

# M² Portal & Product Strategy Overhaul

## What You Asked For (Broken Into Parts)

### Part A: PWA Auto-Install on Mobile
- Modify `PwaInstallBanner` to auto-trigger the native install prompt (not just show a banner) when a logged-in user visits on mobile
- Add it to `ZoneDashboard` (the main logged-in landing page), not just the old `Dashboard`
- Auto-fire `deferredPrompt.prompt()` once per session for authenticated mobile users

### Part B: Browse Without Login (Blur Gating)
- Remove `ProtectedRoute` wrapper from `/zone-dashboard`, `/progress`, `/nutrition`, `/profile`, `/coach`
- Create a new `<BlurGate>` component that replaces `ProtectedRoute` + `SubscriptionGuard`:
  - If user is logged in + subscribed → show content normally
  - If user is logged in but no subscription → show content with blur overlay + CTA to subscribe
  - If user is NOT logged in → show content with blur overlay + CTA to sign up / log in
- Content renders underneath the blur (visible but unreadable), creating FOMO
- Blur overlay has a centered card: "Sign up to unlock" / "Subscribe to access" with action buttons
- Pages that stay fully protected (no browsing): `/admin`, `/admin/view-user`, `/client-portal`

### Part C: 50% Launch Discount (6 Months, Foundation Tier)
- Create a Stripe coupon: 50% off, duration "repeating" for 6 months, applies to Foundation monthly price ($19.99 → $9.99/mo)
- No new price IDs needed — just a coupon code applied automatically at checkout
- Update `create-checkout` to auto-apply this coupon when the tier is Foundation
- Display the discounted price on the landing page and pricing page: ~~$19.99~~ **$9.99/mo** with "Launch Special — 50% off for 6 months"
- Can be turned off by removing the coupon ID from the code (or deactivating in Stripe)

### Part D: Product Honesty Assessment

**Your question is the right one: "If free AI can do it in 10 seconds, why would someone pay?"**

Here's the honest breakdown:

| Product | Can Free AI Do It? | Verdict |
|---|---|---|
| **Website Audit ($9)** | YES — ChatGPT can audit a URL for free | **Bundle into web design funnel as a free lead magnet** |
| **GBP Post Pack ($9→$19)** | MOSTLY — ChatGPT can generate posts | **Bundle as free bonus with GBP SaaS ($49/mo)** |
| **Competitor Report ($9)** | PARTIALLY — Free AI can't pull real Google Maps data, ratings, review counts | **KEEP — uses real Google Places API data. Free AI hallucinates competitors** |
| **Missed Call Text-Back ($99/mo)** | NO — requires Twilio infrastructure, phone number, webhook routing | **KEEP — genuine infrastructure product** |
| **GBP SaaS ($49/mo)** | NO — requires Google Business API, scheduled posting, OAuth | **KEEP — real automation** |
| **Social Media AI ($199/mo)** | NO — requires Meta/LinkedIn API tokens, scheduled posting | **KEEP — real automation** |

**Products that survive the "10-minute test":**
1. Missed Call Text-Back — Twilio setup, webhook, phone number provisioning
2. GBP SaaS — Google API OAuth, automated scheduling, AI content generation
3. Social Media AI — Multi-platform API integration, content calendar automation
4. Competitor Report — Real Google Places API data (keep at $9 as lead magnet for web design)

**Products to convert to free lead magnets:**
1. Website Audit → Free tool on landing page, captures email, funnels to web design
2. GBP Post Pack → Free bonus included with GBP SaaS signup

### Part E: New Product Ideas (Things That Genuinely Take Work to Set Up)

These are services where AI + infrastructure create real barriers:

1. **Automated Google Review Request System** ($49/mo) — After each job/appointment, auto-sends SMS + email asking for a Google review. Requires Twilio + Google Business integration + customer database. A business owner can't set this up in 10 minutes.

2. **AI Receptionist / After-Hours Auto-Responder** ($79/mo) — Twilio-powered. When nobody answers, an AI texts back AND asks qualifying questions (what service they need, their address, urgency). Logs the lead. Requires phone routing infrastructure.

3. **Automated Reputation Dashboard** ($39/mo) — Monitors Google reviews, sends weekly email digest of new reviews + suggested AI responses + competitor review trends. Requires Google Places API polling + scheduled jobs.

4. **AI-Powered Estimate Follow-Up Drip** ($49/mo) — After a contractor gives an estimate, auto-sends a 5-email sequence over 14 days with social proof, urgency triggers, and a "still deciding?" check-in. Requires email automation infrastructure + CRM integration.

---

## Technical Implementation

### Files to Modify
- `src/components/layout/PwaInstallBanner.tsx` — auto-trigger for logged-in mobile users
- `src/pages/ZoneDashboard.tsx` — add PWA banner
- `src/App.tsx` — swap `ProtectedRoute`/`SubscriptionGuard` for new `BlurGate` on browsable routes
- `src/components/layout/BlurGate.tsx` — NEW component
- `src/hooks/useAuth.tsx` — add launch coupon ID constant
- `src/pages/Pricing.tsx` — show strikethrough pricing
- `src/components/landing/MembershipTiers.tsx` — show launch discount
- `supabase/functions/create-checkout/index.ts` — auto-apply Foundation launch coupon
- `src/pages/AiWebsiteAudit.tsx` — convert to free lead magnet
- Various landing/pricing pages — update price displays

### Stripe Coupon (Created via Stripe tools)
- 50% off, repeating, 6 months duration
- Applied automatically to Foundation monthly checkout only

### BlurGate Component Logic
```text
┌─────────────────────────────┐
│ Check auth state            │
│   ├─ Logged in + subscribed │ → render children normally
│   ├─ Logged in + no sub     │ → render children + blur + "Subscribe" CTA
│   └─ Not logged in          │ → render children + blur + "Sign Up" CTA
└─────────────────────────────┘
```

### Code Optimization Pass
- Review all recently merged code for syntax errors, unused imports, redundant re-renders
- Fix any TypeScript errors in the build
- Ensure all Edge Functions deploy cleanly

