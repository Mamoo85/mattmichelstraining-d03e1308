

# Lovable's Slice — Frontend, UI, Memory, PDFs

Claude Code handles the 3 backend items (Tom agent, auto-onboard email, enrichment refactor). I handle everything else from the combined plan. No overlap, no collisions.

## What I'm building

### 1. Kill list — hide 20 SKUs from public selling
- New `src/lib/deprecated-skus.ts` — single registry of slugs + reason + deprecated_at date
- Filter `AllServices.tsx` and `AutomationHub.tsx` grids against the registry
- Add `noindex` flag to each killed page's `SEOHead`
- Routes stay in `App.tsx` (preserves SEO during transition, fully reversible)
- Kill list (Claude's 20): SocialMediaAI, PetMemorial, B2BLeads, LocalTechSupport, EmployeeHandbook, BlogPostWriter, AINewsletter, InsuranceDrip, CreditDisputeFactory, HOALetters, MedicalBillDispute, MenuEngineering, TradeShowFollowUp, LatePaymentCollector, RealEstateNewsletter, AILinkedInGhostwriter, AISermonPrep, FAQRefresh, ChildrensStorySubscription, MeetingPrep

### 2. Mortgage Radar hero rewrite (`src/pages/MortgageRadar.tsx`)
- New hero: "H.R. 2808 killed trigger leads on March 4. Here's what replaced them."
- Comparison table: Trigger Leads (banned) vs Mortgage Radar (FCRA-clean public records)
- Brother case-study placeholder card (real numbers slot in once he tests)
- Keep existing checkout + ZIP picker untouched

### 3. TechAlert interactive ROI calculator
- New `src/components/agency/TechAlertROICalculator.tsx`
- 3 inputs: trade dropdown (HVAC/Plumber/Electrician/Boiler Op/CNA-RN), open positions, hours/week recruiting
- Live output: "Annual vacancy cost $X,XXX vs Talent Radar $1,788/yr — save $Y,YYY"
- Mounted on `HireAlert.tsx` above the existing static "The Math" section
- Inline `useState`, no new deps, reuses existing trial signup CTA

### 4. Pipeline Velocity Dashboard (`src/components/dwa-admin/PipelineVelocityDashboard.tsx`)
- New tab "📊 Pipeline Velocity" in `DWAAdmin.tsx`
- Product filter: All / Mortgage Radar / Talent Radar / FieldDesk / Dead Lead / Web Design
- Pulls from `service_subscriptions` + `prospect_pipeline` + `outreach_cooldowns`
- Shows: stage counts, demos booked, MRR added (30d), formula readout `Velocity = Opps × Value × Win Rate / Sales Cycle`
- Also extends `AdminB2BPipeline.tsx` with the same product filter dropdown

### 5. Enterprise consultation flow (replaces self-serve on $199–$599/mo SKUs)
- New `src/components/EnterpriseConsultationForm.tsx` (name, company, email, phone, product interest)
- New table `enterprise_consultation_requests` (RLS service_role only) — created via migration
- Form submit inserts row + SMSes Matt at +13138064952
- Replace Stripe checkout button with "Book Strategy Call" on ~25 high-ticket B2B intel pages (Bid Intelligence, Reg Filing Monitor, Gov Contract Monitor, Patent Watch, etc.)

### 6. Memory rule updates
- **REVERSE** `mem://marketing/outreach-service-ratio` → 90% SaaS MRR / 10% Web Design (Gemini was right; old 80/20 sabotages the $10k MRR goal)
- **NEW** `mem://business/sku-portfolio-discipline` — hard cap ~25 active public SKUs; new product requires killing one; "free ChatGPT in an hour" test
- **NEW** `mem://business/mortgage-radar-90-day-trigger` — if Mortgage Radar < $5k MRR by 2026-07-22, demote to passive inbound, rotate effort back to FieldDesk + TechAlert
- **NEW** `mem://workflow/feature-factory-guard` — before any new feature, ask "does Matt have 1 paying customer asking for it?" If no → sales not code
- **UPDATE** `mem://index.md` Core to reference the inversion + feature-factory guard

### 7. Brother free founder seat (operational, no money talk)
- Add brother as `mortgage_radar_subscription` row via AdminSandbox $0 test checkout (Matt does this manually after I ship — I'll add a one-click button "Provision Brother Founder Seat" to AdminDWAOverview that pre-fills the form)
- Brother gets 5 Metro Detroit ZIPs, dashboard access, can forward dossiers to LO friends
- No JV agreement, no rev-share, no equity (per your call)
- New `brother_claimed_domains` table so future Tom + DWA Closer agents skip whatever he's claimed (defensive — no behavior change today)

## What I'm NOT building (Claude Code owns these)
- `Tom.agent.md` — Mortgage Radar pitch section
- `auto-onboard/index.ts` — `mortgage_radar_subscription` welcome template
- `_shared/enrichment.ts` — extract NPI→Sonar→Hunter→Snov→PDL→HIBP→Apollo→Twilio waterfall + wire into per-source workers

## What I'm NOT building (per your prior calls)
- "Kill DWA" hard pivot
- Brother JV PDF / equity / rev-share docs
- New product SKUs
- Ad spend
- Page deletions or 404 redirects (use hide + noindex instead)

## Files touched (estimate)
- New: `src/lib/deprecated-skus.ts`, `src/components/agency/TechAlertROICalculator.tsx`, `src/components/dwa-admin/PipelineVelocityDashboard.tsx`, `src/components/EnterpriseConsultationForm.tsx`
- Modified: `src/pages/MortgageRadar.tsx`, `src/pages/HireAlert.tsx`, `src/pages/AllServices.tsx`, `src/pages/AutomationHub.tsx`, `src/pages/DWAAdmin.tsx`, `src/components/admin/AdminB2BPipeline.tsx`, `src/components/dwa-admin/AdminDWAOverview.tsx`, ~25 enterprise SKU pages (button swap), 20 killed-SKU pages (SEOHead noindex flag)
- 1 migration: `enterprise_consultation_requests` + `brother_claimed_domains` tables (RLS service_role only)
- Memory: 1 reversal + 3 new files + 1 index update
- No new edge functions, no Stripe changes, no secrets needed

## After I ship
1. Tell Claude Code to build the 3 backend items (Tom agent, welcome email, enrichment refactor)
2. Click "Provision Brother Founder Seat" in AdminDWAOverview → forward him the dashboard link
3. Make Mortgage Radar cold calls — that's the actual revenue work no code can do for you

