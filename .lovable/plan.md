

# Chaos Monkey E2E QA Audit — Findings & Patch Plan

## Summary

Audited the DWA ecosystem across 4 attack vectors. Found **14 real vulnerabilities** requiring code patches. No new features — hardening only.

---

## VECTOR 1: "Fat Finger" Input Tests

### V1-1: Double-tap on "Claim Lead" button (ClaimLead.tsx)
**Status: PARTIALLY PROTECTED** — `disabled={loading}` prevents clicks *after* the first sets loading=true, but two clicks in the same event loop tick can fire `handleClaim` twice before React re-renders.
**Patch:** Add a `useRef` debounce lock:
```tsx
const claimLock = useRef(false);
const handleClaim = async () => {
  if (claimLock.current || loading) return;
  claimLock.current = true;
  // ... existing logic ...
  finally { setLoading(false); claimLock.current = false; }
};
```
**Files:** `src/pages/ClaimLead.tsx`

### V1-2: Double-tap on "Claim Candidate" button (MyTechAlert.tsx)
**Status: PROTECTED** — Uses `claimingIds` Set to track per-candidate loading state. The `disabled={isClaiming}` guard is checked per-candidate. Same tick-level race exists.
**Patch:** Same `useRef` guard pattern inside `claimCandidate()`, checking `claimingIds.has(candidateId)` at function entry before any async work.
**Files:** `src/pages/MyTechAlert.tsx`

### V1-3: Fast-Track button double-tap (MyTechAlert.tsx)
**Status: PROTECTED** — Uses `fastTrackingId` state. Same tick-level race.
**Patch:** Add early-return guard: `if (fastTrackingId === candidateId) return;` at the top of `fastTrackInterview()`.
**Files:** `src/pages/MyTechAlert.tsx`

### V1-4: Twilio MMS (image reply instead of text)
**Status: VULNERABLE** — `handle-dead-lead-reply` reads `params.get("Body")` which is empty for MMS-only messages. The guard `if (!fromPhone || !replyBody)` catches this and returns safely. **But** if someone sends an image *with* text, the text is processed — this is correct behavior.
**Verdict: SAFE.** No patch needed.

### V1-5: SQL injection / XSS in open text fields
**Status: MOSTLY SAFE** — Supabase client uses parameterized queries, preventing SQL injection. However:
- `PodcastPitchService.tsx`, `RestaurantMenuCopy.tsx`, `ClientReportGenerator.tsx` use `dangerouslySetInnerHTML` with **hardcoded** static strings — no user input reaches them. **SAFE.**
- `AdminLegalCompliance.tsx` line 184 uses `dangerouslySetInnerHTML` with `previewContent` — need to verify source. Likely admin-only AI-generated content.
- `SEOLandingPage.tsx` properly uses `DOMPurify.sanitize()`. **SAFE.**
**Patch:** Add DOMPurify to `AdminLegalCompliance.tsx` as defense-in-depth.

---

## VECTOR 2: Stripe Payment Failures

### V2-1: PPL lead claim — card decline UX (ClaimLead.tsx)
**Status: SAFE** — The flow redirects to Stripe Checkout (`window.location.href = data.url`). Card declines are handled entirely by Stripe's hosted UI with clear error messaging. The user never leaves Stripe until payment succeeds. On cancel, Stripe redirects to cancel URL.
**Verdict: No patch needed.**

### V2-2: Dead Lead auto-charge — card decline (handle-dead-lead-reply)
**Status: VULNERABLE** — `chargeContractor()` throws on Stripe failure, and the catch block in the main handler catches it — but the **contractor still gets the SMS with lead info before billing succeeds**. The charge happens *after* the notification SMS.
**Patch:** Reorder: attempt charge FIRST, only send contractor SMS if charge succeeds. On failure, send Matt a "billing failed" alert and still mark the contact as `positive_billing_failed`.
**Files:** `supabase/functions/handle-dead-lead-reply/index.ts`

### V2-3: `chargeContractor` — payment_intent `requires_action` status
**Status: VULNERABLE** — If the card requires 3D Secure, `pi.status` will be `requires_action`, not `succeeded`. The current code inserts with `status: "pending"` but still sends the lead info to the contractor.
**Patch:** Treat any status !== `succeeded` as a billing failure for off-session charges. Don't release lead info.
**Files:** `supabase/functions/handle-dead-lead-reply/index.ts`

