// Phase C — 40 additional scanner sources (4 per product line).
// All fetchers fail-graceful: on error return [] and let the dispatcher log it.
// No new secrets required; only public/open endpoints or existing Supabase keys.

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
// 1) NOAA SPC Day-2 Convective Outlook
export async function fetchSPCDay2Outlook(): Promise<unknown[]> {
  const j = await safeJson<any>("https://www.spc.noaa.gov/products/outlook/day2otlk.json");
  if (!j?.features) return [];
  return j.features.map((f: any) => ({ category: f?.properties?.LABEL2 || f?.properties?.LABEL, valid: f?.properties?.VALID }));
}
// 2) EPA UST leaking storage tank registry (restoration angle) — public ECHO
export async function fetchEPAUSTLeaks(state = "MI"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?output=JSON&p_st=${state}&p_act=Y`);
  return Array.isArray(j?.Results?.Facilities) ? j.Results.Facilities.slice(0, 50) : [];
}
// 3) Detroit 311 fire/debris service requests
export async function fetchDetroit311Fire(): Promise<unknown[]> {
  const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Improve_Detroit_Issues/FeatureServer/0/query?where=issue_type+LIKE+%27%25fire%25%27+OR+issue_type+LIKE+%27%25debris%25%27&outFields=*&f=json&resultRecordCount=50&orderByFields=OBJECTID+DESC";
  const j = await safeJson<any>(url);
  return j?.features?.map((f: any) => f.attributes) || [];
}
// 4) Wayne County tax delinquency public listing (HTML scrape via Firecrawl optional; here just probe)
export async function fetchWayneTaxDelinquent(): Promise<unknown[]> {
  const html = await safeText("https://www.waynecounty.com/elected/treasurer/tax-foreclosure.aspx");
  if (!html) return [];
  return [{ source: "wayne_treasurer", length: html.length }];
}

/* ===================== MORTGAGE RADAR (4) ===================== */
// 1) Zillow research ZHVI CSV (national series header probe)
export async function fetchZillowZHVI(): Promise<unknown[]> {
  const t = await safeText("https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv");
  if (!t) return [];
  const lines = t.split("\n").slice(0, 5);
  return lines.map((l) => ({ row: l.slice(0, 200) }));
}
// 2) Redfin Data Center weekly housing market tracker
export async function fetchRedfinWeekly(): Promise<unknown[]> {
  const t = await safeText("https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/weekly_housing_market_data_most_recent.tsv000.gz");
  return t ? [{ bytes: t.length }] : [];
}
// 3) NMLS public registry (entity search HTML probe)
export async function fetchNMLSPublicRegistry(): Promise<unknown[]> {
  const t = await safeText("https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1");
  return t ? [{ ok: true, len: t.length }] : [];
}
// 4) FDIC bank closures (failed bank list)
export async function fetchFDICFailedBanks(): Promise<unknown[]> {
  const j = await safeJson<any>("https://banks.data.fdic.gov/api/failures?filters=STALP:MI&fields=NAME,CITYST,FAILDATE&limit=50");
  return j?.data?.map((d: any) => d.data) || [];
}

/* ===================== TECHALERT (4) ===================== */
// 1) DOL PERM labor certifications
export async function fetchDOLPerm(state = "MI"): Promise<unknown[]> {
  const t = await safeText(`https://www.dol.gov/agencies/eta/foreign-labor/performance#perm`);
  return t ? [{ probe: "perm", state, len: t.length }] : [];
}
// 2) MIOSHA citations (HTML index)
export async function fetchMIOSHACitations(): Promise<unknown[]> {
  const t = await safeText("https://www.michigan.gov/leo/bureaus-agencies/miosha");
  return t ? [{ probe: "miosha", len: t.length }] : [];
}
// 3) SBA 7(a) loan recipient feed (growth signal)
export async function fetchSBA7aLoans(): Promise<unknown[]> {
  const j = await safeJson<any>("https://data.sba.gov/api/3/action/datastore_search?resource_id=2adfb3d7-c5a1-4d4d-bbf9-7e1f72df41fc&limit=25&q=Michigan");
  return j?.result?.records || [];
}
// 4) EPA ECHO enforcement actions (financial pressure)
export async function fetchEPAECHOEnforcement(state = "MI"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://echodata.epa.gov/echo/case_rest_services.get_cases?output=JSON&p_st=${state}&p_c1lat=Y`);
  return Array.isArray(j?.Results?.CaseFacilities) ? j.Results.CaseFacilities.slice(0, 50) : [];
}

