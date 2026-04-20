"""
Enrollment Data Agent
Collects monthly Medicaid & CHIP enrollment data from data.medicaid.gov.

Data source: https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360
API: DKAN datastore API (primary), Socrata SODA API (fallback)

The DKAN API returns paginated JSON. We fetch all pages, normalize the
column names (which vary across dataset versions), and compute the
derived metrics the dashboard needs.
"""

import json
import logging
import time
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from json_utils import safe_json_dump
from datetime import datetime, timedelta
from pathlib import Path

import requests
import pandas as pd

try:
    from config import (
        DATASETS, REQUEST_HEADERS, REQUEST_TIMEOUT,
        MAX_RETRIES, RETRY_DELAY, DKAN_PAGE_SIZE,
        SOCRATA_PAGE_SIZE, DATA_DIR, OUTPUT_DIR,
        ENROLLMENT_MONTHS_BACK, ENROLLMENT_MAX_RECORDS,
        ENROLLMENT_DATE_COLUMNS,
    )
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from config import (
        DATASETS, REQUEST_HEADERS, REQUEST_TIMEOUT,
        MAX_RETRIES, RETRY_DELAY, DKAN_PAGE_SIZE,
        SOCRATA_PAGE_SIZE, DATA_DIR, OUTPUT_DIR,
        ENROLLMENT_MONTHS_BACK, ENROLLMENT_MAX_RECORDS,
        ENROLLMENT_DATE_COLUMNS,
    )

logger = logging.getLogger("enrollment_agent")

# ─── Column name mapping ────────────────────────────────────────────
# The dataset columns can appear under different names depending on
# whether we hit the DKAN or Socrata endpoint, and the dataset version.
# This mapping normalizes them all to a consistent set.

COLUMN_ALIASES = {
    # State identification
    "state_abbreviation": "state_code",
    "state_ab": "state_code",
    "state": "state_code",
    # State name
    "state_name": "state_name",
    # Time period
    "report_date": "report_date",
    "year": "year",
    "month": "month",
    # Enrollment figures
    "total_medicaid_enrollment": "medicaid_enrollment",
    "total_medicaid_and_chip_enrollment": "total_enrollment",
    "total_chip_enrollment": "chip_enrollment",
    "separate_chip_enrollment": "chip_enrollment",
    "medicaid_enrollment": "medicaid_enrollment",
    "chip_enrollment": "chip_enrollment",
    # Applications and determinations (bonus data if available)
    "total_applications_received": "applications_received",
    "total_eligibility_determinations": "eligibility_determinations",
}


