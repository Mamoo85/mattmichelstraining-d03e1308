# Plan: Convert the White Light Electric reply into a closed deal

Anne-Abel Smith (CFO/Integrator at White Light Electric, [info@whitelightelectric.us](mailto:info@whitelightelectric.us), cell 248-330-4031) replied "Let's schedule a demo, please." This is our first real warm reply — we treat it like a $50K LTV opportunity, not a one-off.

Below is a 4-part plan covering: (1) prospect research, (2) the reply + scheduling flow, (3) the demo system / playbook, (4) self-enrolling Matt in FieldDesk for practice.

---

## Part 1 — Research White Light Electric (before anything ships)

Before writing copy or building forms, gather facts so the reply doesn't feel templated.

- Scrape `whitelightelectric.us` with Firecrawl: services offered, service area, team size signals, current website quality (load speed, mobile responsiveness, screenshots).
- LARA license lookup for "White Light Electric" (Michigan electrical contractor license, status, expiration).
- Apollo enrich on `info@whitelightelectric.us` and `White Light Electric` — pull owner name, employee count, founded year, LinkedIn.
- Google Places lookup: review count, star rating, last review date, response rate.
- Save findings to a new `prospect_research_dossier` row keyed to `info@whitelightelectric.us` so the reply email and Matt's demo prep both pull from one source.

Output: a one-page dossier Matt sees before the demo (industry, current website grade A–F, employee count, license status, top 3 product fits with reasoning).

---

## Part 2 — The Reply + Demo Scheduling Flow

**Recommendation:** combine a short personal reply from Matt with a one-click scheduling link. Don't ask them to free-text their availability — that creates a back-and-forth and we lose them. A million-dollar business sends a calendar.

### 2a. New page `/book-demo?prospect=<id>`

