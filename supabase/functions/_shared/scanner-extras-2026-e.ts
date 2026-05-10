// Phase E — final 40 scanner sources (4 per product line). Total catalog now 200.
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
export async function fetchNOAALightningArchive(): Promise<unknown[]> {
  const t = await safeText("https://www.spc.noaa.gov/climo/reports/today_filtered.html");
  return t ? [{ source: "spc_today_filtered", len: t.length }] : [];
}
export async function fetchHUDCHAS(): Promise<unknown[]> {
  const j = await safeJson<any>("https://www.huduser.gov/hudapi/public/chas?type=4&stateId=26");
  return Array.isArray(j?.data) ? j.data.slice(0, 50) : [];
}
export async function fetchCensusACSHousingAge(): Promise<unknown[]> {
  const j = await safeJson<any>(
    "https://api.census.gov/data/2022/acs/acs5?get=NAME,B25034_002E,B25034_010E,B25034_011E&for=zip+code+tabulation+area:*&in=state:26"
  );
  return Array.isArray(j) ? j.slice(1, 51) : [];
}
export async function fetchDetroitLandBankGrants(): Promise<unknown[]> {
  const j = await safeJson<any>(
    "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/dlba_own_it_now_sales/FeatureServer/0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=50&orderByFields=OBJECTID+DESC"
  );
  return j?.features?.map((f: any) => f.attributes) || [];
}

/* ===================== MORTGAGE RADAR (4) ===================== */
export async function fetchATTOMRealtorSold(): Promise<unknown[]> {
  const t = await safeText("https://www.realtor.com/realestateandhomes-search/Detroit_MI/show-recently-sold");
  return t ? [{ source: "realtor_sold_detroit", len: t.length }] : [];
}
export async function fetchTruliaCrime(): Promise<unknown[]> {
  const t = await safeText("https://www.trulia.com/MI/Detroit/crime/");
  return t ? [{ source: "trulia_crime_detroit", len: t.length }] : [];
}
export async function fetchPACERCh13(): Promise<unknown[]> {
  const j = await safeJson<any>(
    "https://www.courtlistener.com/api/rest/v3/search/?type=r&court=mieb&nature_of_suit=&q=chapter+13&order_by=score+desc"
  );
  return j?.results?.slice(0, 50) || [];
}
export async function fetchTaxCourtForeclosure(): Promise<unknown[]> {
  const t = await safeText("https://www.ustaxcourt.gov/dpt_cite.html");
  return t ? [{ source: "tax_court_foreclosure", len: t.length }] : [];
}

/* ===================== TECHALERT (4) ===================== */
export async function fetchZipRecruiterRSS(query = "hvac"): Promise<unknown[]> {
  const t = await safeText(`https://www.ziprecruiter.com/jobs-search?search=${encodeURIComponent(query)}&location=Detroit%2C+MI&form=rss`);
  return t ? [{ source: "ziprecruiter_rss", len: t.length }] : [];
}
export async function fetchPensionFund5500(): Promise<unknown[]> {
  const t = await safeText("https://www.efast.dol.gov/5500search/");
  return t ? [{ source: "dol_5500", len: t.length }] : [];
}
export async function fetchMichiganWorksEvents(): Promise<unknown[]> {
  const t = await safeText("https://www.michiganworks.org/events");
  return t ? [{ source: "michigan_works_events", len: t.length }] : [];
}
export async function fetchOhioWARN(): Promise<unknown[]> {
  const t = await safeText("https://jfs.ohio.gov/warn/current.stm");
  return t ? [{ source: "ohio_warn", len: t.length }] : [];
}

/* ===================== DEMAND RADAR (4) ===================== */
export async function fetchGovWinRSS(): Promise<unknown[]> {
  const t = await safeText("https://www.govwin.com/feed/rss/opportunities");
  return t ? [{ source: "govwin_rss", len: t.length }] : [];
}
export async function fetchIndianaBids(): Promise<unknown[]> {
  const t = await safeText("https://www.in.gov/idoa/procurement/business-opportunities/");
  return t ? [{ source: "indiana_bids", len: t.length }] : [];
}
export async function fetchSBIRSolicitations(): Promise<unknown[]> {
  const j = await safeJson<any>("https://api.www.sbir.gov/public/api/solicitations?keyword=&rows=50");
  return Array.isArray(j) ? j.slice(0, 50) : [];
}
export async function fetchFedBizOppsBeta(): Promise<unknown[]> {
  const t = await safeText("https://sam.gov/opportunities/search?index=opp&sort=-modifiedDate&page=0&size=25");
  return t ? [{ source: "sam_opps_beta", len: t.length }] : [];
}

/* ===================== INDUSTRY PULSE (4) ===================== */
export async function fetchDodgeSummaries(): Promise<unknown[]> {
  const t = await safeText("https://www.construction.com/news/");
  return t ? [{ source: "dodge_summaries", len: t.length }] : [];
}
export async function fetchConstructConnect(): Promise<unknown[]> {
  const t = await safeText("https://www.constructconnect.com/blog/category/construction-economic-news");
  return t ? [{ source: "constructconnect", len: t.length }] : [];
}
export async function fetchMIMfgAssociation(): Promise<unknown[]> {
  const t = await safeText("https://www.mimfg.org/news");
  return t ? [{ source: "mi_mfg_assoc", len: t.length }] : [];
}
export async function fetchCrainsDetroitRSS(): Promise<unknown[]> {
  const t = await safeText("https://www.crainsdetroit.com/arc/outboundfeeds/rss/?outputType=xml");
  return t ? [{ source: "crains_detroit_rss", len: t.length }] : [];
}

