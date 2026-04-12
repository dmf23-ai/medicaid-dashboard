"""
Managed Care Agent
Collects Medicaid managed care enrollment penetration rates by state from
the CMS Managed Care Enrollment Summary dataset on data.medicaid.gov.

Data source: data.medicaid.gov/dataset/52ed908b-0cb8-5dd2-846d-99d4af12b369
API: DKAN datastore API

The dataset reports, per state and per year, the number of enrollees in
comprehensive and limited-benefit managed care programs. We combine those
with the overall enrollment (from enrollment_agent) to compute a penetration
rate each state.
"""

import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path

import requests
import pandas as pd

# ─── State name → 2-letter code mapping ─────────────────────────────
# The Managed Care Enrollment Summary dataset reports states by full name
# (e.g. "Alabama"), sometimes with a footnote-number suffix ("Arkansas6").
# We normalize both before converting.
STATE_NAME_TO_CODE = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT",
    "delaware": "DE", "florida": "FL", "georgia": "GA", "hawaii": "HI",
    "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME",
    "maryland": "MD", "massachusetts": "MA", "michigan": "MI",
    "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
    "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
    "new york": "NY", "north carolina": "NC", "north dakota": "ND",
    "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA",
    "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
    "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
    "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
}


def _state_name_to_code(raw: str) -> str | None:
    """Normalize a state-name string (possibly with footnote suffix) to a
    2-letter code. Returns None for totals/territories/unrecognized values."""
    if not isinstance(raw, str):
        return None
    # Strip trailing footnote digits and surrounding whitespace
    cleaned = re.sub(r"\d+$", "", raw).strip().lower()
    # If the cleaned value is already a 2-letter code, keep it
    if len(cleaned) == 2 and cleaned.isalpha():
        return cleaned.upper()
    return STATE_NAME_TO_CODE.get(cleaned)

try:
    from config import (
        DATASETS, REQUEST_HEADERS, REQUEST_TIMEOUT,
        MAX_RETRIES, RETRY_DELAY, DKAN_PAGE_SIZE,
        DATA_DIR, OUTPUT_DIR, ALL_STATE_CODES,
    )
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from config import (
        DATASETS, REQUEST_HEADERS, REQUEST_TIMEOUT,
        MAX_RETRIES, RETRY_DELAY, DKAN_PAGE_SIZE,
        DATA_DIR, OUTPUT_DIR, ALL_STATE_CODES,
    )

logger = logging.getLogger("managed_care_agent")

# Column aliases for the Managed Care Enrollment Summary dataset.
# The column names vary across release years, so we map loosely.
#
# NOTE: "state" is renamed to "state_name_raw" (not "state_code") because
# the dataset reports full state names like "Alabama" — we convert those
# to 2-letter codes in a separate step via _state_name_to_code().
COLUMN_ALIASES = {
    "state_abbreviation": "state_code",
    "state_ab": "state_code",
    "state": "state_name_raw",
    "state_name": "state_name_raw",
    "reporting_year": "year",
    "year": "year",
    # Canonical rollup columns used by compute_metrics():
    "total_medicaid_enrollment": "total_medicaid_enrollment",
    "total_medicaid_enrollees": "total_medicaid_enrollment",
    "total_managed_care_enrollment": "total_managed_care_enrollment",
    "total_medicaid_managed_care_enrollment": "total_managed_care_enrollment",
    "total_medicaid_enrollment_in_any_type_of_managed_care": "total_managed_care_enrollment",
    "total_managed_care_enrollees": "total_managed_care_enrollment",
    "comprehensive_risk_based_managed_care": "comprehensive_mc",
    "comprehensive_managed_care_organization_mco": "comprehensive_mc",
    "medicaid_enrollment_in_comprehensive_managed_care": "comprehensive_mc",
    "medicaid_newly_eligible_adults_enrolled_in_comprehensive_mcos": "newly_eligible_adults_mc",
    "primary_care_case_management": "pccm",
    "limited_benefit_managed_care": "limited_mc",
}


