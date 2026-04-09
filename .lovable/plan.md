
## Plan: 15 Upgrades for Detroit Web Agency — Conversion-First Architecture

The market research exposed a critical structural gap: the current AgencyHome jumps from Hero → Trust → Stats → Services — skipping the **Problem agitation** and **Process clarity** that drive conversions. This plan restructures the page into a psychological "Grease Slide" flow and layers the 15 features into that framework.

---

### PHASE 1: Restructure AgencyHome.tsx (Grease Slide Flow)

The page sections will be reordered to match the proven conversion sequence:

```text
1. Hero (refined copy + sticky mobile CTA)
2. Immediate Social Proof (trust bar + stats combined)
3. THE PROBLEM — "Missed Revenue Calculator" (new)
4. THE SOLUTION — Services Grid (existing, reframed)
5. THE PROCESS — 3-Step "How It Works" (new)
6. Terminal Animation — "See It In Action" (new)
7. Before/After Slider (new)
8. Case Study Audit Trail (new)
9. "Bare Metal DNA" / Why Us (existing, upgraded)
10. Local Footprint Map (new)
11. Local Guarantee Block (new)
12. FAQ / Objection Handling (new)
13. Final CTA (existing, high-contrast)
14. Uptime Bar (new, above footer)
15. Footer
```

**Exit-Intent Modal** renders globally on agency pages only.

---

### Hero Refinements (based on research)

**Current**: "Building Digital Engines for Michigan Businesses" — too vague.

**New**: Clear who/what/result statement:
- H1: "Your Website Should Be Your Best Salesperson"
- Sub: "We build automated websites and lead systems for Michigan contractors. You get booked jobs — we handle the tech."
- Primary CTA: "Get a Free Site Diagnostic" (keeps existing audit link)
- Secondary CTA: "Call (313) 806-4952" (click-to-call on mobile)
- **Sticky mobile CTA**: Fixed bottom bar on mobile with "Get Free Diagnostic" button — always visible while scrolling

---

### Category 1: 5 API-Powered Features

#### 1.1 Live "Lead Magnet" Scanner (`/free-site-scanner`)
- Visitor enters URL → 15-second scan via DataForSEO (PageSpeed + On-Page)
- OpenRouter generates plain-English "Top 3 Issues" summary
- Mini-report shown on screen; email required to unlock full report (Resend)
- **Form design**: Single URL field + email field only (2 fields max per research)
- New Edge Function: `live-site-scanner`
- DB: `site_scanner_leads` table

#### 1.2 Competitor Threat Alerts (weekly cron)
- Scans paying clients' top 3 competitors via DataForSEO SERP API
- If competitor outranks client → Resend email with keyword, position delta, and Stripe "SEO Sprint" payment link
- New Edge Function: `competitor-threat-alerts`
- DB: `competitor_threat_log` table

#### 1.3 Hardware-to-Software Cross-Sell Engine
- Stripe webhook listens for `meta.type === "computer_repair"` payments
- 3-day delayed email via Resend pitching "Digital Infrastructure Audit"
- New Edge Function: `cross-sell-drip` (daily cron)
- DB: `cross_sell_queue` table

#### 1.4 Client "Command Center" Dashboard (`/command-center`)
- Protected route for retainer clients
- Live keyword ranking charts (Recharts) pulled from DataForSEO
- Position changes with up/down arrows, local pack presence
- New Edge Function: `client-rankings-fetch`
- DB: `client_ranking_snapshots` table

#### 1.5 Hyper-Local Content Generator (admin tool)
- OpenRouter/Sonar researches Metro Detroit zoning changes, code updates by trade
- Outputs draft blog posts tagged by industry
- New Edge Function: `local-content-generator`
- DB: `generated_content_drafts` table

---

### Category 2: 5 Design/Conversion Components

#### 2.1 "Missed Revenue" Calculator (THE PROBLEM section)
- **Purpose**: Agitate pain before showing solutions (research: "prove you understand their struggles")
- Two sliders: "Missed Calls/Week" (1-20) + "Average Ticket Size" ($100-$5000)
- Animated output: weekly/monthly/annual loss in bold red
- "Plug the Leak" CTA → `/ai-phone-answering`
- Component: `src/components/agency/MissedRevenueCalculator.tsx`

#### 2.2 Terminal "Live Audit" Illusion
- Dark terminal UI typing animation: DNS lookup → SSL check → mobile score → SEO crawl → competitor scan
- Intersection Observer triggers on scroll
- Ends with "ANALYSIS COMPLETE — 4 Critical Issues Found" + CTA
- Component: `src/components/agency/TerminalAnimation.tsx`

#### 2.3 Dynamic Industry Routing
- `?industry=roofing` (or plumbing, dental, hvac, etc.) swaps hero H1, subtext, testimonials from `INDUSTRY_CONTENT` config
- Default content if no param — enables ad-specific landing variations
- Edit: `AgencyHome.tsx` reads URL params

