# M² Performance Training — Claude Code Context

## Owner
**Matt Michels** — Grosse Pointe, MI | matt@mattmichelstraining.com | (313) 806-4952
Family: wife + young son. Local guy. 10+ years B2B field sales background.

## The Goal
$10k+/mo fully automated income. Matt's only job: return calls, texts, and emails. Everything else runs itself.

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase Edge Functions (Deno/TypeScript) at `supabase/functions/`
- **Database**: Supabase Postgres (RLS enforced on all tables)
- **Payments**: Stripe (inline `price_data`, no pre-created prices)
- **Email**: Resend API (from: `matt@mattmichelstraining.com`)
- **AI**: Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic API
- **Domain**: mattmichelstraining.com
- **Repo**: `mamoo85/m2training` (GitHub)
- **Supabase Project**: `zmyczlfuufhngzovkjdh`
- **Dev branch**: `claude/product-testing-fbMNs`

## Brand
- Primary orange: `#e8621a`
- Dark slate: `#1e293b`
- Photos live at `/public/images/` (matt-boat.jpg, matt-family-cornfield.jpg, matt-family-summer.jpg)
- Email signature: `matt-boat.jpg` (48px circle)

## Revenue Streams — All Automated

### 1. Contractor Lead Gen
- **What**: Exclusive leads for local contractors (roofing, HVAC, plumbing, electrical)
- **Price**: $399/mo
- **Files**: `src/pages/ContractorLeads.tsx`, `supabase/functions/contractor-lead-notify/index.ts`
- **Tables**: `contractor_lead_sites`, `contractor_clients`, `contractor_leads`
- **Cron**: Every 15 min (lead notify), Daily 11am ET (prospecting)

### 2. B2B Dental Database
- **What**: Michigan dental office contacts ($49/mo access)
- **Files**: `src/pages/B2BLeads.tsx`, `supabase/functions/b2b-dental-scraper/index.ts`
- **Tables**: `b2b_contacts`, `b2b_subscribers`
- **Cron**: Daily 6am ET

### 3. GBP SaaS (Google Business Profile Automation)
- **What**: AI posts 3x/week to Google Business Profile
- **Price**: $49/mo basic, $99/mo pro
- **Files**: `src/pages/LocalMarketing.tsx`, `supabase/functions/gbp-saas-poster/index.ts`
- **Tables**: `gbp_saas_clients`
- **Cron**: Mon/Wed/Fri 10am ET

### 4. Field Rep Weekly Newsletter
- **What**: Weekly B2B sales tips for field reps + 7 rotating affiliate tool spotlights
- **Files**: `src/pages/NewsletterPage.tsx`, `supabase/functions/newsletter-send/index.ts`
- **Tables**: `newsletter_subscribers`, `newsletter_sends`
- **Cron**: Monday 8am ET
- **Affiliates** (sign up at each): Writesonic (30% recurring), ElevenLabs (22%), Surfer SEO (125% CPA), Synthesia (25%), Apollo.io, Hunter.io, LinkedIn Sales Navigator

### 5. Field Rep AI Tools SaaS
- **What**: $29/mo access to 4 Claude-powered tools
- **Price**: $29/mo
- **Files**: `src/pages/FieldRepTools.tsx`, `supabase/functions/field-rep-ai-tool/index.ts`, `supabase/functions/create-field-rep-checkout/index.ts`
- **Tables**: `b2b_subscribers` (niche = 'field_rep_tools')
- **stripe-webhook**: `meta.type === "field_rep_subscription"`

### 6. Social Media AI Service
- **What**: AI-generated posts 3x/week to Facebook, Instagram, LinkedIn
- **Price**: $199/mo standard, $299/mo pro, $149/mo trainer (fitness coaches)
- **Files**: `src/pages/SocialMediaAI.tsx`, `src/pages/TrainerSocialAI.tsx`, `supabase/functions/social-media-poster/index.ts`, `supabase/functions/create-social-media-checkout/index.ts`
- **Tables**: `social_media_clients`
- **stripe-webhook**: `meta.type === "social_media_subscription"`
- **TODO**: Need META_ACCESS_TOKEN and LINKEDIN_ACCESS_TOKEN in Supabase secrets

