

# Pre-Launch System Audit Report

## CRITICAL FINDINGS (Production Blockers)

### FINDING 1: Five Missing Database Tables
The following tables are referenced by edge functions but **do not exist in the database**:

| Missing Table | Used By | Impact |
|---|---|---|
| `system_comms_log` | `_shared/twilio.ts` (every SMS send) | All SMS logging silently fails |
| `sms_opt_outs` | `_shared/twilio.ts` (TCPA compliance) | Opt-out checks fail, TCPA violation risk |
| `compliance_blocks` | `_shared/twilio.ts` | Compliance audit trail missing |
| `contractor_lead_purchases` | `stripe-webhook` PPL handler | Payment records lost after purchase |
| `contractor_lead_views` | `create-contractor-ppl-checkout` FOMO engine | Miss-tracking silently fails |

**Impact**: Every `sendSMS()` call creates a Supabase client, queries `sms_opt_outs` (table doesn't exist — query returns error, but `maybeSingle()` gracefully returns null), then tries to insert into `system_comms_log` (fails silently via `.then().catch()`). SMS still sends but zero logging or compliance protection.

### FINDING 2: Missing Columns on `contractor_leads`
The `contractor_leads` table has these columns: `id, client_id, created_at, email, message, name, phone, project_type, notified_at, site_id, source, status`.

The PPL checkout and webhook reference these **missing columns**:
- `checkout_locked_by` — soft lock logic completely broken
- `lock_expires_at` — soft lock logic completely broken  
- `payment_session_id` — idempotency check broken (duplicate SMS possible)
- `paid_by_contractor_id` — purchase attribution lost
- `payment_amount_cents` — payment amount not recorded

**Impact**: The `create-contractor-ppl-checkout` function will fail when updating `checkout_locked_by` and `lock_expires_at`. The webhook's idempotency guard (`existingLead?.payment_session_id === session.id`) will never match because the column doesn't exist — **duplicate Twilio texts will fire on webhook retries**.

### FINDING 3: `ANTHROPIC_API_KEY` Not in Secrets
The secrets list does NOT include `ANTHROPIC_API_KEY`. This means:
- `test-license-vision` will return "ANTHROPIC_API_KEY not set"
- `license-vision-intake` will fail on every MMS
- `generate-digital-audit` will fail
- `handle-dead-lead-reply` AI classification will be skipped
- `ai-reply-detector` will fail

### FINDING 4: Build Error — `_shared/twilio.ts` PromiseLike
The `.then().catch()` pattern on Supabase insert calls fails Deno type checking because the Supabase client returns `PromiseLike` (which has `.then()` but not `.catch()`). This is the active build error blocking deployment of **every function that imports `_shared/twilio.ts`** — potentially dozens of functions.

**Fix**: Replace all 5 instances of `.then(() => {}).catch(() => {})` with either `await` or wrap in `Promise.resolve(...).catch(...)`.

---

## MODERATE FINDINGS

### FINDING 5: Hardcoded Phone Number Fallback
Line 16 of `_shared/twilio.ts`: `ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952"`. This is acceptable as a fallback (Matt's number), but `ADMIN_PHONE` is not in the secrets list — it will always use the hardcoded value.

### FINDING 6: No DB Trigger for Email-to-Comms-Log Sync
The query for triggers matching "comms" or "email_send" returned zero results. The `system_comms_log` table doesn't exist (Finding 1), so there's no trigger to audit — but once the table is created, the trigger for syncing `email_send_log` entries also needs to be created.

### FINDING 7: Stripe Session Expiry Timing
`expires_at: Math.floor(now.getTime() / 1000) + 1800` — This is 30 minutes from `now`, which was captured at the top of the request handler. By the time Stripe processes the request, a few seconds have passed. Stripe requires `expires_at` to be at least 30 minutes in the future from their server time. In rare cases of slow processing this could fail. Low risk but worth noting.

### FINDING 8: PPL Lock Race Condition
The soft lock in `create-contractor-ppl-checkout` has a TOCTOU (time-of-check-time-of-use) race condition. Between reading the lead status (line 30-34) and updating the lock (line 84-88), another contractor could also read "available" and both acquire the lock. This is a narrow window but real under load. A Postgres advisory lock or `UPDATE ... WHERE status != 'sold'` returning the updated row would be more robust.

---

## CLEAN FINDINGS (No Issues)

### TechAlert Cron Schedules
- Trial conversion: `0 * * * *` (hourly) — correct for 72h trial expiry checks
- Phantom alert: `30 13 * * *` (1:30pm UTC = 8:30am ET) — correct
- Both use vault-based URL resolution — correct pattern

### `test-license-vision` Claude API Payload
The payload structure perfectly matches the Anthropic Messages API:
- `type: "image"` with `source: { type: "base64", media_type, data }` — correct
- `model: "claude-haiku-4-5-20251001"` — correct model ID
- JSON extraction regex `rawText.match(/\{[\s\S]*\}/)` — correct

### AdminSimulationSuite Payloads
- Vision OCR: sends `{ image_base64, mime_type }` — matches `test-license-vision` input exactly
- Digital Audit: sends `{ url }` — matches `generate-digital-audit` input
- AI Classifier: sends parsed JSON with `senderEmail`, `replyBody`, `originalSubject` — matches `ai-reply-detector`
- Lead Notify: sends mock payload with `_test` flag — correct pattern

### Stripe Webhook Idempotency (Logic)
The idempotency check logic itself is correct (`status === "sold" && payment_session_id === session.id`). The issue is that the column doesn't exist (Finding 2), not the logic.

---

## IMPLEMENTATION PLAN

### Step 1: Fix `_shared/twilio.ts` Build Error (Unblocks all SMS functions)
Replace all 5 `.then(() => {}).catch(() => {})` chains with `Promise.resolve(...).catch(() => {})` or convert to `await` with try/catch.

### Step 2: Create Missing Tables (Migration)
```sql
-- sms_opt_outs, compliance_blocks, system_comms_log,
-- contractor_lead_purchases, contractor_lead_views
-- Plus email_send_log → system_comms_log trigger
```

### Step 3: Add Missing Columns to `contractor_leads`
```sql
ALTER TABLE contractor_leads ADD COLUMN checkout_locked_by TEXT;
ALTER TABLE contractor_leads ADD COLUMN lock_expires_at TIMESTAMPTZ;
ALTER TABLE contractor_leads ADD COLUMN payment_session_id TEXT;
ALTER TABLE contractor_leads ADD COLUMN paid_by_contractor_id TEXT;
ALTER TABLE contractor_leads ADD COLUMN payment_amount_cents INTEGER;
```

### Step 4: Add `ANTHROPIC_API_KEY` Secret
Use the add_secret tool to request Matt inputs the Anthropic API key.

### Step 5: Redeploy All Affected Edge Functions
After the twilio.ts fix, redeploy all functions that import it.

---

## SELF-VERIFICATION

**What I reviewed (actual code, not docs)**:
- `_shared/twilio.ts` — every line, all 5 fire-and-forget inserts
- `create-contractor-ppl-checkout/index.ts` — full file, lock logic, Stripe session config
- `stripe-webhook/index.ts` — lines 1-600 and 2447-2574 (PPL payment handler)
- `test-license-vision/index.ts` — full file, Claude API payload structure
- `AdminSimulationSuite.tsx` — full file, all simulation button payloads
- `license-vision-intake/index.ts` — full file
- Migration `20260411230000_hire_alert_trial.sql` — cron schedules
- Database schema queries — verified actual columns/tables exist

**Assumptions you must manually verify**:
1. Whether `ANTHROPIC_API_KEY` is set under a different name or injected another way (it's not in the secrets list I received)
2. Whether there are additional migrations that create the missing tables but haven't been applied yet (check if any pending migrations exist)
3. Whether the `email_send_log` table exists (needed for the comms log sync trigger)
4. The Stripe webhook endpoint URL is correctly registered in the Stripe dashboard for the PPL `checkout.session.completed` event

