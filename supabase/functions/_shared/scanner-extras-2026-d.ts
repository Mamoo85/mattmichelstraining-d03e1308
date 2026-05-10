// Phase D — 40 additional scanner sources (4 per product line).
// Fail-graceful: every fetcher returns [] on error; dispatcher logs counts.
// No new secrets; public endpoints, RSS feeds, or HTML probes only.

async function safeFetch(url: string, init?: RequestInit, timeoutMs = 15000): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return r;
  } catch { return null; }
}
async function safeJson<T = any>(url: string, init?: RequestInit): Promise<T | null> {
  const r = await safeFetch(url, init);
  if (!r) return null;
  try { return await r.json() as T; } catch { return null; }
}
async function safeText(url: string, init?: RequestInit): Promise<string | null> {
  const r = await safeFetch(url, init);
  if (!r) return null;
  try { return await r.text(); } catch { return null; }
}

/* ===================== TRADE RADAR (4) ===================== */
export async function fetchNFIPClaimsMI(): Promise<unknown[]> {
  const j = await safeJson<any>(
    "https://www.fema.gov/api/open/v2/FimaNfipClaims?$filter=state%20eq%20%27MI%27&$top=50&$orderby=dateOfLoss%20desc"
  );
  return j?.FimaNfipClaims || [];
}
export async function fetchSEMCOGConstruction(): Promise<unknown[]> {
  const t = await safeText("https://semcog.org/transportation-improvement-program");
  return t ? [{ source: "semcog_tip", len: t.length }] : [];
}
export async function fetchMichiganEGLEPFAS(): Promise<unknown[]> {
  const j = await safeJson<any>(
    "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/PFASSites/FeatureServer/0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=50"
  );
  return j?.features?.map((f: any) => f.attributes) || [];
}
export async function fetchOaklandSchoolsBids(): Promise<unknown[]> {
  const t = await safeText("https://www.oakland.k12.mi.us/Page/3030");
  return t ? [{ source: "oakland_schools_bids", len: t.length }] : [];
}

/* ===================== MORTGAGE RADAR (4) ===================== */
export async function fetchOaklandSheriffSales(): Promise<unknown[]> {
  const t = await safeText("https://www.oakgov.com/sheriff/divisions/civil/Pages/foreclosure-sales.aspx");
  return t ? [{ source: "oakland_sheriff", len: t.length }] : [];
}
export async function fetchMacombSheriffSales(): Promise<unknown[]> {
  const t = await safeText("https://sheriff.macombgov.org/Sheriff-Divisions-CivilProcess-MortgageForeclosures");
  return t ? [{ source: "macomb_sheriff", len: t.length }] : [];
}
export async function fetchMISOSUCCFilings(): Promise<unknown[]> {
  const t = await safeText("https://www.michigan.gov/sos/business-services/ucc");
  return t ? [{ source: "mi_sos_ucc", len: t.length }] : [];
}
export async function fetchCFPBHMDA(): Promise<unknown[]> {
  const j = await safeJson<any>(
    "https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?years=2022&states=MI&actions_taken=1"
  );
  return j?.aggregations?.slice(0, 50) || (Array.isArray(j) ? j.slice(0, 50) : []);
}

/* ===================== TECHALERT (4) ===================== */
export async function fetchIndeedRSS(query = "hvac+technician+Detroit"): Promise<unknown[]> {
  const t = await safeText(`https://www.indeed.com/rss?q=${query}&l=Michigan`);
  if (!t) return [];
  const items = t.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, 50).map((x) => ({ raw: x.slice(0, 240) }));
}
export async function fetchSimplyHiredRSS(query = "electrician"): Promise<unknown[]> {
  const t = await safeText(`https://www.simplyhired.com/search?q=${query}&l=Michigan&rss=1`);
  return t ? [{ probe: "simplyhired", len: t.length }] : [];
}
export async function fetchGlassdoorReviewsProbe(company = "DTE-Energy"): Promise<unknown[]> {
  const t = await safeText(`https://www.glassdoor.com/Reviews/${company}-Reviews-E12345.htm`);
  return t ? [{ probe: "glassdoor", company, len: t.length }] : [];
}
export async function fetchRedditHiring(sub = "HVAC"): Promise<unknown[]> {
  const j = await safeJson<any>(
    `https://www.reddit.com/r/${sub}/search.json?q=hiring&restrict_sr=on&sort=new&limit=25`,
    { headers: { "User-Agent": "scanner-extras/1.0" } }
  );
  return j?.data?.children?.map((c: any) => c?.data?.title) || [];
}

