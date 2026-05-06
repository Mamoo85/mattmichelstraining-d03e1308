## Recommendations on the open questions

**Shop / Stripe Checkout (item 7):** Skip a generic shop. You already have `create-field-crm-checkout` (FieldDesk $199/mo) and 8+ other product checkouts. The bundle CTA on the new landing page should hit a new `create-bundle-90day-checkout` for the **$499 first-90-days** offer. That's the only checkout this email campaign needs. Building a full `/shop` storefront is busywork for a product line you sell 1:1 over demo calls.

**Demo-runner state persistence (item 9):** Not worth building right now. The demo is something *you* drive on a 15-min call — if you refresh, you're 2 clicks from where you left off. localStorage covers the 1% case. Real backend resume would matter only if prospects were self-serving the demo, which isn't the model. **Skip.**

**Scope:** I'm grouping into two waves. Wave 1 = everything that improves the live White Light Electric campaign + future cold outreach. Wave 2 = nice-to-haves you can ship after the first close.

---

## Wave 1 — Ship now (revenue-critical)

### 1. End-to-end click test of sent emails
Audit every URL in the two emails sent to `info@whitelightelectric.us`:
- Original demo invite (with `/book-demo?company=...&email=...` link)
- Follow-up correction email (phone `tel:` link, mailto reply)

Use the browser tool to:
- Hit each URL on `detroitwebagent.com` (production)
- Verify the page loads (200), prefill works, form submits, confirmation fires
- Test on mobile viewport (399px) since prospects open email on phones
- Report: URL → status → notes (any mismatches, prefill bugs, layout issues)

