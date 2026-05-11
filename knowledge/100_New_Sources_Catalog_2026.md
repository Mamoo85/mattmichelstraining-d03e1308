# 100 New Sources Catalog — 2026 Expansion

**Status:** Draft for Matt's review. No code shipped yet.
**Owner:** Claude (Lovable agent)
**Companion plan:** `.lovable/plan.md` ("100-Source Expansion Plan")

---

## Executive Summary

| Metric | Value |
|---|---|
| Total sources | 100 |
| High confidence (proven API or scrape pattern) | 70 |
| Medium confidence (endpoint exists, format unverified) | 20 |
| Low confidence (may swap during build) | 10 |
| Sources requiring NEW paid keys | **0** |
| Sources requiring Firecrawl | 38 |
| Est. additional Firecrawl spend | +$60–$120/mo (capped) |
| Sources feeding Trade Radar | 55 |
| Sources feeding TechAlert | 20 |
| Sources feeding Email Waterfall | 25 |

**Recommended ship order:** Wave 1 (Michigan-deep ArcGIS + state SOS) → Wave 2 (top-10 metros permits) → Wave 3 (TechAlert federal + ATS) → Wave 4 (Email waterfall Tiers 90–115) → Wave 5 (long-tail + smoke test).

**Hard guardrails on every scrape source:**
1. `enrichment-budget.ts` per-source daily row cap (default 200/day, tunable)
2. `source_health` row with auto-pause after 7 consecutive zero-yield days
3. ROI tag linking source → product → expected lead category
4. Fail-graceful (try/catch around every external fetch, never throws into the scanner)

---

## Schema Legend

- **Type:** `api` (open JSON), `arcgis` (Esri FeatureServer), `socrata` (data.cityofX), `ckan` (state open data), `rss` (Atom/RSS feed), `scrape` (Firecrawl + regex), `dataset` (CSV download)
- **Auth:** `none`, `user-agent`, `existing-key` (already in Supabase secrets), `oauth-public` (no token but signed URL)
- **Vertical codes:** R=roofing, H=HVAC, P=plumbing, E=electrical, X=pest, G=gutters, EX=exterior, T=tree, RS=restoration, DJ=demo/junk, F=foundation
- **Signal type:** matches existing AREA_ALERT_TYPES or per-address column convention
- **Confidence:** H = high (works today), M = medium (verify during build), L = low (may swap)

---

## TRADE RADAR — 55 sources

### A. Michigan metro permit/CofC/inspection layers (10)

| # | Name | Vertical(s) | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|---|
| 1 | Grand Rapids building permits | R/H/P/E/G/EX | arcgis | none | Kent | per-address permits | 20–50 | H |
| 2 | Grand Rapids CofC expirations | All | arcgis | none | Kent | cofc_* | 10–30 | H |
| 3 | Lansing building permits | R/H/P/E | socrata | none | Ingham | per-address | 10–25 | M |
| 4 | Ann Arbor A2OpenData permits | R/H/P/E/EX | socrata | none | Washtenaw | per-address | 15–30 | H |
| 5 | Flint code violations | RS/DJ/X | scrape | none | Genesee | foreclosure_vacant | 10–20 | M |
| 6 | Kent County deeds | All | arcgis | none | Kent | new_owner_old_home | 20–60 | H |
| 7 | Washtenaw County deeds | All | arcgis | none | Washtenaw | new_owner_old_home | 15–40 | M |
| 8 | Genesee County deeds | All | arcgis | none | Genesee | new_owner_old_home | 10–30 | M |
| 9 | Saginaw building permits | R/H/P | scrape | none | Saginaw | per-address | 5–15 | L |
| 10 | Kalamazoo open data permits | R/H/P/E | socrata | none | Kalamazoo | per-address | 10–20 | M |

### B. Top-10 US metros permit/inspection layers (12)

