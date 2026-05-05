## Full audit findings (worse than the first pass — 20+ broken functions)

The Gmail screenshot is just one symptom. Across the project there are **5 systemic problems**:

**Problem A — Wrong product pitched.** `multi-service-drip` and parts of the website-pitch flow hawk a salad of cheap add-ons (AI Phone $149, Speed-to-Lead SMS $39, Reputation Dashboard $79, Blog Posts $79). Those are post-sale add-ons, not standalone cold-traffic offers.

**Problem B — Fake trial CTA on everything.** `_shared/dwa-email.ts → dwaColdEmail()` auto-appends a "Start your free 7-day trial of Detroit Web Agency" box on every send, regardless of product. The website itself has no trial.

**Problem C — Hardcoded "free trial" copy in legacy senders that bypass the shared helper.** Found in: `dead-lead-outreach-drip` ("Start your free trial in 60 seconds"), `contractor-fomo-mailer` ("7-day free trial"), `outreach-email-blast` ("Start your free 7-day trial →"), `hoa-cold-outreach` ("Offer a free trial"), `pipeline-drip-send`, `pipeline-batch-drip`, `pipeline-auto-drip` (raw Resend fetch, no brand wrap, no teaser, no audit).

**Problem D — No visuals.** Only 6 of ~25 cold senders use `teaserCardHtml`. The rest are wall-of-text. The teaser card itself shows one lead — no dashboard mock, no "what you're missing" revenue math.

**Problem E — No revenue math.** Nothing in the cold pipeline says "you're losing $X/month." Recipients have to do the value math themselves.

## Plan

### 1. Lock down the shared sender (defense-in-depth)
- `_shared/dwa-email.ts`:
  - Add `TRIAL_ELIGIBLE_PRODUCTS` allowlist (Mortgage Radar, Trade Radar + 11 verticals, FieldDesk, SiteRadar, Missed-Call Catch, AI Phone Answering, Bundle Revenue Suite, TechAlert, CareAlert, Talent Radar).
  - `dwaColdEmail()` only appends `trialCtaHtml()` when `opts.product` is in the allowlist. Otherwise: plain teal CTA button using `opts.ctaUrl`/`opts.ctaText`.
  - Add a new optional `opts.teaser` field that takes a `TeaserCardOpts` and renders it above the body. Add `opts.dashboardPreview` (image URL + missed-revenue line) that renders the new dashboard preview block.

### 2. New shared visual: `_shared/dashboard-preview.ts`
A reusable HTML block that renders:
- A hosted dashboard screenshot (PNG, lives in `public/email-assets/`) styled as a "your dashboard would look like this" tile
- A "Missed Revenue This Month" big-number line ($X,XXX) computed from product-specific defaults (e.g. Trade Radar = leads_in_zip × $400 avg job; Missed-Call = est_missed_calls × $312; Mortgage Radar = est_refi_pool × $2,800; SiteRadar = anonymous_visitors × $80; TechAlert = open_role_days × $1,200/day)
- A small "Based on signals we already pulled in your ZIP" caption so the number feels real, not invented.

### 3. Generate the dashboard preview images
Use the AI image generation gateway (Nano banana pro `google/gemini-3-pro-image-preview`) to mock 6 dashboard screenshots — one per flagship product:
- Trade Radar (lead feed with score badges + Street View thumbs)
- Mortgage Radar (refi candidates with equity %)
- TechAlert / Talent Radar (candidate dossiers + license badges)
- Missed-Call Catch (call log with auto-text replies)
- SiteRadar (anonymous-visitor company list)
- FieldDesk (job board + tech locations)

Save to `public/email-assets/preview-<product>.png`. Run each through the `product-shot` skill so they're framed in a macOS window with a soft DWA-teal mesh gradient. Reference them in cold emails as `https://detroitwebagent.com/email-assets/preview-<product>.png`.

### 4. Reframe `multi-service-drip` (full rewrite)
- Drop `getServicesForIndustry()` add-on salad entirely.
- New 3-step sequence, **each step embeds a dashboard preview + teaser card + missed-revenue number**:
  - **Step 1**: "Your current site has [flaw]. Here's what we'd build" → demo link + dashboard preview of the radar product that fits their industry.
  - **Step 2**: "Here's what a similar [industry] in MI got in 30 days" → revenue math + sample lead teaser card.
  - **Step 3**: "Last note — your competitors in [city] are pulling X leads/mo with this exact stack" → urgency + pricing.
- Industry → product mapping (cold pitch only ever points to ONE real lead/hire product, never the add-on list):
  - Contractors / home-service → Trade Radar (matching vertical)
  - Mortgage / loan officer / realtor → Mortgage Radar
  - Healthcare / facility / staffing → CareAlert / TechAlert
  - Legal / consulting / professional services → Missed-Call Catch + AI Phone Answering bundle
  - Manufacturing / industrial → TechAlert (skilled trades hiring) + SiteRadar
  - Restaurant / retail / salon → Missed-Call Catch
  - B2B / SaaS / agency → SiteRadar

### 5. Sweep every other cold sender
For each, swap raw Resend / hardcoded "free trial" / addon-salad copy for `dwaColdEmail()` with a real `product:` string + teaser card + dashboard preview:
- `dead-lead-outreach-drip`, `contractor-fomo-mailer`, `outreach-email-blast`, `hoa-cold-outreach`, `pipeline-drip-send`, `pipeline-batch-drip`, `pipeline-auto-drip`, `neo-outreach`, `prospect-local-businesses`, `web-design-drip`, `dossier-cold-outreach`, `dossier-cold-outreach-bulk`, `signal-channel-blast`, `storm-lead-blaster`, `marketplace-outreach-blast`, `mortgage-radar-outreach`, `dwa-product-blast`, `fielddesk-cold-blast`, `siteradar-cold-blast`, `contractor-prospector`, `contractor-outreach-email-blast`, `techalert-outreach`, `techalert-followup-drip`, `channel-prospector-followup`, `agency-prospect-list-blast`.

For each one: confirm `product:` string, attach the right dashboard preview image, attach a teaser card with one example lead from that product's table (or a realistic sample if no live row exists for that recipient's geo), inject the missed-revenue line.

### 6. Verify what is NOT touched
- `ai-upsell-sender`, `cross-sell-drip`, `monthly-upgrade-recap-sender` — these target existing customers. The add-on salad lives here legitimately.
- `create-*-checkout` — landing-page checkouts for the individual add-ons are fine; we just stop pitching them in cold.
- TechAlert/Mortgage Radar/Trade Radar/FieldDesk/SiteRadar/Missed-Call landing pages — already pitch their own product correctly.

### 7. Deploy + test
Deploy every touched edge function. Trigger one test send through `multi-service-drip`, `web-design-drip`, `dead-lead-outreach-drip`, `contractor-fomo-mailer`, and `outreach-email-blast` — confirm:
- No bogus "free trial of Detroit Web Agency" box on website pitches
- Dashboard preview image renders inline
- Teaser card renders inline
- Missed-revenue number shows
- CTA goes to the right product page

## Files touched (~30)
- `supabase/functions/_shared/dwa-email.ts`
- `supabase/functions/_shared/teaser-card.ts` (extend with score-meter + sample-data variants)
- `supabase/functions/_shared/dashboard-preview.ts` (new)
- `public/email-assets/preview-*.png` (6 new generated images)
- 25 cold-email edge functions listed in §5
- `supabase/functions/multi-service-drip/index.ts` — full rewrite per §4

## Out of scope
- Customer-portal upsell tiles (where add-ons belong)
- Trial mechanics / Stripe (already correct)
- Any UI changes in the React app
