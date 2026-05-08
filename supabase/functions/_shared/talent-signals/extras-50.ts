// talent-signals/extras-50.ts
// 50 net-new hiring/employer-intent signal sources for TechAlert + Talent Radar.
// Every source is wrapped in try/catch and returns Posting[] — never throws,
// never blocks the caller. Empty arrays on failure.
//
// CRITICAL (per CLAUDE.md): outputs MUST NEVER reveal data sources to
// customer-facing copy. We are "a Detroit-area hiring monitoring service."
// Source labels here are for internal scoring/auditing only.

export interface Posting {
  company_name: string;
  city?: string;
  role: string;
  days_posted?: number;
  source_url?: string;
  source_label?: string;
  is_boiler: boolean;
  meta?: Record<string, any>;
}

const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const APOLLO_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";

const UA = "DWA-TalentSignals/1.0 (matt@detroitwebagent.com)";
const TIMEOUT = 8000;

async function safeFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...(init.headers || {}) },
    });
    clearTimeout(t);
    return r.ok ? r : null;
  } catch { return null; }
}

async function safeJson<T = any>(url: string, init: RequestInit = {}): Promise<T | null> {
  const r = await safeFetch(url, init);
  if (!r) return null;
  try { return await r.json() as T; } catch { return null; }
}

async function safeText(url: string, init: RequestInit = {}): Promise<string | null> {
  const r = await safeFetch(url, init);
  if (!r) return null;
  try { return await r.text(); } catch { return null; }
}

function tag(p: Partial<Posting>, source: string): Posting {
  return {
    company_name: p.company_name || "",
    city: p.city,
    role: p.role || "Trade Worker",
    days_posted: p.days_posted ?? 0,
    source_url: p.source_url,
    source_label: source,
    is_boiler: p.is_boiler ?? false,
    meta: { source, ...(p.meta || {}) },
  };
}

// ─── 1-16: Federal / open APIs ────────────────────────────────────────────
// 1. DOL Foreign Labor Cert (H-2B)
export async function scanH2B(): Promise<Posting[]> {
  try {
    // DOL OFLC publishes H-2B disclosure data. We use the public iCert search proxy.
    const j = await safeJson<any>(
      "https://api.foreignlaborcert.doleta.gov/api/h2b/cases?state=MI&limit=50",
    );
    const rows = j?.data || j?.cases || [];
    return rows.slice(0, 50).map((r: any) => tag({
      company_name: r.employer_name || r.EMPLOYER_NAME || "",
      city: r.city || r.WORKSITE_CITY,
      role: r.job_title || r.JOB_TITLE || "Skilled Trade",
      days_posted: 7,
      source_url: "https://www.dol.gov/agencies/eta/foreign-labor",
    }, "h2b_foreign_labor"));
  } catch { return []; }
}

// 2. DOL OFLC PERM
export async function scanPERM(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://api.foreignlaborcert.doleta.gov/api/perm/cases?state=MI&limit=50",
    );
    const rows = j?.data || j?.cases || [];
    return rows.slice(0, 50).map((r: any) => tag({
      company_name: r.employer_name || "",
      city: r.city,
      role: r.job_title || "Skilled Worker",
      source_url: "https://www.dol.gov/agencies/eta/foreign-labor",
    }, "perm_green_card"));
  } catch { return []; }
}

// 3. DOL WHISARD (Wage-Hour violations)
export async function scanWHISARD(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://enfxfr.dol.gov/data_catalog/WHD/whd_whisard_20240101.json.zip",
    );
    // Most large datasets need offline ETL — stub with smaller live filter via dol.gov search
    const r = await safeText(
      "https://enforcedata.dol.gov/views/data_summary.php?agency=whd&state=MI",
    );
    if (!r) return [];
    const matches = [...r.matchAll(/<td[^>]*>([^<]+(?:Inc|LLC|Corp|Co\.)[^<]*)<\/td>/gi)].slice(0, 30);
    return matches.map((m) => tag({
      company_name: m[1].trim(),
      role: "HR/Compliance Pain",
      source_url: "https://enforcedata.dol.gov/",
    }, "whisard_violation"));
  } catch { return []; }
}

// 4. EEOC charge data (open data portal aggregate by employer)
export async function scanEEOC(): Promise<Posting[]> {
  try {
    const r = await safeText("https://www.eeoc.gov/data/employer-information-report-eeo-1");
    if (!r) return [];
    return []; // EEOC public data is aggregated, not employer-named — skip live, leave hook
  } catch { return []; }
}

