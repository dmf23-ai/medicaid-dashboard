# National Medicaid Dashboard — Pipeline Runbook

This is the hands-on guide for running the Python data pipeline, checking the output, committing the generated JSON, and deploying to Vercel. Written for David's workflow — no assumed CLI chops.

---

## 0. One-time setup (first run only)

### 0a. Open PowerShell inside the repo

Easiest way: open File Explorer, navigate to the `medicaid-dashboard` folder on your computer, click in the address bar at the top, type `powershell`, and hit Enter. That opens a PowerShell window already `cd`'d into the right folder.

Alternatively, open PowerShell from the Start menu and navigate manually:

```powershell
cd "C:\path\to\medicaid-dashboard"
```

### 0b. Python environment

From the `medicaid-dashboard/` directory in PowerShell:

```powershell
cd data-pipeline
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Once the venv is active you'll see `(.venv)` at the start of your prompt — that's your cue that the environment is live. You should see `requests`, `pandas`, `anthropic`, and a few others install. If `pandas` fails, make sure you're on Python 3.10 or newer (`python --version`).

**Two gotchas the first time:**

1. **Execution policy error on `Activate.ps1`.** If PowerShell refuses to run the activate script with a red "running scripts is disabled on this system" message, run this once in the same window and then retry the activate command:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
   The `-Scope Process` part means it only affects that one PowerShell window and reverts when you close it.

2. **`python` not found.** If you get "python is not recognized," Python isn't on your PATH. Install from https://www.python.org/downloads/ and check the "Add Python to PATH" box in the installer, then open a **fresh** PowerShell window.

> **macOS/Linux equivalent** (for reference, not your machine): `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`

### 0c. Environment variables

From the `medicaid-dashboard/` directory (the Next.js app root, not the pipeline folder):

```powershell
cd ..                               # back out of data-pipeline
Copy-Item .env.example .env
```

Then open `.env` in an editor (VS Code, Notepad, whatever) and fill in two keys:

- **`ANTHROPIC_API_KEY`** — required for the AI-generated executive insights, risk/opportunity matrix, and pulse metrics. Grab one at https://console.anthropic.com/. Without it, the pipeline still runs but falls back to template text instead of Claude-generated analysis.
- **`SOCRATA_APP_TOKEN`** — optional but recommended. It raises your rate limit on data.medicaid.gov from ~1000 req/hour to much higher. Register at https://data.medicaid.gov/profile/edit/developer_settings.

Leave `LOG_LEVEL=INFO` unless you're debugging.

The pipeline reads `.env` from the project root via `python-dotenv`, so you don't need to export anything manually.

---

## 1. Run the pipeline

From `medicaid-dashboard/data-pipeline/` with the venv active (you should see `(.venv)` in your prompt):

```powershell
cd data-pipeline                    # if you're not already there
python orchestrator.py
```

If you opened a fresh PowerShell window since setup, you'll need to reactivate the venv first:

```powershell
cd data-pipeline
.venv\Scripts\Activate.ps1
python orchestrator.py
```

Expected runtime: **3–6 minutes** on a decent connection (was ~25 min before the enrollment agent learned to filter the dataset to the last 24 months — see Phase 3F-2 fixes). The orchestrator runs agents in dependency order:

1. `enrollment` — CMS Monthly Medicaid & CHIP Enrollment (DKAN)
2. `expenditure` — CMS MBES/CBES rolled into the 6 dashboard buckets
3. `quality` — CMS Adult + Child Core Set (two DKAN distributions)
4. `managed_care` — CMS Medicaid Managed Care Enrollment Summary
5. `signals` — Federal Register, HHS OIG, Congress.gov, Texas ESBD, OhioBuys
6. `intelligence` — builds template baseline, then layers 3 Claude calls on top (insights / risk-opp / pulse)

You'll see a per-agent log line like `[enrollment] ✓ wrote public/data/enrollment.json (52 states, 14.2s)`. If an agent fails, the orchestrator logs the error and continues with the others — the failed agent's JSON won't be regenerated, so the frontend falls back to the previous committed copy (or sample data on a first run).

### What to watch for

- **Enrollment agent fetching tens of thousands of records** → should now stop at ~12K (a 24-month window across 50 states) thanks to the date-column probe in `enrollment_agent.fetch_dkan()`. If you see it climbing past 15K, the schema probe missed the date column — paste the "Schema columns" log line back to me and I'll patch the candidate list in `config.py` (`ENROLLMENT_DATE_COLUMNS`).
- **`No Claude API key — using template-based briefings`** → your `.env` doesn't exist or doesn't have `ANTHROPIC_API_KEY` filled in. `config.py` now loads `.env` from the app root explicitly (`medicaid-dashboard\.env`), so make sure the file is there and has the key on its own line.
- **Managed care reports "0 states"** → was a state-name vs state-code bug; fixed. If you see it again it means the dataset added new state-name spellings — the mapping table is in `agents/managed_care_agent.py` (`STATE_NAME_TO_CODE`).
- **Signals from OIG / Texas ESBD / OhioBuys → 0 items** → the agent now logs HTML byte length and regex match counts so you can see whether the page was empty (JS-rendered SPA) or just filtered out. When the scraper misses, the agent falls back to "verified landing page" stubs that point at the canonical portal — better than an empty feed.
- **404 on a DKAN distribution** → the dataset ID in `config.py` may have rotated. Open the URL in your browser. If the dataset page loads but the distribution UUID no longer matches, grab the new one and update `config.py`. Report this back to me and I'll patch it.
- **Rate limit (429)** → add a `SOCRATA_APP_TOKEN` to `.env` or wait 15 minutes.
- **`anthropic` auth failure** → `ANTHROPIC_API_KEY` is wrong or has no credit. Pipeline will fall back to template output.
- **WinError 10013 / `getaddrinfo failed`** → transient Windows TCP/IP or DNS hiccup, often after the laptop wakes from sleep or after a brief outage. Wait 30 seconds and re-run `python orchestrator.py` — it picks up where the JSON files left off.

---

## 2. Verify the output

After a successful run, you should see six files under `medicaid-dashboard\public\data\`:

```
enrollment.json
expenditure.json
quality.json
managed_care.json
signals.json
intelligence.json
```

Quick sanity checks in PowerShell:

```powershell
cd ..\public\data                   # from data-pipeline\
Get-ChildItem *.json | Select-Object Name, Length