/* ===================== DEMAND RADAR (4) ===================== */
export async function fetchOaklandCountyPurchasing(): Promise<unknown[]> {
  const t = await safeText("https://www.oakgov.com/purchasing/Pages/bid-opportunities.aspx");
  return t ? [{ source: "oakland_purchasing", len: t.length }] : [];
}
export async function fetchMacombCountyPurchasing(): Promise<unknown[]> {
  const t = await safeText("https://purchasing.macombgov.org/Purchasing-Bids");
  return t ? [{ source: "macomb_purchasing", len: t.length }] : [];
}
export async function fetchMISIGMAVSS(): Promise<unknown[]> {
  const t = await safeText("https://sigma.michigan.gov/webapp/PRDVSS2X1/AltSelfService");
  return t ? [{ source: "mi_sigma_vss", len: t.length }] : [];
}
export async function fetchK12ISDBids(): Promise<unknown[]> {
  const t = await safeText("https://www.gomaisd.org/about/business-services/bid-opportunities");
  return t ? [{ source: "k12_isd_bids", len: t.length }] : [];
}

/* ===================== INDUSTRY PULSE (4) ===================== */
export async function fetchABCBacklog(): Promise<unknown[]> {
  const t = await safeText("https://abc.org/News-Media/Construction-Economics");
  return t ? [{ source: "abc_backlog", len: t.length }] : [];
}
export async function fetchAGCInflation(): Promise<unknown[]> {
  const t = await safeText("https://www.agc.org/learn/construction-data/agc-construction-inflation-alert");
  return t ? [{ source: "agc_inflation", len: t.length }] : [];
}
export async function fetchNAHBReleases(): Promise<unknown[]> {
  const t = await safeText("https://www.nahb.org/news-and-economics/press-releases");
  return t ? [{ source: "nahb_releases", len: t.length }] : [];
}
export async function fetchENRTop400(): Promise<unknown[]> {
  const t = await safeText("https://www.enr.com/toplists/2024-Top-400-Contractors-Preview");
  return t ? [{ source: "enr_top400", len: t.length }] : [];
}

/* ===================== DEAD LEAD POOL (4) ===================== */
export async function fetchMacombBizExpirations(): Promise<unknown[]> {
  const t = await safeText("https://www.macombgov.org/clerk/business-registrations");
  return t ? [{ source: "macomb_biz_exp", len: t.length }] : [];
}
export async function fetchOaklandBizExpirations(): Promise<unknown[]> {
  const t = await safeText("https://www.oakgov.com/clerk/Pages/business.aspx");
  return t ? [{ source: "oakland_biz_exp", len: t.length }] : [];
}
export async function fetchLansingBizExpirations(): Promise<unknown[]> {
  const t = await safeText("https://www.lansingmi.gov/350/Business-Licenses");
  return t ? [{ source: "lansing_biz_exp", len: t.length }] : [];
}
export async function fetchDefunctDomains(domains: string[] = ["detroitwebagent.com"]): Promise<unknown[]> {
  const results: any[] = [];
  for (const d of domains.slice(0, 10)) {
    const j = await safeJson<any>(`https://dns.google/resolve?name=${d}&type=A`);
    results.push({ domain: d, status: j?.Status, nx: j?.Status === 3 });
  }
  return results;
}