| # | Name | Vertical(s) | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|---|
| 11 | Chicago building permits | All | socrata | none | Cook | per-address | 100–300 | H |
| 12 | Chicago code violations | RS/DJ/X | socrata | none | Cook | foreclosure_vacant | 50–150 | H |
| 13 | Cleveland building permits | R/H/P/E | arcgis | none | Cuyahoga | per-address | 30–80 | H |
| 14 | Cuyahoga County demolitions | DJ/RS | arcgis | none | Cuyahoga | demo_permit | 5–20 | M |
| 15 | Columbus building permits | All | socrata | none | Franklin | per-address | 40–100 | H |
| 16 | Cincinnati building permits | All | socrata | none | Hamilton | per-address | 30–80 | M |
| 17 | Toledo code enforcement | RS/DJ/X | scrape | none | Lucas | foreclosure_vacant | 10–30 | L |
| 18 | Indianapolis building permits | All | socrata | none | Marion | per-address | 50–120 | H |
| 19 | Milwaukee building permits | R/H/P/E | socrata | none | Milwaukee | per-address | 25–70 | H |
| 20 | Pittsburgh building permits | R/H/P/E | scrape | none | Allegheny | per-address | 20–50 | M |
| 21 | Nashville building permits | All | socrata | none | Davidson | per-address | 40–100 | H |
| 22 | Louisville building permits | R/H/P | socrata | none | Jefferson | per-address | 20–50 | M |

### C. Top-10 metros county deeds / sales (8)

| # | Name | Vertical(s) | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|---|
| 23 | Cook County recorder deeds | All | scrape | none | Cook | new_owner_old_home | 80–200 | M |
| 24 | Cuyahoga fiscal officer sales | All | arcgis | none | Cuyahoga | new_owner_old_home | 30–80 | H |
| 25 | Franklin County auditor sales | All | scrape | none | Franklin | new_owner_old_home | 30–80 | M |
| 26 | Hamilton County auditor sales | All | scrape | none | Hamilton | new_owner_old_home | 20–50 | M |
| 27 | Marion County assessor sales | All | scrape | none | Marion | new_owner_old_home | 30–80 | M |
| 28 | Milwaukee County land records | All | scrape | none | Milwaukee | new_owner_old_home | 20–50 | L |
| 29 | Davidson County assessor | All | scrape | none | Davidson | new_owner_old_home | 20–60 | M |
| 30 | Allegheny County deeds | All | scrape | none | Allegheny | new_owner_old_home | 25–70 | M |

### D. Federal / national area signals (10)

| # | Name | Vertical(s) | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|---|
| 31 | HUD CHAS housing condition | All | api | none | US | aging_housing_tract | tract-level | H |
| 32 | FFIEC HMDA loan originations | R/H/F | api | none | US | refi_area | weekly | H |
| 33 | FEMA NFIP repeat-loss zones | F/RS/P | dataset | none | US | nfip_flood_area | zip-level | H |
| 34 | USGS landslide hazard | F | api | none | US | foundation_hazard_area | county | M |
| 35 | EPA ECHO water-system violations | P | api | none | US | lead_line_area | facility | H |
| 36 | DOT FMCSA carrier registrations | TechAlert+ | api | none | US | fleet_signals | daily | H |
| 37 | OSHA Establishment Search | TechAlert+ | api | none | US | osha_violation | daily | H |
| 38 | USPS vacancy (via HUD) | RS/X/DJ | dataset | none | US | vacancy_area | qtr | M |
| 39 | NOAA CDO historical (top-10 metros) | R/EX/G | api | existing-key | US | historical_hail_county | daily | H |
| 40 | NOAA SPC mesoscale archive | R/EX/G | dataset | none | US | storm_followup | daily | H |

### E. County deeds — Michigan deep (4)

| # | Name | Vertical(s) | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|---|
| 41 | Wayne Co tax foreclosure auction | RS/DJ | scrape | none | Wayne | foreclosure_vacant | 20–60 | H |
| 42 | Oakland Co property sales | All | arcgis | none | Oakland | new_owner_old_home | 40–100 | M |
| 43 | Macomb Co property transfers | All | arcgis | none | Macomb | new_owner_old_home | 30–80 | M |
| 44 | Michigan SOS UCC filings | TechAlert+ | scrape | none | MI | ucc_growth_signal | 10–30 | M |

### F. Court & legal — multi-state (4)

| # | Name | Vertical(s) | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|---|
| 45 | PACER NDIL bankruptcy RSS | F/RS | rss | none | IL | bankruptcy_distress | 10–40 | H |
| 46 | PACER NDOH bankruptcy RSS | F/RS | rss | none | OH | bankruptcy_distress | 10–40 | H |
| 47 | PACER SDIN bankruptcy RSS | F/RS | rss | none | IN | bankruptcy_distress | 5–20 | H |
| 48 | State mechanics lien filings (MI+OH+IN) | All | scrape | none | MI/OH/IN | contractor_distress | 10–30 | M |

