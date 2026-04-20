"""
Signals Agent
Collects early-warning signals relevant to Texas Medicaid / Accenture BusOps
from five external sources:

    1. Federal Register API — CMS rulemaking and notices
    2. HHS OIG reports listing — audits, evaluations, advisories
    3. Congress.gov API — pending Medicaid legislation (optional; needs key)
    4. Texas ESBD via TxSmartBuy — HHSC solicitations (HTML scrape)
    5. OhioBuys public browser — Ohio Medicaid procurement (HTML scrape)

Each fetcher returns a list of raw items; the agent normalizes them into
the `SignalItem` shape the dashboard expects and writes signals.json.

Fetchers that fail are logged and skipped — the pipeline never dies because
a single source is down. If every source fails, the agent writes an empty
signals list rather than crashing.
"""

import json
import sys as _sys
from pathlib import Path as _P
_sys.path.insert(0, str(_P(__file__).resolve().parent.parent))
from json_utils import safe_json_dump
import logging
import re
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin

import requests

try:
    from config import (
        SIGNALS_SOURCES, REQUEST_HEADERS, HTML_HEADERS,
        REQUEST_TIMEOUT, MAX_RETRIES, RETRY_DELAY,
        CONGRESS_API_KEY, DATA_DIR, OUTPUT_DIR, SIGNALS_MAX_PER_CATEGORY,
    )
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from config import (
        SIGNALS_SOURCES, REQUEST_HEADERS, HTML_HEADERS,
        REQUEST_TIMEOUT, MAX_RETRIES, RETRY_DELAY,
        CONGRESS_API_KEY, DATA_DIR, OUTPUT_DIR, SIGNALS_MAX_PER_CATEGORY,
    )

logger = logging.getLogger("signals_agent")

# Keywords used to filter Federal Register and Congress results down to
# things Accenture's Texas BusOps team would actually care about.
MEDICAID_KEYWORDS = [
    "medicaid", "chip", "managed care", "mco", "waiver", "1115",
    "eligibility", "enrollment", "fmap", "provider",
]