class ManagedCareAgent:
    """
    Agent responsible for computing managed care penetration rates per state.
    """

    def __init__(self):
        self.dataset_config = DATASETS.get("managed_care_summary", {})
        self.raw_data_path = DATA_DIR / "managed_care_raw.json"
        self.output_path = OUTPUT_DIR / "managed_care.json"

    # ─── Data Fetching ───────────────────────────────────────────────

    def _request_with_retry(self, url: str, params: dict = None,
                            method: str = "GET", json_body: dict = None):
        """HTTP with retry."""
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

    def fetch_dkan(self) -> list[dict]:
        endpoint = self.dataset_config.get("dkan_endpoint")
        if not endpoint:
            raise ValueError("No DKAN endpoint configured for managed care")

        logger.info(f"Fetching from DKAN API: {endpoint}")
        all_records = []
        offset = 0

        while True:
            query_body = {"limit": DKAN_PAGE_SIZE, "offset": offset}
            try:
                result = self._request_with_retry(endpoint, method="POST",
                                                   json_body=query_body)
            except Exception:
                params = {"limit": DKAN_PAGE_SIZE, "offset": offset}
                result = self._request_with_retry(endpoint, params=params)

            if isinstance(result, dict):
                records = result.get("results", result.get("data", []))
                if isinstance(records, dict):
                    records = records.get("results", [])
            elif isinstance(result, list):
                records = result
            else:
                break

            if not records:
                break

            all_records.extend(records)
            logger.info(f"  Page fetched: {len(records)} records (total: {len(all_records)})")

            if len(records) < DKAN_PAGE_SIZE:
                break
            offset += DKAN_PAGE_SIZE

        return all_records

    # ─── Data Processing ─────────────────────────────────────────────

    def normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        logger.info(f"Raw columns: {list(df.columns)}")

        rename_map = {}
        for raw_col in df.columns:
            if raw_col in COLUMN_ALIASES:
                rename_map[raw_col] = COLUMN_ALIASES[raw_col]
        if rename_map:
            df = df.rename(columns=rename_map)
            logger.info(f"Renamed columns: {rename_map}")
        return df

    def compute_metrics(self, raw_data: list[dict]) -> dict:
        """Compute per-state managed care penetration."""
        now = datetime.now().isoformat()

        if not raw_data:
            return {"states": [], "national": {}, "updated": now,
                    "source": "data.medicaid.gov"}

        df = pd.DataFrame(raw_data)

        df = self.normalize_columns(df)

        # Numeric columns come back as comma-formatted strings (e.g.
        # "1,026,621"); strip commas before pd.to_numeric. Also treat
        # "--", "N/A", etc. as null placeholders.
        numeric_cols = ["year", "total_medicaid_enrollment",
                        "total_managed_care_enrollment",
                        "comprehensive_mc", "pccm", "limited_mc",
                        "newly_eligible_adults_mc"]
        for col in numeric_cols:
            if col in df.columns:
                if not pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = (df[col].astype(str)
                               .str.replace(",", "", regex=False)
                               .str.strip()
                               .replace({"--": None, "N/A": None,
                                         "NA": None, ".": None,
                                         "None": None, "nan": None,
                                         "": None}))
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Derive state_code from the state-name column if the dataset
        # doesn't already provide a 2-letter code.
        if "state_code" not in df.columns and "state_name_raw" in df.columns:
            df["state_code"] = df["state_name_raw"].apply(_state_name_to_code)

        if "state_code" not in df.columns:
            logger.error(f"No state_code column in managed care data. Available: {list(df.columns)}")
            return {"states": [], "national": {}, "updated": now,
                    "source": "data.medicaid.gov",
                    "error": "no state_code column"}

        # Drop rows that couldn't be mapped (TOTALS, territories, unknowns)
        before = len(df)
        df = df.dropna(subset=["state_code"])
        df = df[df["state_code"].str.len() == 2]
        logger.info(f"Filtered to {len(df)} rows with valid state codes "
                    f"(dropped {before - len(df)} totals/territories/unknowns)")

        # Use the most recent year with non-empty managed care data.
        # CMS rolls out MC enrollment gradually — the latest year often has
        # only a handful of early-reporting states, so blindly picking max(year)
        # gives a dashboard where 50 states show N/A. Instead, pick the latest
        # year that has a reasonable number of states reporting.
        if "year" in df.columns and not df["year"].isna().all():
            mc_cols_present = [c for c in ["total_managed_care_enrollment",
                                            "comprehensive_mc", "pccm", "limited_mc"]
                               if c in df.columns]
            if mc_cols_present:
                logger.info(f"MC columns for coverage check: {mc_cols_present}")
                # For each year, count states with any non-zero MC enrollment.
                # Use a numpy-backed approach instead of pd.Series.sum() on
                # each column per state (which silently yields NaN when any
                # column has all-NaN values in some pandas versions).
                year_coverage = {}
                for yr in sorted(df["year"].dropna().unique(), reverse=True):
                    sub = df[df["year"] == yr]
                    # Row-level "has any mc data" check
                    row_total = sub[mc_cols_present].fillna(0).sum(axis=1)
                    states_with_data = sub.loc[row_total > 0, "state_code"].nunique()
                    year_coverage[int(yr)] = int(states_with_data)
                logger.info(f"Managed care state coverage by year: {year_coverage}")
                # Pick the most recent year with at least 20 states reporting.
                # Threshold lowered from 30 → 20 so we still pick a usable
                # year if a subset of states haven't reported yet.
                latest_year = None
                for yr in sorted(year_coverage.keys(), reverse=True):
                    if year_coverage[yr] >= 20:
                        latest_year = yr
                        break
                if latest_year is None:
                    # Final fallback: pick the year with the MAX coverage,
                    # regardless of age. Better to show 2018 data than nothing.
                    latest_year = max(year_coverage, key=year_coverage.get)
                    logger.warning(f"No year had >= 20 states reporting; "
                                   f"falling back to best-coverage year {latest_year} "
                                   f"({year_coverage[latest_year]} states)")
            else:
                latest_year = int(df["year"].max())
            df_latest = df[df["year"] == latest_year]
            logger.info(f"Using managed care data from year {latest_year} "
                        f"({len(df_latest)} rows)")
        else:
            df_latest = df
            latest_year = None

        states_data = []
        for code in df_latest["state_code"].unique():
            rows = df_latest[df_latest["state_code"] == code]

            # Total Medicaid enrollment in this dataset (may be absent)
            total_medicaid = (rows["total_medicaid_enrollment"].sum()
                              if "total_medicaid_enrollment" in rows.columns else 0)

            # Total managed care enrollment: sum whichever MC columns are present
            mc_cols = [c for c in ["total_managed_care_enrollment",
                                   "comprehensive_mc", "pccm", "limited_mc"]
                       if c in rows.columns]
            if "total_managed_care_enrollment" in mc_cols:
                total_mc = rows["total_managed_care_enrollment"].sum()
            else:
                # Sum the components
                total_mc = sum(rows[c].sum() for c in mc_cols if c != "total_managed_care_enrollment")

            if pd.isna(total_mc):
                total_mc = 0
            if pd.isna(total_medicaid):
                total_medicaid = 0

            # Penetration rate (cast to native Python float for JSON safety)
            penetration = None
            if total_medicaid > 0 and total_mc > 0:
                penetration = round(float(total_mc / total_medicaid) * 100, 1)
            elif total_mc > 0:
                # If we don't have total enrollment in this dataset, try to
                # read it from the enrollment_agent output.
                enrollment_path = OUTPUT_DIR / "enrollment.json"
                if enrollment_path.exists():
                    try:
                        with open(enrollment_path) as f:
                            enroll_data = json.load(f)
                        for s in enroll_data.get("states", []):
                            if s["stateCode"] == code and s.get("enrollment", 0) > 0:
                                penetration = round(float(total_mc / s["enrollment"]) * 100, 1)
                                break
                    except Exception:
                        pass

            states_data.append({
                "stateCode": code,
                "managedCareEnrollment": int(total_mc),
                "totalMedicaidEnrollment": int(total_medicaid) if total_medicaid > 0 else None,
                "managedCarePenetration": penetration,
                "year": latest_year,
            })

        states_data.sort(key=lambda s: s.get("managedCarePenetration") or 0, reverse=True)

        # National average penetration
        rates = [s["managedCarePenetration"] for s in states_data
                 if s["managedCarePenetration"] is not None]
        national = {
            "averagePenetration": round(float(sum(rates) / len(rates)), 1) if rates else None,
            "statesReporting": len(rates),
            "year": latest_year,
        }

        return {
            "states": states_data,
            "national": national,
            "updated": now,
            "source": "data.medicaid.gov",
            "record_count": len(df),
        }

    # ─── Persistence ─────────────────────────────────────────────────

    def save_raw(self, data: list[dict]):
        self.raw_data_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.raw_data_path, "w") as f:
            json.dump({
                "fetched_at": datetime.now().isoformat(),
                "record_count": len(data),
                "columns": list(data[0].keys()) if data else [],
                "sample": data[:3] if data else [],
                "data": data,
            }, f, indent=2)
        logger.info(f"Saved raw data to {self.raw_data_path}")

    def save_output(self, metrics: dict):
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.output_path, "w") as f:
            json.dump(metrics, f, indent=2)
        logger.info(f"Saved output to {self.output_path}")

    # ─── Main Pipeline ───────────────────────────────────────────────

    def run(self) -> dict:
        logger.info("=" * 60)
        logger.info("MANAGED CARE AGENT - Starting pipeline run")
        logger.info("=" * 60)

        start_time = time.time()

        try:
            raw_data = self.fetch_dkan()
            self.save_raw(raw_data)
            metrics = self.compute_metrics(raw_data)
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


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    agent = ManagedCareAgent()
    result = agent.run()
    print(f"\nResult: {json.dumps(result, indent=2)}")
