

# Fix Bugs + Strategic Product Restructuring

## Bug Fixes (Code Changes)

### Fix 1: "See Live Dashboard" → Access Denied
**Problem:** The button on the hire-alert landing page links to `/my-techalert?token=DEMO`, but the demo system only recognizes `token=DWA_DEMO_MASTER`. So every prospect who clicks it sees "Access Denied."
**Fix:** Find the button linking with `token=DEMO` and change it to `token=DWA_DEMO_MASTER` so it loads the demo dashboard with mock candidates.

### Fix 2: DWA Pages Accessible on M2 Domain
**Problem:** Image-106 shows `m2training.lovable.app/my-techalert?token=DEMO` — DWA pages (my-techalert, hire-alert, field-service, dead-lead-intake, etc.) are fully accessible on the M2 Training domain. M2 is a fitness brand. DWA is an agency brand. They must be completely isolated.
**Fix:** Add a domain guard to all DWA-only routes. If the hostname is `m2training.lovable.app` or `mattmichelstraining.com`, redirect DWA routes to `detroitwebagent.com`. This prevents any DWA content from rendering on M2 domains. Implementation: a `DWARouteGuard` wrapper component that checks hostname and either renders children or redirects.

---

## Strategic Product Architecture (Your Vision, Clarified)

Based on everything you said, here's the restructured product strategy:

### TechAlert / HireAlert = THE Core Product
You're right — this is the crown jewel. Not just trades. Nurses, CNAs, LPNs, RNs, DONs. Anyone with a state-monitored license. The name should be **HireAlert** (covers all verticals) with TechAlert as the trades-specific branding.

### Pricing: Dual Model (Membership + À La Carte)

**Membership (Open Season):**
- Start at $149/mo (trades) / $149/mo (healthcare) — raise later as value proves out
- Unlimited daily alerts, full dashboard, candidate claiming, outreach drafts
- Bundle with FieldDesk: $199/mo (both products)

**À La Carte (On-Demand):**
- $50 for 10 names RIGHT NOW (one-time purchase)
- If we can't deliver all 10 (not enough in the system), refund $5 per undelivered name
- No subscription required — great for one-time hiring pushes or first-time buyers
- This is the QR code postcard offer: "Scan → Get 5 FREE names of licensed [trade] in your area"

### Missed Call Text-Back = Standalone Product (Already Built)
Already live at `/missed-call-text` (MissedCallSaaS.tsx) at $99/mo. It IS standalone. The fix: make it more prominent — add to the main DWA nav, feature it on the agency homepage, include it in QR postcard campaigns.

### FieldDesk = Sticky Long-Term Play
Keep at $199/mo standalone. It grows on clients over time. Don't oversell it — let it prove itself.

### Dead Lead Reactivation = Zero-Risk Entry Point
Keep as-is. $50/positive reply. No monthly commitment. Gets foot in door → upsell to HireAlert + FieldDesk.

### QR Postcard Campaign
The offer: "5 FREE licensed [Boiler Operators / CNAs / HVAC Techs] in your area. Scan now."
- QR → landing page with instant preview of 5 real candidates (blurred contact info)
- "Want contact info? $50 for 10 names" (à la carte) or "Get unlimited alerts: $149/mo"
- This is the top-of-funnel that feeds everything

---

## Code Changes for Strategy

| # | Change | Files |
|---|--------|-------|
| 1 | Fix "See Live Dashboard" token=DEMO → token=DWA_DEMO_MASTER | HireAlert.tsx or wherever the button lives |
| 2 | Add DWARouteGuard — block all DWA routes on M2 domains | New component + wrap routes in App.tsx |
| 3 | Add à la carte checkout to HireAlert page ("$50 for 10 names") | HireAlert.tsx + new edge function `create-hire-alert-one-time` |
| 4 | Create edge function for one-time name delivery | `supabase/functions/create-hire-alert-one-time/index.ts` |
| 5 | Add healthcare-specific HireAlert landing page variant | New or update existing `/hire-alert-healthcare` |
| 6 | Make Missed Call Text-Back more prominent in DWA nav | DWAStickyNav, AllServices, AgencyHome |
| 7 | Update pricing across all HireAlert pages ($149/mo standalone) | HireAlert.tsx, checkout function |

The bug fixes (1-2) ship immediately. The strategic changes (3-7) build out the dual pricing model and healthcare vertical you described.