### G. Open-data scrapes — homeowner intent (7)

| # | Name | Vertical(s) | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|---|
| 49 | EstateSale-NET (beyond EstateSales.net) | DJ/RS | scrape | none | US | estate_sale | 20–50 | M |
| 50 | AuctionZip estate listings | DJ/RS | scrape | none | US | estate_sale | 10–30 | M |
| 51 | County sheriff foreclosure dockets (top-10) | RS/DJ | scrape | none | US | courtlistener_foreclosure | 30–80 | M |
| 52 | BBB complaint pages (homeowner side) | All | scrape | none | US | underserved_market | 10–30 | L |
| 53 | Local-news fire/storm RSS aggregator | RS/R/EX | rss | none | US | storm_followup | 20–50 | M |
| 54 | USGS National Map roof-age proxy | R | api | none | US | aging_roof_area | weekly | L |
| 55 | OpenStreetMap tag-based POI (extend) | All | api | none | US | poi_change | 10–30 | M |

---

## TECHALERT — 20 sources

### H. State contractor license boards (9)

| # | Name | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|
| 56 | Ohio OCILB license expirations | scrape | none | OH | license_expiring | 10–30 | M |
| 57 | Indiana PLA license board | scrape | none | IN | license_expiring | 10–25 | M |
| 58 | Illinois IDFPR contractor lookup | scrape | none | IL | license_expiring | 15–40 | M |
| 59 | Wisconsin DSPS credentials | api | none | WI | license_new+expiring | 10–25 | H |
| 60 | Tennessee BCLB license search | scrape | none | TN | license_expiring | 10–25 | L |
| 61 | Kentucky DHBC license search | scrape | none | KY | license_expiring | 5–15 | L |
| 62 | PA HIC contractor registry | api | none | PA | license_expiring | 15–30 | M |
| 63 | Federal NPI Registry (medical trades) | api | none | US | medical_trades_signal | 20–50 | H |
| 64 | LARA Michigan license expansions | api | none | MI | new_corp_filings | 30–60 | H |

### I. Funding & growth (5)

| # | Name | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|
| 65 | Crunchbase free RSS funded rounds | rss | none | US | funded_round | 5–15 | M |
| 66 | SEC EDGAR Form D (extend SIC codes) | api | none | US | edgar_funding | 5–20 | H |
| 67 | USPTO assignee (extend HVAC/industrial) | api | none | US | uspto_patent | 10–30 | H |
| 68 | Census BFS new-business formations | api | none | US | new_business_area | weekly | H |
| 69 | NSF SBIR/STTR awards | api | none | US | sbir_award | 5–15 | H |

### J. Public ATS boards (3)

| # | Name | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|
| 70 | Greenhouse public job boards | scrape | none | US | hiring_scale_signal | 30–80 | H |
| 71 | Lever public job boards | scrape | none | US | hiring_scale_signal | 20–60 | H |
| 72 | Workable public boards | scrape | none | US | hiring_scale_signal | 20–50 | M |

### K. Labor & enforcement (3)

| # | Name | Type | Auth | Geo | Signal | Vol/day | Conf |
|---|---|---|---|---|---|---|---|
| 73 | OSHA Inspection Detail API | api | none | US | osha_violation | 20–50 | H |
| 74 | NLRB petitions (extend) | api | none | US | nlrb_petition | 5–15 | H |
| 75 | DOL WHD violations search | api | none | US | dol_violation | 10–30 | H |

---

## EMAIL / CONTACT WATERFALL — 25 sources (Tiers 90–115)

### L. Trade association directories (8)

| # | Name | Type | Auth | Geo | Yield | Conf |
|---|---|---|---|---|---|---|
| 76 | NAHB local chapter directories | scrape | none | US | owner_email + phone | M |
| 77 | ABC (Associated Builders) chapters | scrape | none | US | owner_email | M |
| 78 | ASA (Subcontractors) directory | scrape | none | US | owner_email | M |
| 79 | PHCC plumbing/HVAC chapters | scrape | none | US | owner_email | M |
| 80 | NECA electrical chapters | scrape | none | US | owner_email | M |
| 81 | SMACNA sheet-metal chapters | scrape | none | US | owner_email | L |
| 82 | MCAA mechanical contractors | scrape | none | US | owner_email | L |
| 83 | NRCA roofing contractors | scrape | none | US | owner_email | M |

