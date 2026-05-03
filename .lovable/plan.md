# Game Plan: Guarantee 150 Cold Emails/Day With Auto-Failover

## The Diagnosis

Current pool (live DB pull just now):
- **outreach_leads**: 2,272 total · **194 ready-to-send** (have email, never contacted) · **1,376 missing email** (enrichment-blocked)
- **contractor_outreach_prospects**: 623 total · **118 ready-to-send** · **505 missing email**
- **hire_alert_candidates (TechAlert)**: **0 enriched-and-unsent** ← TechAlert is dry, hunter cron is barely producing
- **Yesterday's send mix** (2-day window, 104 sends): multi_service 58, web_drip 18, contractor 14, techalert 9, generic cold 5 → all senders work, but each one runs once, hits its own pool, and stops. Nothing rebalances when one pool empties.

So the 78/150 shortfall isn't a sender bug — it's three things:
1. **Enrichment throughput < scanner throughput** (1,881 leads sitting with no email)
2. **No failover** between senders when one pool dries
3. **Scanner volume per day is too low** for some products (TechAlert produced 0 enriched leads)

## The Fix — Three-Layer Waterfall

### Layer 1 — Pump up lead SUPPLY (scanners + enrichment)

**Scanner cadence increases (pg_cron edits):**
- `techalert-prospect-hunter` 1×/day → **3×/day** (8a, 1p, 6p ET) — adds GitHub/EDGAR/USPTO/SAM/BLS/Eventbrite/USAspending/LinkedIn signals each pass
- `contractor-prospector` 1×/day → **2×/day** (10a, 4p ET)
- `prospect-local-businesses` 1×/day → **2×/day** (10a, 3p ET)
- `enrichment-matrix-walker` already runs every 30m — **raise daily budget +50%** via `set_walker_daily_budget()` so it doesn't bottleneck on $$ cap
- New: `outreach-leads-enrich` cron drained 20/run @ 1×/day → **30/run × every 2h** (15 runs/day = 450 enrichment attempts) to chew through the 1,376 backlog
- New: `contractor-outreach-enrich` (statewide) → bumped from 4h to **2h** cadence, batch 25→50

**New parallel waterfall sources** (when Apollo/Hunter exhaust on a domain):
- Already wired: Apollo → Hunter → Firecrawl contact-page → PDL. Confirm all 4 stages fire in `_shared/email-waterfall.ts`.
- Add **DataForSEO Local Pack** as an extra discovery source inside `prospect-local-businesses` (already env-keyed, used in `channel-prospector`) — typically yields 30-40% more contractors not in Google Places.
- Add **SAM.gov + USAspending + LARA new-LLC** feeds into a new tiny pull job that pre-fills `outreach_leads` with company+website (then enrichment fills email).

### Layer 2 — Sender FAILOVER (the "rebalancer")

Today each sender (`multi-service-drip`, `web-design-drip`, `prospect-local-businesses`, `contractor-prospector`, `techalert-outreach`) runs on its own clock against its own pool. When the pool is empty it just exits with 0.

Build **`cold-email-rebalancer`** (new edge function, hourly cron 11a–8p ET):
1. For each product, count `unsent_with_email` (the queries above).
2. Track today's `email_send_log` count by template family.
3. Compute remaining gap = max(0, 150 − sent_today).
4. Allocate gap proportionally across products **weighted by available supply**:
   - If contractor pool = 0, route 100% of remaining quota to multi-service + web-design.
   - If TechAlert pool = 0, skip it entirely until hunter refills.
5. Invoke each sender with `{ batch: N, force: true }` to send N emails right now.
6. Per-sender hard cap (e.g. 60/day per template family) so we don't blow up one product's deliverability.
7. Self-throttle: 25/hour pacing across 8 hours (8 hrs × 19 sends ≈ 152) — keeps Gmail/Resend happy and avoids spam-trap clustering.

### Layer 3 — Sentinel + alerting (already built, tighten it)

`cold-email-volume-sentinel` already fires at 9pm ET and SMS-alerts on shortfall. Add:
- **3pm ET early-warning sentinel** — if sent_today < 75 by 3pm, SMS Matt + auto-trigger rebalancer in `force` mode
- **Daily morning supply digest SMS** at 8am ET: "Pools: outreach 194 / contractor 118 / techalert 0. Yesterday 78/150. Bottleneck: techalert hunter."
- **Auto-pause** any sender that returns 0 leads 3 runs in a row → write to `system_health` so admin dashboard shows the stuck pool red.

## Admin Dashboard Updates

Add two cards to `/dwa-admin/cold-email-audit`:
- **Supply Pool**: bar chart of `unsent_with_email` per product, refreshed every 5 min. Red bar when pool < 50.
- **Enrichment Backlog**: count of `email IS NULL` per product, with "Drain Now" button → invokes the relevant enrich function with `{ batch: 100 }`.

## Technical Details

**New files:**
- `supabase/functions/cold-email-rebalancer/index.ts` — hourly orchestrator
- `supabase/migrations/<ts>_cold_email_rebalancer_cron.sql` — schedules rebalancer hourly + 3pm early-warning + 8am supply digest, bumps existing scanner crons (techalert-prospect-hunter to 3×, contractor-prospector to 2×, etc.)

**Edited files:**
- `supabase/functions/cold-email-volume-sentinel/index.ts` — call rebalancer instead of 3 hardcoded fns
- `supabase/functions/outreach-leads-enrich/index.ts` — accept `{ batch }`, raise default 20→30
- `supabase/functions/prospect-local-businesses/index.ts` — add DataForSEO discovery alongside Google Places
- `src/pages/admin/AdminColdEmailAudit.tsx` — add Supply Pool + Enrichment Backlog cards
- `supabase/config.toml` — `verify_jwt = false` for `cold-email-rebalancer`

## Verification After Deploy

1. Manually invoke `cold-email-rebalancer` with `{ force: true, target: 150 }` — confirm it fans out across senders proportional to supply.
2. Run all bumped scanners once each, check `outreach_leads` and `hire_alert_candidates` counts climbed.
3. Trigger `outreach-leads-enrich` 5× to drain ~150 from the 1,376 backlog and confirm pool grows.
4. Watch `email_send_log` over 1 hr — expect ≥ 19 sends with diversified template_name distribution.
5. Wait for 9pm sentinel — it should report 150/150 sent and send no shortfall SMS.

If approved I will execute all of the above, then run the full 150-email push and report exact counts per template family.
