

User wants me to repeat the "real-life scan + sample print-outs" exercise (like we did for TechAlert/HireAlert and Demand Radar) — but now applied to the **newly-fixed cron pipeline + the products it feeds**. They want to verify the Cron Sentinel fixes actually produced data, then see real sample customer deliverables generated from that data.

Let me think about what they actually want repeated:
- Previous practice = (1) blunt DB inventory check, (2) actual sample PDF of what a customer would receive, (3) burn-rate / "will we run out" math, (4) honest verdict
- Last did this for: TechAlert ($399 sheet + $2,500 MSP) and Demand Radar ($99/$199/$499)
- Now after fixing 20 broken crons + deploying Cron Sentinel — re-run the same exercise to see what changed

## Plan

### Phase 1: Live DB Re-Scan (read-only)
Query current state of:
- `hire_alert_candidates` — total, scored ≥7, contactable, by trade, by county, last 24h
- `industry_pulse_signals` — total, by vertical, by county, last 24h, signal_type populated %
- `cron_sentinel_alerts` — last 24h pass/fail per cron
- `cron.job_run_details` — actual last-run times for the 20 fixed crons
- `hire_alert_runs` — did scanner actually write rows since the fix?
- `agent_heartbeats` — which agents are alive

Compare to last scan (148 candidates, 0 scored, 0 contactable). Report deltas.

### Phase 2: Generate Real Sample PDFs from CURRENT DATA
Pull actual rows from DB (not synthetic) and render:

1. **`/mnt/documents/sample-techalert-sheet-399-v2.pdf`** — what a $399 buyer gets TODAY based on real candidates in the table
2. **`/mnt/documents/sample-techalert-monthly-2500-v2.pdf`** — sample monthly MSP delivery using current real data
3. **`/mnt/documents/sample-demand-radar-snapshot-99-v2.pdf`** — $99 snapshot built from actual `industry_pulse_signals` rows
4. **`/mnt/documents/sample-demand-radar-weekly-199-v2.pdf`** — $199 weekly digest from real signals
5. **`/mnt/documents/sample-demand-radar-enterprise-499-v2.pdf`** — $499 enterprise built from real data

If a product has insufficient real data → say so bluntly in the PDF + chat ("only 12 candidates available — would need 50 to ship this product live").

### Phase 3: Burn-Rate Math (real numbers, not estimates)
For each product:
- Current contactable inventory
- Daily intake rate (last 7 days from cron logs)
- Max sellable units before exhaustion
- Replenishment time

### Phase 4: Verdict Memo + Artifacts
Single chat memo + saved file `/mnt/documents/post-fix-pipeline-status.md`:
- "What changed since the cron fix"
- "What's actually sellable RIGHT NOW"
- "What still needs to bake before going live"
- Links to all 5 sample PDFs

### Out of Scope
- No code changes
- No new pricing
- No new scanners — only measuring what's now flowing
- No fixing remaining gaps this round (separate approval)

### Deliverables
- Chat: blunt status table + verdict per product
- 5 sample PDFs in `/mnt/documents/` (real data, current as-of-now)
- 1 status memo `/mnt/documents/post-fix-pipeline-status.md`