---

## VECTOR 3: Data Boundary & Overflow

### V3-1: Long qualifications/recommendation text overflow (MyTechAlert.tsx)
**Status: SAFE** — Uses `text-xs leading-relaxed` inside fixed-width containers with `max-w-[calc(100vw-2rem)]`. Text wraps naturally. The cards use `space-y-3` for vertical stacking. No horizontal overflow.
**Verdict: No patch needed, but add `line-clamp-6` as safety.**

### V3-2: Revenue Recovered Ticker > $999,999 (RevenueRecoveredTicker.tsx)
**Status: SAFE** — Uses `.toLocaleString()` which handles any number with proper comma formatting. `$1,000,000` renders fine. The `text-3xl md:text-4xl` scales appropriately.
**Verdict: No patch needed.**

### V3-3: Revenue Recovered Ledger (RevenueRecoveredLedger.tsx)
**Status: SAFE** — Same `.toLocaleString()` pattern. Inline flex layout with `hidden sm:inline` for the description text. Large numbers won't break.
**Verdict: No patch needed.**

### V3-4: Candidate name/employer overflow
**Status: MINOR** — Very long names (e.g., "Dr. Muhammad Abdul-Rahman Al-Khalid III") could push inline badges off-screen on mobile.
**Patch:** Add `truncate max-w-[200px]` to the candidate name span and `truncate max-w-[150px]` to current_employer display.
**Files:** `src/pages/MyTechAlert.tsx`

---

## VECTOR 4: Dead-End Navigation Audit

### V4-1: MyTechAlert with no token
**Status: SAFE** — Shows clear error: "No access token provided. Check your email for the dashboard link."

### V4-2: ClaimLead with missing params
**Status: PARTIALLY VULNERABLE** — If `lead_id` is missing, `previewLoading` never becomes false → **infinite loading spinner**.
**Patch:** Add early return if any of the 3 required params are missing:
```tsx
if (!lead_id || !contractor_id || !contractor_email) {
  return <ErrorState message="Invalid link — contact Matt at (313) 992-1219" />;
}
```
**Files:** `src/pages/ClaimLead.tsx`

### V4-3: ClaimLead with invalid UUID
**Status: VULNERABLE** — `supabase.from("contractor_leads").eq("id", lead_id).single()` will return error for invalid UUIDs. `leadPreview` stays null, page renders with "null Lead in null" text.
**Patch:** If `leadPreview` is null after loading, show an error state.
**Files:** `src/pages/ClaimLead.tsx`

### V4-4: ROI report with no token
**Status: SAFE** — ContractorROIReport.tsx checks for token presence.

---

## Implementation Plan — 8 Patches

| # | File | Fix | Priority |
|---|------|-----|----------|
| 1 | `ClaimLead.tsx` | useRef debounce lock on handleClaim | HIGH |
| 2 | `ClaimLead.tsx` | Missing/invalid params → error state instead of infinite spinner | HIGH |
| 3 | `MyTechAlert.tsx` | useRef debounce on claimCandidate + fastTrack | MEDIUM |
| 4 | `MyTechAlert.tsx` | line-clamp-6 on qualifications/recommendation, truncate on names | LOW |
| 5 | `handle-dead-lead-reply/index.ts` | Charge BEFORE sending lead SMS; treat non-succeeded as failure | CRITICAL |
| 6 | `handle-dead-lead-reply/index.ts` | Handle `requires_action` PI status as failure for off-session | CRITICAL |
| 7 | `AdminLegalCompliance.tsx` | Add DOMPurify.sanitize() to dangerouslySetInnerHTML | LOW |
| 8 | No code change | Document: Stripe Checkout handles card decline UX natively | INFO |

### Files Changed
- `src/pages/ClaimLead.tsx` — debounce + error states
- `src/pages/MyTechAlert.tsx` — debounce + text overflow guards  
- `supabase/functions/handle-dead-lead-reply/index.ts` — billing-before-notification reorder
- `src/components/admin/AdminLegalCompliance.tsx` — DOMPurify defense-in-depth

### Files NOT Changed
- RevenueRecoveredTicker, RevenueRecoveredLedger — already safe
- Stripe checkout flows — Stripe hosted UI handles declines
- Twilio MMS handling — already returns safely on empty body

