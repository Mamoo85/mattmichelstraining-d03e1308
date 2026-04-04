

# Plan: Agent Selma (Head Marketer) + 10 New Agent Responsibilities + Build Fix

## Build Fix (First)

The build error `Cannot find module '@lovable.dev/cloud-auth-js'` is caused by a lockfile version mismatch. `package.json` requires `^1.0.1` but `package-lock.json` has `0.0.3` cached. Fix: reinstall/update the dependency to sync the lockfile.

---

## Research Results: Do You Need Better API Keys?

Here's the breakdown of paid data sources and whether they're worth it at your stage:

### What You Already Have (Free / Included)
| Source | What It Gets You | Cost |
|--------|-----------------|------|
| **Firecrawl** (connected) | Scrape competitor sites, discover their landing pages, extract ad copy | Included via connector |
| **Lovable AI Gateway** | Generate ad campaigns, analyze markets, write copy | Included in plan |
| **Google Maps API** (connected) | Local business data, competitor locations | Already configured |

### Paid APIs Worth Considering

| API | What Selma Could Do With It | Cost | Verdict |
|-----|---------------------------|------|---------|
| **DataForSEO** | Real Google Ads keyword data (CPC, volume, competition), competitor ad copy from SERP, Google Ads Transparency data | **$50 minimum**, pay-per-use (~$0.05/task) | **Best bang for buck.** This is the one to get. Gives Selma real keyword pricing data instead of AI estimates. |
| **SpyFu** | See what competitors spend on ads, their exact keywords, ad history | **$79/mo** (Pro+AI plan includes $40 API credit) | **Nice-to-have.** Good for web design competitor intel. Not essential yet. |
| **SEMrush** | Full competitive intelligence | **$499/mo** minimum for API | **Too expensive.** Skip until you're at $10k+ MRR. |
| **SimilarWeb** | Traffic estimates for any site | **$38k/year** average | **Hard no.** Enterprise pricing, not for us. |
| **Meta Marketing API** | Read your own ad performance, manage campaigns programmatically | **Free** (need app review) | **Yes — but requires Meta Business verification.** You already have META_ACCESS_TOKEN. |
| **Google Ads API** | Create/manage campaigns programmatically, keyword planner data | **Free** (need developer token + active ad account) | **Yes eventually.** Requires a Google Ads account with spend history. |

### Recommendation
**Start with DataForSEO ($50 deposit, pay-as-you-go).** It gives Selma real CPC/keyword data from Google's actual Keyword Planner without needing a Google Ads account. Everything else can wait. Firecrawl + Lovable AI + DataForSEO is enough for Selma to generate PhD-quality campaign recommendations.

---

## Agent Selma — Autonomous Head Marketer

### Identity
- **Name**: Selma
- **Role**: Autonomous Head of Marketing & Ad Strategy
- **Personality**: PhD economist who only recommends campaigns with positive expected ROI. If the numbers don't work, she stays silent.

### What She Does (Daily, 9am ET)
1. **Scans all product tables** — identifies which services have clients, which have capacity, which have momentum
2. **Researches market conditions** — uses Firecrawl to check competitor ads, landing pages, and pricing in relevant verticals
3. **Evaluates ad channels** — determines whether Google, Facebook, Instagram, Reddit, or another platform is the best fit for each service based on audience match and estimated CPC
4. **Writes a complete campaign** — full ad copy, targeting, budget allocation, and projected ROI
5. **Submits to Matt for approval** — one campaign per day maximum, only if the economics make sense
6. **Monitors existing campaigns** — tracks which services are converting and adjusts future recommendations

### Selma's Decision Framework
- Calculate expected Customer Acquisition Cost (CAC) vs. Lifetime Value (LTV)
- Only propose campaigns where projected LTV > 3x CAC
- Prioritize services with existing infrastructure (landing pages, checkout flows)
- Consider seasonality and local market conditions

### Edge Function
`selma-autonomous/index.ts` — cron daily 9am ET

### Protocol File
`.claude/agents/selma.md`

---

## 10 New Responsibilities for Existing Agents

| # | Agent | New Responsibility |
|---|-------|-------------------|
| 1 | **Tom** | Monitor Reddit and Facebook groups for people asking about web design / local marketing in Michigan — flag as warm leads |
| 2 | **Tom** | Track which landing pages have the highest conversion rates and recommend doubling down on those verticals |
| 3 | **Scout** | Monitor competitor Google Ads via Firecrawl scraping of Google Ads Transparency Center — report new competitor campaigns |
| 4 | **Scout** | Track competitor pricing changes by periodically scraping their pricing pages |
| 5 | **Hype** | Auto-generate "before/after" case study drafts when a web design project moves to "Live" status |
| 6 | **Drill** | Audit all landing pages for missing CTAs, broken checkout links, or outdated pricing — report fixes needed |
| 7 | **Shield** | Monitor trial-to-paid conversion rates per product — alert if any product drops below 30% |
| 8 | **Cashier** | Track revenue per ad dollar spent (ROAS) once campaigns go live — feed data back to Selma |
| 9 | **Oz** | Weekly "dead page" audit — find pages with zero traffic in 30 days and recommend action (kill, redirect, or refresh) |
| 10 | **Ref** | Identify top-performing referrers and auto-draft personalized thank-you emails with bonus offers |

---

## Implementation Steps

1. **Fix build error** — reinstall `@lovable.dev/cloud-auth-js` to sync lockfile
2. **Create Selma's protocol** — `.claude/agents/selma.md`
3. **Build Selma's edge function** — `supabase/functions/selma-autonomous/index.ts` with daily cron
4. **Create `ad_campaign_queue` table** — stores Selma's proposed campaigns with status (pending/approved/rejected)
5. **Add campaign review UI** — section in Admin panel where Matt sees Selma's daily proposal and can approve/reject with one tap
6. **Update existing agent edge functions** — add the 10 new responsibilities to their respective functions
7. **Schedule cron** — `selma-autonomous` daily at 9am ET

### Technical Details
- Selma uses Firecrawl for competitor research, Lovable AI for campaign generation, and queries all product/client tables to understand current business state
- Campaign proposals stored in `ad_campaign_queue` table with fields: `id`, `service`, `platform`, `campaign_content`, `projected_cac`, `projected_ltv`, `status`, `created_at`
- If DataForSEO is added later, Selma's function gets upgraded with real keyword data — but she works without it using AI estimates

