

## Plan: 15 Upgrades for Detroit Web Agency — Conversion-First "Grease Slide" Architecture

The market research validates the overall direction and highlights one critical structural gap: the current AgencyHome skips from Hero → Trust → Stats → Services — missing the **Problem agitation** and **Process clarity** sections that drive conversions. This refined plan restructures the page into a proven psychological flow and layers all 15 features into that framework.

---

### Key Refinements From Market Research

1. **Hero copy rewrite**: Replace vague "Building Digital Engines" with clear who/what/result: "Your Website Should Be Your Best Salesperson"
2. **Add "Problem" section**: The Missed Revenue Calculator becomes the centerpiece pain-agitator before any solution is presented
3. **Add "Process" section**: Simple 3-step "How It Works" after services (Scan → Build → Get Jobs)
4. **Add FAQ/Objection Handling**: Categorized accordion near bottom to clear final doubts
5. **Sticky Mobile CTA**: Fixed bottom bar on mobile that's always visible while scrolling
6. **Click-to-call emphasis**: Secondary CTA becomes a phone call button on mobile
7. **Minimal form fields**: All lead capture forms use 2 fields max (URL + email)

---

### AgencyHome.tsx New Section Order (Grease Slide Flow)

```text
1.  Hero (refined copy + click-to-call secondary CTA)
2.  Trust Bar + Stats (combined social proof strip)
3.  Missed Revenue Calculator — THE PROBLEM (new)
4.  Services Grid — THE SOLUTION (existing, reframed)
5.  How It Works — 3-step process (new)
6.  Terminal Animation — "See It In Action" (new)
7.  Before/After Slider (new)
8.  Case Study Audit Trail (new)
9.  Bare Metal DNA + Why Us (existing, upgraded)
10. Local Footprint Map (new)
11. Local Guarantee Block (new)
12. FAQ / Objection Handling (new)
13. Final CTA (existing, high-contrast)
14. Uptime Bar (new, above footer)
15. Footer (existing)
```

Exit-Intent Modal renders globally on agency pages only.
Sticky Mobile CTA bar fixed at bottom on mobile.

---

### Category 1: 5 API-Powered Features

**1.1 Live "Lead Magnet" Scanner** — New page `/free-site-scanner`, new Edge Function `live-site-scanner`
- DataForSEO (PageSpeed + On-Page) → OpenRouter plain-English summary → mini-report on screen
- Email capture to unlock full report (Resend). **2 fields only**: URL + email
- DB: `site_scanner_leads` table

**1.2 Competitor Threat Alerts** — New Edge Function `competitor-threat-alerts` (weekly cron)
- DataForSEO SERP API checks client keywords vs competitors
- If outranked → Resend email with Stripe "SEO Sprint" payment link
- DB: `competitor_threat_log` table

**1.3 Hardware-to-Software Cross-Sell** — Edit `stripe-webhook` + new Edge Function `cross-sell-drip`
- Listen for `meta.type === "computer_repair"` → queue 3-day delayed agency pitch email
- DB: `cross_sell_queue` table

**1.4 Client Command Center** — New page `/command-center` (protected), new Edge Function `client-rankings-fetch`
- Live keyword ranking charts (Recharts) from DataForSEO
- DB: `client_ranking_snapshots` table

**1.5 Hyper-Local Content Generator** — Admin tool, new Edge Function `local-content-generator`
- OpenRouter/Sonar researches Metro Detroit zoning/code changes by trade
- Outputs draft blog posts
- DB: `generated_content_drafts` table

---

### Category 2: 5 Design/Conversion Components

**2.1 Missed Revenue Calculator** — `MissedRevenueCalculator.tsx`
- Sliders for missed calls + ticket size → animated red loss numbers → "Plug the Leak" CTA

**2.2 Terminal Animation** — `TerminalAnimation.tsx`
- Dark terminal typing simulation (DNS, SSL, mobile score, SEO, competitor scan)
- Intersection Observer trigger, ends with "4 Critical Issues Found" + CTA

**2.3 Dynamic Industry Routing** — URL param `?industry=roofing` swaps hero content
- `INDUSTRY_CONTENT` config map for roofing, plumbing, dental, hvac, landscaping, restaurant, salon

**2.4 Exit-Intent Modal** — `ExitIntentModal.tsx`
- Mouse-leave detection, 2-field form (URL + email), once per session
- DB: `exit_intent_leads` table

**2.5 Before/After Slider** — `BeforeAfterSlider.tsx`
- Draggable divider showing old broken site vs new agency build, touch-friendly

---

### Category 3: 5 Credibility & Trust Builders

**3.1 Local Footprint Map** — `LocalFootprintMap.tsx`
- SVG grid map of Metro Detroit with color-coded pins (web, automation, hardware)

**3.2 Uptime Bar** — `UptimeBar.tsx`
- Subtle footer bar: "99.99% Uptime" with green status dots

**3.3 Bare Metal DNA** — `BareMetalDNA.tsx`
- "Our DNA" section: Motherboard → Server → Cloud → Lead Engine progression

**3.4 Case Study Audit Trail** — `CaseStudyAuditTrail.tsx`
- 3 anonymized case studies showing raw audit output → fix → measurable result

**3.5 Local Guarantee Block** — `LocalGuaranteeBlock.tsx`
- Matt's photo, direct quote guarantee, contact info

---

### New Sections From Research

**How It Works** — `HowItWorks.tsx`
- 3 cards: Scan → Build → Get Jobs

**Agency FAQ** — `AgencyFAQ.tsx`
- 8 categorized questions (Pricing, Timeline, Effort, Technical, General)

**Sticky Mobile CTA** — `StickyMobileCTA.tsx`
- Fixed bottom bar on mobile, appears after scrolling past hero

---

### Database (single migration, 6 tables)

| Table | Purpose |
|---|---|
| `site_scanner_leads` | Lead magnet email capture |
| `competitor_threat_log` | Weekly competitor alert tracking |
| `cross_sell_queue` | Hardware → agency cross-sell pipeline |
| `client_ranking_snapshots` | Keyword ranking cache |
| `generated_content_drafts` | AI-generated blog drafts |
| `exit_intent_leads` | Exit-intent form submissions |

All with RLS enabled, service_role access. `site_scanner_leads` and `exit_intent_leads` also allow anon insert.

---

### New Routes

- `/free-site-scanner` → `FreeSiteScanner.tsx`
- `/command-center` → `ClientCommandCenter.tsx` (protected)

### Files Summary

| Area | Count | Details |
|---|---|---|
| Components | 13 new | All in `src/components/agency/` |
| Pages | 2 new | `FreeSiteScanner.tsx`, `ClientCommandCenter.tsx` |
| Edge Functions | 5 new | `live-site-scanner`, `competitor-threat-alerts`, `cross-sell-drip`, `client-rankings-fetch`, `local-content-generator` |
| Restructure | 1 | `AgencyHome.tsx` full section reorder |
| Routes | 2 new | In `App.tsx` |
| DB | 1 migration | 6 tables |
| Edit | 1 | `stripe-webhook/index.ts` (cross-sell handler) |

### Zero Bleed Guarantee
All components render exclusively on the agency domain. No CSS, layout, or component changes touch M² Training.

