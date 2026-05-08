## Goal
Three deliverables in one push:
1. AmeriSteel (Warren, MI) — research → "everything-we-offer" 7-day no-card trial → SMS-ready link for the CEO.
2. Add 50 new sources to the TechAlert / Talent Radar / cross-scanner waterfall — best-in-the-world coverage.
3. Test-scan to repopulate the candidate DB, then auto-blast 250 cold emails with that trial link.

---

## Part 1 — AmeriSteel CEO trial

**What they are (from ameristeel.com):** Warren, MI sheet-metal fabricator + steel service center. Family-owned since 1985, ~30 employees, ISO 9001:2015, two facilities (Warren + Fraser), serves Michigan OEMs. Hires welders, laser/CNC operators, press-brake techs, powder-coat techs, forklift drivers, QC inspectors. B2B website that gets RFQ traffic from manufacturers.

**Best-fit DWA products (this is the "everything they could use" bundle):**
| Product | Why it fits AmeriSteel |
|---|---|
| **TechAlert** | 30-employee MI manufacturer with chronic skilled-trades shortage. Welders, CNC, laser ops, powder-coat — exactly what our scanner already finds. **Anchor product.** |
| **SiteRadar** | B2B site getting RFQs from OEMs. Identifies anonymous buyer companies hitting the quote page. |
| **Missed-Call Catch** | Warehouse + shop-floor environment, calls dropped during production. Each missed call = potentially a $5k+ order. |
| **Buyer Radar / Industry Pulse** | They're a steel supplier — surfaces MI OEMs about to RFQ steel/fab work. |
| **AI Reputation Dashboard** | ISO 9001 supplier; reviews matter for purchasing-team vendor approval. |

(Skipping: FieldDesk, Contractor Leads, Mortgage Radar, Trade Radar verticals — wrong vertical.)

**Implementation:**
1. Extend `start-radar-trial` to accept `products: string[]` (or a sentinel `"bundle:ameristeel"`). Loop the existing per-product provisioning so one call provisions all 5 products under the same email + magic token. One welcome email lists all 5 dashboards behind one login.
2. Generate one trial token for `info@ameristeel.com` (or CEO email if reachable from site/LinkedIn — `find-lo-prospects` / Apollo lookup) and seed `radar_trials` + each product's client table.
3. Output the SMS-ready text + URL in chat:
   - URL: `https://detroitwebagent.com/trial/<token>`
   - SMS draft: "Matt @ Detroit Web Agency — built a 7-day no-card preview of 5 tools your shop could use (hiring intel, anonymous-buyer ID, missed-call recovery). Link's pre-loaded for AmeriSteel: <link>. Kill it anytime."

---

## Part 2 — 50 new sources for the TechAlert / Talent Radar waterfall

Already live (~25): Sonar, GitHub, SEC EDGAR, USPTO, SAM.gov, BLS, Eventbrite, USAspending, LinkedIn, NLRB, OSHA, LARA new/dissolved/expiring, CFPB, Ch.7 liquidations, Detroit certified contractors, Detroit open biz, Demo contractors, Multifamily, City contracts, Billion-Dollar construction.

**50 net-new sources, free or already-keyed, prioritized for hiring/employer-intent signal:**