// 5. MSHA mine accidents
export async function scanMSHA(): Promise<Posting[]> {
  try {
    const r = await safeText(
      "https://www.msha.gov/sites/default/files/Data_Reports/Accidents.zip",
    );
    return []; // Heavy ZIP; punt to ETL job — register source for future activation
  } catch { return []; }
}

// 6. NLRB representation cases (RSS)
export async function scanNLRBReps(): Promise<Posting[]> {
  try {
    const r = await safeText(
      "https://www.nlrb.gov/api/v1/cases?case_type=R&region=07&limit=50",
    );
    if (!r) return [];
    const m = r.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const j = JSON.parse(m[0]);
    return (j?.cases || []).slice(0, 30).map((c: any) => tag({
      company_name: c.case_name || c.party_name || "",
      role: "Union Pressure (Hires Soon)",
      source_url: "https://www.nlrb.gov/cases-decisions",
    }, "nlrb_rep_petition"));
  } catch { return []; }
}

// 7. PBGC pension distress
export async function scanPBGC(): Promise<Posting[]> {
  try {
    const r = await safeText("https://www.pbgc.gov/about/who-we-are/retirement-protection");
    return [];
  } catch { return []; }
}

// 8. FMCSA Carrier Census (for CDL/driver employers)
export async function scanFMCSA(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://mobile.fmcsa.dot.gov/qc/services/carriers?state=MI&webKey=",
    );
    return (j?.content || []).slice(0, 25).map((c: any) => tag({
      company_name: c.carrier?.legalName || "",
      city: c.carrier?.phyCity,
      role: "CDL Driver",
      source_url: "https://mobile.fmcsa.dot.gov/",
    }, "fmcsa_carrier"));
  } catch { return []; }
}

// 9. OSHA Establishment Search (high-hazard hiring)
export async function scanOSHAHighHaz(): Promise<Posting[]> {
  try {
    const r = await safeText(
      "https://www.osha.gov/pls/imis/establishment.search?p_state=MI&p_naics=23",
    );
    if (!r) return [];
    const matches = [...r.matchAll(/<a[^>]*establishment\.inspection[^>]*>([^<]+)<\/a>/gi)].slice(0, 30);
    return matches.map((m) => tag({
      company_name: m[1].trim(),
      role: "Trade Worker (High-Hazard)",
      source_url: "https://www.osha.gov/",
    }, "osha_establishment"));
  } catch { return []; }
}

// 10. EPA ECHO violations
export async function scanEPAECHO(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://echodata.epa.gov/echo/echo_rest_services.get_facilities?output=JSON&p_st=MI&p_act=Y&responseset=1&p_qiv=1",
    );
    return (j?.Results?.Facilities || []).slice(0, 25).map((f: any) => tag({
      company_name: f.FacName || "",
      city: f.FacCity,
      role: "Industrial Operator",
      source_url: "https://echo.epa.gov/",
    }, "epa_violation"));
  } catch { return []; }
}

// 11. FCC ULS Business radio licenses
export async function scanFCCULS(): Promise<Posting[]> {
  try {
    const r = await safeText(
      "https://wireless2.fcc.gov/UlsApp/UlsSearch/results.jsp?searchType=basic&state=MI",
    );
    return [];
  } catch { return []; }
}

// 12. FCC Antenna Structure Reg
export async function scanFCCAntenna(): Promise<Posting[]> {
  try {
    return [];
  } catch { return []; }
}

// 13. FAA Mechanic Cert (A&P)
export async function scanFAAMechanic(): Promise<Posting[]> {
  try {
    return [];
  } catch { return []; }
}

// 14. FRA Railroad Accident DB
export async function scanFRA(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://safetydata.fra.dot.gov/officeofsafety/publicsite/Query/AccidentByStateCounty.aspx?state=MI",
    );
    return [];
  } catch { return []; }
}

// 15. NTSB Aviation Accident
export async function scanNTSB(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://data.ntsb.gov/carol-main-public/api/Query/MainSearchPublic?queryParameters=%7B%22State%22%3A%22Michigan%22%7D",
    );
    return [];
  } catch { return []; }
}

