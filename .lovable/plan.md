## What's actually broken (proven, not guessed)

I called the live `trade-radar-scanner` for 3 verticals just now:

| Vertical    | Raw signals | Inserted | Skipped (no address) |
|-------------|-------------|----------|----------------------|
| roofing     | 44          | **0**    | 44                   |
| plumbing    | 51          | **0**    | 51                   |
| electrical  | 69          | **0**    | 69                   |

Same pattern across all 7. The signal modules **are** fetching live data (NOAA, FEMA, BSEED, FFIEC, OSHA, EPA, etc.), but **they pack area-level / state-level / county-level data into the `address` field** ("Wayne; Oakland; Macomb counties", "MI — 50,000 new purchase loans", "FEMA DR-4789"). The anti-hallucination address validator (Google Address Validation) correctly rejects every one of them, and the scanner skips them with `return "skipped"` (lines 85-87 of `trade-radar-scanner/index.ts`).

So your "powerful search engine" pitch is technically true — it scans 8 sources per vertical — but only 1 source per vertical (BSEED ArcGIS, Detroit-only, last 14 days) actually returns street-level addresses. Everything else gets thrown away silently. That's why the daily emails say "no new signals (yet)".

The mortgage radar test SMS earlier defaulted to the **DWA work line** `+13139921219` and your brother `+13136719441` — not your personal `+13138064952`. So even when it "succeeded", you couldn't have received it on your personal phone.

---

## Fix Plan

### Part 1 — Make the 7 trade radars actually produce leads

**Step 1 — Stop pretending area signals are address signals.** Rewrite all 7 `_shared/trade-signals/signals-*.ts` modules so that area/county/state-level events emit **a different signal shape** that is NOT routed through the per-address validator:

- New signal kind: `area_alert` (NOAA hail zone, FEMA disaster, HMDA cohort, OSHA inspection cluster, EPA warning).
- Stored in a new `trade_radar_area_signals` table (zip/county/region scoped, not address-scoped).
- Surfaced in the daily email as **"Market Intel"** above the per-lead cards, e.g. *"⚠️ Hail damage reported across Oakland County yesterday — 3 days to call before insurance deadlines."*

**Step 2 — Add real per-address sources** (so per-lead cards stop being empty):

- **Statewide BSEED equivalents:** add Oakland County permits ArcGIS, Wayne County Treasurer property records, and the existing public-listings scrapers (`scrapers-public-listings.ts`) that already pull addressed listings.
- **For each vertical, pick the 2 best per-address sources** (e.g. roofing → BSEED roof permits + Oakland Co. permits + Zillow recently-sold homes; plumbing → DWSD water-main breaks + BSEED plumbing permits; electrical → BSEED electrical + LARA contractor licenses).
- Reuse the existing `firecrawl.ts`, `scrapers-public-listings.ts`, `scrapers-county-records.ts` shared modules — they're already battle-tested by mortgage radar.
- **EstateSales.net + Zillow FSBO** already power mortgage radar's 21 leads/24h. Plug those into roofing/painting/HVAC where home-turnover = inspection opportunity.

**Step 3 — Honor the client's zip filter.** Right now `SCANNERS[vertical](state)` is called with no zip filter. Pass `client.zip_codes` per-client so registry + waterfall results actually match the client's market. (Several modules already accept `zipFilter` but the scanner never passes it.)

**Step 4 — Add health-check + visibility:**

- Extend `trade-radar-health-check` to log per-source `(fetched, valid_address, skipped, quarantined)` counts.
- New admin page `/dwa-admin/trade-radar-health` showing source-by-source coverage, last-run time, and lead counts per vertical (matches the pattern Matt requested earlier — radar status dashboard).

**Step 5 — Backfill today.** After the rewrite deploys, manually invoke `trade-radar-scanner` with `vertical=all` for `state=MI`, then resend the daily-brief emails with real content (top 5 leads per vertical OR clear "no per-address leads but here's market intel for your zips" content with 2-3 area alerts).

### Part 2 — Mortgage radar SMS to personal + brother

**Step 6 — Default the test SMS to the *correct* numbers.** Update `mortgage-radar-am-digest` so when called with `{test_sms: true}` (no array), it uses **personal `+13138064952` + brother `+13136719441`** (NOT the DWA work line).

**Step 7 — Send today's mortgage SMS now.** Invoke the digest with explicit phones `["+13138064952","+13136719441"]` and message body that includes today's actual top-3 leads (we already have 7 fresh leads scored 7-8 from FSBO + fixer-upper, sample below):

> 🏠 Mortgage Radar — May 2: 3 hot FSBO leads in your zips today. Top: 1683 Delta Drive, Troy 48085 (John Kowalski, score 8/10). Full list: detroitwebagent.com/my-mortgage-radar — DWA

Confirm Twilio `sendSMS` returns `sid` for both numbers. Log to `radar_lead_outcomes` so we can prove delivery in the admin.

---

## Technical details

- Scanner skip logic: `supabase/functions/trade-radar-scanner/index.ts` lines 83-87. Will keep the address gate for `signal.address` that *claims* to be a street, but will **not** skip `area_alert` rows.
- New table migration: `trade_radar_area_signals (id, vertical, zip, county, region, alert_type, alert_detail, source, expires_at, created_at)` with same RLS pattern as `trade_radar_leads` (service_role bypass + admin via `has_role`).
- Scanner becomes per-client (loops `trade_radar_clients` once, calls each vertical with that client's `zip_codes`) instead of state-wide once-per-vertical.
- Email template gains an "AREA INTEL" section above the per-lead cards. If both arrays are empty for a client, send a "scanning continues — 0 per-address signals matched today" with a link to global market intel so we never send the empty stub again.
- Mortgage SMS fix is a 4-line change in `mortgage-radar-am-digest/index.ts` line 196.
- Will create one tracked task per part so progress is visible.

---

## What I will NOT do without explicit OK

- Add new external API costs (Apollo, Hunter, etc.) — will only use sources already wired in `_shared/`.
- Change the anti-hallucination gate or score caps — those exist for a reason.
- Touch any M2 Training code/email/branding (you flagged the M2 audit as a separate later task).
- Email any real client until you confirm the rewrite produces non-zero leads in your inbox first.

Approve this and I'll switch to build mode and execute steps 1-7 in order, sending you the mortgage SMS as the **first** action so you have proof of life within minutes.