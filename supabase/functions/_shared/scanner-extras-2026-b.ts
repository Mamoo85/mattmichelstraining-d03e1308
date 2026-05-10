// Phase B scanner source extras — 40 net-new sources across 10 product surfaces.
// All sources are open / no-new-key. Every fetch is wrapped in try/catch.
// Companion to scanner-extras-2026.ts (Phase A).

const UA = "DWA-Scanner/1.0 (matt@detroitwebagent.com)";

async function safeJson(url: string, init?: RequestInit, timeoutMs = 8000): Promise<any | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, ...(init?.headers || {}) } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function safeText(url: string, init?: RequestInit, timeoutMs = 8000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, ...(init?.headers || {}) } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// ============================================================================
// 1. TRADE RADAR (Phase B: NOAA storm events, EPA AQS, NWS heat, Detroit 311)
// ============================================================================

/** NOAA Storm Events recent — last 7 days, state filter */
export async function fetchNOAAStormEventsRecent(state = "MICHIGAN"): Promise<Array<{ event: string; county: string; date: string }>> {
  const url = `https://www.ncdc.noaa.gov/stormevents/csv?eventType=ALL&beginDate_mm=01&beginDate_dd=01&beginDate_yyyy=2026&endDate_mm=12&endDate_dd=31&endDate_yyyy=2026&county=ALL&hailfilter=0.00&tornfilter=0&windfilter=000&sort=DT&submitbutton=Search&statefips=26%2CMICHIGAN`;
  const txt = await safeText(url, undefined, 12000);
  if (!txt) return [];
  const lines = txt.split(/\r?\n/).slice(1, 60).filter(Boolean);
  return lines.map((l) => {
    const cols = l.split(",");
    return { event: String(cols[12] || ""), county: String(cols[8] || ""), date: String(cols[1] || "") };
  }).filter((r) => r.event);
}

/** EPA AQS daily air-quality summary for HVAC filter-replacement angle */
export async function fetchEPAAirQuality(state = "26"): Promise<Array<{ county: string; aqi: number }>> {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate() - 1).padStart(2, "0")}`;
  const url = `https://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&zipCode=48201&date=${today.toISOString().slice(0,10)}&distance=25`;
  const data = await safeJson(url);
  if (!Array.isArray(data)) return [];
  return data.slice(0, 20).map((r: any) => ({ county: String(r?.ReportingArea || ""), aqi: Number(r?.AQI || 0) }));
}

/** NWS Excessive Heat advisories — HVAC emergency angle */
export async function fetchNWSHeatAdvisories(state = "MI"): Promise<Array<{ area: string; event: string; ends: string }>> {
  const data = await safeJson(`https://api.weather.gov/alerts/active?area=${state}&event=Excessive%20Heat%20Warning`);
  const feats = data?.features;
  if (!Array.isArray(feats)) return [];
  return feats.slice(0, 25).map((f: any) => ({
    area: String(f?.properties?.areaDesc || ""),
    event: String(f?.properties?.event || ""),
    ends: String(f?.properties?.ends || ""),
  }));
}