class EnrollmentAgent:
    """
    Agent responsible for collecting and processing Medicaid enrollment data.

    Pipeline:
    1. Fetch raw enrollment data (tries DKAN first, falls back to Socrata)
    2. Discover and normalize column names
    3. Clean and structure the data
    4. Compute derived metrics (YoY change, trends, rankings)
    5. Output structured JSON for the dashboard frontend
    """

    def __init__(self):
        self.dataset_config = DATASETS["enrollment"]
        self.raw_data_path = DATA_DIR / "enrollment_raw.json"
        self.output_path = OUTPUT_DIR / "enrollment.json"

    # ─── Data Fetching ───────────────────────────────────────────────

    def _request_with_retry(self, url: str, params: dict = None,
                            method: str = "GET", json_body: dict = None) -> dict | list:
        """Make an HTTP request with retry logic."""
        for attempt in range(MAX_RETRIES):
            try:
                logger.info(f"  Request: {method} {url} (attempt {attempt + 1})")
                if method == "POST":
                    resp = requests.post(url, json=json_body, headers=REQUEST_HEADERS,
                                         timeout=REQUEST_TIMEOUT)
                else:
                    resp = requests.get(url, params=params, headers=REQUEST_HEADERS,
                                        timeout=REQUEST_TIMEOUT)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as e:
                logger.warning(f"  Request failed (attempt {attempt + 1}): {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
                else:
                    raise
        return []

    @staticmethod
    def _extract_records(result) -> list[dict]:
        """Unwrap a DKAN query response into a flat list of record dicts."""
        if isinstance(result, list):
            return result
        if not isinstance(result, dict):
            return []
        records = result.get("results", result.get("data", []))
        # Some DKAN versions nest further: results.results
        if isinstance(records, dict):
            records = records.get("results", [])
        return records if isinstance(records, list) else []

    def _probe_schema(self, endpoint: str) -> tuple[list[str], str | None]:
        """
        Fetch a single record to discover the dataset's column names, then
        pick the first date-like column from ENROLLMENT_DATE_COLUMNS.

        Returns (columns, date_column_or_None).
        """
        logger.info("Probing DKAN schema...")
        try:
            result = self._request_with_retry(
                endpoint, method="POST",
                json_body={"limit": 1, "offset": 0},
            )
        except Exception as e:
            logger.warning(f"Schema probe failed: {e}")
            return [], None

        records = self._extract_records(result)
        if not records:
            logger.warning("Schema probe returned no records")
            return [], None

        # Normalize column names for comparison (lowercase, underscores)
        sample = records[0]
        raw_cols = list(sample.keys())
        norm_cols = [c.strip().lower().replace(" ", "_") for c in raw_cols]
        col_map = dict(zip(norm_cols, raw_cols))

        logger.info(f"  Schema columns: {norm_cols}")

        date_col = None
        for candidate in ENROLLMENT_DATE_COLUMNS:
            if candidate in norm_cols:
                date_col = col_map[candidate]  # use the raw-cased name for the API
                break

        # Fallback: any column containing "date" or "period"
        if date_col is None:
            for nc, raw in col_map.items():
                if "date" in nc or "period" in nc or "month" in nc:
                    date_col = raw
                    logger.info(f"  Heuristic date column: {raw}")
                    break

        if date_col:
            logger.info(f"  Using date column: {date_col}")
        else:
            logger.warning("  No date column found — will rely on MAX_RECORDS cap")

        return raw_cols, date_col

    def fetch_dkan(self) -> list[dict]:
        """
        Fetch enrollment data from the DKAN datastore API.

        Strategy:
        1. Probe the schema to find a date-like column.
        2. If found, request only the last ENROLLMENT_MONTHS_BACK months,
           sorted descending so we get the newest data first.
        3. Paginate until we hit either the end of the filtered result set
           or the ENROLLMENT_MAX_RECORDS safety cap.
        """
        endpoint = self.dataset_config.get("dkan_endpoint")
        if not endpoint:
            raise ValueError("No DKAN endpoint configured")

        logger.info(f"Fetching from DKAN API: {endpoint}")

        # Probe the schema before the main fetch
        _cols, date_col = self._probe_schema(endpoint)

        # Build the base query (conditions + sorts) once.
        # `reporting_period` in the CMS enrollment dataset is a YYYYMM
        # string (e.g. "202404"); other date columns we've seen use
        # YYYY-MM-DD. Format the cutoff to match.
        base_query: dict = {}
        if date_col:
            cutoff_dt = datetime.now() - timedelta(days=ENROLLMENT_MONTHS_BACK * 31)
            if date_col.lower() in ("reporting_period", "report_period",
                                    "applications_rpt_mth"):
                cutoff_str = cutoff_dt.strftime("%Y%m")
            else:
                cutoff_str = cutoff_dt.strftime("%Y-%m-%d")
            base_query["conditions"] = [
                {"property": date_col, "value": cutoff_str, "operator": ">="}
            ]
            base_query["sorts"] = [{"property": date_col, "order": "desc"}]
            logger.info(f"  Date filter: {date_col} >= {cutoff_str}")

        all_records: list[dict] = []
        offset = 0
        filter_active = bool(date_col)

        while True:
            # Safety cap — hard stop regardless of filter
            if len(all_records) >= ENROLLMENT_MAX_RECORDS:
                logger.warning(
                    f"  Hit ENROLLMENT_MAX_RECORDS cap ({ENROLLMENT_MAX_RECORDS}). Stopping."
                )
                break

            query_body = {
                **base_query,
                "limit": DKAN_PAGE_SIZE,
                "offset": offset,
            }

            try:
                result = self._request_with_retry(
                    endpoint, method="POST", json_body=query_body
                )
            except Exception as e:
                # If POST with conditions fails (e.g. filter syntax rejected),
                # retry once without the filter — the MAX_RECORDS cap will keep us safe.
                if filter_active and offset == 0:
                    logger.warning(
                        f"  Filtered query failed ({e}); retrying without filter"
                    )
                    base_query = {}
                    filter_active = False
                    continue
                # Also try GET as a fallback for older DKAN versions
                try:
                    params = {"limit": DKAN_PAGE_SIZE, "offset": offset}
                    result = self._request_with_retry(endpoint, params=params)
                except Exception:
                    raise

            records = self._extract_records(result)
            if not records:
                break

            all_records.extend(records)
            logger.info(
                f"  Page fetched: {len(records)} records (total: {len(all_records)})"
            )

            if len(records) < DKAN_PAGE_SIZE:
                break
            offset += DKAN_PAGE_SIZE

        return all_records

    def fetch_socrata(self) -> list[dict]:
        """
        Fallback: fetch from the legacy Socrata SODA API.
        """
        endpoint = self.dataset_config.get("socrata_endpoint")
        if not endpoint:
            raise ValueError("No Socrata endpoint configured")

        logger.info(f"Fetching from Socrata API: {endpoint}")
        all_records = []
        offset = 0

        while True:
            params = {
                "$limit": SOCRATA_PAGE_SIZE,
                "$offset": offset,
                "$order": ":id",
            }
            records = self._request_with_retry(endpoint, params=params)
            if not records:
                break

            all_records.extend(records)
            logger.info(f"  Page fetched: {len(records)} records (total: {len(all_records)})")

            if len(records) < SOCRATA_PAGE_SIZE:
                break
            offset += SOCRATA_PAGE_SIZE

        return all_records

    def fetch_data(self) -> list[dict]:
        """Fetch data, trying DKAN first, then Socrata as fallback."""
        try:
            data = self.fetch_dkan()
            if data:
                logger.info(f"DKAN fetch succeeded: {len(data)} records")
                return data
            logger.warning("DKAN returned no data, trying Socrata fallback")
        except Exception as e:
            logger.warning(f"DKAN fetch failed ({e}), trying Socrata fallback")

        try:
            data = self.fetch_socrata()
            logger.info(f"Socrata fetch succeeded: {len(data)} records")
            return data
        except Exception as e:
            logger.error(f"Both DKAN and Socrata fetches failed: {e}")
            raise

    # ─── Data Processing ─────────────────────────────────────────────

    def normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Discover what columns exist and map them to our standard names.
        This handles the varying column names across API versions.
        """
        # Lowercase all column names first
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        logger.info(f"Raw columns: {list(df.columns)}")

        # Apply aliases
        rename_map = {}
        for raw_col in df.columns:
            if raw_col in COLUMN_ALIASES:
                rename_map[raw_col] = COLUMN_ALIASES[raw_col]

        if rename_map:
            df = df.rename(columns=rename_map)
            logger.info(f"Renamed columns: {rename_map}")

        logger.info(f"Normalized columns: {list(df.columns)}")
        return df

    def clean_and_normalize(self, raw_data: list[dict]) -> pd.DataFrame:
        """Clean raw API data into a structured DataFrame."""
        if not raw_data:
            logger.warning("No raw data to clean")
            return pd.DataFrame()

        df = pd.DataFrame(raw_data)
        logger.info(f"Raw dataframe: {df.shape[0]} rows x {df.shape[1]} cols")

        # Normalize column names
        df = self.normalize_columns(df)

        # Convert numeric columns
        numeric_cols = ["medicaid_enrollment", "chip_enrollment",
                        "total_enrollment", "applications_received",
                        "eligibility_determinations"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # If we have medicaid + chip but not total, compute it
        if "total_enrollment" not in df.columns:
            med = df.get("medicaid_enrollment", 0)
            chip = df.get("chip_enrollment", 0)
            if isinstance(med, pd.Series) and isinstance(chip, pd.Series):
                df["total_enrollment"] = med.fillna(0) + chip.fillna(0)

        # Parse dates: handle "report_date", "reporting_period" (YYYYMM),
        # or separate year/month columns.
        if "report_date" in df.columns:
            df["report_date"] = pd.to_datetime(df["report_date"], errors="coerce")
            df["year"] = df["report_date"].dt.year
            df["month"] = df["report_date"].dt.month
        elif "reporting_period" in df.columns:
            # CMS enrollment dataset packs year and month into a YYYYMM int/str
            rp = pd.to_numeric(df["reporting_period"], errors="coerce")
            df["year"] = (rp // 100).astype("Int64")
            df["month"] = (rp % 100).astype("Int64")
        elif "year" in df.columns and "month" in df.columns:
            df["year"] = pd.to_numeric(df["year"], errors="coerce")
            df["month"] = pd.to_numeric(df["month"], errors="coerce")

        # Drop rows with no state or enrollment data
        if "state_code" in df.columns:
            df = df.dropna(subset=["state_code"])
            # Filter to valid 2-letter state codes
            df = df[df["state_code"].str.len() == 2]

        logger.info(f"Cleaned dataframe: {df.shape[0]} rows, "
                     f"states: {df['state_code'].nunique() if 'state_code' in df.columns else '?'}")
        return df

    def compute_metrics(self, df: pd.DataFrame) -> dict:
        """
        Compute derived metrics for the dashboard:
        - Latest enrollment by state
        - Year-over-year enrollment change
        - Monthly trends (last 24 months)
        - National totals
        """
        now = datetime.now().isoformat()

        if df.empty or "state_code" not in df.columns:
            return {"states": [], "national": {}, "trends": {},
                    "updated": now, "source": "data.medicaid.gov"}

        enrollment_col = "total_enrollment" if "total_enrollment" in df.columns else "medicaid_enrollment"

        if enrollment_col not in df.columns:
            logger.error(f"No enrollment column found. Available: {list(df.columns)}")
            return {"states": [], "national": {}, "trends": {},
                    "updated": now, "error": "no enrollment column"}

        # ── Latest enrollment per state ──
        # Get the most recent record per state
        if "year" in df.columns and "month" in df.columns:
            df_sorted = df.sort_values(["year", "month"], ascending=False)
        else:
            df_sorted = df

        latest_by_state = df_sorted.groupby("state_code").first().reset_index()

        # ── Year-over-year change ──
        states_data = []
        for _, row in latest_by_state.iterrows():
            code = row["state_code"]
            current = row.get(enrollment_col, 0)
            if pd.isna(current):
                current = 0

            # Find the same month one year earlier
            yoy_change = None
            if "year" in row and "month" in row and not pd.isna(row["year"]):
                prior_year = int(row["year"]) - 1
                prior_month = int(row["month"])
                prior = df[(df["state_code"] == code) &
                           (df["year"] == prior_year) &
                           (df["month"] == prior_month)]
                if not prior.empty and prior.iloc[0].get(enrollment_col):
                    prior_val = prior.iloc[0][enrollment_col]
                    if prior_val > 0:
                        yoy_change = round(((current - prior_val) / prior_val) * 100, 1)

            state_entry = {
                "stateCode": code,
                "stateName": row.get("state_name", code),
                "enrollment": int(current) if not pd.isna(current) else 0,
                "enrollmentChange": yoy_change,
                "year": int(row["year"]) if "year" in row and not pd.isna(row["year"]) else None,
                "month": int(row["month"]) if "month" in row and not pd.isna(row["month"]) else None,
            }

            # Include CHIP if available
            if "chip_enrollment" in row and not pd.isna(row.get("chip_enrollment")):
                state_entry["chipEnrollment"] = int(row["chip_enrollment"])
            if "medicaid_enrollment" in row and not pd.isna(row.get("medicaid_enrollment")):
                state_entry["medicaidEnrollment"] = int(row["medicaid_enrollment"])

            states_data.append(state_entry)

        # Sort by enrollment descending
        states_data.sort(key=lambda s: s["enrollment"], reverse=True)

        # ── Monthly trends (last 24 months) ──
        # Drop rows with NaN year/month before astype(int) — pandas Int64
        # with pd.NA raises on astype(int), which previously left the
        # output JSON half-written during json.dump.
        trends = {}
        if "year" in df.columns and "month" in df.columns:
            df_recent = df_sorted.dropna(subset=["year", "month"]).copy()
            if not df_recent.empty:
                df_recent["ym"] = (df_recent["year"].astype(int) * 100
                                   + df_recent["month"].astype(int))
                cutoff_months = sorted(df_recent["ym"].unique(), reverse=True)[:24]
                df_recent = df_recent[df_recent["ym"].isin(cutoff_months)]

                # Deduplicate rows with the same (state, year, month) — CMS
                # sometimes publishes a preliminary and a final record for the
                # same period; keep the first (already sorted newest-first).
                df_recent = df_recent.drop_duplicates(
                    subset=["state_code", "year", "month"], keep="first"
                )

                for code in df_recent["state_code"].unique():
                    state_df = df_recent[df_recent["state_code"] == code].sort_values("ym")
                    trends[code] = [
                        {
                            "month": f"{int(r['year'])}-{int(r['month']):02d}",
                            "value": int(r[enrollment_col]) if not pd.isna(r[enrollment_col]) else 0,
                        }
                        for _, r in state_df.iterrows()
                    ]

        # ── National totals ──
        total_enrollment = sum(s["enrollment"] for s in states_data)
        national = {
            "totalEnrollment": total_enrollment,
            "statesReporting": len(states_data),
            "latestPeriod": (f"{states_data[0]['year']}-{states_data[0]['month']:02d}"
                             if states_data and states_data[0].get("year") else "unknown"),
        }

        return {
            "states": states_data,
            "national": national,
            "trends": trends,
            "updated": now,
            "source": "data.medicaid.gov",
            "record_count": len(df),
        }

    # ─── Persistence ─────────────────────────────────────────────────

    def save_raw(self, data: list[dict]):
        """Save raw API response for debugging and reprocessing."""
        safe_json_dump({
            "fetched_at": datetime.now().isoformat(),
            "record_count": len(data),
            "columns": list(data[0].keys()) if data else [],
            "sample": data[:3] if data else [],
            "data": data,
        }, self.raw_data_path)

    def save_output(self, metrics: dict):
        """Save processed metrics as JSON for the dashboard frontend."""
        safe_json_dump(metrics, self.output_path)

    # ─── Main Pipeline ───────────────────────────────────────────────

    def run(self) -> dict:
        """Execute the full enrollment data pipeline."""
        logger.info("=" * 60)
        logger.info("ENROLLMENT AGENT - Starting pipeline run")
        logger.info("=" * 60)

        start_time = time.time()

        try:
            # Step 1: Fetch from API (DKAN primary, Socrata fallback)
            raw_data = self.fetch_data()

            # Step 2: Save raw data for debugging
            self.save_raw(raw_data)

            # Step 3: Clean and normalize
            df = self.clean_and_normalize(raw_data)

            # Step 4: Compute dashboard metrics
            metrics = self.compute_metrics(df)

            # Step 5: Save processed output
            self.save_output(metrics)

            elapsed = time.time() - start_time
            state_count = len(metrics.get("states", []))
            logger.info(f"Pipeline completed in {elapsed:.1f}s — "
                         f"{len(raw_data)} records, {state_count} states")

            return {
                "status": "success",
                "records": len(raw_data),
                "states": state_count,
                "elapsed_seconds": round(elapsed, 1),
            }

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"Pipeline failed after {elapsed:.1f}s: {e}")
            return {
                "status": "error",
                "error": str(e),
                "elapsed_seconds": round(elapsed, 1),
            }


# ─── CLI entry point ─────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    agent = EnrollmentAgent()
    result = agent.run()
    print(f"\nResult: {json.dumps(result, indent=2)}")
