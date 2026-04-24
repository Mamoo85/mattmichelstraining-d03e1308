## UI/UX & Onboarding Flawless Audit — Top 5 Products

Scope: the screens a real customer hits from a postcard QR, an SMS link, a Stripe success redirect, or a cold-email CTA. Backend stays untouched (already audited last session).

### Surfaces in scope

| Product | Entry pages | Why it matters |
|---|---|---|
| Contractor Leads (PPL) | ClaimLead.tsx, LeadClaimed.tsx, MyContractorLeads.tsx, ContractorLeads.tsx | SMS to claim to $50 Stripe |
| TechAlert / HireRadar | HireAlert.tsx, HireAlertTrial.tsx, MyTechAlert.tsx, GoTechAlert.tsx | Postcard QR to trial signup |
| Apex / Talent Intelligence | TalentIntelligence.tsx, TalentRadarVsStaffing.tsx | Cold email to enterprise consult |
| Dead Lead Reactivation | DeadLeadIntake.tsx, DeadLeadStats.tsx | Owner uploads CSV to Stripe billing setup |
| FieldDesk | FieldServiceManagement.tsx, FieldServiceTechApp.tsx, FieldServiceDispatch.tsx | Demo to checkout to tech PIN login |

### Audit pass (read-only, produces issue list)

For each surface, scan for the 5 killer categories:

1. **Mobile layout collapse** — fixed `w-[Npx]`, missing `flex-wrap`, unbounded `whitespace-nowrap`, tables without `overflow-x-auto`, modals taller than viewport. Spot-checks already flagged: MyTechAlert.tsx, MyMortgageRadar.tsx, Pricing.tsx, Marketplace.tsx use fixed pixel widths; ClaimLead.tsx uses inline-style hardcoded layouts.
2. **Dead clicks** — every button calling `supabase.functions.invoke`, `fetch`, or table writes. Verify `disabled={loading}`, spinner/label swap, double-submit guard. ClaimLead.tsx already has `claimLock.current` — use as reference and propagate.
3. **Link integrity** — every page reading `useSearchParams()` / `useParams()`. Confirm: missing param → friendly error (not blank), invalid UUID → friendly error, expired token → CTA back to working entry. ClaimLead.tsx does this correctly; audit the rest against that bar.
4. **Onboarding friction** — count clicks/forms before a prospect sees value. Flag any flow forcing account creation before the offer is visible (especially /talent-intelligence and /contractor-leads).
5. **Silent failures** — every `catch` in a button handler. Must surface a `sonner` toast or visible error. Many handlers currently swallow errors to console.

### Fix pass (the part that ships code)

Patched in this order so each surface ships independently:

1. **ClaimLead + LeadClaimed** (highest-value path: SMS to $50)
   - Convert inline-style layouts to Tailwind responsive classes (currently `padding: "40px 24px"` style — switch to `px-6 py-10 sm:px-8`).
   - Larger 56px tap target on Claim button, error toast on network failure (currently only sets `status="error"` with small red text).
   - Add `aria-busy` for accessibility.

2. **Contractor Leads landing + MyContractorLeads**
   - Audit all 16 onClick/invoke sites. Add `disabled` + spinner where missing.
   - Wrap data tables in `overflow-x-auto`; replace fixed widths with `max-w-*` + `w-full`.
   - Sonner toast on every checkout/claim failure.

3. **TechAlert (HireAlert, MyTechAlert, HireAlertTrial)**
   - Replace `w-[Npx]` fixed widths in MyTechAlert.tsx with responsive `w-full md:w-[Npx]`.
   - Verify URL-token parsing (line ~112) handles missing/expired tokens with a friendly screen.
   - Loading state on every Fast-Track / Contact button.

4. **Talent Intelligence**
   - Move consult CTA above the fold on mobile.
   - Form shows clear validation + a success state (not just an alert).
   - Remove any "log in to see pricing" gates — replace with public pricing tiers.

5. **Dead Lead Intake**
   - CSV upload UX: file-size cap warning, parse-progress state, row-error toast (don't fail silently on malformed rows).
   - Disabled + spinner on Stripe billing-setup button.

6. **FieldDesk**
   - Tech PIN login screen mobile-first (where techs actually use it).
   - Error toast on bad PIN (instead of silent reject).
   - Stripe checkout button loading state.

7. **Cross-cutting polish**
   - Confirm global `<Toaster richColors position="top-center" />` in App.tsx.
   - Replace any `window.alert()` on customer paths (found 2 in internal pages — verify none on customer routes).
   - Add a shared `<ButtonBusy />` wrapper so future buttons inherit the pattern.

### Deliverable after fixes

Short report with: each file touched, the UX failure fixed, and the route to manually test on a phone. Plus a phone-test checklist with exact URLs:

- `/claim-lead?lead_id=test&contractor_id=test&email=test@test.com` (test the missing-param + invalid-UUID screens)
- `/contractor-leads`
- `/hire-alert`
- `/talent-intelligence`
- `/dead-lead-intake`
- `/field-service-management`

### Out of scope (intentionally)

- Backend logic, RLS, edge functions, Stripe code (already audited).
- Brand redesigns — only fix what's broken or unprofessional.
- Admin/internal dashboards.

### Answering your closing question

Both QR postcards and SMS links hit URL-parameter pages (ClaimLead.tsx and TechAlert flows). The **SMS contractor flow is the higher risk** — bigger purchase ($50 instant), 3 params must all be present, and a single typo or expired lead means a contractor sees a broken page right when you've trained them to act fast. The audit prioritizes that path first.

Approve and I'll execute steps 1–7, then hand you the phone-test checklist.