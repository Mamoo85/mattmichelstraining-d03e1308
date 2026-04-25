# UI/UX Polish & Production Readiness Sprint

**Constraint honored:** Zero edits to `supabase/functions/`, migrations, or webhook logic. All work is inside `src/` (React, routing, Tailwind, inline styles).

## Scope (high-traffic surfaces)
SMS/QR/Email entry points and conversion screens for Apex Talent Signal + Contractor Leads:
- `src/pages/ClaimLead.tsx` (PPL FOMO landing — primary $50 conversion)
- `src/pages/HireAlertTrial.tsx` (trial signup)
- `src/pages/HireAlert.tsx`, `src/pages/TalentIntelligence.tsx` (Apex marketing)
- `src/pages/MyTechAlert.tsx` (client portal — Fast-Track, Mark Ghosted, Draft Outreach buttons)
- `src/pages/AgencyClientPortal.tsx`, `src/pages/AgencyPortal.tsx`
- `src/pages/MyContractorLeads.tsx`, `src/pages/ContractorLeads.tsx`, `src/pages/LeadClaimed.tsx`
- `src/pages/DeadLeadIntake.tsx`, `src/pages/Marketplace.tsx`
- `src/App.tsx` (routing fallback wiring), `src/pages/NotFound.tsx`

---

## 1. Mobile Layout Lockdown

**Audit pass on every page above:**
- Replace any fixed `width: NNNpx` with `maxWidth` + `width: 100%` and `box-sizing: border-box`. (ClaimLead/HireAlertTrial already do this — sweep the rest.)
- Ensure all inputs and `<button>` targets are min 44px tall (iOS HIG). Add `minHeight: 48` to any action button missing it.
- Verify all primary containers wrap in a responsive shell: `padding: clamp(16px, 5vw, 32px)`.
- Confirm long copy uses `overflow-wrap: anywhere` so emails/URLs don't overflow on 320px screens.
- Add `touch-action: manipulation` to all action buttons to suppress 300ms tap delay.
- Phone numbers wrapped in `tel:` / `sms:` links across all error and success states.

**Quick wins:** ClaimLead and HireAlertTrial are already mobile-clean — extend the same pattern (max-width card, vertical padding, single-column form) to MyTechAlert, AgencyClientPortal, MyContractorLeads, and Marketplace.

## 2. Dead-Click Prevention (Global Loading States)

Audit every action button on the in-scope pages. Standard pattern:

```tsx
const [busy, setBusy] = useState(false);
const lock = useRef(false);

const onClick = async () => {
  if (lock.current || busy) return;
  lock.current = true; setBusy(true);
  try { await action(); }
  finally { lock.current = false; setBusy(false); }
};

<button disabled={busy} aria-busy={busy} ...>
  {busy ? <Spinner/> : "Pay $50 — Get Their Phone Number"}
</button>
```

**Targets:**
- MyTechAlert: Fast-Track Interview, Mark Ghosted, Draft Outreach, Buy Credits
- AgencyClientPortal / AgencyPortal: every CTA tied to an edge function
- MyContractorLeads: claim/refund/mark-disconnected actions
- DeadLeadIntake: file upload + submit button
- Marketplace: buy-lead buttons (FirstLook + standard)

Create one shared `<ActionButton busy onClick label busyLabel/>` in `src/components/ui/action-button.tsx` so the pattern is uniform and impossible to forget on new buttons.

## 3. Bulletproof Routing + Branded Expired/Invalid State

**New component:** `src/components/shared/LinkExpired.tsx`

Dark-mode, branded card with:
- Headline (configurable: "Lead no longer available" / "Link expired" / "Invalid link")
- Explanation line
- Two CTAs: primary "View Current Marketplace" → `/marketplace`, secondary `sms:+13139921219` "Text Matt"
- Same `#0a1628` / `#00d4ff` aesthetic as ClaimLead

**Wire it into:**
- `ClaimLead.tsx`: replace the three inline error states (missing-params, lead-not-found, claimed) with `<LinkExpired variant="..."/>`
- `LeadClaimed.tsx`, `MyContractorLeads.tsx`, `Marketplace.tsx`: same.
- `App.tsx`: keep `NotFound` as the catch-all but route any `/claim-lead`, `/lead/:id`, `/marketplace/lead/:id` with no/invalid params through `<LinkExpired/>` instead of bouncing to 404.

**Param parsing hardening:** Add a small helper `src/lib/parseSearchParams.ts` that validates UUIDs and emails from `useSearchParams`, returning `{ ok: true, ... } | { ok: false, reason }`. ClaimLead, DeadLeadIntake, and any token-driven page use it. Invalid → render `<LinkExpired/>`.

## 4. Premium Toasts & Alerts

Sonner is already mounted in `App.tsx` (line 477). Standardize usage:

- Create `src/lib/toast.ts` exporting `toastSuccess(msg)`, `toastError(msg)`, `toastInfo(msg)` with consistent options (duration 4s, dismissible, top-center on mobile).
- Replace ad-hoc `toast.error(...)` / inline error `<p>` strings on the in-scope pages with these helpers so every backend response has a visible outcome.
- Success path on ClaimLead's redirect: fire `toastInfo("Locking lead… opening secure checkout")` before `window.location.href`.
- Errors on Fast-Track / Mark Ghosted / Buy Credits in MyTechAlert: green toast on success, red toast on `409 already claimed` / `402 out of credits` with helpful next-step copy.

## 5. Brand & Copy Enforcement

Sweep user-facing strings on the in-scope pages for the bare word "AI". Confirmed hit:
- `src/pages/MyTechAlert.tsx:595` — "AI-written SMS + email templates" → **"automated SMS + email templates"**

Re-grep after edits to catch anything missed. Acceptable terms: "Apex Talent Signal", "Automated Routing", "Proprietary Infrastructure", "Intelligence Engine".

---

## Technical Notes (for implementation step)

- **No edge function edits.** All "loading" states wrap existing `supabase.functions.invoke(...)` calls — no signature changes.
- **No router restructuring** — only wrap the affected page components in graceful fallbacks; `<NotFound/>` stays as the global 404.
- Sonner is already lazy-loaded; no provider changes required.
- Inline-style pages (ClaimLead, HireAlertTrial) stay inline for consistency; new shared components use Tailwind + the dark palette `bg-[#0a1628] text-white border-[#1e3a5f] accent-[#00d4ff]`.
- TypeScript: helper utilities and shared components ship with strict types and no `any`.

## Files Touched (estimate)

**New (3):**
- `src/components/shared/LinkExpired.tsx`
- `src/components/ui/action-button.tsx`
- `src/lib/toast.ts`, `src/lib/parseSearchParams.ts`

**Edited (~10):**
- `src/App.tsx` (route param fallbacks only)
- `src/pages/ClaimLead.tsx`, `HireAlertTrial.tsx`, `HireAlert.tsx`, `TalentIntelligence.tsx`
- `src/pages/MyTechAlert.tsx`, `AgencyClientPortal.tsx`, `AgencyPortal.tsx`
- `src/pages/MyContractorLeads.tsx`, `LeadClaimed.tsx`, `Marketplace.tsx`, `DeadLeadIntake.tsx`

## Verification before handoff

- `tsc --noEmit` passes
- Manual checklist (Matt verifies on iPhone): tap each primary CTA, confirm spinner + disable; load `/claim-lead?lead_id=bogus` → branded expired card, not blank; trigger Fast-Track on an exhausted credit balance → red toast, no double-charge.

**Approve to execute.**
