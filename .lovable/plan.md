## Code-Level Click-Test Audit — Findings + Fix Plan

I traced every flow specified in the mandate against the actual React component logic. No hallucinated browser testing — all findings come from reading the source.

---

### What I traced and found CLEAN (no fixes needed)

**Phase 1 — Admin panel sweep (200+ admin components):**
- Pattern-scanned all 131 admin files that perform Supabase mutations.
- Zero swallowed catches (`catch {}`, `catch(){}`).
- Zero `supabase.functions.invoke` calls without an associated `toast` import.
- The earlier "DWA Defensive Programming Protocol" sweep already eliminated this class of bug. Admin is solid.

**Phase 2 — HireAlert + MyTechAlert + portal unlock:**
- `handleCheckout` uses `ActionButton` (single-flight), validates email/roles/ToS, error toasts wired.
- Token-based portal access (`MyTechAlert`) properly handles loading / error / missing-token / expired-token states.
- No broken paths.

**Phase 3 — ClaimLead + LeadDetail + LeadUnlocked:**
- `?lead_id=` parsed via hardened `parseParams` validators (UUID, email, Stripe session regex).
- Invalid params show `<LinkExpired />` recovery screen instead of crashing.
- `$50 Claim` button uses `ActionButton` (double-tap proof).
- Webhook race window handled with a polling banner ("Confirming payment with Stripe… 2–5s") before the unblur.
- LeadDetail correctly transitions Locked → Unlocked dossier on `?paid=1` + sold lock.

---

### REAL DEFECTS FOUND (will fix)

**1. FieldDesk has no post-purchase receipt confirmation** (highest-impact bug — $199–299/mo product)

- `create-field-service-checkout` `success_url` doesn't include `{CHECKOUT_SESSION_ID}`.
- `FieldServiceManagement.tsx` success state has no `<ReceiptStatusBanner>` or `<CheckEmailCard>`.
- After paying, the buyer sees a static "FieldDesk is Live!" page with no proof their card actually charged. They go to email and wait — bounce risk is high on mobile.

**2. Four other top-flow checkouts also strip the session ID from success URLs**, so even if the destination page renders `<ReceiptStatusBanner>` it has nothing to poll:

| Edge function | Current `success_url` | Fix |
|---|---|---|
| `create-field-service-checkout` | `?success=1` | append `&session_id={CHECKOUT_SESSION_ID}` |
| `create-hire-alert-checkout` | `?success=1` | append `&session_id={CHECKOUT_SESSION_ID}` |
| `create-mortgage-radar-checkout` | `?success=1&tier=...` | append `&session_id={CHECKOUT_SESSION_ID}` |
| `create-bundle-revenue-suite-checkout` | `?status=success` | append `&session_id={CHECKOUT_SESSION_ID}` |
| `create-contractor-checkout` | `?success=1&trade=...` | append `&session_id={CHECKOUT_SESSION_ID}` |

(`create-marketplace-lead-checkout` and `create-contractor-ppl-checkout` already pass `{CHECKOUT_SESSION_ID}` correctly — leave them.)

**3. FieldServiceManagement loading state uses `min-h-screen` (`100vh`)** instead of `100dvh`. Same iOS Safari toolbar clipping issue we already fixed on ClaimLead. Patch the success state at the same time.

---

### Brand sweep — surgical "AI" rebrand (per your answer)

Scope: rename only **visible UI labels** in JSX text, button copy, badge chips, and toast strings on the dedicated `/ai-*` landing pages. Keep route slugs, file names, SEO titles, meta descriptions, OG tags, and database product keys intact so SEO + analytics + product catalog don't break.

Pages I'll touch (visible label rename):
- `AIBirthdayCampaign`, `AIOnboardingAgent`, `AIReputationDashboard`, `AINewsletterService`, `AIGrantFinder`, `AIAdsCopyGenerator`, `AIEcommerceListings`, `AIBattlecard`, `AIRealEstateDrip`, `AIFranchiseOps`, `AICollections`, `AIMeetingPrep`, plus any visible "AI"-prefixed labels surfaced by a final ripgrep pass on the `/admin` and `/dashboard` regions.

Replacement vocabulary (per brand rule): "Automated Routing", "Built-in Systems", "Automated Engine", "Smart Automation". Headlines like "Stop Guessing. Let AI Write Your Ads." → "Stop Guessing. Let Our Engine Write Your Ads." Badge chips like "AI Newsletter Service" → "Automated Newsletter Service".

What I will NOT change (preserving production):
- File paths, route paths, `path="/ai-…"` SEO routes
- `<SEOHead title="AI X — $YY/mo" …>` titles + descriptions (search-indexed)
- Database product keys, Stripe `metadata.type` values
- Internal admin tools (already non-customer-facing)

---

### Execution checklist

```text
1. supabase/functions/create-field-service-checkout/index.ts
   └─ append &session_id={CHECKOUT_SESSION_ID}

2. supabase/functions/create-hire-alert-checkout/index.ts
   └─ append &session_id={CHECKOUT_SESSION_ID}

3. supabase/functions/create-mortgage-radar-checkout/index.ts
   └─ append &session_id={CHECKOUT_SESSION_ID}

4. supabase/functions/create-bundle-revenue-suite-checkout/index.ts
   └─ append &session_id={CHECKOUT_SESSION_ID}

5. supabase/functions/create-contractor-checkout/index.ts
   └─ append &session_id={CHECKOUT_SESSION_ID}

6. src/pages/FieldServiceManagement.tsx
   ├─ import ReceiptStatusBanner + CheckEmailCard
   ├─ inject both into success-state header
   └─ swap min-h-screen / 100vh → 100dvh

7. Surgical AI-label rename across the 12 product pages
   └─ visible JSX text + badge chips + button copy only

8. tsc --noEmit verification + redeploy 5 edge functions
```

No new tables. No new auth surfaces. No SEO regressions. No re-architecture. Approve and I'll execute.
