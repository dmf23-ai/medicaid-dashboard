"""
Expenditure Data Agent
Collects state Medicaid spending data from data.medicaid.gov (MBES/CBES).

Data source: Medicaid Financial Management Data
    https://data.medicaid.gov/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f
API: DKAN datastore API (primary), Socrata SODA API (fallback)

The CMS-64 expenditure data breaks down state Medicaid spending by:
- Total computable (federal + state share)
- Federal share (FMAP-based)
- Service categories (inpatient, outpatient, physician, pharmacy, etc.)
"""

import json
import logging
import time
from datetime import datetime
from pathlib import Path

import requests
import pandas as pd

try:
    from config import (
        DATASETS, REQUEST_HEADERS, REQUEST_TIMEOUT,
        MAX_RETRIES, RETRY_DELAY, DKAN_PAGE_SIZE,
        SOCRATA_PAGE_SIZE, DATA_DIR, OUTPUT_DIR,
    )
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from config import (
        DATASETS, REQUEST_HEADERS, REQUEST_TIMEOUT,
        MAX_RETRIES, RETRY_DELAY, DKAN_PAGE_SIZE,
        SOCRATA_PAGE_SIZE, DATA_DIR, OUTPUT_DIR,
    )

logger = logging.getLogger("expenditure_agent")

# ─── Column name mapping ────────────────────────────────────────────
# MBES/CBES datasets use varying column names across versions.

COLUMN_ALIASES = {
    # State
    "state_abbreviation": "state_code",
    "state_ab": "state_code",
    "state": "state_code",
    "state_name": "state_name",
    # Time
    "fiscal_year": "fiscal_year",
    "fy": "fiscal_year",
    "year": "fiscal_year",
    "quarter": "quarter",
    "qtr": "quarter",
    "reporting_period": "reporting_period",
    # Expenditure categories (total computable)
    "total_expenditures": "total_expenditures",
    "total_computable": "total_expenditures",
    "total_medicaid_expenditures": "total_expenditures",
    "medical_assistance_total": "total_expenditures",
    # Federal share
    "federal_share": "federal_share",
    "federal_expenditures": "federal_share",
    "federal_financial_participation": "federal_share",
    "ffp": "federal_share",
    # State share
    "state_share": "state_share",
    "non_federal_share": "state_share",
    # Service category breakdowns
    "inpatient": "inpatient",
    "inpatient_hospital": "inpatient",
    "outpatient": "outpatient",
    "outpatient_hospital": "outpatient",
    "physician": "physician",
    "physician_services": "physician",
    "pharmacy": "pharmacy",
    "prescription_drugs": "pharmacy",
    "prescribed_drugs": "pharmacy",
    "nursing_facility": "nursing_facility",
    "nursing_facilities": "nursing_facility",
    "long_term_care": "long_term_care",
    "managed_care": "managed_care",
    "managed_care_premiums": "managed_care",
    "home_health": "home_health",
    "home_and_community": "home_and_community",
    "dental": "dental",
    "dental_services": "dental",
    "other_services": "other_services",
    "administration": "administration",
    "admin": "administration",
    "administrative_costs": "administration",
    # Program type
    "program": "program",
    "program_name": "program",
    "service_category": "service_category",
    "category_of_service": "service_category",
    "item": "service_category",
}

# Service categories we want to capture and display
SERVICE_CATEGORIES = [
    "inpatient", "outpatient", "physician", "pharmacy",
    "nursing_facility", "managed_care", "home_health",
    "home_and_community", "dental", "long_term_care",
    "administration", "other_services",
]