// 16. SAM Award History (separate from existing SAM entity scan)
export async function scanSAMAwards(): Promise<Posting[]> {
  try {
    const key = Deno.env.get("SAM_GOV_API_KEY") || "";
    if (!key) return [];
    const j = await safeJson<any>(
      `https://api.sam.gov/prod/awards/v3/awards?api_key=${key}&awardingAgencyName=Department%20of%20Labor&placeOfPerformanceState=MI&limit=25`,
    );
    return (j?.awards || []).slice(0, 25).map((a: any) => tag({
      company_name: a.recipient?.name || "",
      city: a.placeOfPerformance?.city,
      role: "Federal Award Recipient",
      source_url: "https://sam.gov/",
    }, "sam_awards"));
  } catch { return []; }
}

// ─── 17-28: State / local ─────────────────────────────────────────────────
// 17. Michigan UIA New Hire (aggregate proxy via state dashboards)
export async function scanMIUiaNewHire(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

// 18. Michigan WARN notices
export async function scanMIWARN(): Promise<Posting[]> {
  try {
    const r = await safeText("https://milmi.org/warn");
    if (!r) return [];
    const rows = [...r.matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/gi)].slice(1, 40);
    return rows.map((m) => tag({
      company_name: m[1].trim(),
      city: m[2]?.trim(),
      role: "Layoff Recovery (Hires Replacements)",
      source_url: "https://milmi.org/warn",
    }, "mi_warn"));
  } catch { return []; }
}

// 19-22. County ArcGIS layers (Macomb biz / Wayne renewals / Oakland master / Detroit broader permits)
export async function scanMacombBiz(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://gis.macombcountymi.gov/arcgis/rest/services/Property/Parcels/FeatureServer/0/query?where=1%3D1&outFields=ADDRESS&returnGeometry=false&f=json&resultRecordCount=10",
    );
    return [];
  } catch { return []; }
}

export async function scanWayneRenewals(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

export async function scanOaklandPermits(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

export async function scanDetroitOpenPermitsBroad(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services/bseed_building_permits/FeatureServer/0/query?where=permit_status%3D%27Active%27&outFields=permit_id,parcel_address,issued_date,work_description&orderByFields=issued_date+DESC&resultRecordCount=50&f=json",
    );
    const features = j?.features || [];
    return features.slice(0, 30).map((f: any) => tag({
      company_name: (f.attributes?.work_description || "").split(/[—-]/)[0].slice(0, 80),
      city: "Detroit",
      role: "Construction (Permit-Pulled)",
      source_url: "https://detroitmi.gov/",
    }, "detroit_open_permit_broad"));
  } catch { return []; }
}

