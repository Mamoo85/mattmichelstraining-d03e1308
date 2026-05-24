
# Fix: Zero cold emails today → 500/day nationwide (10-day ramp)

## Current state (verified live, today = May 24, 2026)

| Metric | Actual | Target |
|---|---|---|
| Emails today | **0** | 500 |
| Last 7 days | 885 (avg 126/day) | 3,500 |
| Last send | May 19 | today |
| States with prospects | **1 (MI only)** | 11 |
| Sendable prospects in queue | 578 enriched (of 3,150) | 5,000+ rolling |
| Stuck unsent in `outreach_leads` | 1,888 (lead_found + new) | <100 |
| TechAlert prospects | 14 (0 with email) | 500+ active |

Three compounding failures: (1) senders not firing, (2) prospect pool is starved + MI-only, (3) no single function exists that targets 500/day.

---

## Plan — 4 phases

### Phase 1 — Unblock the live system (today)

1. **Diagnose cron status.** Curl every scheduled outreach function directly to confirm whether code is broken or only cron is dead:
   - `techalert-prospect-hunter`, `techalert-enrich`, `techalert-outreach`, `techalert-followup-drip`
   - `outreach-leads-enrich`, `channel-prospector-followup`
   - `dead-lead-drip`, `mortgage-radar-outreach`
   - `weekly-admin-digest` (so Matt actually sees what's running)
2. **Re-apply the cron-fix migration** (`20260507120000_fix_remaining_broken_crons.sql`) plus any newer crons that may not be live on the primary DB. Rewrite using the verified vault pattern: hardcoded URL + `SUPABASE_SERVICE_ROLE_KEY_VAULT`.
3. **Add `verify_jwt = false`** to `supabase/config.toml` for any outreach function still defaulting to true (cron will 401 otherwise).
4. **Drain the 1,888 stuck `outreach_leads`** by triggering `outreach-leads-enrich` until `enriched_at` is set on all rows (auto-retry safe — sets `enriched_at` on both success and failure).
5. **Deploy.** All edge function changes via `deploy_edge_functions`.

### Phase 2 — Flip prospect pool to nationwide

1. **Activate all 10 seeded targets** in `prospector_targets`: OH, IN, IL, TX, FL, TN, GA, AZ, NC, PA (data update via insert tool — already seeded `active=false`).
2. **Expand `techalert-prospect-hunter`** to iterate `prospector_targets WHERE active=true` instead of hardcoded Michigan loops. All 8 signal sources already accept state/city params (Sonar, GitHub, EDGAR, USPTO, SAM, Eventbrite, USAspending, LinkedIn) — wiring change only, no new APIs.
3. **Expand `channel-prospector`** the same way (already reads `prospector_targets` per Phase 27, just needs the new rows active).
4. **Update `dead-lead-drip`** state map — already supports 11 states via `STATE_NAMES` (Phase 27 F3), just confirm the contractor's `state` column is populated for new nationwide rows.
5. **Backfill prospect pool.** Run hunters in a loop across all 11 states until each state has ≥200 enriched prospects (parallel `Promise.all` per state). Target floor: ~2,500 enriched prospects before opening the throttle.

### Phase 3 — New `cold-sender-master` function (500/day ceiling, ramped)

Build one orchestrator that replaces the scattered daily caps. Existing senders stay for backwards compatibility but new function owns the volume number.

**File:** `supabase/functions/cold-sender-master/index.ts`

**Behavior:**
- Reads `cold_email_ramp_state` (table already exists per Phase 37) for today's `daily_cap`.
- Ramp curve (Resend-safe, single domain): **50 → 90 → 140 → 200 → 260 → 320 → 380 → 430 → 470 → 500** over 10 days.
- Pulls candidates round-robin across 11 states from a union of three sources: `outreach_leads` (enriched, never emailed), `contractor_outreach_prospects` (with email), `techalert_business_prospects` (with email).
- Per-row checks: `outreach-blocklist`, `email-suppression`, TCPA/FCRA gates, last-contact > 30 days.
- Template selection by source: contractor → `multi_service_pitch_*`, techalert → `techalert_cold_d0`, mortgage LO → `mortgage_radar_lo_blast`, generic → `cold_outreach`.
- Writes `outreach_sent_at`, `email_send_log` row, increments daily counter.
- Hard stop at `daily_cap`. Logs reason if it can't fill the cap (e.g. pool empty for state X) so we can see the bottleneck.

**Cron:** every 30 min between 9am–4pm ET (16 windows). Sends ~`daily_cap / 16` per tick — smooths bursts, avoids Resend rate limits.

**Migration:**
- `cold_sender_state` table: `date, state, sent_count, cap_pulled, last_tick_at`
- Insert today's row in `cold_email_ramp_state` with `current_cap=50`, `target_cap=500`, `step=10 days`

### Phase 4 — Visibility (so this never goes dark for 5 days again)

1. **`cold-sender-master`** writes a daily summary to `email_send_log` with template `cold_sender_daily_summary` so we can see "sent X/Y today, blocked by Z reason" without SQL.
2. **`weekly-admin-digest`** already runs Monday 8am ET — add the cold sender metrics (sent, capped, blocked, by state).
3. **Health-check guard**: a new daily 8am cron `cold-sender-health-check` SMS Matt at +13138064952 if yesterday's count is <50% of the daily cap. This is the missing alarm that would have caught May 20.

---

## Technical notes

- **DB ops policy:** Schema changes (`cold_sender_state`, `prospector_targets` rows already exist) via `supabase--migration`. Data flips (`active=true`) via `supabase--insert`. No raw SQL in migrations for data.
- **Vault pattern (confirmed working):** `WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'` + hardcoded `https://eauvubfpanpeuxsrqesu.supabase.co`. Per CLAUDE.md, NULL-returning patterns must not be used.
- **Deployment:** Primary project (`eauvubfpanpeuxsrqesu`) is Lovable-managed — `deploy_edge_functions` deploys directly. No GitHub Actions detour.
- **Apollo cost guard:** Nationwide × 11 states will increase Apollo enrichment spend. `_shared/budget-gate.ts` + `enrichment-budget.ts` already enforce per-lead caps; confirm daily ceiling before flipping all 10 states.
- **Compliance preserved:** Every send still flows through `outreach-blocklist`, `email-suppression`, TCPA quiet hours via `_shared/twilio.ts` patterns (already in shared modules). No SMS sender changes in this plan — email only.

## Deliverables checklist

```text
[ ] Cron diagnostic curl report                          (Phase 1.1)
[ ] Migration: re-apply broken-cron fix + add 2 new crons (Phase 1.2, 4.3)
[ ] config.toml: verify_jwt=false on outreach functions  (Phase 1.3)
[ ] Drain run of outreach-leads-enrich                   (Phase 1.4)
[ ] Insert: prospector_targets active=true for 10 states (Phase 2.1)
[ ] Patch: techalert-prospect-hunter + channel-prospector
    to iterate prospector_targets                         (Phase 2.2-3)
[ ] Backfill loop: nationwide prospect pool ≥ 2,500     (Phase 2.5)
[ ] New function: cold-sender-master                     (Phase 3)
[ ] Migration: cold_sender_state + ramp_state row       (Phase 3)
[ ] Cron: cold-sender-master every 30 min 9am–4pm ET    (Phase 3)
[ ] New function: cold-sender-health-check (daily 8am)  (Phase 4.3)
[ ] Patch: weekly-admin-digest with cold sender metrics (Phase 4.2)
[ ] Deploy all changed functions                         (final)
```

## What you'll see when it's working

- Day 1 (tomorrow): ~50 cold emails sent across 11 states
- Day 10: 500/day sustained
- Daily SMS digest if volume drops below 50% of cap
- Weekly Monday SMS with full state-by-state breakdown
