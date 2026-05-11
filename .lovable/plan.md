## What's actually broken (root causes confirmed in DB + code)

### 1. Email Open/Click 0.0% across every template — **`resend-webhook` function does not exist**
The dashboard literally says "Requires Resend webhook → resend-webhook fn". I ran `ls supabase/functions/resend-webhook` → **No such file or directory**. Resend has nowhere to POST `email.opened`/`email.clicked` events, so all rates will be 0% forever until the function is built.

### 2. LO Outreach "NMLS refresh: 0 new prospects" — **target table doesn't exist**
`find-lo-prospects` upserts into `public.marketplace_prospects`. I queried the DB: that table does not exist. Every upsert silently errors → 0 inserted. The MI_MLO_SEED list of ~40 lenders can't land. The whole LO Outreach product is non-functional.

### 3. Talent Radar Hub "Pending 66 · Enriched 0 · Stuck >2h 66 · Last scan: never" — **3 wrong queries in EnrichmentHealthStrip**
- Code counts rows where `enrichment_status = 'enriched'`. The actual values used in the table are: `complete`, `pending`, `enriching`, `exhausted`, `manual_workbench`. **No row will ever match `enriched`** → that pill is hard-stuck at 0 even when 79 rows are actually `complete`.
- "Last scan" queries `hire_alert_runs.run_at`, but the scanner writes `started_at`/`created_at` and leaves `run_at` NULL. Most recent real run was today 11:02 UTC, but the strip shows "never".
- The 66 "stuck" rows are real — they're `pending` and >2h old because the enrich worker stopped completing them. Need to verify the cron is running post worker-pool fix.

### 4. Auto-Blast "Sent 0 of 10 · Scraped 0 · enriched 0 · suppressed 0 · 1 failure"
`contractor-outreach-auto-blast` orchestrates: scrape → enrich → email. "Scraped 0 / 1 failure" means the internal `invokeFn("contractor-outreach-scrape", …)` call returned non-ok and the pipeline aborted. Most likely cause given recent context: `GOOGLE_MAPS_API_KEY` quota or the scrape function itself erroring. Need to pull the function's log to confirm before touching code.

### 5. Workbench "No contact found for Delta T Group / PrideStaff Detroit"
These are `techalert_business_prospects` rows. The table only has columns `phone`, `email`, `website` — no enriched contact stack. The "Draft with Opus" button refuses because `email` is null. The cherry-pick UI surfaces candidate matches (Kai Ho, Aaron Trudgeon, etc.) from a *different* table, but those aren't linked back to the prospect → enrich step never writes an email onto the prospect row. Two acceptable fixes — needs your call (see Open Question).

### 6. Prospect Tracker "Update failed: Could not query the database for the schema cache. Retrying."
The Mark-dead handler runs `supabase.from("prospect_nudges").update({ status }).eq("id", id)`. The error is PostgREST's schema cache reload error, which is a known transient symptom when the Cloud instance just came back up. It usually resolves in 2–5 minutes once PostgREST finishes reloading. If it persists, force a reload with `NOTIFY pgrst, 'reload schema'`. No code change needed — verify only.

### 7. Sidebar issues
None — screenshots 142058 / 142946 / 143058 are the same products surfaced above. No separate bugs.

---

## Fix order

**Step 1 — Verify (no code, 1 min)**
- Re-test "Mark dead" on the Prospect Tracker. If it works now, that confirms #6 was the PostgREST cache reloading after Cloud upgrade. If it still fails, run `NOTIFY pgrst, 'reload schema';` once via a migration.

**Step 2 — Talent Radar Hub stats (small frontend fix, ~5 min)**
Edit `src/components/admin/EnrichmentHealthStrip.tsx`:
- Change the "Enriched" count from `.eq('enrichment_status','enriched')` → `.eq('enrichment_status','complete')`.
- Change the "Last scan" query from `.order('run_at', …)` → `.order('started_at', …)` and read `started_at` (or `completed_at` for finished runs).
- Result: pill flips from `0` → `79`, "never" → "today 11:02 UTC", and CRITICAL banner downgrades once stuck count clears.

**Step 3 — Resend webhook (new edge function + Resend dashboard wiring, ~15 min)**
- Create `supabase/functions/resend-webhook/index.ts` with `verify_jwt = false`. Accept Resend event payloads, verify signature with `RESEND_WEBHOOK_SECRET` (new secret to add), and upsert `opened_at` / `clicked_at` / `bounced_at` / `complained_at` columns on `email_send_log` keyed by `message_id` (Resend's `data.email_id`).
- Add the missing columns to `email_send_log` (opened_at, clicked_at, bounced_at, complained_at) via migration.
- Tell user the webhook URL to paste into resend.com → Webhooks: `https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/resend-webhook`, subscribe to `email.opened`, `email.clicked`, `email.bounced`, `email.complained`.
- AdminEmailLog dashboard already reads `email_send_log` — open/click columns will populate automatically.

**Step 4 — LO Outreach NMLS table (migration, ~5 min)**
- Create `marketplace_prospects` table the function expects: nmls_id (text unique), full_name, company, city, state, phone, email, source, fetched_at, created_at, plus RLS (service_role bypass + admin read).
- Confirm `find-lo-prospects` then inserts the ~40 seed lenders on next click.
- (Optional, separate task) Wire the NMLS Consumer Access scrape behind a Browserless fetch since Apollo free-tier returns 0; not required for the button to start working today.

**Step 5 — Auto-Blast diagnostic (logs first, then fix)**
- Pull `contractor-outreach-auto-blast` and `contractor-outreach-scrape` recent edge logs (no code change yet) to find which step actually fails. Three plausible causes: (a) Google Maps key quota/billing, (b) scrape function 500ing, (c) suppression list claiming everyone. Fix once root cause is in hand. Do not guess-patch.

**Step 6 — Workbench enrichment → prospect link** — needs your decision, see Open Question.

---

## Open Question (need your input before Step 6)

For the "No contact found for Delta T Group / PrideStaff Detroit" workbench errors, two ways to fix:

- **(A)** When a cherry-pick candidate is selected (e.g. Aaron Trudgeon's email/phone), copy that contact onto the `techalert_business_prospects` row so "Draft with Opus" can fire immediately. Faster path, gets you drafting today.
- **(B)** Wire the existing Apollo→Hunter→Snov enrichment waterfall into a button on each prospect card ("Enrich Contact"), and only allow drafting once it succeeds. Cleaner long-term, but you're hitting Apollo/Hunter on every click.

Which do you want — A, B, or both?

## Technical Notes (for me)

- All fixes target the **primary** Lovable-managed project (`eauvubfpanpeuxsrqesu`).
- The `resend-webhook` will need `RESEND_WEBHOOK_SECRET` added via the secrets tool — Resend generates this when you create the webhook on their dashboard.
- The PostgREST schema cache issue (#6) commonly self-heals within 2–5 minutes after a Cloud instance comes back up. No fix unless still failing 10 min from now.
- The Talent Radar Hub `EnrichmentHealthStrip` fix is the only purely visual/data-display change — all the others touch backend.