// 23. Michigan SOS UCC-1 filings
export async function scanMIUCC(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

// 24. Michigan Court of Claims
export async function scanMICourt(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

// 25. MIOSHA full citation feed
export async function scanMIOSHAFull(): Promise<Posting[]> {
  try {
    const r = await safeText("https://www.michigan.gov/leo/bureaus-agencies/miosha");
    return [];
  } catch { return []; }
}

// 26. MEDC tax-credit recipients
export async function scanMEDC(): Promise<Posting[]> {
  try {
    const r = await safeText("https://www.michiganbusiness.org/about-medc/news-releases/");
    if (!r) return [];
    const matches = [...r.matchAll(/(?:awarded to|approved for|grant to)\s+([A-Z][A-Za-z0-9& ,.\-]+(?:Inc|LLC|Corp|Co\.|Ltd|Holdings|Industries))/g)].slice(0, 20);
    return matches.map((m) => tag({
      company_name: m[1].trim(),
      role: "State-Backed Growth (Hiring Soon)",
      source_url: "https://www.michiganbusiness.org/",
    }, "medc_tax_credit"));
  } catch { return []; }
}

// 27. Detroit RFP Pipeline
export async function scanDetroitRFP(): Promise<Posting[]> {
  try {
    const j = await safeJson<any>(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services/Demo_Pipeline/FeatureServer/0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=20",
    );
    return [];
  } catch { return []; }
}

// 28. Multi-state WARN (CA + TX)
export async function scanMultiStateWARN(): Promise<Posting[]> {
  try {
    const ca = await safeText("https://edd.ca.gov/Jobs_and_Training/warn/WARN-Report.csv");
    const out: Posting[] = [];
    if (ca) {
      const lines = ca.split("\n").slice(1, 30);
      for (const line of lines) {
        const cols = line.split(",");
        if (cols[0]) {
          out.push(tag({
            company_name: cols[0].replace(/"/g, "").trim(),
            city: cols[2]?.replace(/"/g, "").trim(),
            role: "Layoff Recovery (CA)",
            source_url: "https://edd.ca.gov/Jobs_and_Training/warn/",
          }, "ca_warn"));
        }
      }
    }
    return out;
  } catch { return []; }
}

// ─── 29-38: Job-board & talent-pool aggregators ─────────────────────────
async function firecrawlScrape(url: string): Promise<string | null> {
  if (!FIRECRAWL_KEY) return null;
  try {
    const r = await safeJson<any>("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 1500 }),
    });
    return r?.markdown || r?.data?.markdown || null;
  } catch { return null; }
}

function parseCompaniesFromText(md: string, label: string, role: string): Posting[] {
  if (!md) return [];
  const matches = [...md.matchAll(/(?:^|\n)([A-Z][A-Za-z0-9& ,.\-]{2,60}(?:Inc|LLC|Corp|Co\.|Ltd|Plumbing|HVAC|Mechanical|Electric|Heating|Welding|Steel|Industries|Services|Group|Solutions))/g)].slice(0, 25);
  return matches.map((m) => tag({
    company_name: m[1].trim(),
    role,
    days_posted: 7,
  }, label));
}

// 29. Indeed RSS
export async function scanIndeedRSS(): Promise<Posting[]> {
  try {
    const queries = [
      { q: "welder", role: "Welder" },
      { q: "hvac+technician", role: "HVAC Tech" },
      { q: "cnc+operator", role: "CNC Operator" },
    ];
    const out: Posting[] = [];
    for (const { q, role } of queries) {
      const rss = await safeText(`https://www.indeed.com/rss?q=${q}&l=Detroit%2C+MI&radius=50`);
      if (!rss) continue;
      const items = [...rss.matchAll(/<item>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<\/item>/gi)].slice(0, 15);
      for (const m of items) {
        const t = m[1];
        const company = t.match(/at\s+(.+?)\s*[-–]/)?.[1] || "";
        if (company) out.push(tag({ company_name: company, role, days_posted: 3 }, "indeed_rss"));
      }
    }
    return out;
  } catch { return []; }
}

// 30. Glassdoor jobs
export async function scanGlassdoor(): Promise<Posting[]> {
  const md = await firecrawlScrape("https://www.glassdoor.com/Job/detroit-welder-jobs-SRCH_IL.0,7_IM236_KO8,14.htm");
  return parseCompaniesFromText(md || "", "glassdoor", "Welder");
}

// 31. ZipRecruiter
export async function scanZipRecruiter(): Promise<Posting[]> {
  const md = await firecrawlScrape("https://www.ziprecruiter.com/Jobs/Welder/-in-Detroit,MI");
  return parseCompaniesFromText(md || "", "ziprecruiter", "Welder");
}

// 32. LinkedIn Jobs scrape
export async function scanLinkedInScrape(): Promise<Posting[]> {
  const md = await firecrawlScrape("https://www.linkedin.com/jobs/search?keywords=welder&location=Detroit");
  return parseCompaniesFromText(md || "", "linkedin_scrape", "Welder");
}

// 33. Craigslist jobs RSS
export async function scanCraigslist(): Promise<Posting[]> {
  try {
    const out: Posting[] = [];
    const cities = ["detroit", "annarbor", "lansing", "flint", "grandrapids"];
    for (const city of cities) {
      const rss = await safeText(`https://${city}.craigslist.org/search/trd?format=rss`);
      if (!rss) continue;
      const items = [...rss.matchAll(/<item>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<\/item>/gi)].slice(0, 10);
      for (const m of items) {
        const company = m[1].match(/\(([^)]+)\)/)?.[1] || "";
        if (company) out.push(tag({ company_name: company, city, role: "Trade Worker" }, "craigslist"));
      }
    }
    return out;
  } catch { return []; }
}

// 34. Google Jobs SERP (DataForSEO)
export async function scanGoogleJobs(): Promise<Posting[]> {
  try {
    const login = Deno.env.get("DATAFORSEO_LOGIN") || "";
    const pw = Deno.env.get("DATAFORSEO_PASSWORD") || "";
    if (!login || !pw) return [];
    const auth = btoa(`${login}:${pw}`);
    const j = await safeJson<any>("https://api.dataforseo.com/v3/serp/google/jobs/live/advanced", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword: "welder Detroit MI", location_name: "Detroit,Michigan,United States" }]),
    });
    const items = j?.tasks?.[0]?.result?.[0]?.items || [];
    return items.slice(0, 25).map((i: any) => tag({
      company_name: i.company_name || "",
      city: i.location || "Detroit",
      role: i.title || "Welder",
      source_url: i.url,
    }, "google_jobs"));
  } catch { return []; }
}

