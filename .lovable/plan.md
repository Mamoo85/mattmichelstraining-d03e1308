## What we have today vs. what's missing

**We have:**
- `industrial_supply_buyers` table (66 buyers across HVAC, Electrical, Plumbing, Building Materials, Welding/CNC) — but only `email` + `city`. **No phones. No fax numbers. No mailing addresses.**
- `BuyerOutreachDialog` + `dossier-cold-outreach-bulk` — works for **email only** right now.
- Standalone Fax / SMS / Postcard tabs that scrape Google Maps for random Michigan trades — totally disconnected from Growth Signals.

**We're missing:** the bridge. Fax/SMS/Postcard buttons on the signal cards, an enriched DB with phone/fax/address, and a single dispatch engine that fans the dossier tease out across all 4 channels.

## The plan — 4 parts

### 1. Enrich the buyer DB with phone, fax, and mailing address

Add 3 columns to `industrial_supply_buyers`: `phone`, `fax`, `address` (street, used for postcards). Then build a one-shot enrichment function `enrich-supply-buyers` that:

- Pulls each buyer's company name + city
- Hits **Google Places API** (we already have `GOOGLE_MAPS_API_KEY`) — Place Details returns formatted_address + formatted_phone_number
- For fax numbers, scrapes the buyer's website footer/contact page using a lightweight regex (`/fax[:\s]*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/i`) — Browserless renders the page, we already have that key
- Writes back to the row, sets `enrichment_status` = `enriched` or `partial`
- Skips already-enriched rows (idempotent)
- Admin-only trigger button in the dialog: "🔎 Enrich missing contact info" — runs in background, refreshes list when done

Coverage we expect after a single run: ~90% phone, ~70% address, ~30% fax (fax is dying — that's fine, we mark `fax_capable=false` for the rest).

### 2. Unify the existing channels — one engine to rule them all

Build `signal-channel-blast` edge function. Single endpoint:

```
POST /signal-channel-blast
{
  signal_id: uuid,
  buyer_ids: uuid[],     // selected from BuyerOutreachDialog
  channels: ('email' | 'fax' | 'sms' | 'postcard')[]
}
```

For each buyer × each channel:
- **Email** → re-uses existing `dossier-cold-outreach` (already shipped) — dossier PDF link in body
- **SMS** → 160-char tease + short `wa.me`-style cancel link, queued through `email_reply_drafts`-style ghost delay table `sms_outreach_drafts` (10-min cancel window, TCPA quiet-hours via `_shared/twilio.ts`)
- **Fax** → 1-page cover sheet via Sinch (we just wired that up) — body = "Randazzo Mechanical 30-day spend window — full dossier at [bit.ly link]"
- **Postcard** → 6×4 via Lob — front: bold "Randazzo Mechanical is hiring 9 trades — they need {vertical} supplies"; back: dossier QR code linking to the signed PDF URL

Logs every send to a new `signal_outreach_log` table with `(signal_id, buyer_id, channel, status, cost_cents, sent_at, error)` for the per-signal ROI report.

Hard rules baked in:
- 30-day dedup per buyer × channel × signal (so we don't spam the same plumbing distributor about the same Randazzo signal across 4 channels in one week)
- Daily cap **per channel, across all signals**: SMS 150/day, Fax 80/day, Postcard 80/day (matches existing CAPS, prevents budget blowout)
- One consolidated SMS to Matt summarizing the whole batch ("Randazzo blast: 8 emails + 6 SMS + 4 faxes + 4 postcards queued. Total cost: $4.62. Cancel-all: <link>")

### 3. Upgrade BuyerOutreachDialog with the channel toggles

Add a channel-picker row at the top of the dialog (above the buyer list):

```
[ ✓ Email ]  [ ✓ SMS ]  [ ✓ Fax ]  [ ✓ Postcard ]
   (8 ready)   (6 ready)  (3 ready)  (5 ready)
```

Numbers are live counts of selected buyers who have the required contact field populated. Each buyer row gets small icons next to their name showing which channels they're reachable on (`📧 📱 📠 ✉️`) — greyed out if missing.

The "Send to N buyers" button changes to **"Send N emails + N SMS + N faxes + N postcards"** showing the total cost estimate (`$X.XX`) before commit.

### 4. Visible ROI badge on the signal card

Under each signal card, replace the static "X HVAC + Electrical buyers ready to pitch" line with live counts from the new log table:

```
📧 8 emailed · 📱 6 SMS · 📠 3 faxes · ✉️ 4 postcards · 2 replies — $4.62 spent
```

Click → opens a per-signal log drilldown showing every send + reply + cost.

## Volume + cost per click

Realistic Randazzo-class signal: 8 buyers selected, all 4 channels:
- 8 emails (free) + 8 SMS ($0.06) + 3 faxes ($0.21) + 8 postcards ($6.80) = **~$7.07 total spend**
- One physical postcard hits the branch manager's desk 3 days later — that's the killshot
- All cancellable from the SMS preview within 10 minutes

If even **one** of those 8 supply houses converts to a $50/5-pack, ROI is 7×. If they upgrade to the $99/mo Demand Radar subscription shown on the screenshot, ROI is 14× in month 1.

## Technical changes

**Migrations**
- `<ts>_supply_buyers_enrichment_columns.sql` — add `phone`, `fax`, `address`, `state`, `zip`, `enrichment_status`, `enriched_at`, `last_outreach_at` to `industrial_supply_buyers`
- `<ts>_signal_outreach_log.sql` — new table, RLS service_role + admin SELECT, indexes on `(signal_id)`, `(buyer_id, channel, sent_at)`
- `<ts>_sms_outreach_drafts.sql` — ghost-delay queue mirroring `email_reply_drafts` shape

**New edge functions**
- `enrich-supply-buyers` — Google Places + Browserless fax scrape, idempotent
- `signal-channel-blast` — unified dispatcher (email→reuses dossier-cold-outreach, sms→Twilio shared sender, fax→Sinch, postcard→Lob)
- `signal-outreach-cancel-bulk` — one-tap kill for any in-flight batch

**Modified files**
- `src/components/admin/BuyerOutreachDialog.tsx` — channel toggle row, per-buyer reachability icons, cost preview, calls new endpoint
- `src/components/admin/AdminGrowthSignals.tsx` — replace static buyer-count line with live log-driven badge; add "Enrich contacts" admin button in dialog header
- `supabase/config.toml` — register 3 new functions with `verify_jwt = false`

**Reused as-is**
- Existing Sinch fax credentials (just added)
- Existing `LOB_API_KEY`, `BROWSERLESS_API_KEY`, `GOOGLE_MAPS_API_KEY` secrets
- `_shared/twilio.ts` sendSMS (TCPA + opt-out scrub baked in)
- `dossier-cold-outreach` (email path stays untouched)

## What this does NOT do

- No automatic per-day cron blast — every send is one click from the signal card (manual-only mandate respected)
- No new Stripe products — this is internal outreach tooling
- No change to the standalone Fax/SMS/Postcard tabs — those keep working for Matt's daily Michigan trade prospecting (different use case)
- No buyer-side opt-in flow — these are B2B branch managers, exempt under TCPA EBR + B2B fax rules; we still honor STOP replies via shared SMS handler

After approval I'll build it in default mode.