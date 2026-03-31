

# Full Business Enhancement — All 26 Items Implementation Plan

This is a large-scale implementation covering broken fulfillment fixes, efficiency upgrades, AI agents, and 5 new revenue streams. I'll organize it into buildable phases.

---

## Phase 1: Fix Broken Fulfillment (7 missing cron sender functions)

These services collect payment via Stripe but have NO automated delivery. Highest priority — clients are paying for nothing.

### 1.1 `reputation-report-sender` edge function
- Query `reputation_clients` (active=true)
- Use Firecrawl to search Google/Yelp for each client's business
- AI summarizes review sentiment, new reviews, suggested responses
- Email weekly HTML report via Resend
- New DB table: `reputation_reports` (client_id, report_html, sent_at)

### 1.2 `newsletter-service-sender` edge function
- Query `newsletter_service_clients` table (needs creation via stripe-webhook upsert)
- AI generates monthly industry newsletter for each client
- Email via Resend to client's subscriber list
- Track in `newsletter_service_sends`

### 1.3 `faq-refresh-sender` edge function
- Query `faq_refresh_clients` table
- AI generates updated FAQ + homepage copy based on industry
- Email to client monthly

### 1.4 `blog-post-monthly-sender` edge function
- Wraps existing `ai-blog-post-writer` in a cron-safe monthly loop
- Generates 4 SEO posts per client, batches into one email

### 1.5 `ads-copy-monthly-sender` edge function
- Query `ads_copy_clients` table
- AI generates 10 Google Ads variations (headlines + descriptions)
- Email monthly

### 1.6 `competitor-watch-weekly-sender` edge function
- Wraps existing `ai-competitor-watch` in weekly cron delivery
- Uses Firecrawl to scrape competitor sites
- AI analysis emailed to client

### 1.7 `local-seo-monthly-sender` edge function
- Wraps existing `ai-local-seo-writer` in monthly delivery
- Generates city-specific landing page content per client

**DB migrations needed**: Create client tables where missing (`newsletter_service_clients`, `faq_refresh_clients`, `ads_copy_clients`, `reputation_reports`). Update `stripe-webhook` to upsert into these tables on subscription activation.

---

## Phase 2: Efficiency & Reduce Manual Work (4 items)

### 2.1 AI Lead Scoring Agent — enhance `prospect-local-businesses`
- After finding a business, call `score-business-presence` (already exists!) to grade their web presence
- Store score in `web_design_leads` table (add `presence_score`, `presence_grade` columns)
- Sort outreach queue by worst scores first (highest conversion potential)

### 2.2 Multi-touch Drip Sequence — enhance `multi-service-drip`
- Add 3-email sequence logic: Day 1 intro, Day 4 case study, Day 8 last chance
- Add `drip_step` and `next_drip_at` columns to track position in sequence
- Cron processes due drips daily

### 2.3 Monthly SMS Performance Report
- New `sms-performance-report` edge function
- Query Twilio usage per client number
- AI summarizes: texts sent, response rate, opt-outs
- Email monthly report to each SMS client

### 2.4 AI Client Health Dashboard — admin component
- New `AdminClientHealth.tsx` component in admin panel
- Queries ALL client tables (15+ tables) with active status
- Shows: client name, service, Stripe status, last delivery date, days since last delivery
- Color-coded: green (delivered this period), yellow (due soon), red (overdue/at risk)

---

## Phase 3: Growth AI Agents (5 items)

### 3.1 AI Reply Detection Agent — `ai-reply-detector` edge function
- Use Resend webhook to capture inbound replies to outreach emails
- AI categorizes: interested, not interested, wrong person, out of office
- Flag "interested" replies with admin notification
- Add `reply_status` column to `web_design_leads`

### 3.2 AI Upsell Agent — `ai-upsell-sender` edge function
- 14 days after any B2B subscription starts, query client's industry
- AI recommends 2-3 complementary services from the catalog
- Send personalized upsell email via Resend
- Track in `upsell_emails_sent` table to avoid repeats

### 3.3 AI Churn Prevention Agent — `ai-churn-preventer` edge function
- Weekly scan of all B2B client tables
- Flag clients who: haven't opened last 3 emails, approaching trial end, or subscription > 60 days with no engagement
- Send personal "checking in" email from Matt with usage summary
- Admin notification for high-risk accounts

### 3.4 AI Invoice Follow-Up Agent — enhance `payment-chaser-sender`
- Add escalation tiers: 30-day gentle reminder, 45-day firm follow-up, 60-day formal demand letter
- AI adjusts tone per tier
- Track `chase_tier` on each overdue invoice

