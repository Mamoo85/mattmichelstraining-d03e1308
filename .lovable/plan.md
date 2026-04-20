
## What we know about Apollo's strengths

Apollo's sweet spot:
- **B2B firmographics**: company size, revenue, tech stack, decision-maker org charts
- **White-collar contacts**: VPs, directors, ops managers, hiring managers (not tradespeople)
- **Email + mobile waterfalls**: their bread and butter — verified work emails, sometimes mobiles
- **Intent signals**: companies actively researching topics

Apollo's weak spots (proven in v5 audit):
- Solo tradespeople / licensees (RNs, electricians on MIOSHA) — they're not in Apollo's DB
- Government sites / public sector — Apollo indexes private companies, not gov contracting offices
- Small contractors with no website — no domain = no Apollo record

## So who is Apollo's best customer in OUR system?

Looking at our actual products and what each one needs:

| Product | What we need | Is Apollo right? |
|---|---|---|
| **TechAlert (Talent Radar)** — find available tradespeople | Individual workers (RNs, boiler ops) | ❌ Wrong tool. Use MIOSHA/NPI/Sonar. |
| **TechAlert sales pitch to nursing homes/contractors** | Decision-maker at the *hiring company* (HR Director, COO) | ✅ **Apollo's sweet spot** |
| **Demand Radar (industry-pulse)** — find expanding companies | Company firmographics + decision makers | ✅ **Apollo's sweet spot** |
| **Demand Radar sales pitch** — sell signals to suppliers | Sales VP, BD Director at supplier company | ✅ **Apollo's sweet spot** |
| **Contractor Leads / FieldDesk pitch** | Owner of small HVAC shop | ⚠️ Partial — bigger contractors yes, mom-and-pops no |
| **DWA web design pitch** | Local business owner | ⚠️ Partial — same as above |
| **Gov sites (SAM.gov, BSEED, NPI, MIOSHA)** | Public records of permits/licenses/contracts | ❌ Wrong tool. Apollo doesn't index gov data. |

**Answer to "Can we use Apollo for gov sites?"** — No. Gov data sources (SAM.gov, BSEED, NPI, MIOSHA, Accela) are already free and structured. Apollo wouldn't add anything there.

**But** — once a gov source surfaces a *company* (e.g., SAM.gov shows "Acme Mechanical won a $400k contract"), Apollo IS the right tool to find Acme's CEO/COO/HR Director so we can pitch them. That's the bridge.

## What we need most right now

Per v5 audit + current session state:
- **Talent Radar contactability is stuck at 17.5%** because MIOSHA records have no employer → Hunter/Snov/Lusha all fail
- **`alerts_sent: 0` for 3 days** — we're finding 122 candidates/day but not pitching anyone
- **Industry Pulse signals (131 rows)** are sitting there with no decision-maker contact info to pitch to

**The biggest unlock: turn our 131 unmonetized industry-pulse signals into a pitch list with named decision-makers.** That's a direct revenue play, not a research project.

## Three Apollo deployment options — pick one

### Option A: Decision-Maker Mapping for Demand Radar signals (RECOMMENDED)
**What**: When industry-pulse-scanner finds an expansion/hiring signal at "Acme Boiler Co.", auto-call Apollo's `mixed_people/search` to pull the COO + VP Operations + HR Director with verified emails.
**Why**: Turns dead signals into a sales-ready pitch list. Highest revenue impact.
**Cost**: ~$0.01 per company, ~131 companies = $1.31 backfill, then ~$0.30/day ongoing.
**Risk**: Free plan blocks `mixed_people/search` (we already saw the 403). Would need paid plan ($49/mo Basic).

### Option B: Org Enrichment for Talent Radar candidates
**What**: When MIOSHA gives us a name + city but no employer, search Apollo by name+region to find their LinkedIn/employer.
**Why**: Could lift contactability from 17% → 25%+.
**Risk**: Apollo's coverage of solo tradespeople is weak (proven in v5). Likely wastes credits. **Skip this.**

### Option C: Free-tier diagnostic only
**What**: Keep Apollo on free tier. Use `org_enrich` only (the one endpoint that worked) to add firmographics (employee count, revenue, industry) to companies we already found. No people search.
**Why**: Zero spend, marginal lift, low risk.
**Why not**: Doesn't move the needle on the actual bottleneck (no decision-maker contact info).

## Recommendation

**Go with Option A.** It targets the actual revenue bottleneck (131 unpitched signals), uses Apollo where it's strongest (B2B decision-makers), and avoids where it's weakest (solo tradespeople, gov sites).

Two questions before I build:
1. Confirm Apollo plan — is this still the free key, or did you upgrade to Basic ($49/mo) so `mixed_people/search` works?
2. Vertical priority for first run — pitch decision-makers at (a) **healthcare facilities** (CMS 1-star nursing homes for TechAlert RN/CNA pitch), (b) **industrial expanders** (SAM.gov contract winners for Demand Radar), or (c) **both**?

If Apollo is still free-tier, the only viable play is Option C — and the honest answer is "don't bother spending dev time on it; cancel the key and put the $49 toward Sonar credits which actually work."
