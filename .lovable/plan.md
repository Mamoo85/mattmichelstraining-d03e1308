

# Plan: Two Revenue Plays — Second Mortgage Leads + Ameristeel Buyer Intelligence

Both opportunities are real, but they sit on opposite ends of "ready to ship." One is a brand-new vertical that needs data infrastructure; the other is a 90%-built product that just needs a steel-industry skin. Here's the honest read on each.

---

## Question 1 — Second Mortgage / HELOC Leads for Your Brother's Company

### Reality check: can we find them today?
**No.** We have zero homeowner-side data. Everything we built is contractor-side (we know who DOES the work, not who NEEDS money). Searching the codebase for `home_value`, `equity`, `homeowner_data`, `ATTOM`, `propertyradar` returns nothing relevant.

### The market is real and big
- HELOC originations grew ~20% YoY through 2025 — Americans are sitting on ~$35T in tappable home equity, prime rate is finally dropping, and people who locked in 3% mortgages won't refi the first lien but WILL take a second.
- Mortgage companies pay **$25–$80 per qualified second-mortgage / HELOC lead**, **$150–$400 for live-transfer calls**. This is one of the highest-paying lead verticals in the country.
- TCPA is brutal here — FCC's 1:1 consent rule (Jan 2024) killed most lead aggregators. Quality > quantity now, which favors small operators with clean intake forms.

