"""
Intelligence Agent
Generates AI-powered briefings, anomaly alerts, and executive summaries
using the Claude API, based on data collected by the other pipeline agents.

This agent reads the output of the enrollment, expenditure, and quality
agents, synthesizes the data, and produces:
1. Executive summary (2-3 paragraph briefing for leadership)
2. State spotlight for Texas (anchor state analysis)
3. Anomaly alerts (unusual trends or outliers worth flagging)
4. Comparative insights (cross-state patterns)

The output feeds the dashboard's AI Briefings panel and Alerts feed.
"""

import json
import logging
import time
from datetime import datetime
from pathlib import Path

try:
    from config import (
        ANTHROPIC_API_KEY, CLAUDE_MODEL,
        DATA_DIR, OUTPUT_DIR,
    )
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from config import (
        ANTHROPIC_API_KEY, CLAUDE_MODEL,
        DATA_DIR, OUTPUT_DIR,
    )

from json_utils import safe_json_dump

logger = logging.getLogger("intelligence_agent")

# ─── Prompt templates ───────────────────────────────────────────────

EXECUTIVE_SUMMARY_PROMPT = """\
You are a senior Medicaid policy analyst preparing a briefing for state health program leadership.
Analyze the following data and produce a concise executive summary (2-3 paragraphs).

Focus on:
- Overall enrollment trends (national and key states)
- Spending patterns and per-enrollee costs
- Quality measure performance
- Notable state comparisons, especially Texas vs. peer states
- Any significant changes or trends worth flagging

Keep the tone professional, data-driven, and actionable. Use specific numbers.
Reference time periods. Do NOT use bullet points — write in narrative prose.

DATA:
{data_summary}

Write the executive summary now:"""

TEXAS_SPOTLIGHT_PROMPT = """\
You are a Medicaid policy analyst focused on Texas. Using the data below,
write a 2-paragraph analysis of Texas's Medicaid program performance.

Compare Texas to:
- National averages
- Peer states (large states, southern states, non-expansion states)
- Its own historical trajectory

Highlight strengths, challenges, and areas to watch. Be specific with numbers.

DATA:
{data_summary}

Write the Texas spotlight analysis:"""

ANOMALY_DETECTION_PROMPT = """\
You are a data analyst scanning Medicaid data for anomalies and notable patterns.
Review the data below and identify 3-5 alerts worth flagging for dashboard users.

For each alert, provide:
- A short title (under 60 characters)
- A severity level: "critical", "warning", or "info"
- A one-sentence description explaining the finding
- The relevant state(s)
- A sourceLabel (where the finding came from, e.g., "CMS Enrollment Data")
- A sourceUrl (URL to the underlying dataset)

Format your response as a JSON array of objects with keys:
"title", "severity", "description", "states", "sourceLabel", "sourceUrl"

Look for:
- States with enrollment changes >10% year-over-year
- States with per-enrollee spending far above/below the median
- Quality scores notably above or below expectations
- Interesting cross-metric patterns (e.g., high spending but low quality)

DATA:
{data_summary}

Return ONLY the JSON array, no other text:"""

EXECUTIVE_INSIGHTS_PROMPT = """\
You are a senior strategy consultant at Accenture writing for the Account Director
on the Texas HHSC Medicaid contract. Based on the data below, produce the five
most important insights he should be aware of this week.

Each insight must be grounded in the actual numbers or signals in the data —
do not speculate beyond what's there. Focus on insights that would change what
Accenture does, who it calls, or what it flags to the client.

For each of the 5 insights, produce a JSON object with:
- "rank": 1-5 (1 = most important)
- "title": under 75 chars, specific and concrete
- "summary": 1-2 sentences describing the finding
- "whyItMatters": 1-2 sentences on why Accenture/HHSC should care
- "confidence": "high", "medium", or "low"
- "category": one of "operational", "financial", "regulatory", "competitive", "quality"
- "impactLevel": "critical", "high", or "moderate"
- "actionPrompt": a single clear action the reader could take ("Review X", "Flag Y to Z", etc.)
- "relatedStates": array of 2-letter state codes mentioned
- "source": short label for the dataset or feed the insight came from
- "sourceUrl": URL to that source if visible in the data

DATA:
{data_summary}

Return ONLY a JSON array of 5 objects, no other text:"""

RISK_OPPORTUNITY_PROMPT = """\
You are a consulting strategist mapping risks and opportunities for Accenture's
Texas HHSC Medicaid position. Based on the data below, produce 6-8 items for a
risk/opportunity matrix chart.

Each item represents a single theme (e.g., "EVV system renewal", "Managed care
recompete", "Quality measure gap"). Score each from 0-100 on three axes:
- risk: likelihood AND severity of something going wrong for Accenture/client
- opportunity: upside if Accenture executes well
- impact: magnitude if either risk or opportunity materializes (bubble size)

The points should SPREAD across the risk/opportunity space — do not cluster.

For each item, produce a JSON object with:
- "label": 2-5 word theme name
- "description": 1 sentence describing the item
- "risk": 0-100
- "opportunity": 0-100
- "impact": 0-100
- "trend": "improving", "stable", or "deteriorating"
- "category": one of "procurement", "operations", "policy", "quality", "competitive"
- "recommendedAction": single action sentence
- "sourceUrl": URL to the underlying signal/dataset if visible in the data

DATA:
{data_summary}

Return ONLY a JSON array of 6-8 objects, no other text:"""