### Federal / open APIs (16)
1. **DOL Foreign Labor Cert (H-2B)** — employers filing for guest welders/CNC = chronic shortage = TechAlert buyer. Free.
2. **DOL OFLC PERM** — green-card sponsorships for skilled trades. Free.
3. **DOL WHISARD** — wage-hour violations (settlement = HR pain). Free CSV.
4. **EEOC charge data** — discrimination filings (HR weak). Open data.
5. **MSHA mine accidents** — for industrial / pit ops. Free.
6. **NLRB representation cases** — union petitions per employer. Free RSS + JSON.
7. **PBGC pension distress** — employers failing pension plans. Free.
8. **DOT/FMCSA Carrier Census** — adds CDL/driver-shortage employers. Free.
9. **DOL OSHA Establishment Search** — high-hazard industries hiring. Free.
10. **EPA ECHO violations** — environmental violations (turnover/regulatory pressure). Free.
11. **FCC ULS Business** — radio-licensed (HVAC, alarm) operators. Free.
12. **FCC Antenna Structure Reg** — tower owners (hires field techs). Free.
13. **FAA Mechanic Cert (A&P)** — every certified A&P; aviation hiring. Free.
14. **FRA Railroad Accident DB** — railroad hiring proxy. Free.
15. **NTSB Aviation Accident** — operator-level hiring after incidents. Free.
16. **DOE LM Worker Compensation** — federal contractor compensation claims. Free.

### State / local (Michigan + national) (12)
17. **Michigan UIA New Hire Reporting** (aggregate) — net-add employer signal. Free.
18. **Michigan WARN notices** — layoff = competitor weakness, hiring opportunity. Free.
19. **Macomb County business filings ArcGIS** — already in env; new layer. Free.
20. **Wayne County business renewals** — new layer of existing endpoint. Free.
21. **Oakland County master plan permits** (new commercial = future hires). Free.
22. **Detroit Open Permits ArcGIS** (broader filter than current). Free.
23. **Michigan SOS UCC-1 filings** — equipment financing = capacity expansion = hires. Free.
24. **Michigan Court of Claims** — employer lawsuits as turnover proxy. Free.
25. **MIOSHA citation list** — already partially used; full citation feed. Free.
26. **MEDC tax-credit recipients** — state-incentivized growers. Free.
27. **Detroit RFP Pipeline** (new ArcGIS layer). Free.
28. **California BAR / Texas TWC WARN** — out-of-state expansion (matches your "MI or out of state" ask). Free.

### Job-board & talent-pool aggregators (10)
29. **Indeed Job-Posting RSS** per metro/keyword (free RSS, no key).
30. **Glassdoor jobs** scrape via Firecrawl (already keyed).
31. **ZipRecruiter** Firecrawl scrape.
32. **LinkedIn Jobs scrape** (firecrawl, supplements gateway API).
33. **Craigslist jobs** RSS per metro × trade. Free.
34. **Google Jobs SERP via DataForSEO** (already keyed).
35. **Recruit.net** scrape.
36. **CareerBuilder** scrape.
37. **Detroit Free Press jobs** scrape.
38. **Trade-specific boards: HVACagent.com, ElectricianTalk, WeldingJobs.com** — Firecrawl scrape.

### Candidate-side / talent-pool (8)
39. **GitHub commit-search for HVAC/IoT firmware repos** — embedded engineers. Free.
40. **Stack Overflow Jobs archive** — historical talent index.
41. **AngelList/Wellfound startup hiring** — Firecrawl scrape.
42. **Reddit r/HVAC, r/electricians, r/Welding job-posts subreddit** — Reddit JSON, free.
43. **Discord trade servers** (public listings) via webhook scrape.
44. **YouTube creator trade channels** — owners hiring helpers. Free Data API.
45. **NCCER candidate registry** — certified construction craft pros. Public lookup.
46. **NICET certification public lookup** — fire-protection techs. Free.

### Buyer-intent / employer growth signal (4 — feed both TechAlert + Buyer Radar/SiteRadar)
47. **BuiltWith free tier** — companies that just installed Workday/ADP/Gusto = HR build-out = hiring.
48. **DNS-MX / new-domain Whoisxml feed** — newly registered MI corp domains.
49. **Crunchbase free CSV (orgs page)** — newly funded MI/national B2B.
50. **Apollo Saved Searches "company has hired in last 30d"** (already keyed) — direct hiring-velocity ping.

