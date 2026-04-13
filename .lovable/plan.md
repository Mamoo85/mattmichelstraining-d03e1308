

# NUCLEAR E2E DRY-RUN EXECUTION — Structured Technical Diagnostic

---

## SERVICE 1: CONTRACTOR LEADS (PPL / Dead Lead Reactivation)

### LAYER 1: Component State & Null-Reference Hardening

**VULNERABILITY 1 — CRITICAL: Dead code fires a wasted POST before the real GET**
- **File:** `src/pages/LeadUnlocked.tsx`, lines 39-42
- **Failure Condition:** `fetchLead()` calls `supabase.functions.invoke("get-lead-by-session", { body: null })` which fires a POST to the edge function. The edge function reads `url.searchParams.get("session_id")` from a GET request. This POST fires, likely returns an error or null, and is completely ignored. Then lines 45-53 fire the correct GET `fetch()`. The dead POST wastes a function invocation on every poll cycle (up to 10 times).
- **Fix:** Delete lines 39-42 entirely. The `fetch()` on line 45 is the real call.

**VULNERABILITY 2 — CRITICAL: `VITE_SUPABASE_ANON_KEY` is undefined**
- **File:** `src/pages/LeadUnlocked.tsx`, lines 49-50
- **Failure Condition:** The `.env` file defines `VITE_SUPABASE_PUBLISHABLE_KEY`, not `VITE_SUPABASE_ANON_KEY`. `import.meta.env.VITE_SUPABASE_ANON_KEY` resolves to `undefined`. The `apikey` header becomes `undefined`. The `Authorization` header becomes `Bearer undefined`. The edge function returns 401. The contractor pays $50, sees "Payment Confirmed", polls 10 times, then sees "Check Your SMS" — they never see the lead data on screen.
- **Fix:** Replace `VITE_SUPABASE_ANON_KEY` with `VITE_SUPABASE_PUBLISHABLE_KEY` on both lines 49 and 50.

**Note:** The previous fix session claimed to have fixed this, but the code still shows `VITE_SUPABASE_ANON_KEY`. Either the fix didn't deploy or was reverted.

**VULNERABILITY 3 — SAME BUG in two other files:**
- **File:** `src/pages/ContractorROIReport.tsx`, line 18: `const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;`
- **File:** `src/pages/TrademarkWatch.tsx`, line 76: `apikey: import.meta.env.VITE_SUPABASE_ANON_KEY`
- **Failure Condition:** Same as above — 401 on every request. ROI report page shows nothing; TrademarkWatch checkout fails silently.
- **Fix:** Replace with `VITE_SUPABASE_PUBLISHABLE_KEY` in both files.

**VULNERABILITY 4 — Missing `contact_preference` in lead reveal**
- **File:** `supabase/functions/get-lead-by-session/index.ts`, line 50
- **Failure Condition:** The SELECT query doesn't include `contact_preference`. The contractor pays $50 and sees name/phone/email but NOT whether the homeowner prefers text vs call vs email. This data IS captured in `GetQuote.tsx` and IS used in `contractor-lead-notify`, but is dropped at the reveal step.
- **Fix:** Add `contact_preference` to the SELECT on line 50 and include it in the response object on line 67-75.

### LAYER 2: Integration Triangle (Frontend -> Stripe -> Supabase)

**VULNERABILITY 5 — PPL webhook returns 200 on DB failure**
- **File:** `supabase/functions/stripe-webhook/index.ts`, lines 2595-2596
- **Failure Condition:** The outer `catch` on line 2595 logs the error but the function falls through to `return new Response(... { status: 200 })` on line 2596. If the `Promise.all` on line 2488 fails (DB insert error), Stripe sees 200 and won't retry. The contractor paid $50 but the lead is never marked "sold" and the purchase record is never created. The `get-lead-by-session` page will poll forever and show "Check Your SMS" — but no SMS was sent either.
- **Fix:** Change the catch block to return `status: 500` and add a `notifyMatt()` call, matching the pattern used by `missed_call_subscription` (line 4019).

### LAYER 3: Twilio/Comms Failure Matrix

**No critical issues.** SMS sends in the PPL webhook handler (lines 2521-2530) are inside a `Promise.all` that is itself inside the outer `try`. If Twilio 400s on a bad phone number, the entire `Promise.all` would reject, but since it's the SMS/email notification block (not the DB write), the lead is already sold at that point. The DB transaction survives. However:

**MINOR:** If the contractor's phone number is malformed and `sendSMS` throws, the email send in the same `Promise.all` is also cancelled. Consider using `Promise.allSettled` instead.