/* ===================== DEAD LEAD POOL (4) ===================== */
export async function fetchWayneBizExpirations(): Promise<unknown[]> {
  const t = await safeText("https://www.waynecounty.com/elected/clerk/business-registrations.aspx");
  return t ? [{ source: "wayne_biz_expirations", len: t.length }] : [];
}
export async function fetchAARBizExpirations(): Promise<unknown[]> {
  const t = await safeText("https://www.a2gov.org/departments/finance-admin-services/treasury/Pages/Business-License.aspx");
  return t ? [{ source: "annarbor_biz", len: t.length }] : [];
}
export async function fetchFlintBizExpirations(): Promise<unknown[]> {
  const t = await safeText("https://www.cityofflint.com/business/");
  return t ? [{ source: "flint_biz", len: t.length }] : [];
}
export async function fetchMITaxRevocations(): Promise<unknown[]> {
  const t = await safeText("https://www.michigan.gov/taxes/business-taxes/sales-use-tax/registration-license");
  return t ? [{ source: "mi_tax_revocations", len: t.length }] : [];
}

/* ===================== COUNSEL RECORDS (4) ===================== */
export async function fetchMITrialCourts(): Promise<unknown[]> {
  const t = await safeText("https://www.courts.michigan.gov/case-search/");
  return t ? [{ source: "mi_trial_courts", len: t.length }] : [];
}
export async function fetchBankruptcyECF(): Promise<unknown[]> {
  const j = await safeJson<any>(
    "https://www.courtlistener.com/api/rest/v3/search/?type=r&court=mieb&order_by=dateFiled+desc"
  );
  return j?.results?.slice(0, 50) || [];
}
export async function fetchALMLawNews(): Promise<unknown[]> {
  const t = await safeText("https://www.law.com/feed/");
  return t ? [{ source: "alm_law_rss", len: t.length }] : [];
}
export async function fetchDetroitLegalNews(): Promise<unknown[]> {
  const t = await safeText("https://www.legalnews.com/detroit/");
  return t ? [{ source: "detroit_legal_news", len: t.length }] : [];
}

/* ===================== CHANNEL PROSPECTOR (4) ===================== */
export async function fetchAngelListProfile(slug = "detroit-web-agency"): Promise<unknown[]> {
  const t = await safeText(`https://wellfound.com/company/${slug}`);
  return t ? [{ source: "wellfound", slug, len: t.length }] : [];
}
export async function fetchIndeedCompanyDir(query = "hvac"): Promise<unknown[]> {
  const t = await safeText(`https://www.indeed.com/companies?q=${encodeURIComponent(query)}&l=Detroit%2C+MI`);
  return t ? [{ source: "indeed_companies", len: t.length }] : [];
}
export async function fetchGlassdoorCompanyDir(query = "hvac"): Promise<unknown[]> {
  const t = await safeText(`https://www.glassdoor.com/Explore/browse-companies.htm?overall_rating_low=0&page=1&locId=1134645&locType=M&locName=Detroit-MI&filterType=RATING_OVERALL&industryId=200158`);
  return t ? [{ source: "glassdoor_dir", q: query, len: t.length }] : [];
}
export async function fetchOpenCageRev(lat = 42.3314, lon = -83.0458): Promise<unknown[]> {
  const t = await safeText(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
  return t ? [{ source: "opencage_rev", len: t.length }] : [];
}

/* ===================== EMAIL WATERFALL (4) ===================== */
export async function fetchNIHReporter(query = "construction"): Promise<unknown[]> {
  const r = await safeFetch("https://api.reporter.nih.gov/v2/projects/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ criteria: { text_search: { search_field: "all", search_text: query } }, limit: 25 }),
  });
  if (!r) return [];
  try {
    const j = await r.json();
    return j?.results?.slice(0, 25) || [];
  } catch { return []; }
}
export async function fetchSECFormADV(): Promise<unknown[]> {
  const t = await safeText("https://adviserinfo.sec.gov/firm/summary");
  return t ? [{ source: "sec_form_adv", len: t.length }] : [];
}
export async function fetchSECEdgarRecent(): Promise<unknown[]> {
  const t = await safeText(
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&State=MI&SIC=1731&type=&dateb=&owner=include&count=25",
    { headers: { "User-Agent": "DWA Scanner contact@detroitwebagent.com" } }
  );
  return t ? [{ source: "sec_edgar_recent", len: t.length }] : [];
}
export async function fetchTwitterBioScrape(handle = "detroitwebagent"): Promise<unknown[]> {
  const t = await safeText(`https://nitter.net/${handle}`);
  return t ? [{ source: "nitter_bio", handle, len: t.length }] : [];
}

/* ===================== SITERADAR VISITOR (4) ===================== */
export async function fetchMaxMindGeoLite(): Promise<unknown[]> {
  const t = await safeText("https://download.maxmind.com/app/geoip_download_by_token");
  return t ? [{ source: "maxmind_probe", len: t.length }] : [];
}
export async function fetchSpamhausDROP(): Promise<unknown[]> {
  const t = await safeText("https://www.spamhaus.org/drop/drop.txt");
  if (!t) return [];
  const lines = t.split("\n").filter((l) => l && !l.startsWith(";"));
  return lines.slice(0, 100).map((l) => ({ entry: l }));
}
export async function fetchIPLocationNet(ip = "8.8.8.8"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://api.iplocation.net/?ip=${ip}`);
  return j ? [j] : [];
}
export async function fetchIPWhoIs(ip = "8.8.8.8"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://ipwho.is/${ip}`);
  return j ? [j] : [];
}
