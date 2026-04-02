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
- **Dev branch**: `claude/analyze-test-coverage-P1QLW`

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

### 5. Field Rep AI Tools SaaS ← NEW
- **What**: $29/mo access to 4 Claude-powered tools
- **Price**: $29/mo
- **Files**: `src/pages/FieldRepTools.tsx`, `supabase/functions/field-rep-ai-tool/index.ts`, `supabase/functions/create-field-rep-checkout/index.ts`
- **Tables**: `b2b_subscribers` (niche = 'field_rep_tools')
- **stripe-webhook**: `meta.type === "field_rep_subscription"`

### 6. Social Media AI Service ← NEW
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

## Deployment
1. Claude commits to `claude/analyze-test-coverage-P1QLW` and pushes
2. Matt pushes/merges to main → Lovable auto-deploys frontend
3. Matt runs new SQL migrations in Supabase Dashboard → SQL Editor
4. Edge functions deploy automatically

## Required Supabase Secrets
- `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY` ← already added
- `META_ACCESS_TOKEN` ← needed for social media posting
- `LINKEDIN_ACCESS_TOKEN` ← needed for social media posting

## Matrix Agents (in `/root/.claude/agents/`)
- **Morpheus** — strategic advisor, evaluates new opportunities
- **Trinity** — full-stack builder, writes React + Supabase code
- **Neo** — lead hunter, optimizes prospecting pipeline
- **Oracle** — revenue analyst, forecasts MRR
- **Tank** — DevOps operator, manages cron/migrations/deployments
- **Mouse** — copywriter, writes in Matt's voice

## Pending Affiliate Signups (Matt needs to do)
1. Writesonic: writesonic.com/affiliates → get link, update `newsletter-send/index.ts`
2. ElevenLabs: elevenlabs.io/affiliates → get link, update
3. Surfer SEO: surferseo.com/affiliate → get link, update
4. Synthesia: synthesia.io/affiliates → get link, update

## Rules
- Matt's only manual work: return messages
- Never build features requiring ongoing manual operation
- All new tables get RLS enabled + service_role policy
- Stripe: always inline price_data, always set metadata.type for webhook routing
- AI calls: Claude Haiku only (cost-efficient), max_tokens 800-1200
- **"Create an agent"** always means: create a `.md` file at `/root/.claude/agents/[name].md` with frontmatter (`name`, `description`) followed by full agent instructions. Never create an agent as code unless explicitly asked.