class ExpenditureAgent:
    """
    Agent responsible for collecting and processing Medicaid expenditure data.

    Pipeline:
    1. Fetch raw expenditure data (tries DKAN first, falls back to Socrata)
    2. Normalize column names
    3. Clean and structure the data
    4. Compute per-state and per-enrollee spending metrics
    5. Output structured JSON for the dashboard frontend
    """

    def __init__(self):
        self.dataset_config = DATASETS["expenditures"]
        self.raw_data_path = DATA_DIR / "expenditure_raw.json"
        self.output_path = OUTPUT_DIR / "expenditure.json"

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

    def fetch_dkan(self) -> list[dict]:
        """Fetch expenditure data from the DKAN datastore API."""
        endpoint = self.dataset_config.get("dkan_endpoint")
        if not endpoint:
            raise ValueError("No DKAN endpoint configured for expenditures")

        logger.info(f"Fetching from DKAN API: {endpoint}")
        all_records = []
        offset = 0

        while True:
            query_body = {
                "limit": DKAN_PAGE_SIZE,
                "offset": offset,
                "sort": {"descending": True},
            }

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

    def fetch_socrata(self) -> list[dict]:
        """Fallback: fetch from the legacy Socrata SODA API."""
        endpoint = self.dataset_config.get("socrata_endpoint")
        if not endpoint:
            raise ValueError("No Socrata endpoint configured for expenditures")

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
        """Map raw column names to our standard names."""
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        logger.info(f"Raw columns: {list(df.columns)}")

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
            logger.warning("No raw expenditure data to clean")
            return pd.DataFrame()

        df = pd.DataFrame(raw_data)
        logger.info(f"Raw dataframe: {df.shape[0]} rows x {df.shape[1]} cols")

        df = self.normalize_columns(df)

        # Convert numeric columns
        numeric_cols = ["total_expenditures", "federal_share", "state_share",
                        "fiscal_year", "quarter"] + SERVICE_CATEGORIES
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Filter to valid state codes
        if "state_code" in df.columns:
            df = df.dropna(subset=["state_code"])
            df = df[df["state_code"].str.len() == 2]

        logger.info(f"Cleaned dataframe: {df.shape[0]} rows, "
                     f"states: {df['state_code'].nunique() if 'state_code' in df.columns else '?'}")
        return df

    def compute_metrics(self, df: pd.DataFrame, enrollment_data: dict = None) -> dict:
        """
        Compute spending metrics for the dashboard:
        - Total expenditures per state
        - Per-enrollee spending (if enrollment data available)
        - Spending breakdown by category
        - Federal vs state share
        - Year-over-year spending change
        """
        now = datetime.now().isoformat()

        if df.empty or "state_code" not in df.columns:
            return {"states": [], "national": {}, "updated": now, "source": "data.medicaid.gov"}

        # Determine which fiscal year to use (most recent available)
        if "fiscal_year" in df.columns:
            latest_fy = df["fiscal_year"].max()
            prior_fy = latest_fy - 1
            df_latest = df[df["fiscal_year"] == latest_fy]
            df_prior = df[df["fiscal_year"] == prior_fy]
            logger.info(f"Using FY {int(latest_fy)} (prior: FY {int(prior_fy)})")
        else:
            df_latest = df
            df_prior = pd.DataFrame()
            latest_fy = None

        # Load enrollment data to compute per-enrollee spending
        enrollment_by_state = {}
        if enrollment_data:
            for s in enrollment_data.get("states", []):
                enrollment_by_state[s["stateCode"]] = s["enrollment"]
        else:
            # Try to load from the enrollment agent's output
            enrollment_path = OUTPUT_DIR / "enrollment.json"
            if enrollment_path.exists():
                try:
                    with open(enrollment_path) as f:
                        enroll = json.load(f)
                    for s in enroll.get("states", []):
                        enrollment_by_state[s["stateCode"]] = s["enrollment"]
                    logger.info(f"Loaded enrollment data for {len(enrollment_by_state)} states")
                except Exception as e:
                    logger.warning(f"Could not load enrollment data: {e}")

        # Aggregate expenditure by state for the latest fiscal year
        # Some datasets have one row per state; others have one row per category
        states_data = []

        if "service_category" in df_latest.columns and "total_expenditures" in df_latest.columns:
            # Data is broken out by service category — aggregate per state
            state_totals = df_latest.groupby("state_code")["total_expenditures"].sum().reset_index()
            state_totals.columns = ["state_code", "total_expenditures"]

            # Also capture category breakdowns
            category_pivot = df_latest.pivot_table(
                index="state_code",
                columns="service_category",
                values="total_expenditures",
                aggfunc="sum"
            ).fillna(0)
        else:
            # One row per state already
            state_totals = df_latest.groupby("state_code").agg({
                "total_expenditures": "sum",
                **{cat: "sum" for cat in SERVICE_CATEGORIES if cat in df_latest.columns}
            }).reset_index()
            category_pivot = None

        for _, row in state_totals.iterrows():
            code = row["state_code"]
            total = row.get("total_expenditures", 0)
            if pd.isna(total):
                total = 0

            # Federal vs state share
            state_row = df_latest[df_latest["state_code"] == code]
            federal = state_row["federal_share"].sum() if "federal_share" in state_row.columns else 0
            state_share = state_row["state_share"].sum() if "state_share" in state_row.columns else 0

            # Per-enrollee spending
            enrollment = enrollment_by_state.get(code, 0)
            per_enrollee = round(total / enrollment, 2) if enrollment > 0 else None

            # YoY change
            yoy_change = None
            if not df_prior.empty:
                prior_total = df_prior[df_prior["state_code"] == code]
                if not prior_total.empty:
                    prior_val = prior_total["total_expenditures"].sum()
                    if prior_val > 0:
                        yoy_change = round(((total - prior_val) / prior_val) * 100, 1)

            # Category breakdown
            breakdown = {}
            if category_pivot is not None and code in category_pivot.index:
                for cat in SERVICE_CATEGORIES:
                    if cat in category_pivot.columns:
                        val = category_pivot.loc[code, cat]
                        if val > 0:
                            breakdown[cat] = float(val)
            else:
                for cat in SERVICE_CATEGORIES:
                    if cat in row and not pd.isna(row.get(cat)) and row.get(cat, 0) > 0:
                        breakdown[cat] = float(row[cat])

            entry = {
                "stateCode": code,
                "totalExpenditures": float(total),
                "federalShare": float(federal) if not pd.isna(federal) else 0,
                "stateShare": float(state_share) if not pd.isna(state_share) else 0,
                "perEnrolleeSpending": per_enrollee,
                "spendingChange": yoy_change,
                "enrollment": enrollment if enrollment > 0 else None,
                "breakdown": breakdown if breakdown else None,
            }
            states_data.append(entry)

        # Sort by total expenditures descending
        states_data.sort(key=lambda s: s["totalExpenditures"], reverse=True)

        # National totals
        national_total = sum(s["totalExpenditures"] for s in states_data)
        national_federal = sum(s["federalShare"] for s in states_data)
        total_enrollment = sum(enrollment_by_state.values()) if enrollment_by_state else 0
        national_per_enrollee = round(national_total / total_enrollment, 2) if total_enrollment > 0 else None

        return {
            "states": states_data,
            "national": {
                "totalExpenditures": national_total,
                "federalShare": national_federal,
                "perEnrolleeSpending": national_per_enrollee,
                "statesReporting": len(states_data),
                "fiscalYear": int(latest_fy) if latest_fy and not pd.isna(latest_fy) else None,
            },
            "updated": now,
            "source": "data.medicaid.gov",
            "record_count": len(df),
        }

    # ─── Persistence ─────────────────────────────────────────────────

    def save_raw(self, data: list[dict]):
        """Save raw API response for debugging."""
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
        """Save processed metrics as JSON for the dashboard frontend."""
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.output_path, "w") as f:
            json.dump(metrics, f, indent=2)
        logger.info(f"Saved output to {self.output_path}")

    # ─── Main Pipeline ───────────────────────────────────────────────

    def run(self) -> dict:
        """Execute the full expenditure data pipeline."""
        logger.info("=" * 60)
        logger.info("EXPENDITURE AGENT - Starting pipeline run")
        logger.info("=" * 60)

        start_time = time.time()

        try:
            raw_data = self.fetch_data()
            self.save_raw(raw_data)
            df = self.clean_and_normalize(raw_data)
            metrics = self.compute_metrics(df)
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
    agent = ExpenditureAgent()
    result = agent.run()
    print(f"\nResult: {json.dumps(result, indent=2)}")