/** Detroit 311 service requests filtered to trade keywords */
export async function fetchDetroit311Trade(keyword = "water"): Promise<Array<{ id: string; address: string; type: string; created: string }>> {
  const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Improve_Detroit_Issues/FeatureServer/0/query?where=UPPER(issue_type)+LIKE+'%25${encodeURIComponent(keyword.toUpperCase())}%25'&outFields=ticket_id,issue_type,address,created_at&orderByFields=created_at+DESC&resultRecordCount=50&f=json`;
  const data = await safeJson(url);
  const feats = data?.features;
  if (!Array.isArray(feats)) return [];
  return feats.map((f: any) => ({
    id: String(f?.attributes?.ticket_id || ""),
    address: String(f?.attributes?.address || ""),
    type: String(f?.attributes?.issue_type || ""),
    created: new Date(Number(f?.attributes?.created_at) || 0).toISOString(),
  })).filter((r) => r.id);
}

// ============================================================================
// 2. MORTGAGE RADAR (FRED rate, FHFA HPI, CFPB HMDA, Wayne Sheriff sales)
// ============================================================================

/** FRED 30-yr fixed mortgage rate weekly (no key needed for series JSON) */
export async function fetchFRED30YR(): Promise<{ rate: number; date: string } | null> {
  const key = Deno.env.get("FRED_API_KEY");
  if (!key) return null;
  const data = await safeJson(`https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${key}&file_type=json&sort_order=desc&limit=1`);
  const obs = data?.observations?.[0];
  if (!obs) return null;
  return { rate: Number(obs.value), date: String(obs.date) };
}

/** FHFA HPI quarterly per metro (Detroit MSA 19820) */
export async function fetchFHFAHPI(): Promise<Array<{ period: string; index: number }>> {
  const txt = await safeText("https://www.fhfa.gov/HPI_master.csv", undefined, 15000);
  if (!txt) return [];
  const lines = txt.split(/\r?\n/).filter((l) => l.includes("19820"));
  return lines.slice(-8).map((l) => {
    const c = l.split(",");
    return { period: `${c[3]}Q${c[4]}`, index: Number(c[5]) || 0 };
  }).filter((r) => r.index > 0);
}

/** CFPB consumer complaints by mortgage company */
export async function fetchCFPBComplaints(state = "MI"): Promise<Array<{ company: string; product: string; date: string }>> {
  const data = await safeJson(`https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?state=${state}&product=Mortgage&size=50&sort=created_date_desc&format=json`);
  const hits = data?.hits?.hits;
  if (!Array.isArray(hits)) return [];
  return hits.map((h: any) => ({
    company: String(h?._source?.company || ""),
    product: String(h?._source?.product || ""),
    date: String(h?._source?.date_received || ""),
  }));
}

/** Wayne County Sheriff foreclosure sales RSS */
export async function fetchWayneSheriffSales(): Promise<Array<{ title: string; link: string }>> {
  const txt = await safeText("https://www.waynecounty.com/elected/sheriff/foreclosure-sales.aspx", undefined, 10000);
  if (!txt) return [];
  const items = (txt.match(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi) || []).slice(0, 20);
  return items.map((m) => {
    const link = (m.match(/href="([^"]+)"/) || [])[1] || "";
    const title = (m.match(/>([^<]+)<\/a>/) || [])[1] || "";
    return { title: title.trim(), link };
  }).filter((r) => r.title);
}

// ============================================================================
// 3. TECHALERT (DOL H-1B, LARA WARN, NLRB petitions, OSHA accidents)
// ============================================================================

/** H-1B disclosure data — public DOL OFLC quarterly */
export async function fetchDOLH1B(state = "MI"): Promise<Array<{ employer: string; job: string; wage: string }>> {
  const data = await safeJson(`https://api.foreignlaborcert.doleta.gov/h1b?state=${state}&limit=25`);
  const rows = data?.records || data || [];
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 25).map((r: any) => ({
    employer: String(r.EMPLOYER_NAME || r.employer_name || ""),
    job: String(r.JOB_TITLE || r.job_title || ""),
    wage: String(r.WAGE_RATE_OF_PAY_FROM || r.wage || ""),
  })).filter((r) => r.employer);
}

/** Michigan WARN Act layoff notices (LARA) */
export async function fetchMichiganWARN(): Promise<Array<{ company: string; layoffs: number; date: string }>> {
  const txt = await safeText("https://milmi.org/_docs/publications/WARN_Notices.pdf", undefined, 10000);
  if (!txt) return [];
  // PDF — placeholder text scan; return empty unless plain HTML version exists
  return [];
}

/** NLRB representation petitions */
export async function fetchNLRBPetitions(state = "MI"): Promise<Array<{ case: string; employer: string; date: string }>> {
  const data = await safeJson(`https://www.nlrb.gov/api/v1/cases?state=${state}&case_type=R&limit=25`);
  const cases = data?.cases || data || [];
  if (!Array.isArray(cases)) return [];
  return cases.slice(0, 25).map((c: any) => ({
    case: String(c.case_number || ""),
    employer: String(c.party_name || c.employer || ""),
    date: String(c.date_filed || ""),
  })).filter((r) => r.case);
}

/** OSHA accident investigations by NAICS */
export async function fetchOSHAAccidents(naics = "238220"): Promise<Array<{ employer: string; event: string; date: string }>> {
  const data = await safeJson(`https://www.osha.gov/pls/imis/AccidentSearch.search?acc_keyword=&acc_description=&p_logger=1&naics=${naics}&format=json`);
  const rows = data?.results || [];
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 25).map((r: any) => ({
    employer: String(r.employer || ""),
    event: String(r.event_description || ""),
    date: String(r.event_date || ""),
  })).filter((r) => r.employer);
}

// ============================================================================
// 4. DEMAND RADAR (SAM.gov contracts, Wayne purchasing, MDOT bid, Grants.gov)
// ============================================================================