- Mobile-first, DWA-branded (electric teal #00d4ff on near-black #0a1628).
- 14-day rolling availability grid (M–F, 9a–5p ET, 30-min slots), reads from a new `demo_slots` table.
- Pre-filled with prospect's name + company (from `?prospect=` token).
- Two demo types: "15-min discovery" (default) or "30-min full demo + screenshare".
- On submit: writes to `demo_bookings`, sends Matt SMS + adds to his Google Calendar via `GOOGLE_SERVICE_ACCOUNT_KEY` (already configured), sends prospect a confirmation email with the join link.

### 2b. Reply email (sent from `matt@detroitwebagent.com`)

Sent via `gmail-send-outreach` (already deployed). Structure:

1. Personal one-liner referencing their business specifically ("Saw whitelightelectric.us — happy to walk you through what we'd do for an electrical contractor your size").
2. **One** primary CTA: "Pick a 15-min slot here → /book-demo?prospect=&nbsp;"
3. A short "While you're here" section listing the 3 products most relevant to electrical contractors:
  - **TechAlert** — "Michigan publishes every licensed electrician in the state. We text you when one becomes available." ($99/mo)
  - **FieldDesk** — "Replace eWay. Your techs can use it from a panel." ($199/mo, **free first month** with website)
  - **Trade Radar (Electrical)** — "We watch BSEED panel-upgrade permits across Wayne/Oakland/Macomb daily and route you the leads." ($149/mo)
4. **The Bundle Hook**: "$1,499 website + 30-day free FieldDesk trial + 20% off everything else when bundled." This is the wedge — get the website sale, lock in recurring.
5. Soft P.S. with Matt's cell.

### 2c. New offer to formalize: "Website + FieldDesk Free Trial Bundle"

We don't currently package this. Add it:

- New Stripe checkout `create-website-fielddesk-trial-checkout` — $1,499 one-time website build, FieldDesk auto-provisions free for 30 days, then $159/mo (bundle price) auto-bills.
- Webhook handler in `stripe-webhook` for `website_fielddesk_trial` type.
- New landing page `/website-plus-fielddesk` so the offer is referenceable.

---

## Part 3 — The Demo System (so Matt can actually run a great demo)

Right now Matt has never used FieldDesk. We fix this in two layers:

### 3a. Demo Prep Pack (auto-generated per booking)

When a `demo_bookings` row is created, an edge function `generate-demo-prep` runs and emails Matt 30 min before the call:

- The dossier from Part 1
- The 3 recommended products with talking points pulled from `knowledge/field-service-brief.md` and the cold-email angle table
- A pre-filled FieldDesk demo environment seeded with **their company name** as fake jobs (e.g., "White Light Electric — service call, 1234 Main St")
- Pricing math specific to their tech count (already in the brief)
- 3 likely objections with rebuttals

### 3b. Live Demo Script (one shareable URL)

A new `/demo-runner/<booking_id>` page Matt opens during the call. Single-screen, advances through:

1. Their current site → ours (split screen)
2. FieldDesk dispatch board (live, pre-seeded with their data)
3. Tech mobile view (large buttons, "your tech in a panel box")
4. TechAlert pitch: "Here are 3 licensed electricians in Wayne County right now"
5. Pricing card with bundle math
6. "Send proposal" button → triggers `send-djconley-proposal-v3` style flow customized for them

This is the "million-dollar" piece — Matt walks in with a personalized environment, not a generic deck.

---

## Part 4 — Enroll Matt in FieldDesk as a real customer

So Matt can practice, learn the product, and dogfood it.

- Insert a `field_crm_clients` row for `matt@detroitwebagent.com` / "Detroit Web Agency Internal" with full subscription (`status='active'`, `plan='founder_internal'`, no Stripe charge).
- Seed 8 fake jobs across statuses (Open / Assigned / En Route / On Site / Completed) with realistic Detroit addresses.
- Seed 3 fake techs with GPS coordinates around Metro Detroit so the Tech Map looks alive.
- Add Matt's phone (313-806-4952) as the dispatcher SMS endpoint so he gets the real notifications.
- Generate a magic-login link to `/my-field-desk` and SMS it to him.
- Add a small "Demo Mode" badge to the UI when `plan='founder_internal'` so he knows it's seeded data.

---

## Technical Section

**New files**

- `src/pages/BookDemo.tsx` — booking grid
- `src/pages/DemoRunner.tsx` — live demo screen for Matt
- `src/pages/WebsitePlusFieldDesk.tsx` — bundle landing page
- `supabase/functions/create-demo-booking/index.ts` — writes booking, calendar invite, SMS Matt
- `supabase/functions/generate-demo-prep/index.ts` — runs 30-min pre-call, emails Matt the dossier
- `supabase/functions/research-prospect/index.ts` — Firecrawl + LARA + Apollo + Places dossier builder
- `supabase/functions/create-website-fielddesk-trial-checkout/index.ts`
- `supabase/functions/seed-fielddesk-internal/index.ts` — one-shot to provision Matt

**New tables (one migration)**

- `demo_slots` (id, slot_date, start_time, is_booked, booking_id)
- `demo_bookings` (id, prospect_email, prospect_name, company, slot_id, demo_type, status, notes, created_at)
- `prospect_research_dossier` (id, email, company, website, dossier_json, generated_at)

All with RLS + service_role bypass.

**Stripe webhook**: add `website_fielddesk_trial` type handler that creates client + 30-day trial subscription.

**Edge function deploys needed**: all new functions above, plus a re-deploy of `stripe-webhook`.

---

## Suggested order of execution (after you approve)

1. Run prospect research on White Light Electric — get the dossier first (no code changes needed; uses existing tools).
2. Provision Matt's FieldDesk so he can play with it tonight.
3. Build `/book-demo` + booking infrastructure.
4. Build the website+FieldDesk trial bundle + landing page.
5. Build demo-prep + demo-runner.
6. Send the personalized reply to Anne-Abel with the booking link.

Step 1, 2, and 6 can happen in parallel today. Steps 3–5 are the longer build.

---

## Open questions for you

1. Demo length default — **15 min discovery** (low friction, screen later) or **30 min full demo** out of the gate? Im not sure, whats standard? I'll let you recommend.
2. Bundle pricing — confirm **$1,499 website + 30 days free FieldDesk + then $159/mo** (the brief's bundle price) — or do you want a different trial offer? No its $499 for the website. Remember the website is the Trojan Horse lets not price ppl out.
3. Calendar — should bookings push to your existing Google Calendar (`GOOGLE_CALENDAR_ID`) or a new dedicated DWA-demos calendar? New demos calendar that texts me when ppl sign up. 
4. Demo mode — do you want Tom (the autonomous lead-hunter agent) to also auto-research every reply that comes in going forward, so this happens automatically next time? Yes.