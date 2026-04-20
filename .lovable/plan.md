

## Self-Audit — Honest Answers

### Q1: Will the proposed rewrite break what's working?

**Yes, meaningful risk. Here's the truth:**

The current system is NOT failing the way the prompt assumes. Looking at actual data:

- `hire_alert_runs` last 3 days: **522 candidates found, 146 new** (4/19 alone produced 122 new). That's not "AI panicking and dropping 90% of data."
- `hire_alert_candidates`: **165 rows**. `industry_pulse_signals`: **131 rows** (79 hiring, 36 expansion, 11 school RFPs, 5 permit_surge).
- The scanners are **already** mostly dumb extraction — `hire-alert-scanner` is 2,078 lines of mostly Apify/MIOSHA/Sonar/Hunter/Snov/PDL waterfall, with AI only at the scoring step. `industry-pulse-scanner` (657 lines) already pulls BSEED, SAM.gov, NOAA, etc. before any AI.
- The **real bug from your v5 audit** (`knowledge/talent-radar-v5/`) is contactability ceiling at ~17% because MIOSHA records have no employer field — Hunter/Snov/Lusha/PDL all need an employer to function. That's a **data source problem, not an architecture problem.** The prompt's premise misdiagnoses it.
- `alerts_sent: 0` for 3 days is the actual silent bug worth fixing — but it's a scoring threshold issue, not extraction.

**What ripping it out costs:**
- ~3,000 lines of working scanner code replaced
- Apify Actor pipeline (just got working in Phase 19, 2 days ago) gets bypassed
- The 8-stage waterfall + 2-strike SMS alerts + source_breakdown logging from Phase 19 — all that gets orphaned
- `accela-permit-scanner` (built yesterday, not yet run) hasn't even produced data yet to know if it works

**Risk level: HIGH that we set ourselves back 1–2 weeks for marginal gain.**

### Q2: Will it actually improve or weaken results?

**Mixed — mostly neutral, partially weakening, with one real win.**

| Claim in prompt | Reality |
|---|---|
| "Wasting AI credits on empty returns" | Partly true. v5 audit shows total spend = **$0.74 across 126 candidates** ($0.034/contactable lead). This is not a cost crisis. |
| "AI tries to extract + analyze in one step" | **False for this codebase.** Extraction is already dumb (Apify/REST/Firecrawl). AI runs only at scoring + enrichment polish. |
| "Keyword gate would save money" | **Marginal.** Already spending ~$0.005/candidate. Gate saves maybe $0.20/run. Not material. |
| Round-robin sector schedule | **Actual win.** Current crons overlap; staggering 1/2/3am IS cleaner and easier to debug. |
| "Pulled X → Gated Y → Enriched Z" diagnostics | **Real win.** Current logging is per-source counts; full waterfall drop-off view would be genuinely useful. |
| Raw dump table for replayability | **Real win.** If enrichment logic changes, we can re-run on raw without re-scraping. |

**Net: the architectural rewrite is mostly cargo-culting a pattern that's already in place. But 3 specific pieces (round-robin cron, drop-off logging, raw dump for replay) are genuinely valuable.**

---

## Revised Plan — Surgical, Not Total Rewrite

Keep all working code. Add the 3 valuable pieces without ripping anything out.

### Change 1: `raw_signals_dump` table (additive, zero risk)
New table. Existing scanners get **one extra line** that also dumps raw payload before processing. Nothing else changes. Enables replay + drop-off math.

### Change 2: Round-robin cron schedule (low risk)
Migration that drops overlapping schedules and reinstalls staggered:
- 1am ET: healthcare-focused hire-alert-scanner pass (filtered by role)
- 2am ET: industrial-focused hire-alert-scanner pass
- 3am ET: commercial pass (industry-pulse + accela)
- Existing every-4h Accela cron stays for now (until we see if 3am alone is enough)

No code changes to scanners — just cron schedule edits + a `vertical_filter` query param the existing scanners already support.

### Change 3: Waterfall diagnostics view (UI only, zero backend risk)
New tab in Talent Radar Hub + Demand Radar Hub:
```
Time   Run               Pulled  After-Gate  Enriched  Final  $
01:00  hire-alert(hc)    187     142         58        24     $0.12
02:00  hire-alert(ind)   95      71          31        12     $0.08
03:00  industry-pulse    140     98          42        18     $0.21
```
Reads from existing `hire_alert_runs` + `demand_radar_runs` (already has source_breakdown JSON from Phase 19). Adds drop-off math client-side. **No edge function changes.**

### Change 4: Fix the actual silent bug — `alerts_sent: 0`
The real failure: 522 candidates found in last 3 days, **0 alerts sent**. Investigate why scoring threshold or client matching is failing. This is the bug worth fixing tonight.

### What we explicitly are NOT doing
- ❌ Not building 3 new "raw vacuum" functions (existing scanners already do this)
- ❌ Not building a separate enrichment engine (waterfall already exists in hire-alert-scanner)
- ❌ Not adding a keyword gate (marginal $ savings, real bug-introduction risk)
- ❌ Not touching the Apify pipeline that just started working

### Files
**New:**
- migration: `raw_signals_dump` table + round-robin cron reschedule
- `src/components/dwa-admin/WaterfallDiagnostics.tsx`

**Edited:**
- `hire-alert-scanner/index.ts` — add 1 dump-to-raw call (5 lines)
- `industry-pulse-scanner/index.ts` — add 1 dump-to-raw call (5 lines)
- `accela-permit-scanner/index.ts` — add 1 dump-to-raw call (5 lines)
- `TalentRadarHub.tsx` + `DemandRadarHub.tsx` — add Waterfall tab

### Plus the bug investigation
First action when approved: query why `alerts_sent=0` despite 122 new candidates. Could be scoring threshold raised, client target_roles mismatch, or notification function silently erroring. **This is the highest-ROI fix in this whole conversation.**

## Two questions answered, plainly
1. **Original plan**: high risk of breaking working code for marginal gain. **Revised plan**: low risk — additive only, no scanner rewrites.
2. **Original plan**: would weaken short-term (regression risk) for unclear long-term gain. **Revised plan**: strictly improves diagnostics + replayability + cron hygiene, plus fixes the real bug (zero alerts).