### LAYER 4: RLS & Cross-Contamination

**VULNERABILITY 6 — CRITICAL: `contractor_lead_purchases` has public ALL access**
- **Table:** `contractor_lead_purchases`
- **Policy:** `Service role full access on contractor_lead_purchases` — `roles: {public}`, `cmd: ALL`, `qual: true`, `with_check: true`
- **Failure Condition:** ANY unauthenticated user can SELECT, INSERT, UPDATE, DELETE from `contractor_lead_purchases`. An attacker can enumerate all purchases, see which leads were bought, by whom, and for how much. They can also INSERT fake purchase records or DELETE real ones.
- **Fix:** Change the policy role from `public` to `service_role`. Create a separate admin SELECT policy.

### LAYER 5: Dead Ends & Success Void

**ClaimLead.tsx (`/claim-lead`):** Routes exist ✅. After Stripe payment, redirects to `/lead-unlocked?session_id={CHECKOUT_SESSION_ID}` — route exists ✅. However, the lead data won't display due to Vulnerability 2 (ANON_KEY undefined).

**LeadClaimed.tsx (`/lead-claimed`):** Route exists ✅. Static page, no data fetch needed ✅.

---

## SERVICE 2: TECHALERT (Hiring Monitor)

### LAYER 1: Component State & Null-Reference Hardening

**No issues found.** `HireAlert.tsx` has proper `loading` state on the checkout button (line 103 `setLoading(true)`, line 113 `setLoading(false)`), disabled state on the button (line 353 `disabled={loading}`), and validation before submit (lines 95-102). The success state is driven by `?success=1` URL param (line 62) which renders a clean confirmation. No data fetch on success page — purely static confirmation text ✅.

### LAYER 2: Integration Triangle

**No issues found.** `create-hire-alert-checkout` correctly creates a Stripe subscription with `metadata.type: "hire_alert_subscription"`. The webhook handler (confirmed in prior audit) inserts into `hire_alert_clients` and returns 500 on failure. Success URL is `${origin}/hire-alert?success=1` — route exists and renders the confirmation block ✅.

### LAYER 3: Twilio/Comms

**No issues found.** Welcome email uses `dwaEmail()` and `matt@detroitwebagent.com` (confirmed in prior audit). No hardcoded `matt@mattmichelstraining.com` in TechAlert flows.

### LAYER 4: RLS

`hire_alert_clients`: admin ALL + admin SELECT + service_role ALL ✅. No public access. No cross-contamination possible.

### LAYER 5: Dead Ends

Success redirect goes to `/hire-alert?success=1` — same page, `isSuccess` branch renders clean confirmation ✅. No hard refresh required.

**TechAlert: CLEAN — 0 vulnerabilities found.**

---

## SERVICE 3: FIELDDESK (Field Service CRM)

### LAYER 1: Component State & Null-Reference Hardening

**No issues found.** `FieldServiceManagement.tsx` has proper `loading` state (line 63, line 67-68, line 76), `toast.error` on failure, and `window.location.href` redirect on success. The checkout button is gated by email validation (line 66).

### LAYER 2: Integration Triangle

**No issues found.** `create-field-service-checkout` creates subscription with `metadata.type: "field_service_subscription"`. Webhook inserts into `field_crm_clients`. Success URL derived from `origin` header ✅.

### LAYER 3: Twilio/Comms

**No issues found.** FieldDesk provisioning uses `auto-onboard` with `.catch()` — if auto-onboard fails, provisioning still succeeds (DB insert completes). The `.catch()` swallows the error silently (noted as yellow flag in prior audit but not a blocker).

### LAYER 4: RLS

`field_crm_clients`: admin INSERT/UPDATE/DELETE + service_role ALL ✅. Properly locked.

### LAYER 5: Dead Ends

Checkout success URL goes to the FieldDesk page with `?status=success` — need to verify this branch exists in the component. Let me note: I did not see an explicit `status=success` handler in `FieldServiceManagement.tsx` lines 58-140. This may be a **yellow flag** — contractor pays, gets redirected, but sees the same marketing page again with no confirmation.

**FieldDesk: 1 yellow flag (missing success confirmation UI). 0 critical vulnerabilities.**

---

## SERVICE 4: MISSED CALL TEXT-BACK

### LAYER 1: Component State & Null-Reference Hardening