### 3.5 AI Call Summary Agent — enhance `ai-phone-answering`
- After call handling, generate structured summary: caller name, intent, urgency, callback needed
- Email summary to business owner
- Store in `call_summaries` table

---

## Phase 4: New Revenue Streams (5 new services)

Each gets: landing page, Stripe checkout function, fulfillment function, client table.

### 4.1 AI Customer Onboarding Agent — $59/mo
- Landing page: `/ai-onboarding-agent`
- Checkout: `create-onboarding-agent-checkout`
- Fulfillment: `ai-onboarding-agent-sender` — webhook-triggered welcome sequences (email + SMS at Day 1, 3, 7)
- Table: `onboarding_agent_clients`

### 4.2 AI Social Proof Collector — $39/mo
- Landing page: `/ai-social-proof`
- Checkout: `create-social-proof-checkout`
- Fulfillment: `ai-social-proof-sender` — SMS to recent customers asking for Google review + testimonial quote, monthly digest of collected proof
- Table: `social_proof_clients`

### 4.3 AI Competitor Price Monitor — $49/mo
- Landing page: `/ai-price-monitor`
- Checkout: `create-price-monitor-checkout`
- Fulfillment: `ai-price-monitor-sender` — weekly Firecrawl scrape of competitor pricing pages, AI analysis, emailed report
- Table: `price_monitor_clients`

### 4.4 AI Meeting Prep Agent — $29/mo
- Landing page: `/ai-meeting-prep`
- Checkout: `create-meeting-prep-checkout`
- Fulfillment: `ai-meeting-prep` — on-demand company research via Firecrawl, generates 1-page briefing doc
- Table: `meeting_prep_clients`
- Also add as 5th tool in Field Rep Tools for subscribers

### 4.5 AI Local Directory Submitter — $39/mo
- Landing page: `/ai-directory-submitter`
- Checkout: `create-directory-submitter-checkout`
- Fulfillment: `ai-directory-audit-sender` — monthly Firecrawl audit of 20+ directories for NAP consistency, emailed report with fix instructions
- Table: `directory_submitter_clients`

---

## Cross-Cutting Updates

### Stripe Webhook
- Add handlers for all 5 new subscription types in `stripe-webhook/index.ts`
- Upsert into respective client tables on checkout.session.completed

### Admin Automation Hub
- Add cards for all new services to `AdminAutomationHub.tsx`
- Add the Client Health Dashboard as a new admin tab

### Config.toml
- Add `verify_jwt = false` entries for all new edge functions

---

## Files Summary

**New Edge Functions** (17):
`reputation-report-sender`, `newsletter-service-sender`, `faq-refresh-sender`, `blog-post-monthly-sender`, `ads-copy-monthly-sender`, `competitor-watch-weekly-sender`, `local-seo-monthly-sender`, `sms-performance-report`, `ai-reply-detector`, `ai-upsell-sender`, `ai-churn-preventer`, `ai-onboarding-agent-sender`, `ai-social-proof-sender`, `ai-price-monitor-sender`, `ai-meeting-prep`, `ai-directory-audit-sender`, `ai-call-summary`

**New Landing Pages** (5):
`AIOnboardingAgent.tsx`, `AISocialProof.tsx`, `AIPriceMonitor.tsx`, `AIMeetingPrep.tsx`, `AIDirectorySubmitter.tsx`

**New Checkout Functions** (5):
One per new service

**New Admin Component** (1):
`AdminClientHealth.tsx`

**Modified Files**:
- `stripe-webhook/index.ts` — 5 new subscription handlers
- `prospect-local-businesses/index.ts` — integrate lead scoring
- `multi-service-drip/index.ts` — 3-step sequence
- `payment-chaser-sender/index.ts` — escalation tiers
- `ai-phone-answering/index.ts` — call summaries
- `AdminAutomationHub.tsx` — new service cards
- `Admin.tsx` — add Client Health tab
- `App.tsx` — 5 new routes
- `supabase/config.toml` — new function entries

**DB Migrations**: ~8 new client/tracking tables, column additions to existing tables

---

## Implementation Order

Due to the scale (50+ files), I'll implement in batches:
1. **Batch 1**: Phase 1 fulfillment functions (highest revenue risk) + DB tables
2. **Batch 2**: Phase 2 efficiency upgrades + Admin Client Health Dashboard
3. **Batch 3**: Phase 3 AI agents
4. **Batch 4**: Phase 4 new services (landing pages + checkouts + fulfillment)
5. **Batch 5**: Stripe webhook updates + Admin Hub updates + routes

Each batch will be a separate implementation message to keep changes manageable and testable.