class SignalsAgent:
    """
    Pulls external signals into a single normalized feed for the dashboard.
    """

    def __init__(self):
        self.raw_data_path = DATA_DIR / "signals_raw.json"
        self.output_path = OUTPUT_DIR / "signals.json"

    # ─── Generic HTTP helper ─────────────────────────────────────────

    def _request(self, url: str, params: dict = None, headers: dict = None,
                 is_json: bool = True):
        """HTTP GET with retry. Returns parsed JSON or text."""
        hdrs = headers or REQUEST_HEADERS
        for attempt in range(MAX_RETRIES):
            try:
                resp = requests.get(url, params=params, headers=hdrs,
                                    timeout=REQUEST_TIMEOUT)
                resp.raise_for_status()
                return resp.json() if is_json else resp.text
            except requests.exceptions.RequestException as e:
                logger.warning(f"  Request failed (attempt {attempt + 1}): {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
                else:
                    raise
        return None

    # ─── Source 1: Federal Register ──────────────────────────────────

    def fetch_federal_register(self) -> list[dict]:
        """Fetch recent CMS-tagged Federal Register documents."""
        cfg = SIGNALS_SOURCES["federal_register_cms"]
        try:
            # Prefer JSON format; the example URL in config uses RSS but the
            # documents.json endpoint accepts identical parameters.
            result = self._request(cfg["endpoint"], params=cfg["params"])
        except Exception as e:
            logger.warning(f"Federal Register fetch failed: {e}")
            return []

        if not result or "results" not in result:
            return []

        items = []
        for doc in result["results"][:SIGNALS_MAX_PER_CATEGORY * 2]:
            title = doc.get("title", "").strip()
            abstract = doc.get("abstract") or ""
            pub_date = doc.get("publication_date", "")
            html_url = doc.get("html_url") or doc.get("pdf_url") or cfg["endpoint"]
            doc_type = doc.get("type", "")

            # Filter: must mention Medicaid-adjacent keywords in title or abstract
            searchable = f"{title} {abstract}".lower()
            if not any(k in searchable for k in MEDICAID_KEYWORDS):
                continue

            # Skip routine CMS paperwork notices — these are generic
            # info-collection requests that clutter the feed with identical
            # titles while providing no actionable intelligence.
            routine_prefixes = (
                "Agency Information Collection Activities",
            )
            if title.startswith(routine_prefixes):
                continue

            items.append({
                "id": f"fr-{doc.get('document_number', pub_date)}",
                "title": title[:200],
                "summary": (abstract[:280] + ("…" if len(abstract) > 280 else "")) or doc_type,
                "source": cfg["source_name"],
                "sourceUrl": html_url,
                "category": cfg["category"],
                "relevance": "high" if "medicaid" in searchable else "medium",
                "timestamp": pub_date,
            })

            if len(items) >= SIGNALS_MAX_PER_CATEGORY:
                break

        logger.info(f"Federal Register: {len(items)} signals")
        return items

    # ─── Source 2: HHS OIG Reports ───────────────────────────────────

    def fetch_oig_reports(self) -> list[dict]:
        """Scrape the HHS OIG reports listing for Medicaid-related items."""
        cfg = SIGNALS_SOURCES["oig_reports"]
        try:
            html = self._request(cfg["endpoint"], headers=HTML_HEADERS, is_json=False)
        except Exception as e:
            logger.warning(f"OIG reports fetch failed: {e}")
            return self._oig_fallback()

        if not html:
            logger.info("OIG reports: empty response body")
            return self._oig_fallback()

        logger.info(f"OIG reports: fetched {len(html)} chars of HTML")

        items: list[dict] = []

        # Try two link patterns — modern OIG pages sometimes use /reports/all
        # and sometimes /oas, /oei. Match anything under the reports path.
        pattern = re.compile(
            r'<a[^>]+href="(?P<href>/(?:reports|oas|oei)/[^"]+)"[^>]*>(?P<title>[^<]{10,300})</a>',
            re.IGNORECASE,
        )
        date_pattern = re.compile(r'<time[^>]*datetime="(?P<date>[\d-]+)"', re.IGNORECASE)
        date_list = [m.group("date") for m in date_pattern.finditer(html)]

        all_matches = list(pattern.finditer(html))
        logger.info(f"OIG reports: regex matched {len(all_matches)} anchors")

        seen = set()
        medicaid_kw = {"medicaid", "chip", "managed care", "mco", "waiver",
                       "1115", "eligibility", "provider"}

        for idx, m in enumerate(all_matches):
            title = re.sub(r"\s+", " ", m.group("title")).strip()
            href = m.group("href")
            if href in seen or not title:
                continue
            seen.add(href)

            # Keyword match on the anchor text OR a surrounding context
            # window (±400 chars). The OIG listing often puts the topic
            # label (e.g. "Medicaid") in a sibling element adjacent to the
            # anchor, not inside the anchor text itself.
            window_start = max(0, m.start() - 400)
            window_end = min(len(html), m.end() + 400)
            context = html[window_start:window_end].lower()
            if not any(k in context for k in medicaid_kw):
                continue

            ts = date_list[idx] if idx < len(date_list) else ""

            items.append({
                "id": f"oig-{href.rsplit('/', 1)[-1]}",
                "title": title[:200],
                "summary": f"HHS Office of Inspector General report: {title[:220]}",
                "source": cfg["source_name"],
                "sourceUrl": urljoin("https://oig.hhs.gov", href),
                "category": cfg["category"],
                "relevance": "high",
                "timestamp": ts,
            })

            if len(items) >= SIGNALS_MAX_PER_CATEGORY:
                break

        logger.info(f"OIG reports: {len(items)} signals after filter")

        if not items:
            return self._oig_fallback()
        return items

    def _oig_fallback(self) -> list[dict]:
        """Verified landing-page signals when the scraper misses.
        Points users at the OIG Medicaid portfolio page where they can
        browse current reports manually."""
        today = datetime.now().strftime("%Y-%m-%d")
        return [
            {
                "id": "oig-portfolio-medicaid",
                "title": "HHS OIG Medicaid Portfolio — active oversight docket",
                "summary": "Browse current HHS OIG Medicaid audits, evaluations, and advisories. Scraper fell back; visit directly for the latest items.",
                "source": "HHS OIG (portfolio page)",
                "sourceUrl": "https://oig.hhs.gov/reports/",
                "category": "oig",
                "relevance": "medium",
                "timestamp": today,
            },
            {
                "id": "oig-workplan",
                "title": "HHS OIG Work Plan — in-progress Medicaid items",
                "summary": "The OIG Work Plan lists audits and evaluations underway; filter to Medicaid & CHIP for upcoming report drops.",
                "source": "HHS OIG (work plan)",
                "sourceUrl": "https://oig.hhs.gov/reports/work-plan/",
                "category": "oig",
                "relevance": "medium",
                "timestamp": today,
            },
        ]

    # ─── Source 3: Congress.gov ──────────────────────────────────────

    def fetch_congress_bills(self) -> list[dict]:
        """Fetch recent Medicaid-related bills from the Congress.gov API."""
        if not CONGRESS_API_KEY:
            logger.info("Congress.gov: skipping (no CONGRESS_API_KEY set)")
            return []

        cfg = SIGNALS_SOURCES["congress_medicaid_bills"]
        # Congress.gov has no single "keyword" endpoint; use /bill/{congress}/{type}
        # and filter client-side. We try the most recent Congress.
        current_congress = 119  # 119th Congress as of 2026
        endpoint = f"{cfg['endpoint']}/{current_congress}"

        try:
            result = self._request(endpoint, params={
                "api_key": CONGRESS_API_KEY,
                "limit": 100,
                "sort": "updateDate+desc",
                "format": "json",
            })
        except Exception as e:
            logger.warning(f"Congress.gov fetch failed: {e}")
            return []

        if not result or "bills" not in result:
            return []

        items = []
        for bill in result.get("bills", []):
            title = bill.get("title", "").strip()
            if not any(k in title.lower() for k in MEDICAID_KEYWORDS):
                continue

            bill_number = f"{bill.get('type', '')}.{bill.get('number', '')}"
            update_date = bill.get("updateDate", "")
            congress_url = bill.get("url", "")

            # The API url points back at the API; convert to the public page.
            public_url = (f"https://www.congress.gov/bill/{current_congress}th-congress/"
                          f"{(bill.get('type') or '').lower()}-bill/{bill.get('number')}")

            items.append({
                "id": f"cng-{bill_number}",
                "title": f"{bill_number}: {title[:180]}",
                "summary": title[:280],
                "source": cfg["source_name"],
                "sourceUrl": public_url,
                "category": cfg["category"],
                "relevance": "medium",
                "timestamp": update_date,
            })

            if len(items) >= SIGNALS_MAX_PER_CATEGORY:
                break

        logger.info(f"Congress.gov: {len(items)} signals")
        return items

    # ─── Source 4: Texas ESBD (HHSC solicitations) ───────────────────

    def fetch_texas_esbd(self) -> list[dict]:
        """Scrape the TxSmartBuy ESBD search for open HHSC Medicaid solicitations."""
        cfg = SIGNALS_SOURCES["texas_esbd"]

        try:
            html = self._request(cfg["endpoint"], headers=HTML_HEADERS, is_json=False)
        except Exception as e:
            logger.warning(f"Texas ESBD fetch failed: {e}")
            return self._esbd_fallback()

        if not html:
            logger.info("Texas ESBD: empty response body")
            return self._esbd_fallback()

        logger.info(f"Texas ESBD: fetched {len(html)} chars of HTML")

        pattern = re.compile(
            r'<a[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<text>[^<]{15,250})</a>',
            re.IGNORECASE,
        )
        hhsc_keywords = ["hhsc", "health and human services", "medicaid",
                         "tmhp", "star+plus", "chip", "managed care"]

        all_matches = list(pattern.finditer(html))
        logger.info(f"Texas ESBD: regex matched {len(all_matches)} anchors")

        items: list[dict] = []
        seen = set()
        for m in all_matches:
            text = re.sub(r"\s+", " ", m.group("text")).strip()
            href = m.group("href")

            # Keyword match on anchor text OR ±400-char HTML context window —
            # ESBD listing table cells put the agency name in adjacent <td>s,
            # not inside the anchor text.
            window_start = max(0, m.start() - 400)
            window_end = min(len(html), m.end() + 400)
            context = html[window_start:window_end].lower()
            if not any(k in context for k in hhsc_keywords):
                continue
            if href in seen or text.lower() in ("home", "search", "login"):
                continue
            seen.add(href)

            full_url = href if href.startswith("http") else urljoin(cfg["endpoint"], href)

            items.append({
                "id": f"esbd-{len(items) + 1}",
                "title": text[:200],
                "summary": f"Texas HHSC solicitation surfaced on the ESBD: {text[:220]}",
                "source": cfg["source_name"],
                "sourceUrl": full_url,
                "category": cfg["category"],
                "relevance": "high",
                "timestamp": datetime.now().strftime("%Y-%m-%d"),
                "affectedStates": ["TX"],
            })

            if len(items) >= SIGNALS_MAX_PER_CATEGORY:
                break

        logger.info(f"Texas ESBD: {len(items)} signals after filter")

        if not items:
            return self._esbd_fallback()
        return items

    def _esbd_fallback(self) -> list[dict]:
        """Verified landing-page signals when the ESBD scraper misses.
        TxSmartBuy and the HHSC opportunities page are JS-rendered, so a
        plain HTTP fetch usually returns a SPA shell with no items. We
        point the user at the canonical HHSC procurement landing pages."""
        today = datetime.now().strftime("%Y-%m-%d")
        return [
            {
                "id": "hhsc-opportunities",
                "title": "Texas HHSC Procurement Opportunities portal",
                "summary": "Active solicitations and pre-procurement notices from Texas Health and Human Services Commission. Filter by Medicaid Operations / TMHP / STAR program.",
                "source": "Texas HHSC (Procurement)",
                "sourceUrl": "https://www.hhs.texas.gov/business/contracting-hhs",
                "category": "procurement",
                "relevance": "high",
                "timestamp": today,
                "affectedStates": ["TX"],
            },
            {
                "id": "txsmartbuy-esbd",
                "title": "Texas Electronic State Business Daily (ESBD) — search portal",
                "summary": "Statewide solicitation search. Filter by HHSC agency code and 'Medical Services' category for current Medicaid awards and renewals.",
                "source": "Texas ESBD (TxSmartBuy)",
                "sourceUrl": "https://www.txsmartbuy.gov/esbd",
                "category": "procurement",
                "relevance": "medium",
                "timestamp": today,
                "affectedStates": ["TX"],
            },
        ]

    # ─── Source 5: OhioBuys public browser ───────────────────────────

    def fetch_ohiobuys(self) -> list[dict]:
        """Scrape the OhioBuys public RFP browser for Medicaid-adjacent items."""
        cfg = SIGNALS_SOURCES["ohiobuys_public"]
        try:
            html = self._request(cfg["endpoint"], headers=HTML_HEADERS, is_json=False)
        except Exception as e:
            logger.warning(f"OhioBuys fetch failed: {e}")
            return self._ohiobuys_fallback()

        if not html:
            logger.info("OhioBuys: empty response body")
            return self._ohiobuys_fallback()

        logger.info(f"OhioBuys: fetched {len(html)} chars of HTML")

        pattern = re.compile(
            r'<a[^>]+href="(?P<href>[^"]*rfp[^"]*)"[^>]*>(?P<text>[^<]{10,200})</a>',
            re.IGNORECASE,
        )
        ohio_keywords = ["medicaid", "mco", "managed care", "dodd", "odh",
                         "odm", "department of medicaid", "health", "behavioral",
                         "star+plus"]

        all_matches = list(pattern.finditer(html))
        logger.info(f"OhioBuys: regex matched {len(all_matches)} anchors")

        items: list[dict] = []
        seen = set()
        for m in all_matches:
            text = re.sub(r"\s+", " ", m.group("text")).strip()
            href = m.group("href")

            # Keyword match on anchor text OR ±400-char HTML context window
            window_start = max(0, m.start() - 400)
            window_end = min(len(html), m.end() + 400)
            context = html[window_start:window_end].lower()
            if not any(k in context for k in ohio_keywords):
                continue
            if href in seen:
                continue
            seen.add(href)

            full_url = href if href.startswith("http") else urljoin(cfg["endpoint"], href)

            items.append({
                "id": f"ohiobuys-{len(items) + 1}",
                "title": text[:200],
                "summary": f"OhioBuys public solicitation: {text[:220]}",
                "source": cfg["source_name"],
                "sourceUrl": full_url,
                "category": cfg["category"],
                "relevance": "medium",
                "timestamp": datetime.now().strftime("%Y-%m-%d"),
                "affectedStates": ["OH"],
            })

            if len(items) >= SIGNALS_MAX_PER_CATEGORY:
                break

        logger.info(f"OhioBuys: {len(items)} signals after filter")

        if not items:
            return self._ohiobuys_fallback()
        return items

    def _ohiobuys_fallback(self) -> list[dict]:
        """Verified landing-page signal for OhioBuys when the scraper misses."""
        today = datetime.now().strftime("%Y-%m-%d")
        return [
            {
                "id": "ohiobuys-public",
                "title": "OhioBuys public RFP browser — Ohio Department of Medicaid track",
                "summary": "Browse Ohio Department of Medicaid procurement opportunities and active RFPs. Page is JS-rendered; scraper fell back, visit directly for current items.",
                "source": "OhioBuys",
                "sourceUrl": "https://ohiobuys.ohio.gov/page.aspx/en/rfp/request_browse_public",
                "category": "procurement",
                "relevance": "low",
                "timestamp": today,
                "affectedStates": ["OH"],
            },
        ]

    # ─── Aggregation ─────────────────────────────────────────────────

    def aggregate(self) -> dict:
        """Run every fetcher, combine the results, and rank them."""
        now = datetime.now().isoformat()

        all_signals: list[dict] = []
        errors: dict[str, str] = {}

        fetchers = [
            ("federal_register", self.fetch_federal_register),
            ("oig_reports", self.fetch_oig_reports),
            ("congress", self.fetch_congress_bills),
            ("texas_esbd", self.fetch_texas_esbd),
            ("ohiobuys", self.fetch_ohiobuys),
        ]

        for name, fn in fetchers:
            try:
                signals = fn()
                all_signals.extend(signals)
            except Exception as e:
                logger.error(f"Fetcher {name} crashed: {e}")
                errors[name] = str(e)

        # Sort by timestamp descending (newest first), then relevance
        def sort_key(item: dict):
            ts = item.get("timestamp") or "0"
            rel_rank = {"high": 0, "medium": 1, "low": 2}.get(item.get("relevance"), 3)
            return (ts, -rel_rank)

        all_signals.sort(key=sort_key, reverse=True)

        # Deduplicate by title — when multiple signals share the same title
        # (common with Federal Register routine notices), keep the most recent.
        seen_titles: set[str] = set()
        deduped: list[dict] = []
        for sig in all_signals:
            t = sig.get("title", "")
            if t in seen_titles:
                continue
            seen_titles.add(t)
            deduped.append(sig)
        all_signals = deduped

        return {
            "signals": all_signals,
            "national": {
                "totalSignals": len(all_signals),
                "byCategory": self._count_by_field(all_signals, "category"),
                "byRelevance": self._count_by_field(all_signals, "relevance"),
            },
            "errors": errors,
            "updated": now,
            "source": "aggregated",
        }

    @staticmethod
    def _count_by_field(items: list[dict], field: str) -> dict:
        counts: dict = {}
        for it in items:
            key = it.get(field) or "unknown"
            counts[key] = counts.get(key, 0) + 1
        return counts

    # ─── Persistence ─────────────────────────────────────────────────

    def save_raw(self, metrics: dict):
        safe_json_dump({
            "fetched_at": datetime.now().isoformat(),
            "signal_count": len(metrics.get("signals", [])),
            "sample": metrics.get("signals", [])[:3],
            "errors": metrics.get("errors", {}),
        }, self.raw_data_path)

    def save_output(self, metrics: dict):
        safe_json_dump(metrics, self.output_path)

    # ─── Main Pipeline ───────────────────────────────────────────────

    def run(self) -> dict:
        logger.info("=" * 60)
        logger.info("SIGNALS AGENT - Starting pipeline run")
        logger.info("=" * 60)

        start_time = time.time()

        try:
            metrics = self.aggregate()
            self.save_raw(metrics)
            self.save_output(metrics)

            elapsed = time.time() - start_time
            signal_count = len(metrics.get("signals", []))
            err_count = len(metrics.get("errors", {}))
            logger.info(f"Pipeline completed in {elapsed:.1f}s — "
                        f"{signal_count} signals, {err_count} source errors")

            return {
                "status": "success" if signal_count > 0 else "partial",
                "signals": signal_count,
                "errors": metrics.get("errors", {}),
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
    agent = SignalsAgent()
    result = agent.run()
    print(f"\nResult: {json.dumps(result, indent=2)}")
