"""
Shared JSON utilities for the Medicaid data pipeline.

The primary purpose is a NaN/Infinity sanitizer that makes pandas-derived
dicts safe for json.dump(), which otherwise silently truncates output when
it encounters float('nan') or float('inf').
"""

import json
import math
import logging
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _sanitize_value(v):
    """Convert a single value to a JSON-safe type."""
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, (pd.Timestamp,)):
        return v.isoformat()
    if isinstance(v, (np.ndarray,)):
        return sanitize(v.tolist())
    if pd.isna(v):
        return None
    return v


def sanitize(obj):
    """Recursively sanitize a Python object for safe JSON serialization.

    Replaces NaN, Infinity, pd.NA, np.nan, and numpy scalar types with
    JSON-compatible equivalents (None for NaN/Inf, int/float for numpy
    scalars).
    """
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, tuple):
        return [sanitize(v) for v in obj]
    return _sanitize_value(obj)


def safe_json_dump(obj, filepath: Path | str, **kwargs):
    """json.dump() wrapper that sanitizes the object first.

    Also re-reads and parses the output to catch any serialization issues
    before they become silent data-loss bugs downstream.
    """
    kwargs.setdefault("indent", 2)
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)

    clean = sanitize(obj)

    with open(filepath, "w") as f:
        json.dump(clean, f, **kwargs)

    # Post-write validation: re-read and parse to confirm well-formed JSON
    try:
        with open(filepath) as f:
            json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"JSON validation failed for {filepath}: {e}")
        raise RuntimeError(
            f"Pipeline produced invalid JSON at {filepath}. "
            f"This is a bug in the sanitizer — please report it. E