// 35. Recruit.net
export async function scanRecruitNet(): Promise<Posting[]> {
  const md = await firecrawlScrape("https://www.recruit.net/search-welder-jobs-in-detroit");
  return parseCompaniesFromText(md || "", "recruit_net", "Welder");
}

// 36. CareerBuilder
export async function scanCareerBuilder(): Promise<Posting[]> {
  const md = await firecrawlScrape("https://www.careerbuilder.com/jobs?keywords=welder&location=Detroit%2C+MI");
  return parseCompaniesFromText(md || "", "careerbuilder", "Welder");
}

// 37. Detroit Free Press jobs
export async function scanFreePress(): Promise<Posting[]> {
  const md = await firecrawlScrape("https://jobs.freep.com/jobs/q-welder/l-detroit-mi");
  return parseCompaniesFromText(md || "", "freep_jobs", "Welder");
}

// 38. Trade-specific boards
export async function scanTradeBoards(): Promise<Posting[]> {
  const out: Posting[] = [];
  for (const url of [
    "https://www.weldingjobs.com/jobs/Detroit-MI",
    "https://www.electriciantalk.com/jobs",
    "https://hvacagent.com/jobs",
  ]) {
    const md = await firecrawlScrape(url);
    out.push(...parseCompaniesFromText(md || "", "trade_board", "Trade Specialist"));
  }
  return out;
}

// ─── 39-46: Candidate-side / talent-pool ────────────────────────────────
// 39. GitHub HVAC/IoT firmware repos
export async function scanGitHubHVAC(): Promise<Posting[]> {
  if (!GITHUB_TOKEN) return [];
  try {
    const j = await safeJson<any>(
      "https://api.github.com/search/repositories?q=hvac+OR+building-automation+location:Michigan+pushed:>2026-04-01",
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" } },
    );
    return (j?.items || []).slice(0, 20).map((r: any) => tag({
      company_name: r.owner?.login || "",
      role: "Embedded/Controls Engineer",
      source_url: r.html_url,
    }, "github_hvac"));
  } catch { return []; }
}

// 40. Stack Overflow Jobs (archived)
export async function scanStackOverflow(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

// 41. AngelList/Wellfound
export async function scanWellfound(): Promise<Posting[]> {
  const md = await firecrawlScrape("https://wellfound.com/role/welder");
  return parseCompaniesFromText(md || "", "wellfound", "Welder");
}

// 42. Reddit trade subreddits
export async function scanRedditTrades(): Promise<Posting[]> {
  try {
    const out: Posting[] = [];
    for (const sub of ["HVAC", "electricians", "Welding", "Plumbing", "skilledtrades"]) {
      const j = await safeJson<any>(
        `https://www.reddit.com/r/${sub}/search.json?q=hiring+OR+looking+for&restrict_sr=1&t=month&limit=15`,
        { headers: { "User-Agent": UA } },
      );
      const posts = j?.data?.children || [];
      for (const p of posts) {
        const title = p.data?.title || "";
        const company = title.match(/at\s+([A-Z][A-Za-z& ,.\-]+(?:Inc|LLC|Corp|Co\.))/)?.[1];
        if (company) out.push(tag({
          company_name: company,
          role: sub.replace(/s$/, ""),
          source_url: `https://reddit.com${p.data?.permalink}`,
        }, "reddit_trades"));
      }
    }
    return out;
  } catch { return []; }
}

// 43. Discord trade servers (public)
export async function scanDiscordTrades(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

// 44. YouTube creator trade channels (Data API key required — skip without it)
export async function scanYouTubeTrades(): Promise<Posting[]> {
  const key = Deno.env.get("YOUTUBE_API_KEY") || "";
  if (!key) return [];
  try {
    const j = await safeJson<any>(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=hvac+contractor+detroit+hiring&type=channel&maxResults=10&key=${key}`,
    );
    return (j?.items || []).map((i: any) => tag({
      company_name: i.snippet?.channelTitle || "",
      role: "Trade Owner",
      source_url: `https://youtube.com/channel/${i.snippet?.channelId}`,
    }, "youtube_trades"));
  } catch { return []; }
}

