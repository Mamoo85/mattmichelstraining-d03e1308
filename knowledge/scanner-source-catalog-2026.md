# Scanner Source Catalog 2026 — 200 New Free / No-Key Sources

Goal: 20 net-new sources per main scanner, zero new API keys required.
Existing keys assumed available: `FIRECRAWL_API_KEY`, `APOLLO_API_KEY`, `HUNTER_IO_API_KEY`,
`SNOV_USER_ID`/`SNOV_API_KEY`, `GOOGLE_MAPS_API_KEY`, `NOAA_API_KEY`, `SAM_GOV_API_KEY`,
`LINKEDIN_ACCESS_TOKEN`, `GITHUB_TOKEN`, `EVENTBRITE_API_KEY`, `DATAFORSEO_LOGIN/PASSWORD`,
`HIBP_API_KEY`, `CLEARBIT_API_KEY`.

Tier legend: 1=open JSON, 2=open RSS/CSV, 3=Firecrawl scrape, 4=multi-step

Phase A status (this turn): 4 highest-ROI sources per surface shipped + verified.
Phase B–E: remaining 16 per surface across 4 follow-up turns.

---

## 1. Trade Radar (11 verticals)

Phase A (live):
1. USDA Drought Monitor county-detail (T1) → HVAC, foundation
2. USGS Water Services water-level (T1) → foundation, restoration
3. NWS Severe Thunderstorm Watch zones (T1) → gutters, roofing
4. Detroit ArcGIS `bseed_business_licenses` new openings (T1) → commercial HVAC/elec/plumb

Phase B (planned):
5. NOAA Storm Events Database CSV archive
6. National Lightning Detection (Vaisala public) — strike density per ZIP
7. EPA AQS air quality (HVAC filter replacement angle)
8. NWS Excessive Heat advisories — HVAC emergency
9. Detroit Open Data 311 service requests by trade keyword
10. Wayne County tax delinquency rolls — foreclosure-pending homes
11. Oakland Schools facility bid postings (commercial)
12. Macomb County RFP public RSS
13. SEMCOG transportation construction projects
14. MDOT statewide construction bid letting
15. Census ACS housing units by year-built ZIP-level (already partial — extend)
16. HUD CHAS housing condition data
17. EPA UST leaking underground storage tank registry (restoration)
18. Michigan EGLE PFAS sites (restoration/water)
19. NFIP claims monthly download (foundation flood proven)
20. Detroit Land Bank improvement-grant approvals

## 2. Mortgage Radar

Phase A:
1. HUD USPS Vacant Address dataset by ZIP (T1)
2. Census Building Permits Survey (T1)
3. BLS Local Area Unemployment by metro (T1)
4. Realtor.com price-cut RSS by ZIP (T2)

Phase B:
5. FRED 30-yr fixed mortgage rate weekly
6. FHFA HPI quarterly per metro
7. Zillow research data CSVs (rent, ZHVI, ZORI)
8. Redfin Data Center weekly market trackers
9. CFPB HMDA loan applications per census tract
10. CFPB consumer complaints by mortgage company
11. NMLS public registry CSV
12. FDIC bank closure list
13. US Tax Court foreclosure-related opinions
14. PACER bankruptcy Ch.13 filings via CourtListener
15. Wayne County Sheriff foreclosure auction RSS
16. Oakland County Sheriff sales calendar
17. Macomb County Sheriff sales scrape
18. Michigan SOS UCC filings (commercial mortgage)
19. ATTOM-equivalent: Realtor.com sold history scraping
20. Trulia neighborhood crime overlays (refi pressure proxy)

## 3. TechAlert (talent intel)

Phase A:
1. USAJobs public API (T1) — federal trade openings
2. BLS QCEW NAICS hiring trends (T1)
3. ProPublica Nonprofit Explorer Form 990 (T1)
4. SAM.gov entity expansions extended NAICS (T1)

Phase B:
5. H-1B disclosure data DOL OFLC
6. PERM labor certifications DOL
7. WARN Act layoff notices Michigan LARA
8. Indeed Sponsored Jobs RSS (deprecated but partial)
9. SimplyHired RSS
10. ZipRecruiter trial RSS
11. Glassdoor company reviews scrape (Firecrawl)
12. Reddit r/HVAC + r/electricians "hiring" filter
13. Trade union pension-fund 5500 filings (DOL)
14. NLRB representation petitions (full scan beyond petition counts)
15. OSHA accident investigations by NAICS
16. EPA ECHO enforcement (fines = financial pressure)
17. MIOSHA citations by employer
18. Michigan Works! employer events
19. SBA 7(a) loan recipients (growth signal)
20. Ohio/IN/IL/PA WARN Act (regional expansion)

## 4. Demand Radar

Phase A:
1. BidNet Direct RSS (T2)
2. DemandStar bid summaries (T3 scrape)
3. Michigan public bid postings ArcGIS (T1)
4. USAspending.gov contract opportunities (T1)

Phase B:
5. SAM.gov contract opportunities full feed
6. FedBizOpps successor (beta.SAM)
7. GovWin RSS public
8. Ohio buyspeed bid postings
9. Indiana state bid opportunities
10. Illinois CMS bid opportunities
11. Wayne County purchasing solicitations
12. Detroit OCP contract opportunities
13. Oakland County purchasing
14. Macomb County purchasing
15. MDOT bid letting calendar
16. State of Michigan SIGMA VSS public
17. K-12 ISD bid postings (statewide)
18. Federal Grants.gov opportunities
19. NSF SBIR awards
20. SBIR.gov solicitations

