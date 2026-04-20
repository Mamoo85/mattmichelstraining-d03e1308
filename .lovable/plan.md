

## The truth: NO postcards were actually sent.

**Evidence:**
- `postcard_campaigns` shows the Macomb nursing-home campaign as `status='mailed'`, `lob_batch_id` set, but `sent_count = 0`.
- `postcard_send_log` is **completely empty** — zero rows ever written.
- `postcard_prospects.postcard_sent_at` is NULL for **all 66 rows** — no prospect was ever marked as mailed.
- 33 prospects have addresses, 14 are in Macomb — none of them were actually pushed to Lob.

**Why it looked "mailed":**
The `send-postcards` function flips the campaign to `status='mailed'` even when zero Lob calls succeed (or when zero prospects matched the filter). It also never writes to `postcard_send_log` — that table exists but the function doesn't insert into it. So the UI shows "mailed" while reality is "nothing happened."

**Most likely root cause:**
The campaign filter `.ilike("county", campaign.county).is("postcard_sent_at", null).not("address_line1", "is", null)` returned 0 prospects (county case mismatch, or addresses got enriched after campaign creation, or the Lob API key is missing/invalid). The function then quietly marked the campaign mailed anyway.

---

## Plan: Honest postcard tracking

### A. Fix the lying status (`send-postcards/index.ts`)
1. Only set `status='mailed'` if `sentCount > 0`. If zero sends, set `status='failed'` and write the reason to a new `last_error` column.
2. **Insert one row into `postcard_send_log` per Lob call** (success AND failure) — capturing `lob_id`, address, `cost_cents`, `status` (`sent`/`failed`/`returned`), and the Lob error body if any.
3. Return Lob's full error in the JSON response so the admin UI can show it.

### B. Wire up Lob delivery webhooks (real tracking)
4. New edge function `lob-webhook` (verify_jwt=false) — receives Lob's `postcard.in_transit`, `postcard.delivered`, `postcard.returned_to_sender`, `postcard.processed_for_delivery` events. Updates `postcard_send_log.delivery_status` + `delivered_at`. Aggregates back to `postcard_campaigns.delivered_count` + `returned_count`.
5. Migration: add `delivered_at`, `expected_delivery_date`, `tracking_events JSONB` to `postcard_send_log`; add `delivered_count`, `returned_count`, `last_error`, `total_cost_cents` to `postcard_campaigns`.
6. Tell user to paste the webhook URL into Lob dashboard → Settings → Webhooks (one-time manual step).

### C. Per-postcard tracking UI (`AdminPostcardCampaigns.tsx`)
7. Add a "Send Log" expandable panel under each campaign card showing the live table:
   - Business name | City | Lob ID (clickable → Lob dashboard) | Status badge (queued/in_transit/delivered/returned/failed) | Sent at | Delivered at | Cost
8. Stat strip per campaign: **X queued · Y in transit · Z delivered · N returned · $C.CC spent**
9. "Resend Failed" button — re-runs only the failed prospects from `postcard_send_log`.
10. **"Diagnose" button** on every campaign — runs a dry-run that shows exactly how many prospects match, why others were skipped (no address / wrong county / already sent), and tests the Lob API key.

### D. QR conversion attribution
11. Append `?utm_campaign={campaign_id}` to the QR URL so `/hire-alert-trial` page logs `postcard_conversions` with the actual campaign ID. Currently the QR is generic — we can't tie a signup back to a specific mailing.

### E. Daily digest email
12. Cron `postcard-tracking-digest` (daily 8am ET) — emails Matt: cards in transit, delivered yesterday, returns, conversions, cost-per-acquisition per campaign. Skip if zero activity.

### Files touched
- `supabase/functions/send-postcards/index.ts` (fix status lie + write to send_log)
- `supabase/functions/lob-webhook/index.ts` (NEW)
- `supabase/functions/postcard-tracking-digest/index.ts` (NEW)
- `src/components/admin/AdminPostcardCampaigns.tsx` (send log panel + diagnose button)
- `src/pages/HireAlertTrial.tsx` (capture utm_campaign → postcard_conversions)
- 1 migration: new columns on `postcard_send_log` + `postcard_campaigns`

### What you'll need to do (one-time, ~3 min)
- Confirm `LOB_API_KEY` is set in Lovable secrets (I'll show you how to test it via the Diagnose button before we send anything else)
- Paste the webhook URL into Lob dashboard once webhook function deploys

### Risk / honesty
- I won't auto-resend the failed Macomb batch — first I make Diagnose tell you *why* it failed, then you click Resend if you want.
- Lob tracking lag is real: "delivered" status arrives 5-12 days after mailing. Digest will reflect that timeline honestly.

