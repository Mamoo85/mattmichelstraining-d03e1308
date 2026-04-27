# Mortgage Radar — End-to-End Journey Hardening

Scope: trace and fix all 6 phases of the customer journey using existing scaffolding. The product already has a landing page, checkout, webhook, dashboard, map, pipeline, and welcome state — but several compliance and UX gaps need to be closed.

---

## Phase 1 — Landing Page (`src/pages/MortgageRadar.tsx`)

Already strong: H.R. 2808 banner, FCRA-clean copy, signal cards, plan picker, compliance footer.

**Add:**
1. **Interactive ROI Calculator** — new component `src/components/mortgage/MortgageRadarROICalculator.tsx`. Slider for "Lost trigger leads / month" (0–50). Computes: replaced lead value (avg loan $300k × 0.8% commission × 1.5% conversion), monthly savings vs trigger lead spend (~$30/lead), and net ROI vs $399/mo. Inserted between the comparison and signals sections.
2. **Territory Picker** — new component `src/components/mortgage/MortgageRadarTerritoryPicker.tsx`. Up to 5 ZIP inputs, "Check availability" button calls a new edge function `check-mortgage-radar-zips` that queries `mortgage_radar_clients.zip_codes` and returns per-ZIP `available | taken` status with green/red chips. Result feeds the ZIP field in the checkout form.

## Phase 2 — Checkout Compliance Gate (`MortgageRadar.tsx` + edge fn)

**Add to the plan-picker form:**
1. **DOB input** with HB 4388 age verification — block submit if user is under 18 (also blocks on the LO licensing reality of 18+).
2. **Mandatory unchecked TCPA / A2P 10DLC checkbox:**
   > "By providing my phone number and clicking Start, I agree to receive SMS messages from Detroit Web Agency / Mortgage Radar regarding lead alerts, account updates, and digests at the number provided. Message and data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help. See Privacy Policy and Terms."
3. **Mandatory unchecked manual-outreach acknowledgment:**
   > "I understand all outreach to leads must be manually reviewed and sent by me as a licensed loan officer. Mortgage Radar does not auto-dial or auto-send."
4. `handleCheckout` blocks submission with toast errors when DOB missing/under-18 or either checkbox unchecked. Both consents are passed in metadata to the checkout function and persisted on `mortgage_radar_clients` (new columns `tcpa_consent_at`, `manual_ack_at`, `dob`).

## Phase 3 — Magic Loading State (success branch)

Replace the static success screen with a new `<MortgageRadarProvisioningProgress />` component:
- 4 sequential steps with skeleton + checkmarks: "Securing your ZIPs", "Provisioning your dashboard", "Scanning permits / FSBO / foreclosures in your ZIPs", "Drafting your first openers".
- Each step animates over ~2s; on completion, auto-redirects to `/my-mortgage-radar?email=…&token=…` (token returned from `claim-session`).
- Keeps existing `ReceiptStatusBanner`, `CheckEmailCard`, `PostCheckoutClaim` mounted underneath for resilience.

## Phase 4 — Dashboard Zero-Empty State (`MyMortgageRadar.tsx`)

Today the dashboard renders an empty list when no leads have been ingested yet (first 24h is the gap).

**Add:** `src/components/mortgage/MortgageRadarSeedLead.tsx` — when `leads.length === 0` AND client just provisioned, render a single demo lead card (clearly flagged "Sample lead — your real ZIP-matched leads land here within 24 hours") so users see value immediately. Pulled from a `mortgage_radar_sample_leads` constant, not a network call.

**Sidebar nav:** add a left rail to `MyMortgageRadar.tsx` with: Lead Feed (default), Territory Settings, Billing, Referrals. Existing tabs (List/Map/Pipeline) become sub-views inside Lead Feed.

## Phase 5 — Lead Detail Modal & Manual-Only Guardrail