# Peek at the intelligence output
python -c "import json; d=json.load(open('intelligence.json')); print('insights:', len(d.get('executiveInsights',[]))); print('riskOpp:', len(d.get('riskOpportunity',[]))); print('pulse:', len(d.get('pulseMetrics',[])))"
```

You should see 5 executive insights, 6–8 risk/opportunity items, and 8 pulse metrics. If any are empty, check the intelligence agent log — the template baseline should still populate them even if Claude calls fail.

### Preview locally

From `medicaid-dashboard\` (the app root, not the pipeline folder):

```powershell
npm run dev
```

Then open http://localhost:3000 and spot-check:

- Texas Pulse ticker is scrolling real tiles (not the sample placeholders)
- Executive Attention shows 5 insights with source citations
- Per-Enrollee Spending card shows a real YoY delta (not the old hardcoded 4.2%)
- Quality Score card shows a real YoY delta (not the old hardcoded -2.1%)
- Signals from the Edge feed has real Federal Register / OIG / procurement items
- Spending Breakdown bar chart shows the 6 rolled-up buckets
- Risk & Opportunity matrix plots 6–8 bubbles

If something falls back to sample data, the `dataSource` badge in the header will say "sample" instead of "live".

---

## 3. Commit the generated JSON

We decided to commit the JSON to git rather than regenerate it on Vercel (keeps deploys fast and deterministic).

From `medicaid-dashboard\` in PowerShell:

```powershell
git status                          # should show 6 modified files in public/data/
git add public/data/*.json
git commit -m "data: refresh pipeline outputs $(Get-Date -Format 'yyyy-MM-dd')"
git push origin main
```

The `$(Get-Date -Format 'yyyy-MM-dd')` part is PowerShell's version of inserting today's date into the commit message — if it looks scary, just type the date manually like `"data: refresh pipeline outputs 2026-04-10"`.

Vercel's GitHub integration will pick up the push and start a deploy automatically.

---

## 4. Deploy to Vercel

If the repo is already connected to Vercel (`dmf23-ai/medicaid-dashboard`), the push in step 3 is all you need. Watch the deploy at https://vercel.com/dmf23-ai/medicaid-dashboard and confirm:

- Build succeeds (Next.js 16 + Turbopack, should take 1–2 min)
- Preview URL loads the dashboard
- The `dataSource` badge in the header reads "live"
- No console errors in the browser devtools

If the repo isn't connected yet, run `vercel` from `medicaid-dashboard\` with the Vercel CLI installed, or go to vercel.com → New Project → Import from GitHub.

---

## 5. Refreshing data later

The whole loop from a clean state in PowerShell:

```powershell
cd "C:\path\to\medicaid-dashboard\data-pipeline"
.venv\Scripts\Activate.ps1
python orchestrator.py
cd ..
git add public/data/*.json
git commit -m "data: refresh $(Get-Date -Format 'yyyy-MM-dd')"
git push
```

That's seven lines but really just four actions: activate, run, commit, push. Once we're confident the pipeline runs cleanly end-to-end, we can wrap this in a scheduled task (Phase 3G) so it happens automatically on a cadence.

---

## Troubleshooting quickref

| Symptom | Likely cause | Fix |
|---|---|---|
| `ModuleNotFoundError: anthropic` | venv not active or deps not installed | `source .venv/bin/activate && pip install -r requirements.txt` |
| `enrollment.json` missing | enrollment agent failed; check log | usually a dataset UUID rotation in `config.py` |
| Dashboard shows sample data badge | one or more JSON files didn't generate | check `public/data/` file timestamps; re-run failing agent |
| `change` cards show nothing | prior-year data missing | check `qualityScoreChange` / `perEnrolleeSpendingChange` in JSON |
| Claude calls failing | `ANTHROPIC_API_KEY` wrong or account out of credit | template fallback still populates the fields; dashboard will work |
| Next.js build fails on Vercel | usually a type error | run `npm run build` locally first to catch it |

---

## What to send me when something breaks

If the pipeline throws and you're not sure what to do, paste me:

1. The **last ~30 lines** of the orchestrator output (the error and a bit of context)
2. Which agent was running when it failed
3. The contents of the relevant file in `public/data/` if one was partially written

I can diagnose from that and send back a targeted fix.
