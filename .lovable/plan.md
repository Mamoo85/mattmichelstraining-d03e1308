## Audit findings

You're correctly enrolled in all 7 trade verticals (roofing, hvac, plumbing, electrical, pest_control, gutters, painting), 130 SE Michigan zips each, phone +13139921219.

**The gap vs. Mortgage Radar:**

| Capability | Mortgage Radar | Trade Radar (today) |
|---|---|---|
| Daily scanner cron | ✅ 8am ET | ✅ 1pm UTC |
| Dedicated AM digest function | ✅ `mortgage-radar-am-digest` | ❌ none — relies on scanner's inline notifier |
| Sends email even on 0-lead days | ✅ yes (shows watch list) | ❌ no — scanner only emails when leads inserted |
| Weekly digest | ✅ `mortgage-radar-weekly-digest` | ❌ none |
| `test_sms` mode for proof texts | ✅ yes | ❌ none |
| SMS to client on hot leads | ⚠️ wired but bugged | ⚠️ wired but bugged |
| Lead enrichment drain | ✅ yes | ❌ none (out of scope for today) |

**Critical bugs found:**
1. `trade-radar-scanner` calls `sendSMS(phone, msg)` — wrong signature. Real shape is `sendSMS(to, from, body, product?, isDemoMode?)`. Every hot-lead SMS to clients and every admin summary SMS has been silently failing. Two callsites (lines 222 and 340).
2. Scanner only emails clients when `insertedLeads.length > 0`. There are **zero leads** in `trade_radar_leads` across all 7 verticals → zero emails have ever gone out → you got nothing.
3. No way to send a daily proof of work to subscribers on quiet days. That's the product gap that justifies refunds.

---

## Plan — full Mortgage Radar parity for all 7 trade radars

### 1. New function: `trade-radar-am-digest`
Mirror of `mortgage-radar-am-digest`. One function, all 7 verticals.

- Runs daily at 8am ET via pg_cron (same time as Mortgage Radar)
- For each vertical, for each active client in `trade_radar_clients`:
  - Pull last 24h leads in client's zip_codes
  - If leads exist: send the existing styled DWA email with top 5 cards + score badges + "Find Contact" buttons
  - If 0 leads: send a "0 new {vertical} signals fired in your 130 zips today — here's what we're watching" email with the watch-list (active monitors, sources scanned, signal types tracked)
  - SMS the client if any lead score ≥9
- POST `{test_sms: true}` mode → texts you (+13139921219) and Mitchell (+13136719441) immediately, bypassing quiet hours via the transactional product code "trade_radar_test"
- POST `{vertical: "roofing"}` runs only one vertical
- POST `{}` runs all 7

### 2. New function: `trade-radar-weekly-digest`
Mirror of `mortgage-radar-weekly-digest`. Mondays 8am ET.
- Per client per vertical: total leads scanned this week, top 10 leads, highest-score lead, best-performing signal type, week-over-week trend.

### 3. Fix the silent SMS bug in `trade-radar-scanner`
- Add `const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;`
- Line 222: `sendSMS(client.phone, TWILIO_PHONE_NUMBER, msg, "trade_radar")`
- Line 340: `sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, msg, "trade_radar")`

### 4. Cron schedules (pg_cron, all ET-aligned)
- `trade-radar-scanner-daily` — already exists at 1pm UTC; **move to 7am ET / 12:00 UTC** so leads land before the digest runs
- `trade-radar-am-digest-daily` — NEW, 8am ET / 13:00 UTC
- `trade-radar-weekly-digest` — NEW, Mondays 8am ET / 13:00 UTC

### 5. config.toml
Add `verify_jwt = false` for `trade-radar-am-digest` and `trade-radar-weekly-digest`.

### 6. Run the proof sequence today (after deploy)
1. Trigger `trade-radar-scanner` with `{"vertical":"all"}` → confirm response shows non-zero `inserted` per vertical, or surface real errors per source so I can patch them
2. Trigger `trade-radar-am-digest` with `{"test_sms": true}` → you + Mitchell get 7 confirmation texts (one per vertical)
3. Trigger `trade-radar-am-digest` with `{}` → you receive 7 branded emails (one per vertical) at matt@detroitwebagent.com — leads if any, watch-list if none
4. Trigger `mortgage-radar-am-digest` with `{"test_sms": true}` → fixes the missed test SMS from yesterday
5. Trigger `mortgage-radar-am-digest` with `{}` → today's mortgage email

### 7. Diagnose 0-leads-ever problem
The scanner has run but inserted nothing. Most likely causes (will inspect during step 6.1 by reading the response and edge-function logs):
- Anti-hallucination `validateLead()` quarantining everything (Google Address Validation rejecting addresses)
- Source scanners (NOAA, BSEED, etc.) returning empty/changed schemas
- Specific vertical scanners throwing inside the try/catch and being swallowed

Per-vertical fixes will be made inline based on what the response summary shows. The "0 leads → still send daily watch-list email" change in step 1 means **even if the per-vertical signal scrapers are partially broken, you still get your daily proof-of-work email** — which is what justifies the price.

---

## Technical specifics

**`trade-radar-am-digest` shape (mirrors mortgage-radar-am-digest exactly):**
- Vertical labels map: `roofing → "Roofing Radar"`, `hvac → "HVAC Radar"`, etc.
- Subject line rotation by signal type + day of week (HBS-level subject pattern from Phase 25)
- DWA teal/dark template via `dwaWrap()`
- "This week" accumulator panel querying last 7 days of `trade_radar_leads`
- Static Google Maps header with lead pins (reuses `GOOGLE_MAPS_API_KEY`)
- Per-lead: score badge, address, signal_detail, suggested_opener, days-since-signal, "Find Contact" Google search button
- 0-lead state: "Quiet day in your 130 zips" + bullet list of monitored sources for that vertical (e.g., for Roofing: "NOAA storm alerts, BSEED roof permits, FEMA disaster declarations, insurance claim filings")

**`trade-radar-weekly-digest` shape:**
- Saturday morning send (matches mortgage)
- Per vertical: total leads, score distribution, top 10 with click-through, best signal type
- Single combined email per client covering all verticals they're subscribed to

**Test SMS bodies (proof messages today):**
- "🏠 Trade Radar LIVE: Roofing Radar is scanning your 130 SE Michigan zips. — DWA"
- One per vertical to both you and Mitchell

**Out of scope (per your call):**
- Building the Arborist radar — skipped
- Trade-radar enrichment drain — defer to next phase

Confirm and I'll execute end-to-end: write the two new functions, fix the SMS bug, deploy, schedule cron, run the proof sequence, paste the actual response payloads back so you can see leads landing and emails sending.