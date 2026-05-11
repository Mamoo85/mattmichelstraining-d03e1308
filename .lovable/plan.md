
# 100-Source Expansion Plan

## Recommendation on scrape budget

You asked what I'd recommend — this is for business, not hobby, so my answer is **Tier 2: Moderate-aggressive Firecrawl scraping with hard per-source budget guards**, not "API only" and not "scrape everything."

Reasoning:
- API-only caps you at ~55 of the 100. You'd leave the highest-intent sources (trade-association member directories, chamber rosters, ATS job boards, RFP boards) on the table — those are exactly where competitors aren't looking.
- Scrape-everything risks a $300–$800/mo Firecrawl bill spike with no ceiling.
- Moderate + budget guards = ~85–90 of the 100 sources wired, with a hard `enrichment-budget.ts` ceiling per source per day (you already have this primitive — I'd extend it). Expected Firecrawl burn: +$60–$120/mo, fully attributable per source so you can kill anything underperforming.

Every scrape-based source gets:
1. Daily row-cap per source (e.g. 200 scrapes/day max)
2. ROI tag (which product it feeds)
3. Auto-pause after 7 days of zero-yield (writes to `source_health` table)

## Scope (confirmed)

- **Priority products:** Trade Radar (11 verticals), TechAlert, email/contact waterfall
- **Geo:** Michigan deep + top-10 US metros (Chicago, Indianapolis, Cleveland, Columbus, Cincinnati, Milwaukee, Toledo, Pittsburgh, Nashville, Louisville — adjustable)
- **Output:** Plan-only first. You approve the catalog before any code lands.

## Deliverable

A single committed document — `knowledge/100_New_Sources_Catalog_2026.md` — containing all 100 sources, each row with:

```text
# | Name | Product fed | Vertical(s) | Type (api/arcgis/socrata/scrape) | Auth | Geo | Signal type written | Expected daily volume | Confidence (H/M/L) | Notes
```

Plus a one-page exec summary at top: confidence distribution, est. monthly cost, which 30 are "ship immediately" vs. which 70 need a judgment call from you.

## The 100 — high-level breakdown

### Trade Radar (≈55 sources)

**Permit / CofC / inspection layers from new metros (~22)**
ArcGIS or Socrata portals for: Grand Rapids, Lansing, Ann Arbor, Flint (MI); Cleveland, Columbus, Cincinnati, Toledo (OH); Indianapolis (IN); Chicago, Milwaukee (IL/WI); Pittsburgh (PA); Nashville (TN); Louisville (KY). Each contributes 1–3 of: building permits, demolition permits, rental registrations, occupancy/CofC, fire incidents, code violations.

**Federal / national area signals (~10)**
HUD CHAS housing condition by tract, FFIEC HMDA loan originations, FEMA NFIP repeat-loss zones (extended beyond current usage), USGS landslide hazard, USDA SAM exclusions cross-ref, NOAA CDO historical (extend beyond current MI use to top-10 metros), EPA ECHO water-system violations, DOT FMCSA fleet registrations (for fleet-truck repair signals), USPS vacancy data via HUD aggregate, OSHA enforcement.

**County deeds / sales (~12)**
Wayne (you have), Oakland, Macomb, Kent (Grand Rapids), Genesee (Flint), Washtenaw (Ann Arbor), Cuyahoga (Cleveland), Franklin (Columbus), Hamilton (Cincinnati), Marion (Indy), Cook (Chicago) — new-owner-of-old-home detection across all 11 trade verticals.

**Open-data per-address scrapes (~7)**
Public auctioneer listings (estate/probate beyond EstateSales.net), county sheriff foreclosure docket pages, BBB complaint pages (homeowner-side, identifies un-served markets), Nextdoor business reviews, local-news fire/storm RSS feeds, NOAA SPC mesoscale archive, USGS National Map roof-age proxy.

**Court & legal (~4)**
PACER bankruptcy RSS expanded (you have CourtListener — adding court-by-court RSS for MIWD/MIED/NDIL/NDOH/SDIN), state UCC filings (MI + top-10), state mechanics lien filings where public, probate court RSS where public.

### TechAlert (≈20 sources)

- **State contractor license boards (~9):** LARA (you have), Ohio (OCILB), Indiana, Illinois IDFPR, Wisconsin DSPS, Tennessee BCLB, Kentucky DHBC, Pennsylvania, plus federal NPI cross-ref for medical trades.
- **Funding / growth (~5):** Crunchbase free RSS, SEC EDGAR D filings (you have — extend SIC codes), USPTO assignee (you have — extend to industrial/HVAC), Census BFS new-business formations, NSF SBIR awards.
- **Public ATS scrapes (~3):** Greenhouse public boards, Lever public boards, Workable public boards — for funded trades cos hiring (signals scale, not poaching).
- **Labor & enforcement (~3):** OSHA Establishment Search, NLRB petitions (you have — extend), DOL WHD violations.

### Email / contact waterfall (≈25 sources, Tiers 90–115)

Extending `email-extras-1.ts` → `email-extras-5.ts`:

- **Trade association member directories (~8):** NAHB local chapters, ABC chapters, ASA, PHCC chapters, NECA chapters, SMACNA, MCAA, NRCA.
- **Chamber rosters (~6):** Detroit Regional Chamber, Grand Rapids Chamber, top-10 metro chambers' public member directories.
- **Industry pubs lead lists (~4):** ENR Top 400, Roofing Contractor Top 100, Plumbing & Mechanical 50, Contracting Business 100.
- **Tech footprint enrichment (~4):** BuiltWith free tier, crt.sh subdomain history, SecurityTrails free tier, Wayback CDX rebuild-detection (extends existing usage).
- **Long-tail registries (~3):** Wikidata SPARQL businesses-by-locality, OpenStreetMap business POIs by tag (extend current usage), Common Crawl WET indices for email extraction by domain.

## Workflow

1. I produce `knowledge/100_New_Sources_Catalog_2026.md` (no code yet).
2. You review — strike, swap, or approve.
3. After approval, I ship in **5 waves of ~20 sources each**, mirroring the Phase 33 pattern (each wave = its own commit batch, with `source_health` rows seeded and `enrichment-budget` caps wired). Each wave includes:
   - New signal-file additions or extras-file (`email-extras-6.ts`, `-7.ts`)
   - `trade-radar-scanner` / `techalert-prospect-hunter` Promise.all extension
   - `source_health` migration entries
   - Per-source budget cap in `enrichment-budget.ts`
4. After all 5 waves, one verification edge function (`new-sources-smoke-test`) curls each source once and reports yield to a `SourcesSmokeReport` admin page row.

## What this plan does NOT include

- No new paid keys (no Costar, no MLS/RESO, no Experian/TU/EQ — H.R. 2808 forbids anyway).
- No partner-gated APIs (LinkedIn Jobs, Indeed, ZoomInfo paid).
- No frontend portal changes — sources feed existing portals.
- No changes to existing 11 trade verticals' core scoring logic.

## Risks I want to flag

1. **Firecrawl monthly burn** could spike if a scraped source returns way more than expected. Mitigated by per-source daily caps, but worth watching the first 2 weeks.
2. **Some county ArcGIS endpoints block edge-function IPs** (Wayne/Oakland sometimes do — see Phase 42 note). I'll fail-graceful and not count them against the 100 if they're confirmed blocked.
3. **Per-state SOS / license boards vary wildly** — some are clean JSON, some require Firecrawl scraping of paginated HTML. Estimated 7 of 9 license boards work cleanly; 2 may be skipped or replaced.

## Confidence

- **~70 sources:** high confidence — open APIs or proven Firecrawl scrape patterns I've already used.
- **~20 sources:** medium — endpoint exists, format needs verification.
- **~10 sources:** low — may swap during catalog drafting if the API turns out to be gated or empty.

Final deliverable target: catalog doc in `knowledge/` within one build session, then wave-by-wave implementation after your approval.
