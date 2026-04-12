# Phase 1 — Data Inventory & Gap Analysis

_Working document for the "connect all pipelines" initiative. Status as of 2026-04-10._

This inventory covers every visible data-carrying component in the dashboard, the fields each component needs, and where those fields can (or cannot) come from in the real world. Fields that today are hardcoded in `src/lib/sample-data.ts` are flagged so we can see the full extent of what has to be wired up.

## Summary of the current state

1. The Python pipeline scaffold already exists with four agents — `enrollment`, `expenditure`, `quality`, `intelligence` — and writes to `medicaid-dashboard/public/data/*.json`.
2. The pipeline has **never been successfully run**: `public/data/` and `data-pipeline/data/` are both empty.
3. Only **three components** read from the `useDashboardData()` hook: `ComparisonTable`, `StateDetailPanel`, and the `MetricCard` set in the Texas hero row (plus `AlertsFeed` via prop drilling). Six other components still import `sample-data` directly and bypass the hook entirely.
4. Two `MetricCard`s on the Texas hero row have `change` values hardcoded in `page.tsx` (`4.2` for per-enrollee, `-2.1` for quality) — even if the pipeline ran, those numbers would stay fake.
5. The intelligence agent produces `executiveSummary`, `texasSpotlight`, and rule-based `alerts`, but the frontend never reads `intelligence.executiveSummary` or `intelligence.texasSpotlight`. `ExecutiveAttention` still imports `sampleInsights`.
6. The egress proxy in my sandbox blocks `data.medicaid.gov`, `www.kff.org`, and similar — so final endpoint verification has to happen where network access is unconstrained (the user's laptop or the Vercel build).

## Component → data → source inventory

### 1. Header (`Header.tsx`)
| Field | Currently | Target source |
| --- | --- | --- |
| `dataSource` flag (`"pipeline"` vs `"sample"`) | Already wired via `useDashboardData()` | — |
| `lastUpdated` timestamp | Already wired via `useDashboardData()` | — |

_No new work._

### 2. Texas Pulse ribbon (`TexasPulse.tsx`)
Eight metrics, all hand-keyed in `samplePulseMetrics`.

| Metric | Current value | Needed source |
| --- | --- | --- |
| Enrollment (5.84M, -8.2% YoY) | Hardcoded | CMS monthly Medicaid & CHIP enrollment (DKAN) — already in pipeline `enrollment_agent.py`; TX row |
| 12-Mo Delta (-508K vs -420K peers) | Hardcoded | Derived from same enrollment dataset; peer median computed across non-expansion peers |
| Per Enrollee ($7,450, +4.2%) | Hardcoded | CMS-64 MBES/CBES — already in `expenditure_agent.py` (joined to enrollment) |
| Managed Care (92%) | Hardcoded | **GAP** — no pipeline agent. See section 9 on managed care. |
| Quality Score (62/100, +2 pts) | Hardcoded | CMS Adult/Child Core Set — already in `quality_agent.py` |
| Procurement Items (3 active) | Hardcoded | **GAP** — needs a procurement agent (Texas SmartBuy / HHSC eSolicitations) |
| OIG Signals (2 open) | Hardcoded | **GAP** — needs OIG feed parser |
| Next Major Milestone (47 days / EVV renewal) | Hardcoded | **GAP** — no authoritative feed; likely judgment-curated |

### 3. Texas at a Glance — hero `MetricCard` row (`page.tsx`)
| Card | Value source | Change source |
| --- | --- | --- |
| Total Enrollment | `texas.enrollment` from hook ✅ | `texas.enrollmentChange` from hook ✅ |
| Per-Enrollee Spending | `texas.perEnrolleeSpending` from hook ✅ | **Hardcoded `change={4.2}`** — needs YoY computation in expenditure agent |
| Managed Care Rate | `texas.managedCarePenetration` from hook (but sample-data default) | No change shown — OK |
| Quality Score | `texas.qualityScore` from hook ✅ | **Hardcoded `change={-2.1}`** — needs YoY computation in quality agent |

### 4. Executive Attention (`ExecutiveAttention.tsx`)
Imports `sampleInsights` directly. Each `ExecutiveInsight` has: `rank`, `title`, `summary`, `whyItMatters`, `confidence`, `category`, `impactLevel`, `actionPrompt`, `relatedStates`, `source`, `sourceUrl`, `timestamp`.

**Reality check:** These are not observations a pipeline can produce on its own — they are AI-synthesized judgments about what matters to Accenture's Texas position. They are the natural output of the `intelligence_agent`, not a separate dataset.

| Field | Target source |
| --- | --- |
| title / summary / whyItMatters / actionPrompt / confidence / category / impactLevel | Claude (via `intelligence_agent.py`), conditioned on the fresh enrollment + expenditure + quality outputs + signals feed |
| source / sourceUrl | Cited by Claude from the signals or pipeline rows that triggered the insight |
| timestamp | Pipeline run date |

_The existing `intelligence_agent` already produces an `executiveSummary` and a `texasSpotlight`, but not ranked `ExecutiveInsight[]` cards. It needs a new prompt that produces the `ExecutiveInsight` shape._

### 5. Enrollment Chart (`EnrollmentChart.tsx`)
Reads `sampleEnrollmentTrends` directly (not from the hook). Needs per-state monthly time series.

| Field | Target source |
| --- | --- |
| Monthly value per state (trailing 12–24 months) | CMS enrollment DKAN (already in `enrollment_agent.py` — it computes a `trends` field) |

_The agent output already contains a `trends` object; the hook already exposes `trends`. The component just needs to be refactored to take `trends` via prop or via the hook instead of importing `sampleEnrollmentTrends`._

### 6. Signals from the Edge (`SignalsFeed.tsx`)
Imports `sampleSignals` (7 entries) directly. Fields per signal: `title`, `summary`, `source`, `sourceUrl`, `category` (procurement / policy / regulatory / oig / cms / legislative), `relevance`, `timestamp`, `affectedStates`.

**GAP** — no pipeline agent exists for signals. Options for each category:

| Category | Candidate source | Access pattern | Feasibility |
| --- | --- | --- | --- |
| procurement | Texas SmartBuy (`txsmartbuy.com/sp`), HHSC eSolicitations, Ohio OhioBuys (`procure.ohio.gov`), state procurement portals | HTML scrape; no official RSS on most state portals | Moderate — brittle HTML, would need per-state scraper |
| policy | medicaid.gov/federal-policy-guidance, CMS SMD letters | HTML with listing page | Moderate |
| regulatory | Federal Register API (`federalregister.gov/api/v1`) filtered by agency=CMS, topic=Medicaid | JSON API, documented, free, no auth | **High** |
| oig | HHS OIG (`oig.hhs.gov/reports/`) RSS feed | Atom/RSS | **High** |
| cms | CMS.gov newsroom, medicaid.gov news | HTML or RSS where available | Moderate |
| legislative | congress.gov API (`api.congress.gov`) or GovTrack | JSON API; congress.gov requires free API key | **High** with key, **Moderate** without |

**Recommended Signals v1:** Federal Register + OIG RSS + congress.gov API. State-specific procurement scraping deferred to v2. That gets us regulatory, oig, cms, and legislative out of the six categories immediately, with real feeds.

### 7. Alerts Feed (`AlertsFeed.tsx`)
Receives `alerts` via prop from the hook. The hook merges pipeline `intelligence.alerts` when available; otherwise falls back to `sampleAlerts`. `DashboardAlert` has: `type`, `severity`, `title`, `description`, `date`, `metric`, `change`, `sourceUrl`, `sourceLabel`, per-state linkage.

The `intelligence_agent.generate_without_api()` already produces rule-based alerts (enrollment swings > 10%, low quality scores). **This mostly works today** — the missing piece is that `intelligence_agent` needs to emit alerts with `sourceUrl`/`sourceLabel` fields, and `type: "policy_change"` alerts need to come from the Signals agent.

### 8. State Selector + Comparison Table (`StateSelector.tsx` + `ComparisonTable.tsx`)
The selector uses `US_STATES` and `TEXAS_PEER_STATES` from `constants.ts` (static configuration, not data — leave alone). The table reads `tableData` from the hook which is already pipeline-ready.

| Column | Source | Status |
| --- | --- | --- |
| enrollment, enrollmentChange | `enrollment_agent` | ✅ |
| perEnrolleeSpending | `expenditure_agent` (joins enrollment) | ✅ |
| managedCarePenetration | **GAP** | See section 9 |
| qualityScore | `quality_agent` | ✅ |
| expansionStatus | Static `US_STATES[code].expansionStatus` (config, not pipeline) | ✅ |

### 9. Managed Care penetration (used in TexasPulse, Comparison Table, StateDetail)
The pipeline has **no agent** for this. Options:

| Source | URL | Access | Feasibility |
| --- | --- | --- | --- |
| CMS "Medicaid Managed Care Enrollment Report" | `medicaid.gov/medicaid/managed-care/enrollment-report` | Annual PDF, also a CSV release on data.medicaid.gov | **High** if the CSV exists as a dataset; needs confirmation |
| MACPAC MACStats exhibit 30 | `macpac.gov/macstats` | Annual Excel | Moderate |
| Individual state EFT reports | varies | Per-state | Low |

**Recommendation:** Try `data.medicaid.gov` first (search for "managed care enrollment"), then fall back to MACPAC Exhibit 30. If neither yields a clean per-state rate, mark the field explicitly as "n/a" rather than hardcoding values.

### 10. Spending Breakdown Chart (`SpendingBreakdownChart.tsx`)
Imports `sampleSpendingCategories` directly. Six categories: Managed Care, Fee-for-Service, Prescription Drugs, Long-Term Care, Behavioral Health, Admin & Other.

Good news: `expenditure_agent.py` already has a `SERVICE_CATEGORIES` map covering inpatient/outpatient/physician/pharmacy/nursing_facility/managed_care/etc., and computes per-category totals in its output JSON. The category taxonomy needs to be harmonized (the agent's finer categories need to roll up to the dashboard's six buckets), and the component needs to stop importing sample data.

### 11. Risk & Opportunity Matrix (`RiskOpportunityChart.tsx`)
Imports `sampleRiskOpportunity` (8 items) directly. Each `RiskOpportunityItem` has numeric `risk`/`opportunity`/`impact` scores — these are Accenture-specific judgments, not data points.

**This is not a pipelineable dataset.** It should be produced by the intelligence agent (Claude reasoning over signals + pipeline data) with a new prompt, same way Executive Attention cards will be. The input signals _are_ pipelineable (see section 6); the scoring is judgment.

### 12. State Detail Panel (`StateDetailPanel.tsx`)
Already pulls from the `states` and `trends` arrays passed in by the hook. Will light up automatically as the other agents produce data.

## Hardcoded values summary

These all become real once the pipeline runs **and** the components are converted:

- `page.tsx` line 91: `change={4.2}` → per-enrollee YoY from expenditure agent
- `page.tsx` line 110: `change={-2.1}` → quality YoY from quality agent
- `TexasPulse.tsx` → reads `samplePulseMetrics`; needs to compute from pipeline outputs
- `ExecutiveAttention.tsx` → reads `sampleInsights`; needs new intelligence agent prompt
- `EnrollmentChart.tsx` → reads `sampleEnrollmentTrends`; switch to `trends` from hook
- `SignalsFeed.tsx` → reads `sampleSignals`; needs new signals agent
- `SpendingBreakdownChart.tsx` → reads `sampleSpendingCategories`; use expenditure agent output
- `RiskOpportunityChart.tsx` → reads `sampleRiskOpportunity`; needs new intelligence agent prompt

## Gap matrix (consolidated)

| # | Missing capability | Remediation |
| --- | --- | --- |
| G1 | Pipeline has never been executed; outputs don't exist yet | Run the pipeline once end-to-end, confirm the DKAN UUIDs in `config.py` still resolve, fix if stale |
| G2 | Enrollment/quality YoY deltas aren't computed per-state | Extend those agents to produce `change` fields (compare newest snapshot to snapshot from 12 months ago) |
| G3 | Expenditure agent categories don't match the dashboard's six buckets | Add a rollup step in `expenditure_agent.py` |
| G4 | No `signals` agent | New agent wrapping: Federal Register API, OIG RSS, congress.gov; emits `signals.json` |
| G5 | No `managed_care` agent | New agent or extension to `enrollment_agent`; source TBD from either data.medicaid.gov or MACPAC |
| G6 | `intelligence_agent` doesn't produce `ExecutiveInsight[]` or `RiskOpportunityItem[]` | New prompts and output fields in `intelligence_agent.py` |
| G7 | `TexasPulse`, `ExecutiveAttention`, `EnrollmentChart`, `SignalsFeed`, `SpendingBreakdownChart`, `RiskOpportunityChart` all bypass the hook | Extend `useDashboardData` to expose new fields; refactor each component to prop/hook |
| G8 | Hardcoded `change={4.2}` and `change={-2.1}` in `page.tsx` | Wire to `texas.perEnrolleeSpendingChange` and `texas.qualityScoreChange` once G2 is done |
| G9 | Vercel build has no pipeline run step, so frontend `/data/*.json` never exists in production | Add a build hook: `prebuild` script running `python data-pipeline/orchestrator.py`, or commit generated JSON |

## What I could NOT verify from this sandbox

The Cowork egress proxy blocks `data.medicaid.gov`, `www.kff.org`, `macpac.gov`, and similar federal data hosts. Concretely, I could not:

- Confirm the three DKAN dataset UUIDs in `config.py` still resolve (one search result suggested a different distribution ID `6c114b2c-cb83-559b-832f-4d8b06d6c1b9` for enrollment — ours is `87ad6d90-2f6f-5dd4-898e-332442baefd8`)
- Inspect the actual column names of the live DKAN response
- Confirm the quality dataset still has data for all 50 states
- Confirm the Federal Register API is reachable from this sandbox (untested)
- Confirm congress.gov API access

**Verification path:** All real network verification will happen from the user's laptop (where the `.bat` ran before) or from a Vercel preview build. This is expected and fine — the egress constraint just means my verification has to be "read the code, confirm the contract, then run it where the network is open" rather than "try the endpoint from here."