#### 2.4 Exit-Intent "Custom Build" Interceptor
- Detects mouse leaving viewport (desktop) / back intent (mobile)
- "Enter your URL — our Lead Agent will build a custom demo in 24 hours. No cost."
- **Minimal form**: URL + email only (2 fields per research guidelines)
- Fires once per session (sessionStorage)
- Component: `src/components/agency/ExitIntentModal.tsx`
- DB: `exit_intent_leads` table

#### 2.5 Before/After Infrastructure Slider
- Draggable divider: old broken mobile site ↔ new agency-built site
- Touch-friendly
- Component: `src/components/agency/BeforeAfterSlider.tsx`

---

### Category 3: 5 Credibility & Trust Builders

#### 3.1 "Local Footprint" Map
- Interactive SVG focused on Metro Detroit / Grosse Pointe
- Color-coded pins by service type (hardware, web, automation)
- Hover shows business type + service
- Component: `src/components/agency/LocalFootprintMap.tsx`

#### 3.2 Live System Uptime Monitor
- Subtle dark footer bar: "99.99% Uptime" with green status dots
- Static metrics initially (industrial clients respect uptime over flash)
- Component: `src/components/agency/UptimeBar.tsx`

#### 3.3 "Bare Metal" Hardware Roots ("Our DNA")
- Split layout: progression icons (Motherboard → Server → Cloud → Lead Engine)
- Copy: "We started fixing motherboards. Today we engineer the same reliability into your digital infrastructure."
- Component: `src/components/agency/BareMetalDNA.tsx`

#### 3.4 Transparent Audit Trail (Case Studies)
- Terminal-style display of real (anonymized) gap analysis: Problem → Fix → Result
- Before/after scores, lead increase metrics
- 2-3 hardcoded case studies
- Component: `src/components/agency/CaseStudyAuditTrail.tsx`

#### 3.5 "No-BS Local Guarantee"
- Matt's photo (matt-boat.jpg), direct quote guarantee
- "I'm not an overseas agency. I'm a local engineer in Grosse Pointe. If it doesn't work, I fix it — in person."
- Signature-style design
- Component: `src/components/agency/LocalGuaranteeBlock.tsx`

---

### NEW: Sections Added From Research

#### "How It Works" — 3-Step Process Section
- Step 1: "We Scan Your Site" (free diagnostic)
- Step 2: "We Build Your System" (custom site + automation)
- Step 3: "You Get Booked Jobs" (leads flow in)
- Simple numbered cards, keeps it non-intimidating
- Component: `src/components/agency/HowItWorks.tsx`

#### FAQ / Objection Handling Section
- Categorized accordion: Pricing, Timeline, Effort Required, Technical
- Questions like: "How much does it cost?", "How long until I see results?", "Do I need to do anything?"
- Component: `src/components/agency/AgencyFAQ.tsx`

#### Sticky Mobile CTA
- Fixed bottom bar on mobile (agency domain only): "Get Free Diagnostic →"
- Hides when user is at the hero CTA (Intersection Observer)
- Component: `src/components/agency/StickyMobileCTA.tsx`

---

### Database Migration (single migration)

New tables (all with RLS + service_role policy):
- `site_scanner_leads` (email, url, scores jsonb, report_sent boolean)
- `competitor_threat_log` (client_id, keyword, competitor, positions, alerted_at)
- `cross_sell_queue` (stripe_payment_id, email, business_name, send_at, sent boolean)
- `client_ranking_snapshots` (client_id, keyword, position, local_pack, checked_at)
- `generated_content_drafts` (industry, title, body, status, client_id)
- `exit_intent_leads` (email, url, created_at)

---

### New Routes
- `/free-site-scanner` — Lead Magnet Scanner page
- `/command-center` — Client Command Center (protected)

### Edge Functions (5 new)
- `live-site-scanner`
- `competitor-threat-alerts`
- `cross-sell-drip`
- `client-rankings-fetch`
- `local-content-generator`

### Files Summary

| Area | Files |
|---|---|
| Pages | `AgencyHome.tsx` (full restructure), new `FreeSiteScanner.tsx`, new `ClientCommandCenter.tsx` |
| Components | 13 new in `src/components/agency/` (10 original + HowItWorks, AgencyFAQ, StickyMobileCTA) |
| Edge Functions | 5 new |
| DB | 1 migration with 6 tables |
| Routes | `App.tsx` — 2 new routes |
| Existing | `stripe-webhook/index.ts` — add computer_repair cross-sell handler |

### Zero Bleed Guarantee
All components render exclusively on agency domain. `AgencyHome.tsx` is only served when hostname includes `detroitwebagent`. No CSS, layout, or component changes touch M² Training.