**Implementation:**
- Each source = one async function in `_shared/talent-signals/` modules grouped by category (federal, state, jobboard, candidate, buyer-intent).
- Wire all into `techalert-prospect-hunter` `Promise.all([...])` block.
- Cross-write into `outreach_leads` + `industry_pulse_signals` where relevant so Buyer Radar / Demand Radar also get lift.
- Per CLAUDE.md: every source `try/catch` fail-graceful; never breaks the run. Provenance written to `meta.signal_source`.
- No new secrets needed — all 50 are either fully open or use existing keys (Firecrawl, DataForSEO, Apollo).

---

## Part 3 — Test scans + 250-business cold blast

**Test-scan sequence (right after sources land):**
1. Run `techalert-prospect-hunter` once — confirm new sources fire and `prospects_count` jumps.
2. Run `techalert-enrich` to drain Apollo owner emails on the new prospects.
3. Verify in `DWAAdmin → TechAlert Hub` that `hire_alert_runs` shows source breakdown including the 50 new tags.
4. Spot-check 10 random new prospects for legitimacy (real company, real email, real signal).

**Cold blast 250 — auto-send via existing pipeline:**
1. **Build `techalert-trial-teaser-blast`** edge function:
   - Pulls 250 best prospects from `outreach_leads` where `enriched_at IS NOT NULL` and `owner_email IS NOT NULL`, scored by signal strength, no prior email.
   - For each: generates a personalized 7-day trial magic link (calls `start-radar-trial` server-side per-prospect — so each email lands them in their own pre-provisioned trial dashboard).
   - Sends through `cold-email-bulk-queue` (already deliverability-throttled at 30–50/day).
   - Compliance: hits `outreach-blocklist`, `sms_opt_outs`, `marketing-kill-switch`. CAN-SPAM footer + physical address + one-click unsubscribe via `email-unsubscribe-handler`.
2. **Email template** (TechAlert teaser, DWA-branded):
   - Subject: "{{first_name}}, 3 welders just left {{competitor}} — you'll see it tomorrow"
   - Body: 1-line signal-specific hook (the actual reason they're a prospect) → 1-line offer (7 days, no card, your dashboard already loaded with MI candidates) → CTA button → "{{magic_link}}"
   - Footer: unsubscribe + DWA address.
3. **Send pacing**: 30/day baseline, ramp to 50/day after day 3 if bounce rate <2% — already handled by `cold-email-ramp-scheduler`.
4. **Reply tracking**: replies route to `matt@detroitwebagent.com`; positive replies trigger `tom-autonomous` follow-up.
5. **Admin dashboard tab**: `DWAAdmin → TechAlert Cold Blast` showing daily sends / opens / clicks / trial-claims / replies.

---

## Technical notes (for implementation phase)

- `start-radar-trial` extension: accept `{ products: ["techalert","siteradar","missed_call","industry_pulse","ai_reputation"] }`; loop existing per-product provision branches under one shared token + email.
- New sources file layout: `supabase/functions/_shared/talent-signals/{federal,state,jobboard,candidate,buyer-intent}.ts` — keeps `techalert-prospect-hunter` from ballooning past 2k lines.
- `techalert-trial-teaser-blast` config.toml: `verify_jwt = false`, schedule via pg_cron (daily 10am ET, idempotent batch claim from `outreach_leads`).
- All 50 source try-blocks log into existing `engine-log.ts` so any one source going dark is visible in `ScannerHealth`.
- AmeriSteel CEO email: try Apollo via `apolloOrganizationEnrich({domain:'ameristeel.com'})` first; fall back to `info@ameristeel.com` if no contact found. Surface result in chat before committing send.

---

## Out of scope (call out before approval)
- I will **not** auto-send to AmeriSteel's CEO — only generate the link + SMS draft and hand it to you for the manual text.
- The 250-blast goes out auto-paced, but the **first 10 sends will be queued for your inspection** before the ramp opens — guardrail against a bad subject line nuking domain reputation.
- No new paid API keys requested; if any of the 50 sources turn out to require one in implementation, I'll skip and substitute from a backup list of 10.
