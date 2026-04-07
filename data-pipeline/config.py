"""
Configuration for the Medicaid Data Pipeline.
Data sources, API endpoints, and pipeline settings.

NOTE: data.medicaid.gov migrated from Socrata to DKAN in 2023-2024.
The DKAN API has a different URL format than the old Socrata SODA API.
We support both formats for resilience.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base paths
PIPELINE_DIR = Path(__file__).parent
DATA_DIR = PIPELINE_DIR / "data"
OUTPUT_DIR = PIPELINE_DIR.parent / "public" / "data"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Data Source APIs ───────────────────────────────────────────────

# data.medicaid.gov - now uses DKAN API (migrated from Socrata)
MEDICAID_GOV_BASE = "https://data.medicaid.gov"

# Key dataset identifiers on data.medicaid.gov
# Each dataset has a UUID and a distribution ID for the DKAN datastore API.
DATASETS = {
    # State Medicaid and CHIP Applications, Eligibility Determinations,
    # and Enrollment Data (the main enrollment dataset)
    "enrollment": {
        # DKAN API endpoint (primary - use this)
        "dkan_endpoint": f"{MEDICAID_GOV_BASE}/api/1/datastore/query/87ad6d90-2f6f-5dd4-898e-332442baefd8/0",
        # Dataset page for reference
        "dataset_url": f"{MEDICAID_GOV_BASE}/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360",
        # Legacy Socrata endpoint (fallback)
        "socrata_endpoint": f"{MEDICAID_GOV_BASE}/resource/bmmj-isbi.json",
        "description": "Monthly Medicaid & CHIP enrollment by state",
        "update_frequency": "monthly",
    },
    # Medicaid Financial Management / Expenditures (MBES/CBES)
    "expenditures": {
        "dkan_endpoint": f"{MEDICAID_GOV_BASE}/api/1/datastore/query/6ac0cd59-34dd-5a2b-aca9-6f9322fbf7be/0",
        "dataset_url": f"{MEDICAID_GOV_BASE}/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f",
        "socrata_endpoint": f"{MEDICAID_GOV_BASE}/resource/mbe2-dntc.json",
        "description": "State Medicaid expenditure data from CMS-64 (MBES/CBES)",
        "update_frequency": "quarterly",
    },
    # Quality Measures - Adult and Child Core Sets
    "quality": {
        "dkan_endpoint": f"{MEDICAID_GOV_BASE}/api/1/datastore/query/52ed908b-0cb8-5dd2-846d-99d4af12b369/0",
        "dataset_url": f"{MEDICAID_GOV_BASE}/datasets",
        "description": "CMS Core Set quality measures by state",
        "update_frequency": "annual",
    },
    # Separate CHIP enrollment
    "chip_enrollment": {
        "dataset_url": f"{MEDICAID_GOV_BASE}/dataset/d30cfc7c-4b32-4df1-b2bf-e0a850befd77",
        "description": "Separate CHIP enrollment by month and state",
        "update_frequency": "monthly",
    },
}

# ─── API Configuration ──────────────────────────────────────────────

# DKAN API does not require authentication.
# Socrata API (legacy) - an app token increases throttle limits but is not required.
SOCRATA_APP_TOKEN = os.getenv("SOCRATA_APP_TOKEN", "")

# Common request headers
REQUEST_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "MedicaidDashboard/0.1 (research project)",
}
if SOCRATA_APP_TOKEN:
    REQUEST_HEADERS["X-App-Token"] = SOCRATA_APP_TOKEN

# Request settings
REQUEST_TIMEOUT = 30  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

# ─── Pipeline Settings ──────────────────────────────────────────────

# DKAN API pagination: how many records per page
DKAN_PAGE_SIZE = 500

# Socrata fallback pagination
SOCRATA_PAGE_SIZE = 5000

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
