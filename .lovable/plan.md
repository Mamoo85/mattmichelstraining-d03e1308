

# Paranoia Sweep Re-Audit — What's Fixed, What's Still Broken

I checked Claude's 11 findings against the current codebase. Here's the honest scorecard:

## ✅ Already fixed (8 of 11)

| ID | Status | Evidence |
|---|---|---|
| GHOST-1 | ✅ Fixed | `agency-payment-reconcile/index.ts` covers TechAlert, FieldDesk, ContractorLeads, MortgageRadar |
| GHOST-2 | ✅ Fixed | `email_sent_at` column + reconcile loop re-fires unsent dossiers |
| GHOST-3 | ✅ Fixed | PDF call awaited with 25s `AbortSignal.timeout` + `notifyMatt` on failure (webhook line 1308–1323) |
| MALICIOUS-1 | ✅ Fixed | `dead-lead-intake` 500-lead cap + field truncation (lines 16–17, 86–98) |
| MALICIOUS-2 | ✅ Fixed | Campaign rollback on contacts insert failure wrapped in try/catch (lines 237–244) |
| MALICIOUS-3 | ✅ Fixed | UUID + email regex validation in `create-marketplace-lead-checkout` (lines 45–57) |
| TOKEN-1 | ✅ Fixed | `queryClient.ts` global 401/PGRST301 handler signs out expired sessions |
| PARTIAL-2 | ✅ Fixed | `dead-lead-drip` already uses ONE atomic update (line 228–230) — was a false positive |

## 🔴 Still broken (3 of 11) — these are the ones to patch

### PARTIAL-1 — Idempotency guard fires BEFORE fulfillment (architectural)
**File**: `supabase/functions/stripe-webhook/index.ts` lines 281–297
**Problem**: `processed_stripe_events` row is inserted FIRST. If provisioning fails after that, the function returns 500, Stripe retries, the dedupe guard fires "duplicate", returns 200, and the customer is **charged but never provisioned with no recovery path**.
**Fix**: Add `fulfillment_status` column (`pending` / `completed` / `failed`). On entry: insert with `pending`. On success of each branch: update to `completed`. On dedupe hit, allow re-entry if existing row is still `pending` and older than 60 seconds. Reconcile cron re-fires `pending > 1h`.

### PARTIAL-3 — TechAlert/FieldDesk/etc. provision but welcome email lost
**File**: `supabase/functions/stripe-webhook/index.ts` lines ~883–1028 (TechAlert), and same shape for FieldDesk, Contractor, MortgageRadar branches
**Problem**: Same root as PARTIAL-1. If `hire_alert_clients` insert succeeds but `auto-onboard` or Resend fails → 500 → Stripe retry → dedupe guard short-circuits → customer has a row but no welcome email, no dashboard setup.
**Fix**: Same `fulfillment_status` pattern. The reconcile cron already re-fires `auto-onboard` for unprovisioned customers — extending it to also re-fire when `processed_stripe_events.fulfillment_status = 'pending'` closes the loop.

### TOKEN-2 — FieldDesk Tech App PIN auth uses anon key with no client_token gate
**Files**: `src/pages/FieldServiceTechApp.tsx`, `src/components/field-service/DispatchBoard.tsx`
**Problem**: PIN login bypasses Supabase auth. All `supabase.from("field_service_jobs")` calls run as anon. RLS on `field_service_jobs` is admin-only via `has_role()` — which means **the queries currently work only because of the service role being injected somewhere, or they silently fail**. Need to verify: either (a) tech app is actually broken in prod, or (b) RLS has a hidden policy allowing anon. Either way, the architecture is wrong: it should use a signed `tech_session_token` validated server-side.
**Fix**: Create `tech-session-validate` edge function. PIN login mints a JWT-like token. All tech app queries go through edge functions (`tech-jobs-get`, `tech-job-update`) that validate the token. Strip direct `supabase.from()` calls from the tech app.

## What I'll ship

### New migration `<ts>_partial_failure_recovery.sql`
- `ALTER TABLE processed_stripe_events ADD COLUMN fulfillment_status text DEFAULT 'pending'`
- `ALTER TABLE processed_stripe_events ADD COLUMN fulfillment_completed_at timestamptz`
- Partial index on `(processed_at) WHERE fulfillment_status = 'pending'`
- New table `tech_sessions(token PK, tech_id, client_id, expires_at)`

### Edge function changes
- `stripe-webhook/index.ts`:
  - Idempotency guard: allow re-entry on `pending` rows older than 60s (Stripe retries are ~immediate then exponential)
  - On successful completion of each product branch: `UPDATE processed_stripe_events SET fulfillment_status='completed'`
  - On caught error inside a branch: `UPDATE ... SET fulfillment_status='failed'` + `notifyMatt`
- `agency-payment-reconcile/index.ts`:
  - Add 4th check: query `processed_stripe_events WHERE fulfillment_status='pending' AND processed_at < now() - interval '1 hour'` → re-fire by event type
- New `tech-session-create` (PIN → token), `tech-session-validate` (used by tech-jobs-* functions)
- New `tech-jobs-get`, `tech-job-update` (proxies that validate token)

### Frontend
- `src/pages/FieldServiceTechApp.tsx`: replace direct `supabase.from("field_service_jobs")` with `supabase.functions.invoke("tech-jobs-get" / "tech-job-update")`
- `src/components/field-service/DispatchBoard.tsx`: same swap
- Store `tech_session_token` in localStorage; pass in body of every call

### Verification (live in build mode)
1. Curl `stripe-webhook` with synthetic `checkout.session.completed`, force inner failure → confirm row in `processed_stripe_events` is `pending`, returns 500, Stripe-style retry → second call enters branch, completes, marks `completed`
2. Curl reconcile cron → confirm it picks up old `pending` rows
3. Run tech app PIN login → confirm token issued, jobs fetched via edge function, no direct DB access

## Honest scope
~2 hours. One ship. After this, the 11 findings are 11/11 closed and the webhook is self-healing.

## Not touching
The 8 already-fixed items. `dead-lead-drip` (false positive — was already atomic). Marketplace flow (already audited last session).