/* ===================== COUNSEL RECORDS (4) ===================== */
export async function fetchABADisciplinary(): Promise<unknown[]> {
  const t = await safeText("https://www.americanbar.org/groups/professional_responsibility/services/databank/");
  return t ? [{ source: "aba_disciplinary", len: t.length }] : [];
}
export async function fetchLaw360RSS(): Promise<unknown[]> {
  const t = await safeText("https://www.law360.com/rss");
  if (!t) return [];
  const items = t.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, 50).map((x) => ({ raw: x.slice(0, 240) }));
}
export async function fetchLegaltechNewsRSS(): Promise<unknown[]> {
  const t = await safeText("https://www.law.com/legaltechnews/rss/");
  if (!t) return [];
  const items = t.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, 50).map((x) => ({ raw: x.slice(0, 240) }));
}
export async function fetchMichiganLawyersWeekly(): Promise<unknown[]> {
  const t = await safeText("https://milawyersweekly.com/feed/");
  if (!t) return [];
  const items = t.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, 50).map((x) => ({ raw: x.slice(0, 240) }));
}

/* ===================== CHANNEL PROSPECTOR (4) ===================== */
export async function fetchMantaDirectory(zip = "48201"): Promise<unknown[]> {
  const t = await safeText(`https://www.manta.com/search?search_source=business&search=hvac&search_what=geo&pt=${zip}`);
  return t ? [{ source: "manta_dir", zip, len: t.length }] : [];
}
export async function fetchCitySquares(city = "Detroit-MI", cat = "hvac"): Promise<unknown[]> {
  const t = await safeText(`https://www.citysquares.com/b/${city}/${cat}`);
  return t ? [{ source: "citysquares", city, cat, len: t.length }] : [];
}
export async function fetchBGPToolsCompany(domain = "detroitwebagent.com"): Promise<unknown[]> {
  const t = await safeText(`https://bgp.tools/dns/${domain}`);
  return t ? [{ source: "bgp_tools_dns", domain, len: t.length }] : [];
}
export async function fetchCrunchbaseProfile(slug = "detroit-web-agency"): Promise<unknown[]> {
  const t = await safeText(`https://www.crunchbase.com/organization/${slug}`);
  return t ? [{ source: "crunchbase", slug, len: t.length }] : [];
}

/* ===================== EMAIL WATERFALL (4) ===================== */
export async function fetchResearchGate(name = "Matt Michels"): Promise<unknown[]> {
  const t = await safeText(`https://www.researchgate.net/search/researcher?q=${encodeURIComponent(name)}`);
  return t ? [{ probe: "researchgate", name, len: t.length }] : [];
}
export async function fetchCrossrefAuthors(query = "construction"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://api.crossref.org/works?query.author=${query}&rows=20`);
  return j?.message?.items?.map((i: any) => ({ title: i?.title?.[0], doi: i?.DOI })) || [];
}
export async function fetchNPIRegistry(state = "MI"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://npiregistry.cms.hhs.gov/api/?version=2.1&state=${state}&limit=25`);
  return j?.results?.slice(0, 25) || [];
}
export async function fetchNSFAwardsPI(query = "construction"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://api.nsf.gov/services/v1/awards.json?keyword=${query}&rpp=25`);
  return j?.response?.award || [];
}

/* ===================== SITERADAR VISITOR (4) ===================== */
export async function fetchCensysCerts(domain = "detroitwebagent.com"): Promise<unknown[]> {
  const t = await safeText(`https://search.censys.io/certificates?q=${domain}`);
  return t ? [{ probe: "censys", domain, len: t.length }] : [];
}
export async function fetchCloudflareDoHPTR(ip = "8.8.8.8"): Promise<unknown[]> {
  const reversed = ip.split(".").reverse().join(".") + ".in-addr.arpa";
  const j = await safeJson<any>(`https://cloudflare-dns.com/dns-query?name=${reversed}&type=PTR`, {
    headers: { Accept: "application/dns-json" },
  });
  return j?.Answer || [];
}
export async function fetchIPStack(ip = "8.8.8.8"): Promise<unknown[]> {
  // Free tier requires key; probe public endpoint shape only.
  const j = await safeJson<any>(`http://ip-api.com/json/${ip}`);
  return j ? [j] : [];
}
export async function fetchIPGeolocationFree(ip = "8.8.8.8"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://ipwho.is/${ip}`);
  return j ? [j] : [];
}