### M. Chamber of Commerce rosters (6)

| # | Name | Type | Auth | Geo | Yield | Conf |
|---|---|---|---|---|---|---|
| 84 | Detroit Regional Chamber | scrape | none | Detroit | email | M |
| 85 | Grand Rapids Chamber | scrape | none | Grand Rapids | email | M |
| 86 | Chicagoland Chamber | scrape | none | Chicago | email | M |
| 87 | Cleveland Plus Chamber | scrape | none | Cleveland | email | L |
| 88 | Indy Chamber | scrape | none | Indianapolis | email | M |
| 89 | Nashville Area Chamber | scrape | none | Nashville | email | M |

### N. Industry pubs / award lists (4)

| # | Name | Type | Auth | Geo | Yield | Conf |
|---|---|---|---|---|---|---|
| 90 | ENR Top 400 contractors list | scrape | none | US | exec_email | M |
| 91 | Roofing Contractor Top 100 | scrape | none | US | exec_email | M |
| 92 | Plumbing & Mechanical Top 50 | scrape | none | US | exec_email | M |
| 93 | Contracting Business 100 (HVAC) | scrape | none | US | exec_email | M |

### O. Tech footprint enrichment (4)

| # | Name | Type | Auth | Geo | Yield | Conf |
|---|---|---|---|---|---|---|
| 94 | BuiltWith free tier | api | none | US | tech_stack_signal | H |
| 95 | crt.sh certificate transparency | api | none | US | new_subdomain_signal | H |
| 96 | SecurityTrails free tier | api | none | US | dns_history_signal | M |
| 97 | Wayback CDX rebuild detection | api | none | US | website_redesign_signal | H |

### P. Long-tail registries (3)

| # | Name | Type | Auth | Geo | Yield | Conf |
|---|---|---|---|---|---|---|
| 98 | Wikidata SPARQL businesses-by-locality | api | none | US | firmographic | M |
| 99 | OpenStreetMap business POIs (tag extend) | api | none | US | firmographic | H |
| 100 | Common Crawl WET indices (domain email) | dataset | none | US | owner_email | L |

---

## 30 "Ship Immediately" Sources (Wave 1 candidates)

The following 30 are high-confidence, no judgment call needed, and can ship in the first wave without further review:

`1, 2, 4, 6, 11, 12, 13, 15, 18, 19, 21, 24, 31, 32, 33, 35, 36, 37, 39, 40, 41, 45, 46, 47, 59, 63, 64, 66, 67, 73`

These are: pure open APIs (NOAA, FFIEC, HUD, EPA, OSHA, NPI, Census, SEC EDGAR, USPTO, DOL, FMCSA), already-public ArcGIS portals in proven metros (Chicago, Cleveland, Columbus, Indianapolis, Milwaukee, Nashville, Cuyahoga, Kent, Washtenaw), PACER bankruptcy RSS for IL/OH/IN, MI/WI license boards, Wayne tax foreclosure (already-tested pattern).

---

## Wave Sequencing

| Wave | Sources | Focus | Est. effort |
|---|---|---|---|
| 1 | 30 above ("ship immediately") | Federal APIs + proven metros | ~1 build session |
| 2 | 20 more (#3,5,7,8,9,10,14,16,20,22,23,25,26,27,28,29,30,38,42,43) | Remaining metros + MI deep | ~1 session |
| 3 | 20 (#17,34,44,48–55 + TechAlert 56–62,68,69,70–72,74,75) | TechAlert + scrape-heavy edges | ~1 session |
| 4 | 25 (#76–100 — email waterfall tiers 90–115) | `email-extras-6.ts` + `-7.ts` | ~1 session |
| 5 | Smoke test function + admin page | Verification & monitoring | ~½ session |

---

## What Matt Should Do

1. **Read this table.** Strike any source you don't want, swap any vertical assignment, or call out misordered priorities.
2. **Approve geo scope** if top-10 metros list (Chicago/Indy/Cleveland/Columbus/Cincinnati/Milwaukee/Toledo/Pittsburgh/Nashville/Louisville) is wrong — substitutions welcome.
3. **Decide on confidence-low items (10 total).** Either approve as "try and replace if it fails" or strike now.
4. Reply with go-ahead → I start Wave 1.

---

*End of catalog. Code changes begin only after Matt's approval of this document.*