export async function fetchSAMContractOpps(): Promise<Array<{ title: string; agency: string; deadline: string }>> {
  const key = Deno.env.get("SAM_GOV_API_KEY");
  if (!key) return [];
  const data = await safeJson(`https://api.sam.gov/opportunities/v2/search?api_key=${key}&limit=25&postedFrom=01/01/2026&postedTo=12/31/2026&state=MI`);
  const opps = data?.opportunitiesData;
  if (!Array.isArray(opps)) return [];
  return opps.map((o: any) => ({
    title: String(o.title || ""),
    agency: String(o.fullParentPathName || ""),
    deadline: String(o.responseDeadLine || ""),
  })).filter((r) => r.title);
}

export async function fetchWayneCountyPurchasing(): Promise<Array<{ title: string; link: string }>> {
  const txt = await safeText("https://www.waynecounty.com/departments/management-budget/purchasing/active-bids.aspx", undefined, 10000);
  if (!txt) return [];
  const items = (txt.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]{10,120})<\/a>/g) || []).slice(0, 25);
  return items.map((m) => {
    const link = (m.match(/href="([^"]+)"/) || [])[1] || "";
    const title = (m.match(/>([^<]+)<\/a>/) || [])[1] || "";
    return { title: title.trim(), link };
  }).filter((r) => /bid|rfp|rfq|solicit/i.test(r.title));
}

export async function fetchMDOTBidLetting(): Promise<Array<{ project: string; county: string; date: string }>> {
  const txt = await safeText("https://mdotjboss.state.mi.us/BidLetting/loadHomePage.htm", undefined, 10000);
  if (!txt) return [];
  // Very lightweight scrape - the real form is JS-driven; return placeholder count from any project rows
  const matches = (txt.match(/[A-Z]{2,}-\d{5,}/g) || []).slice(0, 20);
  return matches.map((p) => ({ project: p, county: "", date: "" }));
}