### What predicts a "yes" for a second mortgage (the signals we'd hunt)
1. **Long-tenure homeowner** (8+ years in same house = built equity)
2. **Low first-mortgage rate** (won't cash-out refi, but WILL second-lien)
3. **Recent life events**: kid hitting college age, recent business filing (needs capital), recent permit pulled (renovation = needs cash), recent divorce filing
4. **Self-employed / 1099** (banks make them jump through hoops, brokers love them)
5. **Credit-repair signals**: recently paid off a collection, recent dispute filings

### What we need to find them — three honest paths

**Path A — Buy the data ($$$, fastest):**
- ATTOM Data or PropertyRadar API ($300–$1,500/mo) → property records, owner name, equity estimate, length of ownership
- Add Experian or LexisNexis credit-trigger feed ($$$$, requires FCRA cert) — too heavy for us
- **Verdict:** Skip. Too expensive, FCRA liability, your brother's company can already buy this themselves.

**Path B — Public records + permit cross-ref (cheap, fits our stack):**
- **BSEED / county permit data** — already harvested by `industry-pulse-scanner`. Filter for residential renovation permits (kitchen, bath, addition) = homeowners who just spent money or are about to.
- **Detroit + Wayne/Oakland/Macomb tax assessor data** (free public APIs) → owner name, year acquired, assessed value
- **Michigan SOS new business filings** — already scanned. Self-employed = HELOC candidate.
- Cross-reference these three → "homeowner who just pulled a $40k kitchen permit, owns home 12 years, just registered an LLC" = gold-tier HELOC lead
- **Verdict:** Doable. Uses 100% existing infrastructure. Conservative output: 30–80 qualified leads/week in Metro Detroit.

**Path C — Inbound funnel (TCPA-clean, scalable):**
- Build a single landing page: `detroitwebagent.com/heloc` (or a separate domain like `metrodetroitequity.com`)
- Free tool: "How much can I borrow against my home?" → instant estimate using public assessor data + Zillow
- They get the estimate; we get name, address, phone, email, **explicit 1:1 TCPA consent** to share with one mortgage broker
- We sell the lead exclusively to your brother's company at $50–$80/lead
- **Verdict:** Highest-quality, lowest-risk. Lead is opted-in, exclusive, fresh.

### Recommendation for #1: Ship Path B + Path C together
- Path B fills the funnel during slow weeks (we hand-curate 20 high-signal leads/week from public records → cold-call them with a generic refi tip → those who engage become opt-in leads we can sell)
- Path C builds the long-term moat (our own opt-in list, defensible against TCPA, recurring revenue per lead)
- **Ask your brother first**: "What does your company pay per qualified HELOC lead, and what's their definition of qualified?" That answer determines if we build this for $25/lead or $80/lead.

---

## Question 2 — Ameristeel (Steel Sales, Sheet Metal Fab, Laser, Welding, Powder Coat)

### Reality check: do we have anything for them today?
**Yes — and it's almost a perfect fit.** We've already built **Demand Radar** specifically for `industrial_mfg` and `supply_house` audiences (this is in the codebase: `growth-radar-enhanced-scan`, `federal-contract-intel`, `industry-pulse-scanner`, plus the `prospect_pool` row for industrial vendors). We just never sold it to a steel company directly.

### What Ameristeel actually needs (the buying signals we already capture)
A company that does steel sales, fab, laser, welding, and powder coat sells to:
- **Industrial OEMs** (auto Tier 2/3, aerospace, defense, ag equipment)
- **General contractors** doing structural steel
- **Other fab shops** that subcontract overflow
- **Government** (SAM.gov contracts requiring fabricated metal — NAICS 332)

The signals we **already harvest** that map directly to "this company is about to need steel":
| Signal | Where it comes from | What it tells Ameristeel |
|---|---|---|
| New federal contract awards (NAICS 332/336) in MI | `federal-contract-intel` (live, free from SAM.gov + USAspending) | Defense/auto contractor just won — needs steel NOW |
| New BSEED / county commercial building permits | `industry-pulse-scanner` (live) | Structural steel order incoming |
| MI SOS new manufacturing entity filings | `growth-radar-enhanced-scan` (live) | New plant = equipment + structural steel + railings |
| SBA 504 loan approvals >$500k for manufacturers | `growth-radar-enhanced-scan` (live) | Capital just unlocked = capex spend coming |
| Auto OEM tariff/recall news | `industry-pulse-scanner` Sonar (live) | Reshoring = MI fab work coming back |
| Job postings: "welder," "fabricator," "machinist" hiring | `hire-alert-scanner` (live, MIOSHA + Apollo + job boards) | Shop ramping = needs more raw steel |

**This is real-time buyer intelligence for a steel company.** Today we surface this for *contractors* (Demand Radar). We've never repackaged it for *the people who supply contractors*.

### The product to sell Ameristeel: **"Buyer Radar"** (rebrand of Demand Radar for fab/supply)
Same backend, new vertical skin, new pitch.

**What they get for $399/mo (or $599/mo with named-account targeting):**
1. **Daily buyer alert email + SMS** — "3 new signals today: ABC Defense won a $4.2M Army contract (NAICS 336992 — armored vehicles, needs structural steel); Acme Auto Parts pulled a $1.8M expansion permit in Warren; XYZ Manufacturing posted 4 welder jobs this week."
2. **Named-account watchlist** — Ameristeel uploads their top 50 target accounts; we monitor each for any signal (permits, hiring, contracts, news, expansions, executive changes via Sonar). Their salespeople walk into Monday meetings already knowing which accounts moved.
3. **RFQ Intercept** *(new, builds on Sonar)* — daily scan for public RFQs / RFPs / bid postings on MichiganBidNet, MITN, BidNetDirect, SAM.gov filtered to NAICS 332/333/336 in MI/OH/IN. Their estimators see bids the day they drop instead of finding out from the customer.
4. **Quarterly "Stolen From Competitor" report** — Sonar scrape: which of their named competitors (we'd ask Ameristeel for the list — Worthington, Steel Technologies, Mill Steel, etc.) won what new accounts last quarter, based on press releases and trade pubs.

### What needs to be built (small, mostly repackaging)
- **New audience type**: add `fab_shop` and `steel_service_center` to the prospect_pool audience enum (so we can also prospect *new* steel companies later)
- **New scanner output**: `buyer_radar_signals` view (or just a filtered query on existing `industry_pulse_signals` where `vertical IN ('manufacturing','specialty_manufacturing','fabricated_metal','automotive','defense')` — the data is already there)
- **Named-account watchlist table**: `buyer_radar_accounts (client_id, business_name, domain, naics, monitor_until)` + a daily Sonar probe per account
- **RFQ scanner**: new edge function `rfq-bid-scanner` that hits MITN / BidNetDirect / SAM.gov filtered to fab-metal NAICS — Sonar fallback if no API access
- **Client dashboard**: skin of MyTechAlert / GrowthRadar at `/buyer-radar` — same KPI strip + signal feed + export bar pattern
- **Stripe checkout**: `create-buyer-radar-checkout` ($399 / $599 tier)
- **Pitch deck PDF for Ameristeel** — one-page handout Matt brings to the meeting

### Pricing logic for Ameristeel
A single steel order to a Tier 2 auto supplier is $25k–$200k. **One closed deal pays for 10+ years of subscription.** Don't underprice this — $399/mo is the floor, $599/mo with named-account watchlist is the right ask. If they want the RFQ Intercept, $799/mo and it's still a no-brainer for them.

### What to ask Ameristeel before building the named-account / RFQ pieces
1. Top 25 target accounts (so we know what to monitor)
2. Top 5 competitors they want stolen-share intel on
3. Geographic radius (MI only? Great Lakes? National?)
4. NAICS codes / SIC codes they actively quote against
5. Do they currently subscribe to Reed Construction Data, ConstructConnect, Dodge, or IndustryNet? (Tells us the price ceiling — those tools are $3k–$15k/year and worse.)

---

## Recommended sequence (next 2 weeks)

| Day | Action | Why |
|---|---|---|
| Day 1 | Text your brother — "What does your company pay per HELOC lead, and what makes a lead 'qualified'?" | Determines if mortgage play is worth building |
| Day 1 | Text Ameristeel owner — "I want to show you something I built for industrial suppliers. 20-min meeting this week?" | Strike while warm |
| Day 2–3 | Build Buyer Radar v1 — rebrand Demand Radar, add fab-metal NAICS filter, build pitch PDF | 90% existing code, ship in 2 days |
| Day 4 | Demo Buyer Radar to Ameristeel | $399–$599/mo close, possibly $799 with RFQ |
| Day 5 | If brother gave a clear price (>$50/lead) → start building HELOC opt-in landing page (`detroitwebagent.com/heloc`) | Validated demand first |
| Day 6–10 | If green-lit — build Path C funnel (HELOC estimator tool, opt-in form, TCPA 1:1 consent capture, lead delivery to brother) | Real revenue path, low risk |
| Day 11–14 | Path B passive layer — daily cron that cross-refs new permits + assessor data + SOS filings to surface 20 hand-curated HELOC candidates per week | Fills funnel during cold start |

## Files that would be touched (for transparency, not now)

**For Ameristeel / Buyer Radar:**
- `supabase/functions/rfq-bid-scanner/index.ts` (NEW)
- `supabase/functions/create-buyer-radar-checkout/index.ts` (NEW — copy of Demand Radar checkout)
- `supabase/functions/buyer-radar-daily-digest/index.ts` (NEW — copy of growth-radar digest, filtered to fab-metal verticals)
- `supabase/migrations/<new>.sql` — `buyer_radar_clients`, `buyer_radar_accounts` tables + RLS
- `src/pages/BuyerRadar.tsx` (NEW — public marketing/checkout page)
- `src/pages/MyBuyerRadar.tsx` (NEW — client dashboard, copy of MyGrowthRadar)
- `supabase/functions/stripe-webhook/index.ts` — add `buyer_radar_subscription` handler
- One PDF in `/mnt/documents/` — the Ameristeel meeting one-pager

**For HELOC (only if brother gives green-light pricing):**
- `src/pages/HelocEstimator.tsx` (NEW — free tool / lead magnet)
- `supabase/functions/heloc-estimate/index.ts` (NEW — Zillow API + assessor lookup)
- `supabase/functions/heloc-lead-deliver/index.ts` (NEW — sends opt-in lead to broker via email/SMS)
- `supabase/migrations/<new>.sql` — `heloc_leads` + `mortgage_brokers` tables with TCPA consent fields
- Path B cron: `heloc-public-records-cross-ref/index.ts` (NEW — joins permits + SOS + assessor)

**Zero changes to working code.** Both products are net-new tables + net-new functions + net-new pages. Existing scanners, scoring, drip, Stripe, TCPA suppression — all untouched.

