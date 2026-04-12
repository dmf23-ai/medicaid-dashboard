"""
Configuration for the Medicaid Data Pipeline.
Data sources, API endpoints, and pipeline settings.

NOTE: data.medicaid.gov migrated from Socrata to DKAN in 2023-2024.
The DKAN API has a different URL format than the old Socrata SODA API.
We support both formats for resilience.

Dataset distribution IDs below were re-verified via the data.medicaid.gov
catalog in April 2026. If a dataset goes stale, update the `dkan_endpoint`
with the current distribution ID from the dataset page footer.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
PIPELINE_DIR = Path(__file__).parent
APP_ROOT = PIPELINE_DIR.parent
DATA_DIR = PIPELINE_DIR / "data"
OUTPUT_DIR = APP_ROOT / "public" / "data"

# Load .env explicitly from the Next.js app root (one level above the
# pipeline). This avoids relying on python-dotenv's cwd-walking behavior,
# which silently fails if the orchestrator is invoked from a different
# directory.
_env_path = APP_ROOT / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path)
else:
    # Fall back to default cwd-walking behavior so a .env in any parent
    # directory still works.
    load_dotenv()

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Data Source APIs ───────────────────────────────────────────────

# data.medicaid.gov - now uses DKAN API (migrated from Socrata)
MEDICAID_GOV_BASE = "https://data.medicaid.gov"

# Key dataset identifiers on data.medicaid.gov
# Each dataset has a UUID and a distribution ID for the DKAN datastore API.
DATASETS = {
    # State Medicaid & CHIP Applications, Eligibility Determinations, and
    # Enrollment Data.
    # Verified April 2026 via the dataset's published example query URL:
    # /api/1/datastore/query/6165f45b-ca93-5bb5-9d06-db29c692a360/0/download
    # The distribution ID is the same as the dataset UUID for this one.
    # Date column is `reporting_period` in YYYYMM format (e.g. 202404).
    "enrollment": {
        "dkan_endpoint": f"{MEDICAID_GOV_BASE}/api/1/datastore/query/6165f45b-ca93-5bb5-9d06-db29c692a360/0",
        "dataset_url": f"{MEDICAID_GOV_BASE}/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360",
        # Legacy Socrata endpoint (fallback)
        "socrata_endpoint": f"{MEDICAID_GOV_BASE}/resource/bmmj-isbi.json",
        "description": "Monthly Medicaid & CHIP enrollment by state",
        "update_frequency": "monthly",
    },
    # Medicaid expenditure data — state-level total computable and federal
    # share by quarter. The 1b03ec9b distribution returns per-state expenditure
    # rows with columns state / total_computable_all_medical_assistance_expenditures
    # / federal_share_all_medical_assistance_expenditures / quarter_end_date.
    # Verified April 2026 — was previously mislabeled as "quality_adult".
    "expenditures": {
        "dkan_endpoint": f"{MEDICAID_GOV_BASE}/api/1/datastore/query/1b03ec9b-07dd-4547-99a5-aacf206162d5/0",
        "dataset_url": f"{MEDICAID_GOV_BASE}/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f",
        "socrata_endpoint": f"{MEDICAID_GOV_BASE}/resource/mbe2-dntc.json",
        "description": "State Medicaid expenditure data (CAA 2023 FMAP-adjusted)",
        "update_frequency": "quarterly",
    },
    # Medicaid & CHIP Core Set Quality Measures — state-level results.
    # All public DKAN distributions we've tried either 404 or return
    # non-quality data, so this endpoint is intentionally left empty;
    # the quality_agent falls back to curated values from the published
    # CMS Core Set reports.
    "quality_adult": {
        "dkan_endpoint": "",
        "dataset_url": f"{MEDICAID_GOV_BASE}/datasets?topics=Quality%20of%20Care",
        "description": "CMS Adult Core Set quality measures by state",
        "update_frequency": "annual",
    },
    # Same story as quality_adult — the `af5f07f6-...` distribution 404s.
    # Endpoint is intentionally left empty so the quality_agent falls back
    # to curated Child Core Set values from the published CMS report.
    "quality_child": {
        "dkan_endpoint": "",
        "dataset_url": f"{MEDICAID_GOV_BASE}/datasets?topics=Quality%20of%20Care",
        "description": "CMS Child Core Set quality measures by state",
        "update_frequency": "annual",
    },
    # Medicaid Managed Care Enrollment Summary (per-state totals).
    # This is the correct dataset for penetration rates — the `52ed908b-...`
    # distribution ID was previously mislabeled in config as "quality".
    "managed_care_summary": {
        "dkan_endpoint": f"{MEDICAID_GOV_BASE}/api/1/datastore/query/52ed908b-0cb8-5dd2-846d-99d4af12b369/0",
        "dataset_url": f"{MEDICAID_GOV_BASE}/dataset/52ed908b-0cb8-5dd2-846d-99d4af12b369",
        "description": "Medicaid managed care enrollment summary by state",
        "update_frequency": "annual",
    },
    # Managed Care Enrollment by Program and Plan (plan-level detail).
    "managed_care_by_plan": {
        "dkan_endpoint": f"{MEDICAID_GOV_BASE}/api/1/datastore/query/0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe/0",
        "dataset_url": f"{MEDICAID_GOV_BASE}/dataset/0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe",
        "description": "Managed care enrollment by program and plan",
        "update_frequency": "annual",
    },
    # Separate CHIP enrollment
    "chip_enrollment": {
        "dataset_url": f"{MEDICAID_GOV_BASE}/dataset/d30cfc7c-4b32-4df1-b2bf-e0a850befd77",
        "description": "Separate CHIP enrollment by month and state",
        "update_frequency": "monthly",
    },
}

# ─── Signals Sources ────────────────────────────────────────────────
# The signals_agent pulls from external feeds instead of data.medicaid.gov.

SIGNALS_SOURCES = {
    # Federal Register — documents from CMS. Free, no auth, JSON API.
    "federal_register_cms": {
        "endpoint": "https://www.federalregister.gov/api/v1/documents.json",
        "params": {
            "conditions[agencies][]": "centers-for-medicare-medicaid-services",
            "conditions[term]": "Medicaid",
            "order": "newest",
            "per_page": 25,
        },
        "category": "regulatory",
        "source_name": "Federal Register (CMS)",
    },
    # HHS OIG recent reports. No public JSON feed — we parse the HTML listing.
    "oig_reports": {
        "endpoint": "https://oig.hhs.gov/reports/all/",
        "category": "oig",
        "source_name": "HHS OIG Reports",
    },
    # Congress.gov API. Requires a free api.data.gov key for the CONGRESS_API_KEY env var.
    # Without a key the signals_agent will skip this source gracefully.
    "congress_medicaid_bills": {
        "endpoint": "https://api.congress.gov/v3/bill",
        "category": "legislative",
        "source_name": "Congress.gov",
    },
    # Texas Electronic State Business Daily (ESBD) — HHSC solicitations.
    # No public API. Surfaced through the TxSmartBuy search page.
    "texas_esbd": {
        "endpoint": "https://www.txsmartbuy.gov/esbd",
        "category": "procurement",
        "source_name": "Texas ESBD (HHSC)",
    },
    # OhioBuys public opportunity browser. No public API — HTML scrape.
    "ohiobuys_public": {
        "endpoint": "https://ohiobuys.ohio.gov/page.aspx/en/rfp/request_browse_public",
        "category": "procurement",
        "source_name": "OhioBuys",
    },
}

# ─── API Configuration ──────────────────────────────────────────────

# DKAN API does not require authentication.
# Socrata API (legacy) - an app token increases throttle limits but is not required.
SOCRATA_APP_TOKEN = os.getenv("SOCRATA_APP_TOKEN", "")

# Congress.gov API key (free at api.data.gov/signup)
CONGRESS_API_KEY = os.getenv("CONGRESS_API_KEY", "")

# Common request headers
REQUEST_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "MedicaidDashboard/0.1 (research project)",
}
if SOCRATA_APP_TOKEN:
    REQUEST_HEADERS["X-App-Token"] = SOCRATA_APP_TOKEN

# Headers for HTML scraping (procurement sources)
HTML_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": "Mozilla/5.0 (MedicaidDashboard/0.1 research project)",
    "Accept-Language": "en-US,en;q=0.9",
}

# Request settings
REQUEST_TIMEOUT = 30  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

# ─── Pipeline Settings ──────────────────────────────────────────────

# DKAN API pagination: how many records per page
DKAN_PAGE_SIZE = 500

# Socrata fallback pagination
SOCRATA_PAGE_SIZE = 5000

# ─── Enrollment dataset window ──────────────────────────────────────
# The CMS Monthly Medicaid & CHIP Enrollment dataset has ~700k rows going
# back to 2013. We only need the last ~2 years for trends + YoY comparisons,
# so the enrollment_agent applies a server-side date filter when possible
# and a hard record cap as a safety net.
ENROLLMENT_MONTHS_BACK = 24
ENROLLMENT_MAX_RECORDS = 12000  # 50 states × 24 months × a bit of slack

# Candidate column names for the enrollment report date. The agent probes
# the dataset schema and picks the first one it finds. Note that
# `reporting_period` in the CMS enrollment dataset is a YYYYMM string
# (e.g. "202404"), not a full YYYY-MM-DD date — the agent handles both.
ENROLLMENT_DATE_COLUMNS = [
    "reporting_period",
    "final_report_dt",
    "report_date",
    "report_dt",
    "reporting_period_start_date",
    "report_period",
    "applications_rpt_mth",
]

# Maximum signals items to keep per category
SIGNALS_MAX_PER_CATEGORY = 10

# Dashboard expenditure rollup buckets.
# Maps the fine-grained CMS-64 service categories produced by the
# expenditure_agent into the six buckets the SpendingBreakdownChart shows.
EXPENDITURE_ROLLUP = {
    "Managed Care": ["managed_care"],
    "Fee-for-Service": ["inpatient", "outpatient", "physician"],
    "Prescription Drugs": ["pharmacy"],
    "Long-Term Care": ["nursing_facility", "home_health", "home_and_community", "long_term_care"],
    "Behavioral Health": [],  # Not a CMS-64 line item — derived separately if possible
    "Admin & Other": ["administration", "dental", "other_services"],
}

# Which states to always include in the dataset
ALL_STATE_CODES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]

# Claude API for AI-generated briefings
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = "claude-sonnet-4-20250514"

# ─── Logging ─────────────────────────────────────────────────────────

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