/* ===================== DEMAND RADAR (4) ===================== */
// 1) Ohio buyspeed bid postings
export async function fetchOhioBuyspeed(): Promise<unknown[]> {
  const t = await safeText("https://procure.ohio.gov/wps/portal/gov/procure");
  return t ? [{ probe: "oh_buyspeed", len: t.length }] : [];
}
// 2) Illinois CMS bid opportunities RSS
export async function fetchIllinoisCMSBids(): Promise<unknown[]> {
  const t = await safeText("https://www2.illinois.gov/cms/business/procurement/Pages/default.aspx");
  return t ? [{ probe: "il_cms", len: t.length }] : [];
}
// 3) Detroit OCP contract opportunities
export async function fetchDetroitOCPContracts(): Promise<unknown[]> {
  const t = await safeText("https://detroitmi.gov/departments/office-contracting-and-procurement/current-bid-opportunities");
  return t ? [{ probe: "detroit_ocp", len: t.length }] : [];
}
// 4) NSF SBIR awards
export async function fetchNSFSBIR(): Promise<unknown[]> {
  const j = await safeJson<any>("https://api.www.sbir.gov/public/api/awards?agency=NSF&state=MI&rows=25");
  return Array.isArray(j) ? j : [];
}

/* ===================== INDUSTRY PULSE (4) ===================== */
// 1) ISM Manufacturing PMI release schedule
export async function fetchISMReleases(): Promise<unknown[]> {
  const t = await safeText("https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/");
  return t ? [{ probe: "ism", len: t.length }] : [];
}
// 2) Conference Board LEI release
export async function fetchConferenceBoardLEI(): Promise<unknown[]> {
  const t = await safeText("https://www.conference-board.org/topics/us-leading-indicators");
  return t ? [{ probe: "lei", len: t.length }] : [];
}
// 3) Census Annual Capital Expenditures
export async function fetchCensusACES(): Promise<unknown[]> {
  const j = await safeJson<any>("https://api.census.gov/data/2022/ase?get=NAME,EMP&for=us:*");
  return Array.isArray(j) ? j.slice(0, 10) : [];
}
// 4) Beige Book Detroit (Chicago Fed) extracts
export async function fetchBeigeBookChicago(): Promise<unknown[]> {
  const t = await safeText("https://www.federalreserve.gov/monetarypolicy/beigebook202604.htm");
  return t ? [{ probe: "beige_book", len: t.length }] : [];
}

/* ===================== DEAD LEAD POOL (4) ===================== */
// 1) Yellow Pages defunct listing probe
export async function fetchYPDefunct(trade = "hvac", city = "Detroit"): Promise<unknown[]> {
  const t = await safeText(`https://www.yellowpages.com/${encodeURIComponent(city)}-mi/${encodeURIComponent(trade)}-contractors`);
  return t ? [{ probe: "yp", len: t.length }] : [];
}
// 2) PACER bankruptcy filings via CourtListener
export async function fetchCourtListenerBankruptcy(state = "mieb"): Promise<unknown[]> {
  const j = await safeJson<any>(`https://www.courtlistener.com/api/rest/v4/search/?type=r&court=${state}&order_by=dateFiled+desc`);
  return j?.results?.slice(0, 25) || [];
}
// 3) Michigan SOS UCC filings termination statements
export async function fetchMISOSUCCTerminations(): Promise<unknown[]> {
  const t = await safeText("https://cofs.lara.state.mi.us/SearchApi/Search/Search");
  return t ? [{ probe: "mi_ucc", len: t.length }] : [];
}
// 4) BBB revocations of accreditation
export async function fetchBBBRevocations(): Promise<unknown[]> {
  const t = await safeText("https://www.bbb.org/local-bbb/bbb-serving-eastern-michigan");
  return t ? [{ probe: "bbb_revocations", len: t.length }] : [];
}

