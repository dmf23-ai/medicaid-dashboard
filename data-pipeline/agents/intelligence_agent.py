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

Format your response as a JSON array of objects with keys:
"title", "severity", "description", "states"

Look for:
- States with enrollment changes >10% year-over-year
- States with per-enrollee spending far above/below the median
- Quality scores notably above or below expectations
- Interesting cross-metric patterns (e.g., high spending but low quality)

DATA:
{data_summary}

Return ONLY the JSON array, no other text:"""


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

        return data

    def build_data_summary(self, data: dict) -> str:
        """Build a text summary of the data for the Claude prompt."""
        sections = []

        # Enrollment section
        if "enrollment" in data:
            enroll = data["enrollment"]
            nat = enroll.get("national", {})
            sections.append(
                f"=== ENROLLMENT ===\n"
                f"National total: {nat.get('totalEnrollment', 'N/A'):,} enrollees "
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

        return {
            "executiveSummary": executive_summary,
            "texasSpotlight": texas_spotlight,
            "alerts": alerts[:8],  # Cap at 8 alerts
            "updated": now,
            "source": "template",
            "model": None,
        }

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

            # Generate briefings
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

                    # Parse alerts JSON
                    try:
                        alerts = json.loads(alerts_raw.strip())
                        # Add timestamps
                        now = datetime.now().isoformat()
                        for alert in alerts:
                            alert["timestamp"] = now
                            if "category" not in alert:
                                alert["category"] = "ai_detected"
                    except json.JSONDecodeError:
                        logger.warning("Could not parse alerts JSON, using raw text")
                        alerts = [{
                            "title": "AI Analysis Available",
                            "severity": "info",
                            "description": alerts_raw[:200],
                            "states": [],
                            "category": "ai_detected",
                            "timestamp": datetime.now().isoformat(),
                        }]

                    output = {
                        "executiveSummary": executive_summary,
                        "texasSpotlight": texas_spotlight,
                        "alerts": alerts,
                        "updated": datetime.now().isoformat(),
                        "source": "claude_api",
                        "model": self.model,
                    }
                except Exception as e:
                    logger.warning(f"Claude API call failed ({e}), falling back to templates")
                    output = self.generate_without_api(data, data_summary)
            else:
                logger.info("No Claude API key — generating template-based briefings")
                output = self.generate_without_api(data, data_summary)

            # Save output
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.output_path, "w") as f:
                json.dump(output, f, indent=2)
            logger.info(f"Saved intelligence output to {self.output_path}")

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