### 7. Web Design Services
- **Price**: $499 standard, $1,499 professional, $3,499 business + $49-199/mo retainer
- **Files**: `src/pages/WebDesignServices.tsx`, `src/pages/ManufacturingWebDesign.tsx`, `src/pages/RealEstateWebDesign.tsx`
- **Prospecting**: `supabase/functions/prospect-local-businesses/index.ts` (daily, 16 industries)
- **Drip**: `supabase/functions/web-design-drip/index.ts`

### 8–17. SMS & Monitoring Products (10 new products)
- **Review Monitor** ($25/mo) — `review_monitor_clients`, `supabase/functions/review-monitor/`
- **Weekly SMS Blast** ($19/mo) — `sms_blast_clients`, `supabase/functions/weekly-sms-sender/`
- **No-Show Re-Booker** ($25/mo) — `noshow_clients`, `supabase/functions/noshow-trigger/`, `noshow-followup/`
- **Estimate Follow-Up Drip** ($39/mo) — `estimate_drip_clients`, `supabase/functions/estimate-drip-runner/`
- **Invoice Chaser** ($29/mo) — `invoice_chaser_clients`, `supabase/functions/invoice-chaser-runner/`
- **After-Job Drip** ($29/mo) — `afterjob_drip_clients`, `supabase/functions/afterjob-drip-runner/`
- **Seasonal Promo Blaster** ($29/mo) — `promo_blaster_clients`
- **Referral Program** ($39/mo) — `referral_program_clients`, `referrals`
- **Slow Day SMS** ($25/mo) — `slow_day_clients`, `supabase/functions/slow-day-trigger/`
- **New Homeowner Campaign** ($59/mo) — `homeowner_campaign_clients`
- **Migration**: `supabase/migrations/20260403000000_ten_new_products.sql`
- **Crons**: `supabase/migrations/20260403010000_new_product_crons.sql`

## Deployment
1. Claude commits to `claude/product-testing-fbMNs` and pushes
2. Matt merges to main → GitHub Actions auto-runs migrations + deploys edge functions → Lovable auto-deploys frontend
3. **No manual SQL steps needed** — GitHub Actions handles migrations on every merge to main
4. Required GitHub Secret: `SUPABASE_ACCESS_TOKEN` (Supabase account access token, not the DB password)

## Required Supabase Secrets
- `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY` ← already added
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` ← needed for SMS products
- `META_ACCESS_TOKEN` ← needed for social media posting
- `LINKEDIN_ACCESS_TOKEN` ← needed for social media posting

## Agents (in `/home/user/m2training/.claude/agents/`)
- **Tom** — lead hunter, web design client acquisition
- **Oracle** — account watchdog, queries all 10 SMS product tables for health issues
- **Ops** — project fulfillment, web design client onboarding
- **Builder** — website generation agent

## Testing
- **Admin Sandbox** (`/admin` → Sandbox tab) — $0 test checkout for every product
- `supabase/functions/create-test-checkout/` — test session creator (Matt's email only)
- `AdminOpsCenter` — CRM roster covering all 17 product lines with MRR totals

## Rules
- Matt's only manual work: return messages
- Never build features requiring ongoing manual operation
- All new tables get RLS enabled + service_role policy
- Stripe: always inline price_data, always set metadata.type for webhook routing
- AI calls: Claude Haiku only (cost-efficient), max_tokens 800-1200
- Always use project ref `zmyczlfuufhngzovkjdh` — never the old ref `eauvubfpanpeuxsrqesu`
- **"Create an agent"** always means: create a `.md` file at `/home/user/m2training/.claude/agents/[name].md`