PULSE_METRICS_PROMPT = """\
You are building the "Texas Pulse" ribbon for an executive dashboard — 8 small
metric tiles at the top of the page that communicate "the state of Texas
Medicaid in under 10 seconds."

Based on the data below, produce 8 JSON objects, one per tile. Use REAL numbers
from the data. Do not invent figures.

Each tile has:
- "label": 2-4 word tile header
- "value": the headline number formatted for display (e.g., "5.84M", "$7,450", "92%")
- "delta": optional delta string (e.g., "-8.2% YoY", "+2 pts")
- "deltaDirection": "up", "down", or "neutral" — semantically aligned (for enrollment, down=red; for quality up=green)
- "tooltip": 1 sentence of context
- "sourceUrl": URL visible in the data for this metric's source

Include these 8 tiles in order: Enrollment, 12-Mo Enrollment Delta, Per Enrollee Spend,
Managed Care Rate, Quality Score, Active Procurement Items, OIG/Regulatory Signals,
Next Milestone. If a number isn't in the data, use "—" as value and explain in tooltip.

DATA:
{data_summary}

Return ONLY a JSON array of exactly 8 objects, no other text:"""


class IntelligenceAgent:
    """
    Agent that uses the Claude API to generate analytical briefings
    from the collected pipeline data.

    Depends on: enrollment, expenditure, quality agents (reads their outputs)
    """

    def __init__(self):
        self.output_path = OUTPUT_DIR / "intelligence.json"
        self.api_key = ANTHROPIC_API_KEY
        self.model = CLAUDE_MODEL

    # ─── Data Loading ────────────────────────────────────────────────

    def load_agent_outputs(self) -> dict:
        """Load the output files from the other pipeline agents."""
        data = {}

        enrollment_path = OUTPUT_DIR / "enrollment.json"
        if enrollment_path.exists():
            with open(enrollment_path) as f:
                data["enrollment"] = json.load(f)
            logger.info(f"Loaded enrollment data: {len(data['enrollment'].get('states', []))} states")
        else:
            logger.warning("No enrollment data found")

        expenditure_path = OUTPUT_DIR / "expenditure.json"
        if expenditure_path.exists():
            with open(expenditure_path) as f:
                data["expenditure"] = json.load(f)
            logger.info(f"Loaded expenditure data: {len(data['expenditure'].get('states', []))} states")
        else:
            logger.warning("No expenditure data found")

        quality_path = OUTPUT_DIR / "quality.json"
        if quality_path.exists():
            with open(quality_path) as f:
                data["quality"] = json.load(f)
            logger.info(f"Loaded quality data: {len(data['quality'].get('states', []))} states")
        else:
            logger.warning("No quality data found")

        managed_care_path = OUTPUT_DIR / "managed_care.json"
        if managed_care_path.exists():
            with open(managed_care_path) as f:
                data["managed_care"] = json.load(f)
            logger.info(f"Loaded managed care data: {len(data['managed_care'].get('states', []))} states")
        else:
            logger.warning("No managed care data found")

        signals_path = OUTPUT_DIR / "signals.json"
        if signals_path.exists():
            with open(signals_path) as f:
                data["signals"] = json.load(f)
            logger.info(f"Loaded signals data: {len(data['signals'].get('signals', []))} items")
        else:
            logger.warning("No signals data found")

        return data

    def build_data_summary(self, data: dict) -> str:
        """Build a text summary of the data for the Claude prompt."""
        sections = []

        # Enrollment section
        if "enrollment" in data:
            enroll = data["enrollment"]
            nat = enroll.get("national", {})
            total_enroll = nat.get("totalEnrollment")
            total_enroll_str = f"{total_enroll:,}" if isinstance(total_enroll, (int, float)) else "N/A"
            sections.append(
                f"=== ENROLLMENT ===\n"
                f"National total: {total_enroll_str} enrollees "
                f"({nat.get('statesReporting', '?')} states reporting)\n"
                f"Latest period: {nat.get('latestPeriod', 'unknown')}\n"
            )
            # Top 10 states
            top_states = enroll.get("states", [])[:10]
            for s in top_states:
                change_str = f"{s['enrollmentChange']:+.1f}%" if s.get("enrollmentChange") is not None else "N/A"
                sections.append(
                    f"  {s['stateCode']}: {s['enrollment']:,} enrollees (YoY: {change_str})"
                )

            # Texas specifically
            tx = next((s for s in enroll.get("states", []) if s["stateCode"] == "TX"), None)
            if tx:
                change_str = f"{tx['enrollmentChange']:+.1f}%" if tx.get("enrollmentChange") is not None else "N/A"
                sections.append(f"\n  TEXAS: {tx['enrollment']:,} enrollees (YoY: {change_str})")

        # Expenditure section
        if "expenditure" in data:
            exp = data["expenditure"]
            nat = exp.get("national", {})
            sections.append(
                f"\n=== EXPENDITURES ===\n"
                f"National total: ${nat.get('totalExpenditures', 0):,.0f}\n"
                f"National per-enrollee: ${nat.get('perEnrolleeSpending', 'N/A')}\n"
                f"Federal share: ${nat.get('federalShare', 0):,.0f}\n"
                f"Fiscal year: {nat.get('fiscalYear', 'unknown')}\n"
            )
            # Top 10 by spending
            top_spend = exp.get("states", [])[:10]
            for s in top_spend:
                per_e = f"${s['perEnrolleeSpending']:,.0f}" if s.get("perEnrolleeSpending") else "N/A"
                change_str = f"{s['spendingChange']:+.1f}%" if s.get("spendingChange") is not None else "N/A"
                sections.append(
                    f"  {s['stateCode']}: ${s['totalExpenditures']:,.0f} total, "
                    f"{per_e}/enrollee (YoY: {change_str})"
                )

        # Quality section
        if "quality" in data:
            qual = data["quality"]
            nat = qual.get("national", {})
            sections.append(
                f"\n=== QUALITY MEASURES ===\n"
                f"National average score: {nat.get('averageScore', 'N/A')}/100\n"
                f"High performers (≥75): {nat.get('highPerformers', '?')} states\n"
                f"Low performers (<60): {nat.get('lowPerformers', '?')} states\n"
                f"Source: {qual.get('source', 'unknown')}, Year: {qual.get('reportingYear', 'unknown')}\n"
            )
            # Top and bottom 5
            states_q = qual.get("states", [])
            if states_q:
                top5 = states_q[:5]
                bottom5 = states_q[-5:]
                sections.append("  Top 5: " + ", ".join(
                    f"{s['stateCode']}({s['qualityScore']})" for s in top5))
                sections.append("  Bottom 5: " + ", ".join(
                    f"{s['stateCode']}({s['qualityScore']})" for s in bottom5))

                tx_q = next((s for s in states_q if s["stateCode"] == "TX"), None)
                if tx_q:
                    rank = next(i + 1 for i, s in enumerate(states_q) if s["stateCode"] == "TX")
                    sections.append(
                        f"\n  TEXAS quality score: {tx_q['qualityScore']}/100 "
                        f"(rank #{rank} of {len(states_q)}, tier: {tx_q['qualityTier']})"
                    )

        # Managed care section
        if "managed_care" in data:
            mc = data["managed_care"]
            nat_mc = mc.get("national", {})
            sections.append(
                f"\n=== MANAGED CARE ===\n"
                f"National average penetration: {nat_mc.get('averagePenetration', 'N/A')}% "
                f"({nat_mc.get('statesReporting', '?')} states reporting, "
                f"year {nat_mc.get('year', 'unknown')})\n"
                f"Source: https://data.medicaid.gov/dataset/52ed908b-0cb8-5dd2-846d-99d4af12b369"
            )
            tx_mc = next((s for s in mc.get("states", []) if s["stateCode"] == "TX"), None)
            if tx_mc:
                sections.append(
                    f"  TEXAS managed care penetration: "
                    f"{tx_mc.get('managedCarePenetration', 'N/A')}% "
                    f"({tx_mc.get('managedCareEnrollment', 0):,} MC enrollees)"
                )

        # Signals section
        if "signals" in data:
            sig = data["signals"]
            items = sig.get("signals", [])
            sections.append(
                f"\n=== EXTERNAL SIGNALS ({len(items)} items) ===\n"
                f"Categories: {json.dumps(sig.get('national', {}).get('counts', {}))}"
            )
            # Include the top 15 signals with source URLs so Claude can cite them
            for s in items[:15]:
                sections.append(
                    f"  [{s.get('category', 'signal')}] "
                    f"{s.get('title', '(no title)')[:120]} "
                    f"— {s.get('source', 'unknown')} "
                    f"({s.get('sourceUrl', 'n/a')})"
                )

        return "\n".join(sections)

    # ─── Claude API ──────────────────────────────────────────────────

    def call_claude(self, prompt: str) -> str:
        """Call the Claude API and return the response text."""
        if not self.api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY not set. Set it in .env or environment variables. "
                "Get a key at https://console.anthropic.com/"
            )

        import anthropic

        client = anthropic.Anthropic(api_key=self.api_key)
        logger.info(f"Calling Claude API (model: {self.model}, prompt length: {len(prompt)} chars)")

        response = client.messages.create(
            model=self.model,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text
        logger.info(f"Claude response: {len(text)} chars, "
                     f"tokens: {response.usage.input_tokens}in/{response.usage.output_tokens}out")
        return text

    def _safe_json_parse(self, raw: str, fallback: list) -> list:
        """Extract a JSON array from raw LLM text; return fallback on failure."""
        if not raw:
            return fallback
        text = raw.strip()
        # Strip common markdown code fences
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        # Find first [ and last ]
        start = text.find("[")
        end = text.rfind("]")
        if start == -1 or end == -1 or end < start:
            logger.warning("Could not locate JSON array in LLM response, using fallback")
            return fallback
        try:
            parsed = json.loads(text[start:end + 1])
            if isinstance(parsed, list) and len(parsed) > 0:
                return parsed
            return fallback
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse failed ({e}), using fallback")
            return fallback

    def generate_without_api(self, data: dict, data_summary: str) -> dict:
        """
        Generate basic briefings without the Claude API.
        Used when ANTHROPIC_API_KEY is not configured.
        Produces template-based outputs from the raw data.
        """
        logger.info("Generating briefings without Claude API (template-based)")
        now = datetime.now().isoformat()

        # Build template-based executive summary
        enroll = data.get("enrollment", {})
        exp = data.get("expenditure", {})
        qual = data.get("quality", {})

        nat_enroll = enroll.get("national", {})
        nat_exp = exp.get("national", {})
        nat_qual = qual.get("national", {})

        total_enrollment = nat_enroll.get("totalEnrollment", 0)
        total_spending = nat_exp.get("totalExpenditures", 0)
        avg_quality = nat_qual.get("averageScore", 0)

        executive_summary = (
            f"As of the latest reporting period, approximately {total_enrollment:,} individuals "
            f"are enrolled in Medicaid and CHIP programs across {nat_enroll.get('statesReporting', 50)} "
            f"states and territories. "
        )

        if total_spending > 0:
            executive_summary += (
                f"Total Medicaid expenditures stand at ${total_spending:,.0f}, "
                f"with a national average per-enrollee cost of "
                f"${nat_exp.get('perEnrolleeSpending', 0):,.0f}. "
            )

        if avg_quality > 0:
            executive_summary += (
                f"Quality performance across the Core Set measures averages {avg_quality}/100, "
                f"with {nat_qual.get('highPerformers', 0)} states classified as high performers "
                f"and {nat_qual.get('lowPerformers', 0)} states requiring improvement attention."
            )

        # Texas spotlight
        tx_enroll = next((s for s in enroll.get("states", []) if s.get("stateCode") == "TX"), {})
        tx_qual = next((s for s in qual.get("states", []) if s.get("stateCode") == "TX"), {})

        texas_spotlight = (
            f"Texas currently has {tx_enroll.get('enrollment', 0):,} Medicaid enrollees, "
            f"making it one of the largest programs nationally. "
        )
        if tx_enroll.get("enrollmentChange") is not None:
            texas_spotlight += (
                f"Year-over-year enrollment has changed by "
                f"{tx_enroll['enrollmentChange']:+.1f}%. "
            )
        if tx_qual.get("qualityScore"):
            texas_spotlight += (
                f"Texas's composite quality score of {tx_qual['qualityScore']}/100 "
                f"places it in the {tx_qual.get('qualityTier', 'moderate')} performance tier, "
                f"{'above' if tx_qual['qualityScore'] > avg_quality else 'below'} "
                f"the national average of {avg_quality}."
            )

        # Generate template alerts
        alerts = []

        # Check for large enrollment changes
        for s in enroll.get("states", []):
            change = s.get("enrollmentChange")
            if change is not None and abs(change) > 10:
                direction = "increase" if change > 0 else "decrease"
                alerts.append({
                    "title": f"{s['stateCode']} enrollment {direction}: {change:+.1f}%",
                    "severity": "warning" if abs(change) > 15 else "info",
                    "description": (
                        f"{s.get('stateName', s['stateCode'])} shows a {abs(change):.1f}% "
                        f"year-over-year enrollment {direction}, significantly above the "
                        f"typical range."
                    ),
                    "states": [s["stateCode"]],
                    "category": "enrollment",
                    "timestamp": now,
                })

        # Quality alerts
        for s in qual.get("states", []):
            if s.get("qualityTier") == "low" and s["stateCode"] in ["TX", "CA", "FL", "NY", "OH"]:
                alerts.append({
                    "title": f"{s['stateCode']} quality below threshold",
                    "severity": "warning",
                    "description": (
                        f"{s['stateCode']} has a quality score of {s['qualityScore']}/100, "
                        f"placing it in the low-performance tier."
                    ),
                    "states": [s["stateCode"]],
                    "category": "quality",
                    "timestamp": now,
                })

        # Ensure we have at least a few alerts
        if len(alerts) < 3:
            alerts.append({
                "title": "Core Set reporting rates improving",
                "severity": "info",
                "description": (
                    "Mandatory adult Core Set reporting (effective 2024) has increased "
                    "state participation, improving cross-state comparability."
                ),
                "states": [],
                "category": "quality",
                "timestamp": now,
            })

        if len(alerts) < 3:
            alerts.append({
                "title": "Medicaid unwinding continues",
                "severity": "info",
                "description": (
                    "Post-pandemic continuous enrollment unwinding is still affecting "
                    "enrollment figures in many states. Year-over-year comparisons "
                    "should account for this policy change."
                ),
                "states": [],
                "category": "enrollment",
                "timestamp": now,
            })

        # Build executive insights from data (template version)
        executive_insights = self._template_executive_insights(data, now)
        risk_opportunity = self._template_risk_opportunity(data, now)
        pulse_metrics = self._template_pulse_metrics(data)

        # Enhance alerts with sourceLabel/sourceUrl where possible
        for alert in alerts:
            if "sourceLabel" not in alert:
                if alert.get("category") == "enrollment":
                    alert["sourceLabel"] = "CMS Monthly Enrollment"
                    alert["sourceUrl"] = "https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360"
                elif alert.get("category") == "quality":
                    alert["sourceLabel"] = "CMS Core Set Quality Measures"
                    alert["sourceUrl"] = "https://www.medicaid.gov/medicaid/quality-of-care/performance-measurement/adult-and-child-health-care-quality-measures"
                else:
                    alert["sourceLabel"] = "data.medicaid.gov"
                    alert["sourceUrl"] = "https://data.medicaid.gov/"

        return {
            "executiveSummary": executive_summary,
            "texasSpotlight": texas_spotlight,
            "alerts": alerts[:8],  # Cap at 8 alerts
            "executiveInsights": executive_insights,
            "riskOpportunity": risk_opportunity,
            "pulseMetrics": pulse_metrics,
            "updated": now,
            "source": "template",
            "model": None,
        }

    # ─── Template fallback generators ────────────────────────────────

    def _template_executive_insights(self, data: dict, now: str) -> list[dict]:
        """Produce ranked ExecutiveInsight cards without calling Claude."""
        enroll = data.get("enrollment", {})
        exp = data.get("expenditure", {})
        qual = data.get("quality", {})
        mc = data.get("managed_care", {})
        signals = data.get("signals", {}).get("signals", [])

        insights = []

        # 1. Texas enrollment dynamics
        tx_e = next((s for s in enroll.get("states", []) if s["stateCode"] == "TX"), {})
        if tx_e:
            change = tx_e.get("enrollmentChange")
            change_str = f"{change:+.1f}%" if change is not None else "unknown"
            insights.append({
                "id": "insight-tx-enrollment",
                "rank": 1,
                "title": f"Texas Medicaid enrollment at {tx_e.get('enrollment', 0):,} ({change_str} YoY)",
                "summary": (
                    f"Texas reports {tx_e.get('enrollment', 0):,} enrollees in the latest "
                    f"CMS monthly snapshot, with a year-over-year change of {change_str}."
                ),
                "whyItMatters": (
                    "Enrollment movement directly affects Accenture's downstream work volume "
                    "for Provider Communications and contact-center capacity planning."
                ),
                "confidence": "high",
                "category": "operational",
                "impactLevel": "high",
                "actionPrompt": "Review capacity plan against updated enrollment figure",
                "relatedStates": ["TX"],
                "source": "CMS Monthly Medicaid & CHIP Enrollment",
                "sourceUrl": "https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360",
                "timestamp": now,
            })

        # 2. Quality performance gap
        tx_q = next((s for s in qual.get("states", []) if s["stateCode"] == "TX"), {})
        if tx_q:
            score = tx_q.get("qualityScore", 0)
            nat_avg = qual.get("national", {}).get("averageScore", 0)
            gap = round(score - nat_avg, 1)
            insights.append({
                "id": "insight-tx-quality",
                "rank": 2,
                "title": f"Texas quality score {score}/100, {gap:+.1f} vs national average",
                "summary": (
                    f"On the CMS Core Set composite, Texas scores {score} compared to the "
                    f"national average of {nat_avg}, placing it in the "
                    f"{tx_q.get('qualityTier', 'moderate')} tier."
                ),
                "whyItMatters": (
                    "Core Set results inform CMS oversight and managed care contract scoring; "
                    "lagging measures are quick wins for near-term MCO performance improvement."
                ),
                "confidence": "medium",
                "category": "quality",
                "impactLevel": "high",
                "actionPrompt": "Identify lowest three measures and propose targeted initiatives",
                "relatedStates": ["TX"],
                "source": "CMS Core Set Quality Measures",
                "sourceUrl": "https://www.medicaid.gov/medicaid/quality-of-care/performance-measurement/adult-and-child-health-care-quality-measures",
                "timestamp": now,
            })

        # 3. Managed care penetration
        tx_mc = next((s for s in mc.get("states", []) if s["stateCode"] == "TX"), {})
        if tx_mc:
            pen = tx_mc.get("managedCarePenetration")
            pen_str = f"{pen}%" if pen is not None else "n/a"
            insights.append({
                "id": "insight-tx-managedcare",
                "rank": 3,
                "title": f"Texas managed care penetration at {pen_str}",
                "summary": (
                    f"Approximately {tx_mc.get('managedCareEnrollment', 0):,} Texas Medicaid "
                    f"enrollees are in managed care programs — roughly {pen_str} of total."
                ),
                "whyItMatters": (
                    "High penetration concentrates risk and reward in a handful of MCO contracts; "
                    "recompete timing drives Accenture's downstream workstream volume."
                ),
                "confidence": "high",
                "category": "competitive",
                "impactLevel": "critical",
                "actionPrompt": "Confirm next STAR/STAR+PLUS recompete milestone in contract calendar",
                "relatedStates": ["TX"],
                "source": "CMS Managed Care Enrollment Summary",
                "sourceUrl": "https://data.medicaid.gov/dataset/52ed908b-0cb8-5dd2-846d-99d4af12b369",
                "timestamp": now,
            })

        # 4. Regulatory signal
        reg = next((s for s in signals if s.get("category") == "regulatory"), None)
        if reg:
            insights.append({
                "id": "insight-regulatory",
                "rank": 4,
                "title": reg.get("title", "New CMS Medicaid regulation"),
                "summary": reg.get("summary", "New Federal Register posting from CMS affecting Medicaid."),
                "whyItMatters": (
                    "Federal Register rules often carry state implementation deadlines; "
                    "catching them early avoids downstream compliance scrambles."
                ),
                "confidence": "high",
                "category": "regulatory",
                "impactLevel": "moderate",
                "actionPrompt": "Assess TX implementation implications and notify HHSC contact",
                "relatedStates": reg.get("affectedStates", []) or [],
                "source": reg.get("source", "Federal Register (CMS)"),
                "sourceUrl": reg.get("sourceUrl"),
                "timestamp": now,
            })

        # 5. Procurement signal
        proc = next((s for s in signals if s.get("category") == "procurement"), None)
        if proc:
            insights.append({
                "id": "insight-procurement",
                "rank": 5,
                "title": proc.get("title", "Active HHSC-relevant procurement"),
                "summary": proc.get("summary", "New solicitation on a state procurement portal."),
                "whyItMatters": (
                    "Active procurements are direct pipeline — Accenture capture timelines are short."
                ),
                "confidence": "medium",
                "category": "competitive",
                "impactLevel": "high",
                "actionPrompt": "Decide bid/no-bid and route to capture team",
                "relatedStates": proc.get("affectedStates", []) or [],
                "source": proc.get("source", "State procurement portal"),
                "sourceUrl": proc.get("sourceUrl"),
                "timestamp": now,
            })

        # Assign sequential ranks in case some insights were skipped
        for i, ins in enumerate(insights):
            ins["rank"] = i + 1
        return insights[:5]

    def _template_risk_opportunity(self, data: dict, now: str) -> list[dict]:
        """Produce a default risk/opportunity matrix from signals + metrics."""
        signals = data.get("signals", {}).get("signals", [])
        proc_count = sum(1 for s in signals if s.get("category") == "procurement")
        oig_count = sum(1 for s in signals if s.get("category") == "oig")
        reg_count = sum(1 for s in signals if s.get("category") == "regulatory")
        leg_count = sum(1 for s in signals if s.get("category") == "legislative")

        items = [
            {
                "id": "ro-evv-renewal",
                "label": "EVV System Renewal",
                "description": "Upcoming Electronic Visit Verification system renewal for Texas HHSC.",
                "risk": 65,
                "opportunity": 80,
                "impact": 85,
                "trend": "stable",
                "category": "procurement",
                "recommendedAction": "Confirm capture plan and lock incumbency story",
                "sourceUrl": "https://www.txsmartbuy.gov/esbd",
            },
            {
                "id": "ro-mco-recompete",
                "label": "MCO Recompete Cycle",
                "description": "Managed care recompetes drive large downstream work volumes.",
                "risk": 55,
                "opportunity": 75,
                "impact": 80,
                "trend": "improving",
                "category": "competitive",
                "recommendedAction": "Map MCO contract timelines against Provider Comms demand",
                "sourceUrl": "https://www.hhs.texas.gov/",
            },
            {
                "id": "ro-core-set-quality",
                "label": "Quality Measure Gap",
                "description": "Below-average Core Set performance invites CMS scrutiny and improvement funding.",
                "risk": 45,
                "opportunity": 70,
                "impact": 65,
                "trend": "stable",
                "category": "quality",
                "recommendedAction": "Pitch a targeted quality improvement workstream",
                "sourceUrl": "https://www.medicaid.gov/medicaid/quality-of-care/performance-measurement/adult-and-child-health-care-quality-measures",
            },
            {
                "id": "ro-unwinding-tail",
                "label": "Unwinding Tail Effects",
                "description": "Lingering post-PHE redetermination churn affecting contact-center volumes.",
                "risk": 50,
                "opportunity": 35,
                "impact": 55,
                "trend": "improving",
                "category": "operations",
                "recommendedAction": "Monitor churn vs staffing plan monthly",
                "sourceUrl": "https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360",
            },
            {
                "id": "ro-federal-rules",
                "label": "Federal Rule Pipeline",
                "description": f"{reg_count} active CMS Medicaid regulatory items in Federal Register.",
                "risk": 60,
                "opportunity": 55,
                "impact": 60,
                "trend": "stable" if reg_count < 5 else "deteriorating",
                "category": "policy",
                "recommendedAction": "Brief HHSC on rule timeline implications",
                "sourceUrl": "https://www.federalregister.gov/",
            },
            {
                "id": "ro-oig-risk",
                "label": "OIG Scrutiny",
                "description": f"{oig_count} recent HHS OIG reports touching Medicaid programs.",
                "risk": 70,
                "opportunity": 30,
                "impact": 55,
                "trend": "stable",
                "category": "policy",
                "recommendedAction": "Review findings for TX-relevant exposure",
                "sourceUrl": "https://oig.hhs.gov/reports/",
            },
            {
                "id": "ro-procurement-pipeline",
                "label": "State Procurement Pipeline",
                "description": f"{proc_count} active procurement items across tracked state portals.",
                "risk": 35,
                "opportunity": 75,
                "impact": 70,
                "trend": "improving" if proc_count >= 3 else "stable",
                "category": "procurement",
                "recommendedAction": "Bid/no-bid triage on active RFPs",
                "sourceUrl": "https://www.txsmartbuy.gov/esbd",
            },
            {
                "id": "ro-legislative",
                "label": "Legislative Activity",
                "description": f"{leg_count} bills in Congress touching Medicaid program structure.",
                "risk": 45,
                "opportunity": 50,
                "impact": 50,
                "trend": "stable",
                "category": "policy",
                "recommendedAction": "Track bills that would alter FMAP or waiver authority",
                "sourceUrl": "https://www.congress.gov/",
            },
        ]
        return items

    def _template_pulse_metrics(self, data: dict) -> list[dict]:
        """Generate the 8 Texas Pulse metric tiles from pipeline data."""
        enroll = data.get("enrollment", {})
        exp = data.get("expenditure", {})
        qual = data.get("quality", {})
        mc = data.get("managed_care", {})
        signals = data.get("signals", {}).get("signals", [])

        tx_e = next((s for s in enroll.get("states", []) if s["stateCode"] == "TX"), {})
        tx_x = next((s for s in exp.get("states", []) if s["stateCode"] == "TX"), {})
        tx_q = next((s for s in qual.get("states", []) if s["stateCode"] == "TX"), {})
        tx_mc = next((s for s in mc.get("states", []) if s["stateCode"] == "TX"), {})

        def fmt_num(n):
            if n is None:
                return "—"
            if n >= 1_000_000:
                return f"{n/1_000_000:.2f}M"
            if n >= 1_000:
                return f"{n/1_000:.0f}K"
            return f"{n:,}"

        def pct_delta(val):
            if val is None:
                return None, "neutral"
            direction = "up" if val > 0 else ("down" if val < 0 else "neutral")
            return f"{val:+.1f}% YoY", direction

        enroll_val = tx_e.get("enrollment")
        enroll_delta, enroll_dir = pct_delta(tx_e.get("enrollmentChange"))

        # 12-month absolute delta
        trend = enroll.get("trends", {}).get("TX") or []
        abs_delta = None
        if len(trend) >= 13:
            try:
                abs_delta = trend[-1]["value"] - trend[-13]["value"]
            except Exception:
                abs_delta = None

        spend_val = tx_x.get("perEnrolleeSpending")
        spend_delta, spend_dir = pct_delta(tx_x.get("spendingChange"))

        mc_pen = tx_mc.get("managedCarePenetration")
        qual_val = tx_q.get("qualityScore")
        qual_change = tx_q.get("qualityScoreChange")
        qual_delta_str = f"{qual_change:+.1f} pts" if qual_change is not None else None
        qual_dir = "up" if (qual_change or 0) > 0 else ("down" if (qual_change or 0) < 0 else "neutral")

        proc_count = sum(1 for s in signals if s.get("category") == "procurement")
        oig_count = sum(1 for s in signals if s.get("category") in ("oig", "regulatory"))

        return [
            {
                "label": "Enrollment",
                "value": fmt_num(enroll_val),
                "delta": enroll_delta,
                "deltaDirection": "down" if enroll_dir == "down" else enroll_dir,
                "tooltip": "Total Texas Medicaid & CHIP enrollment (latest CMS monthly snapshot).",
                "sourceUrl": "https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360",
            },
            {
                "label": "12-Mo Delta",
                "value": fmt_num(abs_delta) if abs_delta is not None else "—",
                "delta": "vs peers",
                "deltaDirection": "neutral",
                "tooltip": "Absolute enrollment change over the last 12 months.",
                "sourceUrl": "https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360",
            },
            {
                "label": "Per Enrollee",
                "value": f"${spend_val:,.0f}" if spend_val else "—",
                "delta": spend_delta,
                "deltaDirection": spend_dir,
                "tooltip": "Average Medicaid spend per enrollee in Texas (CMS-64).",
                "sourceUrl": "https://www.medicaid.gov/medicaid/financial-management/state-budget-expenditure-reporting-for-medicaid-and-chip/expenditure-reports-mbes/cbes",
            },
            {
                "label": "Managed Care",
                "value": f"{mc_pen}%" if mc_pen is not None else "—",
                "delta": None,
                "deltaDirection": "neutral",
                "tooltip": "Share of Texas Medicaid enrollees in managed care plans.",
                "sourceUrl": "https://data.medicaid.gov/dataset/52ed908b-0cb8-5dd2-846d-99d4af12b369",
            },
            {
                "label": "Quality Score",
                "value": f"{qual_val}/100" if qual_val else "—",
                "delta": qual_delta_str,
                "deltaDirection": qual_dir,
                "tooltip": "Composite of Texas's CMS Core Set measure scores.",
                "sourceUrl": "https://www.medicaid.gov/medicaid/quality-of-care/performance-measurement/adult-and-child-health-care-quality-measures",
            },
            {
                "label": "Procurement",
                "value": f"{proc_count} active",
                "delta": None,
                "deltaDirection": "neutral",
                "tooltip": "HHSC- or Medicaid-related procurement items currently tracked.",
                "sourceUrl": "https://www.txsmartbuy.gov/esbd",
            },
            {
                "label": "OIG/Reg Signals",
                "value": f"{oig_count} open",
                "delta": None,
                "deltaDirection": "neutral",
                "tooltip": "Combined count of recent OIG and Federal Register signals.",
                "sourceUrl": "https://oig.hhs.gov/reports/",
            },
            {
                "label": "Next Milestone",
                "value": "EVV Renewal",
                "delta": "tracked",
                "deltaDirection": "neutral",
                "tooltip": "Next major Texas HHSC contract milestone (curated).",
                "sourceUrl": "https://www.hhs.texas.gov/",
            },
        ]

    # ─── Main Pipeline ───────────────────────────────────────────────

    def run(self) -> dict:
        """Execute the intelligence pipeline."""
        logger.info("=" * 60)
        logger.info("INTELLIGENCE AGENT - Starting pipeline run")
        logger.info("=" * 60)

        start_time = time.time()

        try:
            # Load data from other agents
            data = self.load_agent_outputs()
            if not data:
                raise ValueError("No agent output data available. Run collection agents first.")

            data_summary = self.build_data_summary(data)
            logger.info(f"Data summary built: {len(data_summary)} chars")

            # Always build a template baseline first — AI output layers on top
            template_output = self.generate_without_api(data, data_summary)

            if self.api_key:
                logger.info("Claude API key found — generating AI briefings")
                try:
                    executive_summary = self.call_claude(
                        EXECUTIVE_SUMMARY_PROMPT.format(data_summary=data_summary)
                    )
                    texas_spotlight = self.call_claude(
                        TEXAS_SPOTLIGHT_PROMPT.format(data_summary=data_summary)
                    )
                    alerts_raw = self.call_claude(
                        ANOMALY_DETECTION_PROMPT.format(data_summary=data_summary)
                    )
                    insights_raw = self.call_claude(
                        EXECUTIVE_INSIGHTS_PROMPT.format(data_summary=data_summary)
                    )
                    risk_opp_raw = self.call_claude(
                        RISK_OPPORTUNITY_PROMPT.format(data_summary=data_summary)
                    )
                    pulse_raw = self.call_claude(
                        PULSE_METRICS_PROMPT.format(data_summary=data_summary)
                    )

                    now = datetime.now().isoformat()

                    alerts = self._safe_json_parse(alerts_raw, template_output["alerts"])
                    for alert in alerts:
                        alert.setdefault("timestamp", now)
                        alert.setdefault("category", "ai_detected")
                        alert.setdefault("sourceLabel", "Claude synthesis")
                        alert.setdefault("sourceUrl", "https://data.medicaid.gov/")

                    insights = self._safe_json_parse(insights_raw, template_output["executiveInsights"])
                    for i, ins in enumerate(insights):
                        ins.setdefault("id", f"insight-{i+1}")
                        ins.setdefault("rank", i + 1)
                        ins.setdefault("timestamp", now)

                    risk_opp = self._safe_json_parse(risk_opp_raw, template_output["riskOpportunity"])
                    for i, ro in enumerate(risk_opp):
                        ro.setdefault("id", f"ro-{i+1}")

                    pulse = self._safe_json_parse(pulse_raw, template_output["pulseMetrics"])

                    output = {
                        "executiveSummary": executive_summary,
                        "texasSpotlight": texas_spotlight,
                        "alerts": alerts,
                        "executiveInsights": insights,
                        "riskOpportunity": risk_opp,
                        "pulseMetrics": pulse,
                        "updated": now,
                        "source": "claude_api",
                        "model": self.model,
                    }
                except Exception as e:
                    logger.warning(f"Claude API call failed ({e}), falling back to templates")
                    output = template_output
            else:
                logger.info("No Claude API key — using template-based briefings")
                output = template_output

            # Save output
            safe_json_dump(output, self.output_path)

            elapsed = time.time() - start_time
            alert_count = len(output.get("alerts", []))
            logger.info(f"Pipeline completed in {elapsed:.1f}s — "
                         f"{alert_count} alerts generated, source: {output['source']}")

            return {
                "status": "success",
                "source": output["source"],
                "alerts": alert_count,
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
    agent = IntelligenceAgent()
    result = agent.run()
    print(f"\nResult: {json.dumps(result, indent=2)}")
