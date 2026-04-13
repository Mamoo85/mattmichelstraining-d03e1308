

# FULL-STACK AUDIT + HEALTHCARE HIREALERT EXPANSION

This plan covers three mandates in one pass: (1) the Golden Path re-trace, (2) the Nuclear 5-Layer audit, and (3) the Healthcare HireAlert strategic pivot.

---

## GOLDEN PATH + NUCLEAR AUDIT RESULTS

### PATH 1: Homeowner Quote (GetQuote.tsx) — TRACE SUCCESSFUL
- All inputs exist: name, phone, email, message, contact_preference (call/text/email)
- `contact_preference` properly captured and inserted to DB (line 76)
- Submit button has `disabled={state === "submitting"}` + shows "Sending..." text (line 229)
- Clear Success UI at line 90-108 (full-screen confirmation)
- Error state renders with phone number fallback (line 220-222)
- No null-reference risks — all state properly initialized

### PATH 2: Contractor Lead Unlock (PPL) — TRACE SUCCESSFUL
- `ClaimLead.tsx`: proper loading/locked/claimed/error states, `disabled={loading}` on button (line 138)
- Stripe checkout via `create-contractor-ppl-checkout`, redirects via `window.location.href` (line 59)
- `LeadUnlocked.tsx`: uses correct `VITE_SUPABASE_PUBLISHABLE_KEY` (lines 44-45) — FIXED in prior session
- `get-lead-by-session` edge function: includes `contact_preference` in SELECT (line 50) and response (line 72) — FIXED in prior session
- Polling logic works: up to 10 polls every 3s, graceful fallback to "Check Your SMS" on timeout
- Webhook returns 500 on DB failure (line 2601) with `notifyMatt()` — FIXED in prior session
- RLS on `contractor_lead_purchases`: locked to `service_role` + admin SELECT — FIXED in prior session

### PATH 3: TechAlert Signup (HireAlert.tsx) — TRACE SUCCESSFUL
- Email + role validation before checkout (lines 95-102)
- `disabled={loading}` implicit via `setLoading(true)` before invoke (line 103)
- Success URL: `/hire-alert?success=1` — handled by `isSuccess` branch (line 62-86)
- Success UI: clean confirmation screen with "Your hiring advantage starts tomorrow at 7am"
- No data fetch needed on success — static confirmation

### PATH 4: Admin Dashboard — TRACE SUCCESSFUL
- Sidebar uses Shadcn components with proper routing
- VisitorIntelFeed reads from `crm_visitor_events` — tables exist, RLS proper

---

## CRITICAL VULNERABILITY FOUND

### FieldDesk Missing Success Confirmation — SEVERITY: HIGH

**File:** `src/pages/FieldServiceManagement.tsx`
**Failure:** Stripe checkout `success_url` is `/field-service?success=1` (confirmed in `create-field-service-checkout/index.ts` line 75). But `FieldServiceManagement.tsx` never imports `useSearchParams` and has zero handling for the `success=1` parameter. The contractor pays $199/mo, gets redirected, and sees the same marketing page with no confirmation — they think payment failed.

**Fix:** Add `useSearchParams` import, read `success` param, render a confirmation screen (matching the pattern in `HireAlert.tsx` and `MissedCallSaaS.tsx`).

---

## HEALTHCARE HIREALERT EXPANSION

### Phase 1: Backend — No Migration Needed
The `hire_alert_clients.target_roles` column is already `text[]` and can accept any role string. The scanner already has `CNA`, `LPN`, `RN`, and `home_health_aide` in `ROLE_KEYWORDS` (confirmed in code). The BPL scanner already downloads nursing license data. No new tables or columns required.

### Phase 2: Admin Panel
Add a healthcare filter/view within the existing `AdminHireAlertClients.tsx` — a toggle or tab to filter clients by healthcare roles (`CNA`, `RN`, `LPN`, `Director of Nursing`). No new route needed — it fits inside the existing TechAlert admin.

### Phase 3: Healthcare Landing Page
Create `/hire-alert-healthcare` — a dedicated landing page targeting nursing home administrators and senior care facility managers. Anti-agency pitch: "Stop paying $80/hr to staffing agencies." Uses the same `create-hire-alert-checkout` edge function with healthcare-specific role presets.

### Phase 4: No SMS rewrite needed
The existing TechAlert SMS templates are role-agnostic — they include the candidate's name, trade/role, and city. "New CNA License cleared in Wayne County" will flow naturally from the existing template when the role is `CNA`.

---

## IMPLEMENTATION PLAN

### Step 1: Fix FieldDesk success void
- Edit `src/pages/FieldServiceManagement.tsx`: add `useSearchParams`, check for `success=1`, render confirmation UI block before the marketing page

### Step 2: Add healthcare roles to HireAlert role selector
- Edit `src/pages/HireAlert.tsx`: add CNA, RN, LPN, Director of Nursing to `ROLE_OPTIONS` array

### Step 3: Create Healthcare HireAlert landing page
- Create `src/pages/HealthcareHireAlert.tsx` at route `/hire-alert-healthcare`
- Anti-agency pitch copy, nursing home testimonials, premium Wall of Love section
- Checkout calls same `create-hire-alert-checkout` with healthcare role presets
- Add route to `App.tsx`

### Step 4: Admin healthcare filter
- Edit `AdminHireAlertClients.tsx`: add a healthcare/trades toggle filter on the client list

**All prior audit fixes are confirmed deployed and correct. No regressions found. The only remaining issue is the FieldDesk success void.**