**No issues found.** `MissedCallSaaS.tsx` has proper `loading` state (line 88, line 98, line 112), `toast.error` on failure, disabled submit implicitly via loading. Success state rendered via `?status=success` (line 85) ✅ with clean confirmation UI (lines 116-129).

### LAYER 2: Integration Triangle

**No issues found.** `create-missed-call-subscription` correctly creates a subscription with 7-day trial, `metadata.type: "missed_call_subscription"`. Webhook returns 500 on provisioning failure (line 4019) + `notifyMatt()` ✅. Success URL is `/missed-call-text?status=success` — route `/missed-call-text` exists (App.tsx line 576) ✅.

### LAYER 3: Twilio/Comms

**No issues found.** Welcome email verified DWA-branded. FriendlyName prefix "DWA -" confirmed.

### LAYER 4: RLS

`missed_call_clients`: admin SELECT + service_role ALL ✅. Properly locked.

### LAYER 5: Dead Ends

Success redirect to `/missed-call-text?status=success` renders confirmation ✅. No data fetch needed on success — purely informational ✅.

**Missed Call: CLEAN — 0 vulnerabilities found.**

---

## VULNERABILITY SUMMARY — PRIORITIZED FIX ORDER

```text
┌───┬──────────┬──────────────────────────────────────────────────────┬─────────┐
│ # │ Severity │ Description                                          │ Service │
├───┼──────────┼──────────────────────────────────────────────────────┼─────────┤
│ 1 │ CRITICAL │ VITE_SUPABASE_ANON_KEY undefined — LeadUnlocked 401  │ PPL     │
│ 2 │ CRITICAL │ Same bug in ContractorROIReport.tsx + TrademarkWatch  │ PPL/TW  │
│ 3 │ CRITICAL │ contractor_lead_purchases RLS: public ALL access      │ PPL     │
│ 4 │ CRITICAL │ PPL webhook returns 200 on DB failure (no retry)      │ PPL     │
│ 5 │ HIGH     │ Dead POST call in LeadUnlocked.tsx (wasted invoke)    │ PPL     │
│ 6 │ MEDIUM   │ contact_preference missing from lead reveal           │ PPL     │
│ 7 │ LOW      │ Promise.all vs Promise.allSettled for SMS+email       │ PPL     │
│ 8 │ LOW      │ FieldDesk missing success confirmation UI             │ FieldD  │
└───┴──────────┴──────────────────────────────────────────────────────┴─────────┘
```

## EXACT FIXES REQUIRED

### Fix 1-2: `LeadUnlocked.tsx` — Replace ANON_KEY + remove dead code
- Delete lines 39-42 (dead `supabase.functions.invoke` call)
- Line 49: `VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY`
- Line 50: `VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY`

### Fix 2b: `ContractorROIReport.tsx` line 18
- `VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY`

### Fix 2c: `TrademarkWatch.tsx` line 76
- `VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY`

### Fix 3: SQL migration — Lock down `contractor_lead_purchases`
```sql
DROP POLICY "Service role full access on contractor_lead_purchases" ON contractor_lead_purchases;
CREATE POLICY "service_role_all_purchases" ON contractor_lead_purchases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_select_purchases" ON contractor_lead_purchases FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
```

### Fix 4: `stripe-webhook/index.ts` — PPL handler return 500 on failure
Change lines 2595-2596 from:
```ts
} catch (e) { console.error("[WEBHOOK] contractor_lead_payment error:", e); }
return new Response(JSON.stringify({ received: true }), { status: 200 });
```
To:
```ts
} catch (e) {
  console.error("[WEBHOOK] contractor_lead_payment error:", e);
  await notifyMatt(
    `🚨 PPL Lead provision FAILED — ${meta.contractor_id} paid $50 but lead ${meta.lead_id} not activated`,
    `<p>Error: ${e instanceof Error ? e.message : String(e)}</p><p>Session: ${session.id}</p>`
  ).catch(() => {});
  return new Response(JSON.stringify({ error: "provisioning failed" }), { status: 500 });
}
return new Response(JSON.stringify({ received: true }), { status: 200 });
```

### Fix 5: Already covered in Fix 1 (delete lines 39-42)

### Fix 6: `get-lead-by-session/index.ts` — Add contact_preference
- Line 50: Add `contact_preference` to SELECT
- Lines 67-75: Add `contact_preference: lead.contact_preference` to response
- `LeadUnlocked.tsx`: Add `contact_preference` to `LeadData` interface and render it

**Next Action:** "Implement all 6 fixes — 3 frontend files, 1 edge function, 1 migration, 1 webhook patch."