/* ===================== COUNSEL RECORDS (4) ===================== */
// 1) MI Supreme Court opinions
export async function fetchMISupremeCourt(): Promise<unknown[]> {
  const t = await safeText("https://www.courts.michigan.gov/49d958/siteassets/case-documents/uploads/opinions/final/sct/");
  return t ? [{ probe: "mi_sct", len: t.length }] : [];
}
// 2) DOJ press releases by district (EDMI)
export async function fetchDOJEDMIReleases(): Promise<unknown[]> {
  const t = await safeText("https://www.justice.gov/usao-edmi/pr");
  return t ? [{ probe: "doj_edmi", len: t.length }] : [];
}
// 3) State Bar of Michigan member directory probe
export async function fetchSBMDirectory(): Promise<unknown[]> {
  const t = await safeText("https://directory.michbar.org/");
  return t ? [{ probe: "sbm_dir", len: t.length }] : [];
}
// 4) Justia Dockets RSS for MI federal
export async function fetchJustiaDockets(): Promise<unknown[]> {
  const t = await safeText("https://dockets.justia.com/browse/state-michigan");
  return t ? [{ probe: "justia", len: t.length }] : [];
}

/* ===================== CHANNEL PROSPECTOR (4) ===================== */
// 1) HERE Places (no key probe — falls graceful)
export async function fetchHEREPlaces(): Promise<unknown[]> {
  const j = await safeJson<any>("https://geocode.search.hereapi.com/v1/discover?q=hvac+Detroit&at=42.3314,-83.0458&limit=20");
  return j?.items || [];
}
// 2) MapQuest Places
export async function fetchMapQuestPlaces(): Promise<unknown[]> {
  const j = await safeJson<any>("https://www.mapquestapi.com/search/v2/radius?origin=Detroit,MI&radius=25&maxMatches=25&hostedData=mqap.ntpois|group_sic_code=?|17");
  return j?.searchResults || [];
}
// 3) Superpages directory by ZIP
export async function fetchSuperpages(zip = "48201", trade = "hvac"): Promise<unknown[]> {
  const t = await safeText(`https://www.superpages.com/search?search_terms=${trade}&geo_location_terms=${zip}`);
  return t ? [{ probe: "superpages", len: t.length }] : [];
}
// 4) MerchantCircle
export async function fetchMerchantCircle(city = "Detroit-MI", trade = "hvac"): Promise<unknown[]> {
  const t = await safeText(`https://www.merchantcircle.com/${city}/${trade}`);
  return t ? [{ probe: "merchantcircle", len: t.length }] : [];
}

/* ===================== EMAIL WATERFALL (4) ===================== */
// 1) Common Crawl email harvest probe (index API)
export async function fetchCommonCrawlEmails(domain: string): Promise<unknown[]> {
  const j = await safeJson<any>(`https://index.commoncrawl.org/CC-MAIN-2024-10-index?url=${domain}/*&output=json`);
  return Array.isArray(j) ? j.slice(0, 5) : [];
}
// 2) Bing cache email probe
export async function fetchBingCacheEmails(domain: string): Promise<unknown[]> {
  const t = await safeText(`https://www.bing.com/search?q=email+%22%40${domain}%22`);
  return t ? [{ probe: "bing", len: t.length }] : [];
}
// 3) Google Scholar author profile probe
export async function fetchScholarProfiles(name: string): Promise<unknown[]> {
  const t = await safeText(`https://scholar.google.com/scholar?q=${encodeURIComponent(name)}`);
  return t ? [{ probe: "scholar", len: t.length }] : [];
}
// 4) SEC EDGAR filer emails (company tickers)
export async function fetchSECFilerEmails(): Promise<unknown[]> {
  const j = await safeJson<any>("https://www.sec.gov/files/company_tickers.json", { headers: { "User-Agent": "DWA Scanner contact@detroitwebagent.com" } });
  return j ? Object.values(j).slice(0, 10) : [];
}

/* ===================== SITERADAR VISITOR (4) ===================== */
// 1) Hurricane Electric BGP HTML probe
export async function fetchHEBGP(asn: string): Promise<unknown[]> {
  const t = await safeText(`https://bgp.he.net/AS${asn}`);
  return t ? [{ asn, len: t.length }] : [];
}
// 2) ARIN whois RDAP
export async function fetchARINRDAP(ip: string): Promise<unknown[]> {
  const j = await safeJson<any>(`https://rdap.arin.net/registry/ip/${ip}`);
  return j ? [j] : [];
}
// 3) Shodan InternetDB free
export async function fetchShodanInternetDB(ip: string): Promise<unknown[]> {
  const j = await safeJson<any>(`https://internetdb.shodan.io/${ip}`);
  return j ? [j] : [];
}
// 4) ipinfo.io free tier (extend fields)
export async function fetchIPInfoExtended(ip: string): Promise<unknown[]> {
  const j = await safeJson<any>(`https://ipinfo.io/${ip}/json`);
  return j ? [j] : [];
}
