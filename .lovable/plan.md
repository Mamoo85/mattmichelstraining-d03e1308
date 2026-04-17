

## Goal
Fix the empty pipeline. Get TechAlert + Demand Radar to "sellable inventory" within 7–14 days by activating the right scanners with the right APIs/credits. Pure research/diagnosis + concrete action list — no code this round.

## What I'll Investigate (read-only)

1. **Audit every scanner already built** — list each `hire-alert-scanner` source function, each Demand Radar/Industry Pulse scanner, what API key each requires, whether the secret is configured, whether the cron is currently scheduled, last run timestamp, last success/failure.
2. **Cross-check secrets** — `fetch_secrets` to see which API keys exist vs. which are missing (PDL, Apollo, Sonar/OpenRouter, Firecrawl, NPI, ArcGIS, LARA, Nursys, etc.).
3. **Cron audit** — query `cron.job` to see which scanners are actually scheduled vs. dormant.
4. **Last-run audit** — `hire_alert_runs` + `industry_pulse_signals.created_at` distribution to see what's actually firing.
5. **Identify the 3 root causes** for empty `trade`/`score` fields on the 148 candidates (likely: scanner writes raw license rows but skips the enrichment+scoring pass when an API key returns 402/missing).

## Deliverable (chat memo + 1 file)

A blunt **"Activation Playbook"** delivered to chat AND saved to `/mnt/documents/pipeline-activation-playbook.md`:

### Section 1: TechAlert Scanner Inventory
Table per scanner: name, purpose, API required, secret status (✅/❌), cron status, last run, daily candidate yield estimate, monthly cost.

Example rows:
```
scanLARA        | MI license issuances | none (free)        | ✅ | dormant   | 4/16 | 10-30/day  | $0
scanBPL         | MI BPL .xlsx         | none (free)        | ✅ | dormant   | never| 5-15/day   | $0
scanFloridaDBPR | FL trade licenses    | none (free)        | ✅ | dormant   | never| 10-25/day  | $0
scanApollo      | People search        | APOLLO_API_KEY     | ❓ | dormant   | never| 50-200/day | $49-99/mo
scanSonar       | OSINT enrichment     | OPENROUTER_API_KEY | ❓ | per-cand. | varies| enrich only| $20-100/mo usage
scanPDL         | Mobile + email       | PDL_API_KEY        | ❓ | per-cand. | varies| enrich only| $0.10-0.28/match
scanNPI         | Healthcare licenses  | none (free)        | ✅ | dormant   | never| 20-50/day  | $0
scanNursys      | RN/LPN licenses      | NURSYS user/pass   | ❓ | dormant   | never| 30-80/day  | ~$200/mo
scanDetroitArcGIS| Trade permits       | none (free)        | ✅ | dormant   | never| 15-40/day  | $0
scanLicenseExpiry| Lapsed MIOSHA       | none (free)        | ✅ | dormant   | never| 5-20/day   | $0
scanVALEnum     | LARA val.apps probe  | none (free)        | ✅ | dormant   | never| 10-30/day  | $0
```

### Section 2: Demand Radar Scanner Inventory
Same table format for `industry-pulse`, `industrial-growth-intel`, `medicare-staffing-intel`, `permit-watch-scanner`, `storm-lead-blaster`, `gov-contract-monitor`, etc.

### Section 3: The Three Bottlenecks (root cause)
1. **Scoring never runs** — `lead-quality-scorer` cron likely missing or `score-prospects` not invoked after intake. Result: 148 rows, score=NULL, all bucketed below "warm" threshold.
2. **Trade field never written** — scanner writes `license_type` but downstream code reads `trade`. Single-line normalizer fix needed.
3. **Enrichment is gated, not parallel** — `batch-enrich-candidates` only runs 5/run sequentially. At 5/day enrichment vs. 30/day intake, contact pool grows slower than candidate pool.

### Section 4: The "Pay-To-Win" Stack (ranked by ROI)
What APIs to fund + estimated monthly cost + expected lift:

| Tier | API | Monthly Cost | Expected New Hot Candidates/Mo |
|---|---|---|---|
| MUST | OpenRouter (Sonar) | $50–100 | +200 (enrich existing 148 in 1 day) |
| MUST | PDL | $50–150 | +150 contactable mobile/email |
| MUST | Apollo | $49 (Basic) | +400 people-search hits |
| NICE | Nursys | $200 | +500 healthcare candidates |
| NICE | Firecrawl Pro | $40 | +100 Demand Radar signals |
| FREE | NPI Registry | $0 | +600 healthcare licenses |
| FREE | LARA BPL | $0 | +300 trade licenses |
| FREE | Detroit ArcGIS | $0 | +400 trade permits |
| FREE | FL DBPR | $0 | +500 trade licenses |

**Bare minimum to launch:** $150/mo (Sonar + PDL + Apollo Basic). Free scanners alone → ~50 contactable/week if cron+scoring fixed.

### Section 5: The 14-Day Activation Timeline
Day-by-day what to fund, what cron to enable, what data to expect:
- **Day 0**: Confirm secrets present. Schedule 6 free scanner crons. Run `lead-quality-scorer` over existing 148 → expect 30-60 to land at score ≥5.
- **Day 1–3**: Free scanners alone yield 80-150 raw rows/day. PDL+Sonar enrich → 30-50 contactable/day.
- **Day 4–7**: Hot pool (score ≥7) hits ~50. Safe to launch $399 sheet to first 3 pilots.
- **Day 8–14**: Hot pool 150+, daily replenishment 20-30/day. Safe to launch $499/mo with 3-client cap per trade/county.

### Section 6: Identical Playbook for Demand Radar
Same structure. Demand Radar scanners exist, just aren't on a daily cron.

### Section 7: What I Recommend Building Next (after research)
Approval gate — I list 5 specific code changes (cron schedules, trade-field normalizer, scoring-on-insert trigger, parallel enrichment, hot-pool monitor) with effort estimates. You pick which to ship.

## Out of Scope
- No code changes
- No pricing changes
- No checkout changes
- No new scanner functions invented (only activate what already exists)

