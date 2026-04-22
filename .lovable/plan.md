
## Three Additions to the Prospect Tracker

All three pieces reuse existing patterns — the approval flow already works for dead-lead replies (Matt texts "A" or "E ..." back), and the StatusCallback pattern already works for contractor welcome SMS. We're cloning those into the prospect-nudge lane.

---

### 1. Twilio Delivery Callbacks → Prospect Log (no duplicate retries)

**New edge function** `prospect-nudge-status-callback` (verify_jwt = false)
- Receives Twilio's POST (`MessageSid`, `MessageStatus`, `ErrorCode`)
- Looks up `system_comms_log` row by `provider_id = MessageSid` and updates a new column `twilio_status` + `twilio_error_code`
- Also updates `prospect_nudges` (matched via `last_nudge_sid`): writes `last_nudge_status` (`queued`/`sent`/`delivered`/`undelivered`/`failed`)

**Modify `dwa-send-sms`** (one-line additive change)
- When `product === "dwa_prospect_nudge"`, append `StatusCallback=<function-url>` to the Twilio POST body. No other product paths touched.

**New columns** on `prospect_nudges`: `last_nudge_sid text`, `last_nudge_status text`, `last_nudge_error text`, `nudge_retry_count int default 0`

**Retry logic — duplicate-safe** (new edge function `prospect-nudge-retry`, cron every 30 min)
- Picks rows where `last_nudge_status IN ('undelivered','failed')` AND `nudge_retry_count < 2` AND `nudge_sent_at < now() - 30 min`
- Hard guard: skips any row whose latest `system_comms_log` entry for that phone in the last 24h is `status='sent'` or `twilio_status='delivered'` (prevents double-sends if Twilio's callback was just slow)
- Re-sends via `dwa-send-sms`, increments `nudge_retry_count`, updates `last_nudge_sid` to the new SID
- Uses Postgres advisory lock per `prospect_nudges.id` so two cron runs can't double-fire
- After 2 failed retries → marks `status='dead_undeliverable'` and SMSes Matt

**Why no duplicates:**
- Only retries when Twilio confirms `undelivered`/`failed` (not on missing callback — silent gaps are NOT retried)
- 24h dedup against `system_comms_log` blocks accidental re-sends
- Advisory lock blocks concurrent cron overlap
- Hard cap at 2 retries

---

### 2. Admin Grid View

**Modify** `src/components/dwa-admin/AdminProspectTracker.tsx` — add a **"📊 Grid"** view toggle next to the existing card view.

Grid columns:
| Phone · City | Trade | Last Contact | Status | Nudges | Delivery | Action |
|---|---|---|---|---|---|---|
| (734) 620-7178 · Livonia | electrical | 12m ago | 🟢 active / 🟠 stalled / 🔴 dead | 2× | ✓ delivered / ✗ failed / ⏳ queued | **[Send Next Nudge]** |

- Sortable by Last Contact / Status / Nudge count
- Quick filter chips reuse existing All / Active / Stalled / Converted
- "Send Next Nudge" button = same handler as today, but routes through the new approval queue (see #3)
- Delivery column reads `last_nudge_status` (live via existing realtime subscription)
- Toggle (cards ↔ grid) persisted in `localStorage`

---

### 3. Y/Approval Workflow for Outbound Nudges

**Reuses** the existing `sms_reply_drafts` table + `inbound-sms-relay` "A"/"E …" handler — same flow Matt already uses for dead-lead replies. No new approval infrastructure.

**Change to `sendNudge()` in `AdminProspectTracker.tsx`:**
1. Replace `window.confirm` + direct `dwa-send-sms` call with a draft insert:
   ```ts
   supabase.from("sms_reply_drafts").insert({
     phone: p.phone,
     draft_body: body,
     status: "pending",
     metadata: { source: "prospect_nudge", prospect_id: p.id, template: "dwa_prospect_nudge" }
   })
   ```
2. Then call new edge function `prospect-nudge-request-approval` which texts Matt:
   > 📋 NUDGE DRAFT for (734) 620-7178 · Livonia electrical:
   > "Hey — Matt with Detroit Web Agency..."
   >
   > Reply **Y** or **A** to send · **E <new text>** to edit · **N** to cancel

**Modify `inbound-sms-relay`** (additive, ~15 lines):
- Accept **Y** as alias for **A** (matches the user's request wording)
- Add **N** (cancel) handler: marks draft `status='cancelled'`, replies "❌ Cancelled, nothing sent"
- When the approved draft has `metadata.source === 'prospect_nudge'`, after successful send: stamp `prospect_nudges.nudge_sent_at`, increment `nudge_count`, store the returned `sid` to `last_nudge_sid` (so the StatusCallback in #1 can match it)

**UI feedback in tracker:**
- Card/grid shows "⏳ Awaiting your Y" badge while a `pending` draft exists for that prospect
- Realtime subscription on `sms_reply_drafts` flips badge to "✅ Sent" or "❌ Cancelled"
- "Send Next Nudge" button disabled while a pending draft exists (no double-queueing)

---

### Files

**New (5):**
- `supabase/functions/prospect-nudge-status-callback/index.ts`
- `supabase/functions/prospect-nudge-retry/index.ts`
- `supabase/functions/prospect-nudge-request-approval/index.ts`
- `supabase/migrations/<ts>_prospect_nudge_delivery.sql` — 4 new columns on `prospect_nudges`, 2 new columns on `system_comms_log` (`twilio_status`, `twilio_error_code`) only if missing, cron schedule for retry function
- `supabase/config.toml` entries: `verify_jwt = false` for the 3 new functions

**Edited (3):**
- `supabase/functions/dwa-send-sms/index.ts` — adds StatusCallback URL only when `product === "dwa_prospect_nudge"` (one conditional, every other code path unchanged)
- `supabase/functions/inbound-sms-relay/index.ts` — adds Y alias, N cancel, prospect_nudge post-send hook (~15 additive lines, existing dead-lead flow untouched)
- `src/components/dwa-admin/AdminProspectTracker.tsx` — grid view toggle, approval flow swap, pending-draft badge

### Code-safety guarantees
- ✅ Zero changes to `stripe-webhook` or any contractor signup path
- ✅ `dwa-send-sms` change is product-gated — only `dwa_prospect_nudge` product gets the new StatusCallback; all 80+ other callers unaffected
- ✅ `inbound-sms-relay` changes are additive (Y alias, N handler, post-send hook) — existing "A" approval flow for dead-lead drafts works identically
- ✅ Retry function has 4 layers of duplicate prevention: terminal-status gate, 24h log dedup, advisory lock, hard cap
- ✅ All new functions use `verify_jwt = false` per project standard for webhook/cron endpoints
- ✅ RLS on new columns inherits existing `prospect_nudges` policies (admin + service_role)