Audit `MyMortgageRadar.tsx` and any existing draft modal: confirm there is **no** "Auto-send", "Start sequence", or "Schedule drip" button anywhere. Replace draft action row with exactly two buttons:
- **Copy to Clipboard** (default)
- **Approve & Send This Message** — opens native `sms:` / `mailto:` link with body prefilled, and logs the approval to `mortgage_radar_outreach` with `status='approved_manual'`.

Add a persistent banner inside the modal: "Manual-only per TCPA + Michigan SB 351. You are the sender."

## Phase 6 — Self-Serve Management

New tab `Territory Settings` in the sidebar:
- Lists current ZIP codes with remove buttons.
- "Add ZIP" input that runs availability check (reuses Phase 1 edge fn), then calls a new edge function `update-mortgage-radar-zips` to append (charges $50/mo extra ZIP via Stripe subscription update). Honors plan ZIP cap (5 / 15) before charging extras.

`Billing` tab: existing `<ManageBillingButton email={clientEmail} />`.

`Referrals` tab: simple card with the user's referral link `https://detroitwebagent.com/mortgage-radar?ref=<email-hash>` and Copy button. Uses existing referral infrastructure pattern.

---

## Technical Details

**New files:**
- `src/components/mortgage/MortgageRadarROICalculator.tsx`
- `src/components/mortgage/MortgageRadarTerritoryPicker.tsx`
- `src/components/mortgage/MortgageRadarProvisioningProgress.tsx`
- `src/components/mortgage/MortgageRadarSeedLead.tsx`
- `src/components/mortgage/MortgageRadarSidebar.tsx`
- `src/components/mortgage/MortgageRadarComplianceGate.tsx` (DOB + 2 checkboxes)
- `supabase/functions/check-mortgage-radar-zips/index.ts`
- `supabase/functions/update-mortgage-radar-zips/index.ts`

**Edited files:**
- `src/pages/MortgageRadar.tsx` — wire ROI calc, territory picker, compliance gate; block checkout on missing consent.
- `src/pages/MyMortgageRadar.tsx` — sidebar layout, seed-lead empty state, audit/replace any auto-send actions.
- `supabase/functions/create-mortgage-radar-checkout/index.ts` — accept and pass `dob`, `tcpa_consent_at`, `manual_ack_at` in metadata.
- `supabase/functions/stripe-webhook/index.ts` — persist new consent columns into `mortgage_radar_clients`.

**Migration:** add `dob date`, `tcpa_consent_at timestamptz`, `manual_ack_at timestamptz` to `mortgage_radar_clients`.

**Compliance enforcement (UI level):**
- Submit handler short-circuits with toast on any of: missing DOB, age < 18, TCPA unchecked, manual-ack unchecked, no ZIPs entered, no email.
- Checkboxes default unchecked (cannot be pre-ticked per FTC and 10DLC rules).
- "Approve & Send This Message" requires the user to click — never fires programmatically.

---

## Click-Through Verification Checklist (post-build)

```text
1. /mortgage-radar loads → H.R. 2808 banner, ROI slider works, territory picker returns availability.
2. Plan form: submitting without DOB / either checkbox / valid ZIP → blocked with clear error.
3. Filled form → Stripe checkout opens with $399 (+ extras) line items.
4. Stripe success → /mortgage-radar?success=1 → provisioning progress runs 4 steps → auto-redirects.
5. /my-mortgage-radar?email=…&token=… → loads with at least 1 sample lead if real feed empty.
6. Sidebar: Lead Feed | Territory Settings | Billing | Referrals — all routes render.
7. Click any lead → modal shows public-record context + draft. Only "Copy" + "Approve & Send" buttons visible.
8. Territory Settings → add ZIP → availability check → confirm $50 add-on charged via Stripe.
9. Billing → ManageBillingButton → Stripe customer portal opens.
10. Referrals → copy link → toast confirms.
```

No broken links, no missing states, no auto-send buttons anywhere.
