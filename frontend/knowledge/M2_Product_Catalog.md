# M² Development — Complete Product Catalog
## Confidential Internal Reference | Last Updated: April 2026

---

# Table of Contents

1. [Web Design Services](#1-web-design-services)
2. [GBP SaaS (Google Business Profile Auto-Poster)](#2-gbp-saas)
3. [Social Media AI Service](#3-social-media-ai)
4. [Field Rep AI Tools SaaS](#4-field-rep-ai-tools)
5. [Field Rep Weekly Newsletter](#5-field-rep-weekly-newsletter)
6. [B2B Dental Database](#6-b2b-dental-database)
7. [Contractor Lead Generation](#7-contractor-lead-gen)
8. [AI Blog Post Writer](#8-ai-blog-post-writer)
9. [AI Review Response Service](#9-ai-review-response)
10. [Review Monitor + Alert](#10-review-monitor)
11. [Weekly SMS Blast](#11-weekly-sms-blast)
12. [No-Show Re-Booker](#12-no-show-re-booker)
13. [Estimate Follow-Up Drip](#13-estimate-follow-up-drip)
14. [Invoice Chaser](#14-invoice-chaser)
15. [After-Job Review Drip](#15-after-job-drip)
16. [Seasonal Promo Blaster](#16-seasonal-promo-blaster)
17. [Referral Program SMS](#17-referral-program-sms)
18. [Slow Day SMS](#18-slow-day-sms)
19. [New Homeowner Campaign](#19-new-homeowner-campaign)
20. [AI Competitor Watch](#20-ai-competitor-watch)
21. [Battlecard Reports](#21-battlecard-reports)
22. [AI Ads Copy Generator](#22-ai-ads-copy)
23. [AI Website Audit](#23-ai-website-audit)
24. [Competitor Pricing Monitor](#24-competitor-pricing-monitor)
25. [AI Sermon Prep](#25-ai-sermon-prep)
26. [Government RFP Alerts](#26-rfp-alerts)
27. [Dark Web Monitor](#27-dark-web-monitor)
28. [Abandoned Cart Recovery](#28-abandoned-cart)
29. [Collections SMS](#29-collections-sms)
30. [Direct Mail AI](#30-direct-mail)
31. [Trainer Social AI](#31-trainer-social-ai)
32. [AI Chatbot Widget](#32-ai-chatbot)
33. [Missed Call Text-Back](#33-missed-call-text-back)
34. [Birthday Campaign SMS](#34-birthday-campaign)
35. [Appointment Reminder SMS](#35-appointment-reminder)
36. [Warranty Reminder SMS](#36-warranty-reminder)

---

# 1. Web Design Services {#1-web-design-services}

## What It Is
Custom professional website builds for local businesses, with ongoing maintenance retainer.

## What It Does
- AI-powered website generation from industry templates (~30 seconds)
- Matt reviews, customizes, and delivers a fully functional site
- Ongoing maintenance: hosting, updates, content changes

## Pricing
| Tier | Price | Retainer |
|------|-------|----------|
| Friends & Family | $1,500 one-time | $99/mo |
| Starter | $499 one-time | $49/mo |
| Professional | $1,499 one-time | $99/mo |
| Business | $3,499 one-time | $199/mo |
| Enterprise | $7,500+ custom | Custom |

## Cost Per Client
- **AI generation**: ~$0.002 per site (Lovable AI Gateway, Gemini Flash Lite)
- **Hosting**: Included in Lovable/Supabase free tier
- **Domain**: Client provides or ~$12/year
- **Margin**: ~95%+ on initial build

## Tools & APIs Used
| Tool | Purpose | Cost |
|------|---------|------|
| Lovable AI Gateway | AI website generation | Included |
| Supabase | Database, auth, edge functions | Included (Cloud) |
| Stripe | Payment processing | 2.9% + $0.30/txn |
| Resend | Email notifications | Free tier (3k/mo) |
| Firecrawl | Competitor research for proposals | Included via connector |

## Edge Functions
- `web-design-drip/index.ts` — Automated outreach emails to prospected leads
- `web-project-fulfillment/index.ts` — Project lifecycle management
- `prospect-local-businesses/index.ts` — Daily lead scraping (16 industries)
- `auto-proposal-agreement/index.ts` — Auto-generate proposals

## Database Tables
- `web_design_leads` — Client pipeline tracking
- `outreach_leads` — Prospected business leads
- `web_design_projects` — Active project tracking

## Step-by-Step Flow
1. **Lead Generation**: `prospect-local-businesses` scrapes Google Maps daily for businesses without websites in 16 industries
2. **Outreach**: `web-design-drip` sends personalized emails with industry-specific demo links
3. **Reply Detection**: `ai-reply-detector` monitors for interested responses
4. **Proposal**: Matt reviews interest, `auto-proposal-agreement` generates a custom proposal
5. **Payment**: Client pays via Stripe checkout (inline price_data)
6. **Intake**: Client fills out intake form at `/web-project-intake`
7. **Build**: AI generates initial site, Matt customizes
8. **Review**: Client gets preview link, provides feedback
9. **Launch**: Site goes live, client enters maintenance retainer
10. **Ongoing**: Monthly retainer covers hosting + minor changes

---

# 2. GBP SaaS (Google Business Profile Auto-Poster) {#2-gbp-saas}

## What It Is
Automated AI-generated posts published directly to Google Business Profile 3x/week.

## What It Does
- Generates industry-relevant posts with local SEO keywords
- Posts automatically to GBP via Google Business Profile API
- Boosts local search visibility and engagement

## Pricing
| Plan | Price |
|------|-------|
| Basic | $49/mo |
| Pro | $99/mo |

## Cost Per Client
- **AI generation**: ~$0.001/post (Gemini Flash Lite)
- **3 posts/week × 4 weeks = 12 posts/mo**: ~$0.012/mo per client
- **Margin**: ~99.9%

## Tools & APIs Used
| Tool | Purpose | Cost |
|------|---------|------|
| Lovable AI Gateway | Content generation | Included |
| Google Business Profile API | Post publishing | Free |
| Supabase | Client management | Included |
| Stripe | Billing | 2.9% + $0.30 |

## Edge Functions
- `auto-gbp-posts/index.ts` — Main poster (Mon/Wed/Fri 10am ET)
- `gbp-saas-poster/index.ts` — Legacy poster

## Database Tables
- `gbp_saas_clients` — Client records with GBP credentials

## Step-by-Step Flow
1. Client signs up via Stripe checkout
2. Webhook activates client in `gbp_saas_clients`
3. Cron fires Mon/Wed/Fri at 10am ET
4. AI generates industry-specific post with local keywords
5. Post is published to GBP via API
6. Client sees new post on their Google listing

---

# 3. Social Media AI Service {#3-social-media-ai}

## What It Is
AI-generated social media posts published to Facebook, Instagram, LinkedIn, Google Business Profile, and TikTok.

## What It Does
- Creates platform-optimized content (different tone for each platform)
- Handles multi-platform distribution from one system
- Supports scheduling 3x/week per platform

## Pricing
| Plan | Price | Platforms |
|------|-------|-----------|
| Standard | $199/mo | FB + IG + LinkedIn |
| Pro | $299/mo | All platforms + priority |
| Trainer | $149/mo | Fitness-specific content |

## Cost Per Client
- **AI generation**: ~$0.001/post × ~12 posts/mo = ~$0.012/mo
- **API posting**: Free (Meta API, LinkedIn API)
- **Margin**: ~99.9%

## Tools & APIs Used
| Tool | Purpose | Cost |
|------|---------|------|
| Lovable AI Gateway | Content generation | Included |
| Meta Marketing API | FB/IG posting | Free |
| LinkedIn API | LinkedIn posting | Free |
| Google Business Profile API | GBP posting | Free |
| TikTok API | TikTok posting | Free |
| Stripe | Billing | 2.9% + $0.30 |

## Edge Functions
- `social-media-poster/index.ts` — Multi-platform poster
- `create-social-media-checkout/index.ts` — Stripe checkout

## Database Tables
- `social_media_clients` — Client records with platform tokens

## Step-by-Step Flow
1. Client selects plan and platforms at checkout
2. Stripe webhook activates client
3. Cron fires 3x/week
4. For each client, AI generates platform-specific content
5. Content is posted via respective platform APIs
6. Post status logged for reporting

---

# 4. Field Rep AI Tools SaaS {#4-field-rep-ai-tools}

## What It Is
$29/mo subscription for 4 Claude-powered AI tools for B2B field sales reps.

## What It Does
- AI Meeting Prep (research a prospect before a meeting)
- AI Objection Handler (real-time objection responses)
- AI Email Writer (follow-up emails from notes)
- AI Territory Planner (optimize your route/territory)

## Pricing
$29/mo

## Cost Per Client
- **AI calls**: ~$0.005/query × avg 20 queries/mo = ~$0.10/mo
- **Margin**: ~99.6%

## Tools & APIs Used
| Tool | Purpose | Cost |
|------|---------|------|
| Lovable AI Gateway | All 4 AI tools | Included |
| Supabase | Auth + user management | Included |
| Stripe | Billing | 2.9% + $0.30 |

## Edge Functions
- `field-rep-ai-tool/index.ts` — Main AI tool handler
- `create-field-rep-checkout/index.ts` — Checkout

## Database Tables
- `b2b_subscribers` (where niche = 'field_rep_tools')

---

# 5. Field Rep Weekly Newsletter {#5-field-rep-weekly-newsletter}

## What It Is
Weekly B2B sales tips newsletter with 7 rotating affiliate tool spotlights.

## What It Does
- AI-generated sales advice content
- Embeds 7 affiliate links (earning 22-125% commissions)
- Sent every Monday morning

## Pricing
Free (revenue from affiliate commissions)

## Cost Per Send
- **Resend**: Free under 3k emails/mo, then $0.001/email
- **AI content**: ~$0.003/newsletter
- **Total**: ~$0.003 + ($0.001 × subscriber_count)

## Affiliate Revenue Potential
| Program | Commission |
|---------|-----------|
| Writesonic | 30% recurring |
| ElevenLabs | 22% recurring |
| Surfer SEO | 125% CPA |
| Synthesia | 25% recurring |
| Apollo.io | TBD |
| Hunter.io | TBD |
| LinkedIn Sales Navigator | TBD |

## Edge Functions
- `send-newsletter/index.ts` — Weekly send (Monday 8am ET)

## Database Tables
- `newsletter_subscribers`, `newsletter_sends`

---

# 6-7. B2B Databases & Contractor Lead Gen

## B2B Dental Database ($49/mo)
- Scrapes Michigan dental offices → searchable database
- Edge: `b2b-dental-scraper/index.ts` (Daily 6am ET)
- Table: `b2b_contacts`, `b2b_subscribers`
- Cost: ~$0 (Google Maps API included)

## Contractor Lead Gen ($399/mo)
- Exclusive leads for local contractors (roofing, HVAC, plumbing, electrical)
- Edge: `contractor-lead-notify/index.ts` (every 15 min)
- Tables: `contractor_lead_sites`, `contractor_clients`, `contractor_leads`
- Cost: ~$0.05/lead notification (Twilio SMS)

---

# 8-36. SMS & Automation Products

## SMS Products Summary

| # | Product | Price | Edge Function | DB Table | API Cost/Client/Mo |
|---|---------|-------|---------------|----------|-------------------|
| 10 | Review Monitor | $25/mo | `review-monitor/` | `review_monitor_clients` | ~$0.10 (Twilio) |
| 11 | Weekly SMS Blast | $19/mo | `weekly-sms-sender/` | `sms_blast_clients` | ~$0.30 (4 SMS) |
| 12 | No-Show Re-Booker | $25/mo | `noshow-trigger/` | `noshow_clients` | ~$0.05/trigger |
| 13 | Estimate Follow-Up | $39/mo | `estimate-drip-runner/` | `estimate_drip_clients` | ~$0.15 (3-msg sequence) |
| 14 | Invoice Chaser | $29/mo | `invoice-chaser-runner/` | `invoice_chaser_clients` | ~$0.10 (2-msg sequence) |
| 15 | After-Job Drip | $29/mo | `afterjob-drip-runner/` | `afterjob_drip_clients` | ~$0.15 (3-msg sequence) |
| 16 | Seasonal Promo | $29/mo | `seasonal-promo-blaster/` | `promo_blaster_clients` | ~$0.50 (bulk blast) |
| 17 | Referral Program | $39/mo | `referral-ask-sender/` | `referral_program_clients` | ~$0.10 |
| 18 | Slow Day SMS | $25/mo | `slow-day-trigger/` | `slow_day_clients` | ~$0.05/trigger |
| 19 | New Homeowner | $59/mo | (planned) | `homeowner_campaign_clients` | ~$0.50 (data + SMS) |
| 34 | Birthday Campaign | $19/mo | `birthday-campaign-sender/` | `birthday_campaign_clients` | ~$0.05/SMS |
| 35 | Appointment Reminder | $25/mo | `appointment-reminder-sender/` | `appointment_reminders` | ~$0.10 |
| 36 | Warranty Reminder | $25/mo | `warranty-reminder-sender/` | (warranty table) | ~$0.05 |

**All SMS products use**: Twilio API ($0.0079/SMS segment), Lovable AI Gateway (for message personalization), Supabase (client data), Stripe (billing).

## Email Automation Products

| # | Product | Price | Edge Function | DB Table | API Cost/Client/Mo |
|---|---------|-------|---------------|----------|-------------------|
| 8 | Blog Post Writer | $49/mo | `ai-blog-post-writer/` | `blog_post_clients` | ~$0.01 |
| 9 | Review Response | $49/mo | `review-response-sender/` | (review response table) | ~$0.01 |
| 20 | Competitor Watch | $49/mo | `ai-competitor-watch/` | `competitor_watch_clients` | ~$0.05 (Firecrawl) |
| 21 | Battlecard Reports | $49/mo | `battlecard-sender/` | `battlecard_clients` | ~$0.05 (Firecrawl) |
| 22 | Ads Copy | $29/mo | `ads-copy-monthly-sender/` | `ads_copy_clients` | ~$0.01 |
| 23 | Website Audit | $9/each | `seo-audit-report/` | (audit table) | ~$0.05 (Firecrawl) |
| 24 | Pricing Monitor | $29/mo | `competitor-pricing-scan/` | `competitor_pricing_clients` | ~$0.05 (Firecrawl) |
| 25 | Sermon Prep | $79/mo | `sermon-prep/` | `sermon_prep_clients` | ~$0.01 |
| 26 | RFP Alerts | $149/mo | `rfp-alerts/` | `rfp_alert_clients` | ~$0.01 |
| 27 | Dark Web Monitor | $29/mo | `dark-web-monitor/` | `dark_web_monitor_clients` | ~$0.01 |
| 28 | Abandoned Cart | $39/mo | `abandoned-cart-sender/` | `abandoned_cart_clients` | ~$0.10 |
| 29 | Collections SMS | $49/mo | `collections-sender/` | `collections_clients` | ~$0.15 |
| 30 | Direct Mail AI | $99/mo | `ai-direct-mail-writer/` | `direct_mail_clients` | ~$0.01 |
| 32 | AI Chatbot | $49/mo | `chatbot-widget/` | `chatbot_clients` | ~$0.05 |

---

# Detroit Web Agency Product Suite {#dwa-products}
## Brand: Detroit Web Agency — "We Handle The Tech" | detroitwebagent.com
## Colors: Teal `#00d4ff` on near-black `#0a1628`
## Target: HVAC, plumbing, boiler, electrical companies 3–15 techs, Metro Detroit

---

## FieldDesk — Field Service CRM

| | |
|---|---|
| **Price** | $199/mo standalone → $159/mo with website (20% bundle discount) |
| **Replaces** | eWay CRM ($27-40/user/mo Outlook plugin) |
| **Tables** | `field_crm_clients`, `field_service_jobs`, `tech_locations`, `crm_visitor_events` |
| **Functions** | `create-field-service-checkout/`, `field-service-sms/` |
| **Routes** | `/field-service`, `/field-service/dispatch`, `/field-service/tech` |
| **Webhook type** | `field_service_subscription` |
| **Margin** | ~99% |

**What it does**: Dispatch board (Kanban), live GPS tech map, mobile tech app (PIN login, job status tap, photo upload, voice notes), auto-SMS on every status change (assigned → en route → on site → complete → review request).

**Key pitch**: "eWay is an Outlook plugin. Your techs are in boiler rooms — they can't use Outlook. FieldDesk works from their phone."

---

## SiteRadar — Visitor Intelligence

| | |
|---|---|
| **Price** | $49/mo standalone → $39/mo with website |
| **Tables** | `field_crm_clients` (visitor_script_key), `crm_visitor_events` |
| **Admin** | `AdminFieldCRMClients.tsx` (snippet generator), `VisitorIntelFeed.tsx` |
| **Margin** | ~99% |

**What it does**: One JS snippet in site footer. Every business visitor's IP is reverse-looked up. Company name + page visited appears in real-time feed. Not anonymous analytics — actual company names.

---

## TechAlert — Hiring Monitor

| | |
|---|---|
| **Price** | $99/mo standalone → $49/mo bundle (hard price, not 20% calc) |
| **Tables** | `hire_alert_clients` (target_roles text[]), `hire_alert_candidates`, `hire_alert_runs` |
| **Functions** | `hire-alert-scanner/` (cron 7am ET daily), `create-hire-alert-checkout/` |
| **Migration** | `20260410300000_hire_alert_tables.sql` |
| **Route** | `/hire-alert` |
| **Webhook type** | `hire_alert_subscription` |
| **Margin** | ~99% |

**What it does**: Daily cron scans 3 sources for available licensed tradespeople in Metro Detroit:
1. **Michigan MIOSHA public license DB** (secret weapon — new license = new talent entering market, no other tool monitors this)
2. **Apollo people search** — finds tradespeople by title + location
3. **Job boards via Firecrawl** — active job-seekers posting availability

Claude Haiku scores each candidate 1-10. Score 7+ = immediate SMS + email alert to matching clients. Score 5-6 = daily digest only. Below 5 = stored, no alert.

**Client config**: Each client sets `target_roles[]` (8 trade options: boiler_operator, hvac_tech, plumber, electrician, pipefitter, steam_engineer, refrigeration_tech, fire_suppression). Scanner filters alerts per client's chosen roles.

**Founder report**: Daily email to matt@mattmichelstraining.com with orange (hot 7+) / amber (5-6) / gray (<5) candidate summary.

---

## DWA Add-On Stack (field service clients, 20% off with website)

| Add-On | Standalone | Bundled |
|--------|-----------|---------|
| Seasonal Promo Blaster | $29/mo | $23/mo |
| Review Monitor | $25/mo | $20/mo |
| After-Job Drip | $29/mo | $23/mo |
| No-Show Re-Booker | $25/mo | $20/mo |
| Estimate Follow-Up | $39/mo | $31/mo |
| Weekly SMS Blast | $19/mo | $15/mo |

**Note**: GBP AI Posts removed from visible add-on list (client AI skepticism). Functionality still runs, folded silently into $99/mo management retainer.

**Full stack DWA client**: $1,499 website (one-time) + $99/mo management + $159 FieldDesk + $49 TechAlert + $112 add-ons = **$419/mo recurring**

---

# Cost Summary

## Fixed Monthly Costs (Pre-Revenue)
| Service | Cost |
|---------|------|
| Lovable Cloud (Supabase) | $0 (included) |
| Resend (email) | $0 (free tier up to 3k/mo) |
| Twilio (SMS) | $0 (pay-per-use, no base) |
| Stripe | $0 (pay-per-transaction) |
| Google Maps API | $0 (free tier) |
| Firecrawl | $0 (included via connector) |
| Domain (mattmichelstraining.com) | ~$12/year |
| **Total fixed** | **~$1/mo** |

## Variable Costs Per Transaction
| Service | Cost |
|---------|------|
| Twilio SMS | $0.0079/segment |
| Stripe | 2.9% + $0.30/txn |
| Resend (over free tier) | $0.001/email |
| AI (Lovable Gateway) | ~$0.001-0.005/call |

## Margin Analysis
- **SMS Products** ($19-59/mo): 97-99% margin
- **Email Products** ($29-149/mo): 99%+ margin
- **Web Design** ($499-3,499): 95%+ margin on build, 98%+ on retainer
- **Overall blended margin**: ~98%

---

*Document generated April 4, 2026 — M² Development internal use only*