### 2. `/website-plus-fielddesk` bundle landing page
New `src/pages/WebsitePlusFieldDesk.tsx`. DWA dark theme (#0a1628 / #00d4ff). Sections:
- **Hero:** "$499 launches your new website + FieldDesk in 7 days"
- **What's included** (5 bullets: site, FieldDesk, missed-call, SiteRadar, white-glove onboarding)
- **Pricing card:** $499 first 90 days → then $199/mo FieldDesk + $99/mo Missed-Call + $49/mo SiteRadar (cancel anytime)
- **Comparison table:** DIY vs Hiring agency vs DWA bundle
- **FAQ** (5 Q&A: timeline, cancellation, who builds, integrations, contracts)
- **Two CTAs:** "Book a 15-min demo" → `/book-demo?source=bundle-page&company=...` (passes through any `?company=` URL param) + "Lock in $499 now" → `create-bundle-90day-checkout` Stripe Checkout
- Route registered in `src/App.tsx` with `lazyRetry`

### 3. `create-bundle-90day-checkout` edge function
- Stripe Checkout, **mode: payment**, $499 one-time
- Inline `price_data` (per project rules)
- `metadata.type = "bundle_90day_purchase"` for webhook routing
- success_url: `/bundle-success?session_id={CHECKOUT_SESSION_ID}`
- cancel_url: `/website-plus-fielddesk?canceled=1`
- `verify_jwt = false` in `config.toml` (public endpoint)

### 4. Demo outcome tracking in Supabase
Migration adds two pieces:

**a. Extend `demo_bookings`:**
- `outcome` text (`scheduled` | `showed` | `no_show` | `won` | `lost` | `follow_up`)
- `outcome_notes` text (Matt's free-form notes)
- `offer_pitched` text (`bundle_499` | `fielddesk_only` | `missed_call_only` | `custom`)
- `deal_value_usd` numeric
- `outcome_set_at` timestamptz
- `next_action_at` timestamptz (when to follow up)

**b. New `demo_outcome_log` table** (append-only audit trail so you can see how a deal evolved):
- `booking_id` FK → demo_bookings
- `outcome`, `notes`, `actor` (defaults to "matt"), `created_at`
- RLS: service_role + admin read/write

**c. Tiny admin UI:** add a "Demo Pipeline" tab to existing `DWAAdmin.tsx` listing bookings with inline outcome dropdown + notes textarea + "save" button (calls a new `update-demo-outcome` edge function). Shows conversion stats per `offer_pitched`.

### 5. SMS reminders (24h + 1h before slot)
- New edge function `demo-reminder-dispatcher` runs every 15 min via pg_cron
- Queries `demo_bookings` where `slot_at` (computed from `slot_date + slot_time` in America/Detroit) is in the next 24h±15min OR 1h±15min window
- Skips bookings already reminded (uses two new columns: `reminder_24h_sent_at`, `reminder_1h_sent_at`)
- Uses `_shared/twilio.ts` `sendSMS()` (TCPA scrub + quiet hours built in)
- 24h template: "Hey {first}, Matt from Detroit Web Agency — quick reminder we're on tomorrow at {time} ET for your {company} demo. Reply YES to confirm or RESCHEDULE if you need a new time."
- 1h template: "60 min until our demo, {first}! Meeting link: {link if added later, else phone fallback (313) 992-1219}"
- Also SMS **Matt** at the 1h mark so he knows a call is coming

### 6. Polish `/demo-runner` for mobile + DWA aesthetic
Current implementation uses inline styles and a 260px sidebar that breaks below 768px. Refactor:
- Migrate to Tailwind classes using existing semantic tokens (`bg-background`, `text-foreground`, `border-border`, `text-primary` mapped to teal)
- Sidebar collapses to a horizontal scrollable step pill row on mobile
- Add **two new comparison views** for sales calls:
  - **"Before / After" split** — side-by-side: their current process (missed calls, voicemail black hole, no visitor data) vs DWA stack (instant SMS reply, FieldDesk dispatch, SiteRadar visitor feed)
  - **"Live dispatch" mock** — animated FieldDesk view with a fake incoming job auto-assigning to nearest tech, used live during calls to show the dashboard
- Keyboard arrow nav stays
- Prospect card in sidebar becomes a sticky bottom sheet on mobile

### 7. Verification (mandatory after build)
- Browser tool: navigate each new/changed URL on the live preview at 399px viewport
- Click through `/book-demo` → confirmation, `/website-plus-fielddesk` → both CTAs, `/demo-runner` all 6+ steps with prefill params
- Insert a fake demo_booking row via service_role and trigger `demo-reminder-dispatcher` manually with NOW shifted to verify the 24h/1h windows fire correctly
- Confirm `update-demo-outcome` writes to both `demo_bookings` AND `demo_outcome_log`
- Report broken/mismatched routes back in the final message

---

## Wave 2 — Ship later (after first close)

These aren't in this build:
- **Lead capture form at end of `/demo-runner`** — wait until you've actually run a demo and know what data you wish you'd captured
- **Demo-runner step persistence to backend** — localStorage is fine; backend is over-engineering
- **Paywall on demo/checkout** — actively harmful to cold outreach
- **Generic /shop with all DWA products** — your existing per-product landing pages convert better than a catalog

---

## Technical details

**Files created:**
- `src/pages/WebsitePlusFieldDesk.tsx`
- `src/pages/BundleSuccess.tsx` (post-checkout thank-you)
- `src/components/admin/DemoPipelineTab.tsx`
- `supabase/functions/create-bundle-90day-checkout/index.ts`
- `supabase/functions/update-demo-outcome/index.ts`
- `supabase/functions/demo-reminder-dispatcher/index.ts`
- `supabase/migrations/<ts>_demo_outcome_tracking.sql`

**Files modified:**
- `src/App.tsx` — routes for `/website-plus-fielddesk`, `/bundle-success`
- `src/pages/DemoRunner.tsx` — Tailwind refactor + 2 new comparison views + mobile layout
- `src/pages/DWAAdmin.tsx` — add Demo Pipeline tab
- `supabase/functions/stripe-webhook/index.ts` — handle `bundle_90day_purchase` type (welcome email + admin SMS)
- `supabase/config.toml` — `verify_jwt = false` for new public functions

**pg_cron:**
- `demo-reminder-dispatcher` every 15 min via existing vault-key pattern (per CLAUDE.md migration template)

**Schema:** all new columns nullable, append-only audit log, RLS enabled with service_role bypass + admin read.

**No mocks, no skipped error handling.** All edge functions fail-fast on errors per DWA Defensive Programming Protocol (memory: tech/dwa-defensive-programming-protocol).