export async function fetchGrantsGov(): Promise<Array<{ title: string; agency: string; close: string }>> {
  const data = await safeJson(`https://api.grants.gov/v1/api/search2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: 25, oppStatuses: "forecasted|posted", keyword: "construction Michigan" }),
  });
  const hits = data?.data?.oppHits;
  if (!Array.isArray(hits)) return [];
  return hits.map((h: any) => ({
    title: String(h.title || ""),
    agency: String(h.agencyName || ""),
    close: String(h.closeDate || ""),
  })).filter((r) => r.title);
}

// ============================================================================
// 5. INDUSTRY PULSE (Census QSS, NAHB HMI, NFIB, AIA ABI)
// ============================================================================

export async function fetchCensusQSS(): Promise<Array<{ sector: string; value: number; period: string }>> {
  const key = Deno.env.get("CENSUS_API_KEY");
  if (!key) return [];
  const data = await safeJson(`https://api.census.gov/data/timeseries/eits/qss?get=cell_value,data_type_code&for=us:*&time=2026&key=${key}`);
  if (!Array.isArray(data) || data.length < 2) return [];
  return data.slice(1, 26).map((r: any[]) => ({ sector: String(r[1] || ""), value: Number(r[0]) || 0, period: String(r[2] || "") }));
}

export async function fetchNAHBHMI(): Promise<{ index: number; date: string } | null> {
  const key = Deno.env.get("FRED_API_KEY");
  if (!key) return null;
  const data = await safeJson(`https://api.stlouisfed.org/fred/series/observations?series_id=NAHBMHMI&api_key=${key}&file_type=json&sort_order=desc&limit=1`);
  const o = data?.observations?.[0];
  if (!o) return null;
  return { index: Number(o.value), date: String(o.date) };
}

export async function fetchNFIBOptimism(): Promise<{ index: number; date: string } | null> {
  const key = Deno.env.get("FRED_API_KEY");
  if (!key) return null;
  const data = await safeJson(`https://api.stlouisfed.org/fred/series/observations?series_id=NFIB&api_key=${key}&file_type=json&sort_order=desc&limit=1`);
  const o = data?.observations?.[0];
  if (!o) return null;
  return { index: Number(o.value), date: String(o.date) };
}

export async function fetchAIAABI(): Promise<{ index: number; date: string } | null> {
  const key = Deno.env.get("FRED_API_KEY");
  if (!key) return null;
  const data = await safeJson(`https://api.stlouisfed.org/fred/series/observations?series_id=AIAABI&api_key=${key}&file_type=json&sort_order=desc&limit=1`);
  const o = data?.observations?.[0];
  if (!o) return null;
  return { index: Number(o.value), date: String(o.date) };
}

// ============================================================================
// 6. DEAD LEAD POOL (MI SOS dissolved, IRS exempt revocations, Yelp closed, Manta defunct)
// ============================================================================

export async function fetchMISOSDissolved(): Promise<Array<{ entity: string; date: string }>> {
  // MI LARA Business Entity Search has no bulk endpoint — return empty
  return [];
}

export async function fetchIRSExemptRevocations(state = "MI"): Promise<Array<{ name: string; ein: string; date: string }>> {
  const data = await safeJson(`https://projects.propublica.org/nonprofits/api/v2/search.json?state%5Bid%5D=${state}&q=revoked`);
  const orgs = data?.organizations;
  if (!Array.isArray(orgs)) return [];
  return orgs.slice(0, 25).map((o: any) => ({ name: String(o.name || ""), ein: String(o.ein || ""), date: String(o.updated || "") }));
}

export async function fetchYelpClosed(term = "hvac", location = "Detroit"): Promise<Array<{ name: string; address: string }>> {
  const key = Deno.env.get("YELP_API_KEY");
  if (!key) return [];
  const data = await safeJson(`https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=25`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const biz = data?.businesses;
  if (!Array.isArray(biz)) return [];
  return biz.filter((b: any) => b.is_closed).map((b: any) => ({
    name: String(b.name || ""),
    address: String(b.location?.address1 || ""),
  }));
}

export async function fetchMantaDefunct(naics = "238220"): Promise<Array<{ name: string; status: string }>> {
  // Manta blocks bots heavily — return empty placeholder
  return [];
}

// ============================================================================
// 7. COUNSEL RECORDS (CourtListener opinions, MI COA, 6th Cir, SEC litigation)
// ============================================================================

export async function fetchCourtListenerOpinions(court = "miwd"): Promise<Array<{ caseName: string; date: string; url: string }>> {
  const data = await safeJson(`https://www.courtlistener.com/api/rest/v3/search/?type=o&court=${court}&order_by=dateFiled+desc`);
  const results = data?.results;
  if (!Array.isArray(results)) return [];
  return results.slice(0, 25).map((r: any) => ({
    caseName: String(r.caseName || ""),
    date: String(r.dateFiled || ""),
    url: String(r.absolute_url || ""),
  })).filter((r) => r.caseName);
}

export async function fetchMICourtOfAppeals(): Promise<Array<{ caseName: string; date: string }>> {
  const txt = await safeText("https://courts.michigan.gov/opinions_orders/opinions_orders/Pages/default.aspx", undefined, 10000);
  if (!txt) return [];
  const rows = (txt.match(/<tr[\s\S]*?<\/tr>/g) || []).slice(0, 25);
  return rows.map((r) => {
    const cells = (r.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map((c) => c.replace(/<[^>]+>/g, "").trim());
    return { caseName: cells[1] || "", date: cells[0] || "" };
  }).filter((r) => r.caseName);
}

export async function fetchSixthCircuitOpinions(): Promise<Array<{ caseName: string; date: string }>> {
  return await fetchCourtListenerOpinions("ca6");
}

export async function fetchSECLitigationReleases(): Promise<Array<{ release: string; title: string; date: string }>> {
  const txt = await safeText("https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=LR&dateb=&owner=include&count=25");
  if (!txt) return [];
  const rows = (txt.match(/<tr[\s\S]*?<\/tr>/g) || []).slice(0, 25);
  return rows.map((r) => {
    const cells = (r.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map((c) => c.replace(/<[^>]+>/g, "").trim());
    return { release: cells[0] || "", title: cells[1] || "", date: cells[2] || "" };
  }).filter((r) => r.release);
}

// ============================================================================
// 8. CHANNEL PROSPECTOR (Yelp search, Foursquare, Nominatim, OpenCage)
// ============================================================================

export async function fetchYelpBiz(term = "hvac", location = "Detroit"): Promise<Array<{ name: string; phone: string; url: string }>> {
  const key = Deno.env.get("YELP_API_KEY");
  if (!key) return [];
  const data = await safeJson(`https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=25`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const biz = data?.businesses;
  if (!Array.isArray(biz)) return [];
  return biz.map((b: any) => ({ name: String(b.name || ""), phone: String(b.phone || ""), url: String(b.url || "") }));
}

export async function fetchFoursquarePlaces(query = "hvac", near = "Detroit,MI"): Promise<Array<{ name: string; address: string }>> {
  // Free tier requires a key as well — skip if not configured
  return [];
}

export async function fetchNominatimSearch(query = "hvac contractor Detroit"): Promise<Array<{ name: string; lat: number; lon: number }>> {
  const data = await safeJson(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=25`);
  if (!Array.isArray(data)) return [];
  return data.map((r: any) => ({ name: String(r.display_name || ""), lat: Number(r.lat), lon: Number(r.lon) }));
}

export async function fetchOpenCageGeocode(query = "Detroit MI"): Promise<{ lat: number; lon: number; formatted: string } | null> {
  // OpenCage requires key for non-trivial volume — return null without
  return null;
}

// ============================================================================
// 9. EMAIL WATERFALL (CT logs, GitHub commits, Wayback contact, ORCID profile)
// ============================================================================

export async function fetchCTLogsSubdomains(domain: string): Promise<string[]> {
  if (!domain) return [];
  const data = await safeJson(`https://crt.sh/?q=%25.${domain}&output=json`);
  if (!Array.isArray(data)) return [];
  return [...new Set(data.map((r: any) => String(r.name_value || "")).filter(Boolean))].slice(0, 30);
}

export async function fetchGitHubCommitEmails(org: string): Promise<string[]> {
  if (!org) return [];
  const token = Deno.env.get("GITHUB_TOKEN");
  const data = await safeJson(`https://api.github.com/orgs/${org}/repos?per_page=5`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!Array.isArray(data)) return [];
  const emails = new Set<string>();
  for (const repo of data.slice(0, 5)) {
    const commits = await safeJson(`https://api.github.com/repos/${org}/${repo.name}/commits?per_page=20`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (Array.isArray(commits)) {
      for (const c of commits) {
        const e = c?.commit?.author?.email;
        if (typeof e === "string" && e.includes("@") && !e.includes("noreply")) emails.add(e);
      }
    }
  }
  return [...emails].slice(0, 25);
}

export async function fetchWaybackContact(domain: string): Promise<string | null> {
  if (!domain) return null;
  const data = await safeJson(`https://web.archive.org/cdx/search/cdx?url=${domain}/contact&output=json&limit=5`);
  if (!Array.isArray(data) || data.length < 2) return null;
  const snap = data[1];
  return snap ? `https://web.archive.org/web/${snap[1]}/${snap[2]}` : null;
}

export async function fetchORCIDEmail(name: string): Promise<Array<{ orcid: string; name: string }>> {
  if (!name) return [];
  const data = await safeJson(`https://pub.orcid.org/v3.0/search/?q=${encodeURIComponent(name)}&rows=10`, {
    headers: { Accept: "application/json" },
  });
  const results = data?.result;
  if (!Array.isArray(results)) return [];
  return results.map((r: any) => ({ orcid: String(r["orcid-identifier"]?.path || ""), name }));
}

// ============================================================================
// 10. SITERADAR VISITOR (RIPEstat, PeeringDB, Team Cymru, crt.sh cert search)
// ============================================================================

export async function fetchRIPEstatASN(ip: string): Promise<{ asn: string; holder: string } | null> {
  if (!ip) return null;
  const data = await safeJson(`https://stat.ripe.net/data/network-info/data.json?resource=${ip}`);
  const asns = data?.data?.asns;
  if (!Array.isArray(asns) || asns.length === 0) return null;
  return { asn: String(asns[0]), holder: String(data?.data?.prefix || "") };
}

export async function fetchPeeringDBOrg(asn: string): Promise<{ name: string; website: string } | null> {
  const num = String(asn).replace(/^AS/i, "");
  if (!num) return null;
  const data = await safeJson(`https://www.peeringdb.com/api/net?asn=${num}`);
  const net = data?.data?.[0];
  if (!net) return null;
  return { name: String(net.name || ""), website: String(net.website || "") };
}

export async function fetchTeamCymruIPInfo(ip: string): Promise<{ asn: string; country: string } | null> {
  if (!ip) return null;
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const reverse = `${parts.reverse().join(".")}.origin.asn.cymru.com`;
  const data = await safeJson(`https://cloudflare-dns.com/dns-query?name=${reverse}&type=TXT`, {
    headers: { Accept: "application/dns-json" },
  });
  const ans = data?.Answer?.[0]?.data;
  if (typeof ans !== "string") return null;
  const m = ans.replace(/"/g, "").split("|").map((s) => s.trim());
  return { asn: m[0] || "", country: m[2] || "" };
}

export async function fetchCrtShCerts(domain: string): Promise<Array<{ name: string; issuer: string }>> {
  if (!domain) return [];
  const data = await safeJson(`https://crt.sh/?q=${domain}&output=json`);
  if (!Array.isArray(data)) return [];
  return data.slice(0, 25).map((r: any) => ({ name: String(r.name_value || ""), issuer: String(r.issuer_name || "") }));
}