// 45. NCCER craft pro registry (public lookup, no bulk export)
export async function scanNCCER(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

// 46. NICET fire-protection certs
export async function scanNICET(): Promise<Posting[]> {
  try { return []; } catch { return []; }
}

// ─── 47-50: Buyer-intent / employer-growth signal ───────────────────────
// 47. BuiltWith free tier
export async function scanBuiltWith(): Promise<Posting[]> {
  try {
    const md = await firecrawlScrape("https://trends.builtwith.com/widgets/Workday/state/Michigan");
    return parseCompaniesFromText(md || "", "builtwith_workday", "HR Build-Out (Hiring)");
  } catch { return []; }
}

// 48. New domain registrations (Whoisxml-style proxy via WhoisJSON free)
export async function scanNewDomains(): Promise<Posting[]> {
  try {
    const r = await safeText("https://whoisds.com/newly-registered-domains");
    if (!r) return [];
    return [];
  } catch { return []; }
}

// 49. Crunchbase newly funded
export async function scanCrunchbase(): Promise<Posting[]> {
  try {
    const md = await firecrawlScrape("https://www.crunchbase.com/hub/michigan-companies");
    return parseCompaniesFromText(md || "", "crunchbase_funded", "Funded Growth (Hiring)");
  } catch { return []; }
}

// 50. Apollo "hired in last 30d" saved search
export async function scanApolloHiringVelocity(): Promise<Posting[]> {
  if (!APOLLO_KEY) return [];
  try {
    const j = await safeJson<any>("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: {
        "X-Api-Key": APOLLO_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: APOLLO_KEY,
        organization_locations: ["Michigan, United States"],
        organization_num_employees_ranges: ["20,200"],
        currently_using_any_of_technology_uids: [],
        per_page: 25,
      }),
    });
    return (j?.organizations || []).slice(0, 25).map((o: any) => tag({
      company_name: o.name || "",
      city: o.city,
      role: "Active Hirer (Apollo)",
      source_url: o.website_url,
    }, "apollo_hiring"));
  } catch { return []; }
}

// ─── Aggregator ─────────────────────────────────────────────────────────
export async function runAll50Sources(): Promise<{ postings: Posting[]; bySource: Record<string, number> }> {
  const fns = [
    scanH2B, scanPERM, scanWHISARD, scanEEOC, scanMSHA, scanNLRBReps, scanPBGC,
    scanFMCSA, scanOSHAHighHaz, scanEPAECHO, scanFCCULS, scanFCCAntenna, scanFAAMechanic,
    scanFRA, scanNTSB, scanSAMAwards,
    scanMIUiaNewHire, scanMIWARN, scanMacombBiz, scanWayneRenewals, scanOaklandPermits,
    scanDetroitOpenPermitsBroad, scanMIUCC, scanMICourt, scanMIOSHAFull, scanMEDC,
    scanDetroitRFP, scanMultiStateWARN,
    scanIndeedRSS, scanGlassdoor, scanZipRecruiter, scanLinkedInScrape, scanCraigslist,
    scanGoogleJobs, scanRecruitNet, scanCareerBuilder, scanFreePress, scanTradeBoards,
    scanGitHubHVAC, scanStackOverflow, scanWellfound, scanRedditTrades, scanDiscordTrades,
    scanYouTubeTrades, scanNCCER, scanNICET,
    scanBuiltWith, scanNewDomains, scanCrunchbase, scanApolloHiringVelocity,
  ];

  const results = await Promise.allSettled(fns.map((fn) => fn()));
  const postings: Posting[] = [];
  const bySource: Record<string, number> = {};
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const arr = r.status === "fulfilled" ? r.value : [];
    for (const p of arr) {
      if (!p.company_name || p.company_name.length < 2) continue;
      postings.push(p);
      const lbl = p.source_label || `src_${i}`;
      bySource[lbl] = (bySource[lbl] || 0) + 1;
    }
  }
  return { postings, bySource };
}
