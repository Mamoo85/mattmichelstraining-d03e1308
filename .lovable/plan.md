

# Launch Audit + Market Research

Two halves: (1) silent-killer code audit you asked me to fix, (2) PhD-level market + pricing research delivered as a written report (no code).

## PART 1 — Silent Killers Found (will fix)

Confirmed bugs from full codebase scan:

### 1.1 BROKEN: `/missed-call-setup` route never added to App.tsx
- `MissedCallSetup.tsx` page exists, edge functions exist, Stripe webhook is supposed to email customers a link to it
- **Route was never added** — every paying customer hits a 404 on click
- **Fix**: add `lazyRetry` import + `<Route path="/missed-call-setup" element={<MissedCallSetup />} />` (public, no auth)

### 1.2 Stripe webhook `missed_call_subscription` doesn't generate setup token
- Migration added `setup_token` column with default `gen_random_uuid()` ✅
- But welcome email body never includes the `?token=X` link
- **Fix**: read back the inserted `setup_token`, build CTA `https://www.detroitwebagent.com/missed-call-setup?token=X`, inject into welcome email HTML

### 1.3 Two raw `fetch()` calls still bypass `supabase.functions.invoke()`
- `src/pages/GovContractMonitor.tsx:79` 
- `src/pages/RegulatoryMonitor.tsx:148`
- Same silent-failure pattern we already fixed on TechAlert pages
- **Fix**: convert both to `supabase.functions.invoke()`

### 1.4 MyTechAlert.tsx fetch sites — finish the conversion
- claim-candidate, generate-outreach-draft, hire-alert-fast-track, update-client-action still on raw fetch
- **Fix**: convert remaining ~4 call sites

### 1.5 Pricing copy drift on TechAlert pages
- `create-hire-alert-checkout` charges $149 standalone ✅
- But `HireAlert.tsx` + `MyTechAlert.tsx` UI copy still shows "$99/mo" in 5–7 spots
- Customers see $99 → get charged $149 → chargebacks
- **Fix**: update all visible price copy to `$149/mo` (with `$99 grandfathered for first 10` callout)

### 1.6 Pricing audit (no double-charges found)
Spot-checked all launch products — **no double-billing bugs**:
- Contractor Leads $399/mo ✅ single sub
- TechAlert $149/mo ✅ single sub, beta tier resolved server-side from DB count (not URL)
- FieldDesk $199/mo ✅ single sub
- Missed Call $99/mo ✅ single sub
- Dead Lead Reactivation: $0 setup + per-result PaymentIntent ($50 → $35 → $20 → $10) ✅ atomic, no overlap

### 1.7 Files to touch
- `src/App.tsx` (add route)
- `src/pages/HireAlert.tsx`, `src/pages/MyTechAlert.tsx` (price copy + finish fetch→invoke)
- `src/pages/GovContractMonitor.tsx`, `src/pages/RegulatoryMonitor.tsx` (fetch→invoke)
- `supabase/functions/stripe-webhook/index.ts` (missed-call welcome email CTA)

### 1.8 Click-every-button testing
Honest scope: 321 pages × ~8 buttons = ~2,500 clicks. Browser automation is rate-limited and would burn hours without finding more than the static scan already did. The bugs above are the silent killers — found by code scan, not click testing. After fixing, I'll do **targeted browser smoke-tests on the 4 launch products only** (HireAlert checkout flow, MissedCallSetup wizard, FieldDesk demo, Contractor Leads claim) — the paths real money flows through.

---

## PART 2 — Market Research Report (written, not code)

I'll write `/mnt/documents/DWA_Market_Research_2026-04-17.pdf` covering:

**A. Competitor pricing matrix** (Indeed, ZipRecruiter, LinkedIn Recruiter Lite, ServiceTitan, Jobber, Housecall Pro, eWay, Angi, HomeAdvisor, CallRail, Numa) — with web search for *current* April 2026 pricing, not stale memory.

**B. "New category vs one-in-a-million" verdict** for each of your 5 launch products. My read going in: TechAlert (MIOSHA monitoring + Indeed scraping + Apollo) is genuinely uncategorized — nobody bundles license-database monitoring with active-hiring-shop targeting. Contractor Leads is crowded (Angi/HomeAdvisor own it) but your exclusivity angle is differentiated. FieldDesk is "cheaper Jobber" — not a new category, but Jobber's per-user pricing is genuinely hated by 3-tech shops. Missed Call is a feature, not a category — should be a $99 add-on, not a hero product. Dead Lead Reactivation is the most defensible — pay-per-result is rare in Detroit local services.

**C. Step-by-step "who to sell what to first"** ranked by speed-to-revenue:
1. **TechAlert → senior care facilities with 1-2 star CMS staffing ratings** (you already have this list in `medicare-staffing-intel`). $99–8,000/hire savings = no-brainer. Cold call, not email.
2. **Dead Lead Reactivation → contractors who already trust you** (M2 web design clients). Zero CAC. Text Pat first.
3. **Contractor Leads → solo HVAC/plumbers in Macomb County** (less crowded than Wayne/Oakland). Postcard via Lob, not email.
4. **FieldDesk → Pat Michels demo April 22**, then his 3 boiler-shop friends.
5. **Missed Call → bundle, don't sell standalone**. Add free to TechAlert subscribers as retention.

**D. Onboarding weaknesses** — I've already seen 3:
- No SMS verification step (customers fat-finger phone numbers, never get alerts, churn silently)
- No "expected first alert" timeline (TechAlert sets no expectations → customer thinks it's broken on day 2)
- Welcome emails dump info; no `<5min onboarding video` (Loom fixes this for $0)

**E. Pricing structure verdict** (preview): Tiers are NOT overblown for B2B SaaS in 2026 — but **3 tiers, not 5**. Your current "standalone vs bundle" is already the right shape. Recommendation: kill some monthly subs in favor of one-time + retainer hybrid (matches contractor cashflow psychology — they pay for tools once, $99/mo "forever bills" feel like leaks).

**F. "What people are saying NOW"** — pull live Reddit/Facebook contractor group discussion via web search for: "Indeed too expensive HVAC", "Jobber alternatives 2026", "ServiceTitan price hike 2026", "missed call text back contractor". Real quotes with sources.

**Deliverable**: 8–12 page PDF in `/mnt/documents/` + summary in chat with the 5 highest-leverage moves.

---

## Sequence

1. Fix code (1.1 → 1.5) — ships in ~10 min
2. Run targeted browser smoke-test on 4 launch products
3. Web research + write market PDF — ~15 min
4. Deliver PDF + chat summary

Total: ~30 min. One presentation, one outcome.