## 5. Buyer / Industry Pulse

Phase A:
1. BLS Employment Situation by metro (T1)
2. Census Business Formation Statistics weekly (T1)
3. FRED housing starts + durable goods (T1)
4. LinkedIn company growth via existing token (T1)

Phase B:
5. Census Quarterly Services Survey
6. Census Annual Capital Expenditures
7. ISM Manufacturing PMI release schedule
8. Conference Board LEI release
9. Beige Book Detroit district extracts
10. NFIB Small Business Optimism Index
11. NAHB Housing Market Index
12. ABC Construction Backlog Indicator
13. AGC Construction Inflation Alert
14. AIA Architecture Billings Index
15. Dodge Construction Network public summaries
16. ConstructConnect Insight free reports
17. ENR Top 400 Contractors changes
18. Michigan Manufacturers Association releases
19. Detroit Regional Chamber economic reports
20. Crain's Detroit Business news RSS

## 6. Dead Lead Pool

Phase A:
1. Detroit BSEED contractor registry — license-soon-expiring (T1)
2. Michigan LARA active builder list (T1)
3. BBB accredited members Michigan scrape (T3)
4. Google Places permanently_closed filter (T1)

Phase B:
5. Yelp closed business filter
6. Yellow Pages defunct listing
7. Manta directory delisting checks
8. Better Business Bureau revocations
9. Michigan SOS dissolved LLCs
10. UCC filings termination statements
11. PACER bankruptcy filings (small biz)
12. State of Michigan tax revocations
13. IRS revocations of tax-exempt status
14. Detroit business license expirations
15. Oakland County biz license expirations
16. Macomb County biz license expirations
17. Wayne County biz license expirations
18. Lansing/AA/Flint biz license expirations
19. Defunct domain registrations (DNS NXDOMAIN cohort)
20. Out-of-business signal via Google Maps "permanently closed" sweep

## 7. Counsel Records Search

Phase A:
1. Michigan LARA disciplinary actions RSS (T2)
2. Michigan Attorney Discipline Board orders (T3)
3. US Tax Court opinions (T1)
4. FEC individual contributions (T1)

Phase B:
5. PACER opinion search via CourtListener
6. State of Michigan trial court opinions (MICourts public)
7. Michigan Court of Appeals opinions
8. Michigan Supreme Court opinions
9. 6th Circuit opinions
10. Bankruptcy court ECF (CourtListener)
11. SEC litigation releases
12. DOJ press releases by district
13. State Bar of Michigan member directory (already partial)
14. ABA Disciplinary Action Reporter
15. Westlaw-equivalent: Justia Dockets
16. Law360 RSS
17. Legaltech News
18. ALM Law.com news
19. Michigan Lawyers Weekly
20. Detroit Legal News public

## 8. Channel Prospector (customer targeting)

Phase A:
1. OpenStreetMap Overpass API trade businesses (T1)
2. Wikidata SPARQL Michigan companies (T1)
3. Michigan SOS business entity filings (T3)
4. Detroit Open Business Registry full NAICS (T1)

Phase B:
5. Yelp business search free tier
6. Foursquare Places free tier
7. HERE Places free tier
8. MapQuest Places free tier
9. OpenCage geocoding (no key needed for low volume)
10. Nominatim place search
11. BGP.tools company-domain mapping
12. Crunchbase open profile pages (Firecrawl)
13. AngelList/Wellfound (Firecrawl)
14. LinkedIn company search via existing token
15. Indeed company directory (Firecrawl)
16. Glassdoor company directory (Firecrawl)
17. Manta directory by ZIP
18. Superpages directory by ZIP
19. MerchantCircle directory
20. CitySquares directory

## 9. Email / Owner Waterfall

Phase A:
1. DNS TXT (SPF) record parser (T1)
2. WHOIS registrant email (T1, public for older domains)
3. Schema.org JSON-LD `org:email` parser (T2)
4. Sitemap.xml multi-language contact discovery (T2)

Phase B:
5. CT Logs (Certificate Transparency) for subdomain leaks revealing email infra
6. GitHub commit author emails (per-domain)
7. Common Crawl email harvesting
8. Wayback Machine historical contact pages
9. Bing cache — `email *@<domain>`
10. Google Scholar author profiles
11. ResearchGate profile emails
12. Crossref author emails
13. ORCID profile public emails
14. NPI Registry email field (medical)
15. NPDB practitioner records
16. NSF awards principal investigator
17. NIH awards PI
18. SEC Form ADV brochure emails
19. SEC Edgar filer emails
20. Twitter/X bio scrape via Firecrawl

## 10. SiteRadar Visitor Enrichment

Phase A:
1. IPAPI.co free tier ASN (T1)
2. AbuseIPDB free reputation (T1)
3. DNS reverse PTR lookup (T1)
4. BGP.tools ASN-to-company JSON (T1)

Phase B:
5. RIPEstat data API (free, ASN intel)
6. Hurricane Electric BGP
7. PeeringDB org/asn lookup
8. ARIN whois RDAP
9. Team Cymru IP-to-ASN DNS
10. MaxMind GeoLite2 City (free CSV)
11. Spamhaus DROP list
12. Shodan InternetDB free
13. Censys public certificate search free
14. crt.sh certificate transparency
15. DNS rDNS via Cloudflare 1.1.1.1 DoH
16. iknowwhatyoudownload (anti-bot signal)
17. ipinfo.io free tier (already used, extend fields)
18. iplocation.net free tier
19. ipstack free tier
20. IPGeolocation.io free tier
