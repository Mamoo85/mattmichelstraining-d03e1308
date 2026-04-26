## Goal

Replace the current `src/pages/MissedCallSaaS.tsx` with a high-conversion landing page implementing all 20 requested elements. Trial moves from 7 days → **14 days, no card charged**.

## Scope

### Backend (small but required)

1. **`supabase/functions/create-missed-call-subscription/index.ts`** — change `trial_period_days: 7` → `14`. Add `payment_method_collection: "if_required"` so the trial truly says "no card charged."
2. **New edge function `send-missed-call-demo-text`** — accepts `{ phone, city? }`, sends a single SMS via shared `_shared/twilio.ts` using the exact production template ("Hey! I just missed your call from {city} — I'll call you right back!"). Rate-limit: 1 send / phone / 10 min via in-memory map + a `demo_text_sends` row (best-effort log, no new migration — uses existing `system_comms_log`). Validates E.164, blocks obvious abuse (no SMS to short codes, no repeated identical numbers > 3/hour from same IP).

### Frontend — full rewrite of `src/pages/MissedCallSaaS.tsx`

Sections in order:

1. **Hero (#1, #2, #3, #20)** — Headline "Never Lose Another Job to a Missed Call." Primary CTA: **"Start Free — 14 Days, No Card Charged"** (red micro-line under button: *"Cancel before day 14 and you're never charged."*). Right side (desktop) / below (mobile): animated iPhone mockup — incoming missed call → 8-second ticking countdown ring → SMS bubble types out the personalized text using browser-detected city (fallback "Grosse Pointe"). Pure CSS/Framer Motion-style keyframes already available in tailwind config (`fade-in`, `scale-in`).
2. **Trust badges row (#6)** — Single horizontal strip: Twilio · Stripe · TCPA Compliant · Month-to-Month · No Setup Fee.
3. **3-step "How It Works" (#12)** — Existing 3-step layout, tightened: Miss call → Text in 8s → Lead saved.
4. **Try-It-Live demo (#17)** — Card with phone input + "Text me the demo" button. On submit calls `send-missed-call-demo-text`. Shows toast "Check your phone — text sent in under 8 seconds." Disabled state while pending; error toast on rate-limit.
5. **Lost-revenue calculator (#7)** — Two sliders: missed calls/week (0–50), avg job value ($100–$10,000). Live computed: `weekly × value × 0.25 × 4.3 = monthly lost`. Big red number "You're losing $X/month." Subtext: "Missed Call Catch costs $99/mo. Recover one job and it pays for itself for the year."
6. **Stat block (#8)** — 3 big stats in a row: 97% / 70% / 1-in-4.
7. **Competitor comparison table (#4, #5)** — 4-column (Feature / Podium $399 / Birdeye $299 / DWA $99). Rows: Voicemail transcription, City personalization, Callback reminders, No contract, 14-day free trial, Setup help included. Below table, the "why we're cheaper" paragraph.
8. **Objection crushers (#9, #10)** — Two side-by-side cards. "We already have voicemail" + "I call everyone back."
9. **Bundle callout (#15)** — Banner: "Already a Mortgage Radar or TechAlert client? Add Missed Call Catch for $49/mo." Button → `/pricing#bundle` (existing route) with `?bundle=missed-call` param.
10. **Social-proof ticker (#14)** — Animated counter line: "47 Metro Detroit businesses signed up this month." Hardcoded number constant `MONTHLY_SIGNUPS = 47` at top of file (easy to update); pulse animation.
11. **Testimonials (#13)** — Reuse existing `WallOfLove` with current 5 quotes (already includes roofer/HVAC/plumber/electrician/GC — covers requested industries).
12. **FAQ (#11)** — shadcn `Accordion` with the 6 Q&As listed in the request.
13. **Pricing card** — $99/mo callout with 14-day trial badge.
14. **Signup form** — Existing form, button copy: **"Start Free — 14 Days, No Card Charged →"** with red sub-line "Cancel before day 14 and you're never charged."
15. **Footer** — Existing `EnterpriseFooterBlock`.

### Industry variants (#16)

Add route in `src/App.tsx`:
```
<Route path="/missed-call-text/:industry" element={<MissedCallSaaS />} />
```
Inside the page, read `useParams().industry`. Map → headline override:
- `plumber` → "Plumbers: Stop Losing Jobs to Voicemail."
- `dentist` → "Dentists: Every Missed Call Is a Lost Patient."
- `contractor` → "Contractors: Win Jobs While You're On Site."
- `roofer`, `hvac`, `electrician` → similar swaps.
Default → existing headline. Also swap one stat-block label and one testimonial filter where applicable. SEO `<title>` updates per variant.

### Mobile sticky CTA (#19)

New small component `src/components/missed-call/MissedCallStickyCTA.tsx` (mirrors existing `StickyMobileCTA` pattern). Bottom bar, mobile only, appears after scrolling past hero. Text: "Start Free Trial — No Card for 14 Days →" → scrolls to signup form.

### Post-checkout setup wizard (#18)

`MissedCallSetup.tsx` already exists and is reasonable. Add a 3-dot progress bar at the top (Confirm number → Customize text → Done) and a clearer "You're on day 1 of 14 — no card charged yet" banner. Existing logic untouched.

## Files touched

- **edit** `src/pages/MissedCallSaaS.tsx` (full rewrite, ~600 lines)
- **edit** `src/pages/MissedCallSetup.tsx` (add progress bar + trial banner only)
- **edit** `src/App.tsx` (add `/missed-call-text/:industry` route)
- **edit** `supabase/functions/create-missed-call-subscription/index.ts` (trial 7→14 + `payment_method_collection`)
- **new** `supabase/functions/send-missed-call-demo-text/index.ts`
- **new** `src/components/missed-call/MissedCallStickyCTA.tsx`

## Out of scope (explicit)

- SiteRadar landing page — separate request, will tackle next.
- Real signup-counter wiring to DB — hardcoded constant for now (per user: "hook it to real data later").
- New testimonial copy — using existing 5 (already cover roofer/plumber/HVAC/electrician/GC).
- Phone-number Twilio Lookup for city personalization in the demo — uses caller-provided city or default; production missed-call flow already does Lookup.

## Risk / verification

- After deploy, will `curl` `create-missed-call-subscription` to confirm `trial_period_days: 14` in the returned Stripe session (read session via `stripe-api` if needed).
- Will `curl` `send-missed-call-demo-text` with a test phone to confirm SMS fires and rate-limit triggers on 2nd call.
- No DB migration required.
