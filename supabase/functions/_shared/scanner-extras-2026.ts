// Phase A scanner source extras — 40 net-new sources across 10 product surfaces.
// All sources are open / no-new-key. Every fetch is wrapped in try/catch and fails
// gracefully (returns []) so a single dead source never breaks a scanner run.
//
// See knowledge/scanner-source-catalog-2026.md for the full 200-source plan.

const UA = "DWA-Scanner/1.0 (matt@detroitwebagent.com)";

async function safeJson(url: string, init?: RequestInit, timeoutMs = 8000): Promise<any | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { "User-Agent": UA, ...(init?.headers || {}) },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function safeText(url: string, init?: RequestInit, timeoutMs = 8000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { "User-Agent": UA, ...(init?.headers || {}) },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ============================================================================
// 1. TRADE RADAR — 4 new area/per-address sources
// ============================================================================

/** USDA Drought Monitor county-level (D1+) — area signal for HVAC + foundation */
export async function fetchDroughtMonitorCounties(state = "MI"): Promise<Array<{
  fips: string; county: string; level: number;
}>> {
  const url = `https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=${state === "MI" ? "26" : "00"}&startdate=1/1/2026&enddate=12/31/2026&statisticsType=1`;
  const data = await safeJson(url);
  if (!Array.isArray(data)) return [];
  return data
    .filter((r: any) => Number(r?.D1 || 0) > 25)
    .slice(0, 50)
    .map((r: any) => ({
      fips: String(r.FIPS || ""),
      county: String(r.County || ""),
      level: Number(r.D2 || 0) > 10 ? 2 : 1,
    }));
}

/** USGS Water Services — recent flood-stage water-level alerts by state */
export async function fetchUSGSWaterAlerts(state = "MI"): Promise<Array<{
  site: string; stage: string; lat: number; lon: number;
}>> {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=${state.toLowerCase()}&parameterCd=00065&siteStatus=active`;
  const data = await safeJson(url);
  const ts = data?.value?.timeSeries;
  if (!Array.isArray(ts)) return [];
  return ts.slice(0, 25).map((t: any) => ({
    site: String(t?.sourceInfo?.siteName || ""),
    stage: String(t?.values?.[0]?.value?.[0]?.value || ""),
    lat: Number(t?.sourceInfo?.geoLocation?.geogLocation?.latitude || 0),
    lon: Number(t?.sourceInfo?.geoLocation?.geogLocation?.longitude || 0),
  })).filter((r) => r.site && Number(r.stage) > 0);
}

/** NWS Severe Thunderstorm Watch zones — gutters/roofing area lead */
export async function fetchNWSSevereThunderWatches(state = "MI"): Promise<Array<{
  area: string; severity: string; effective: string;
}>> {
  const url = `https://api.weather.gov/alerts/active?area=${state}&event=Severe+Thunderstorm+Watch`;
  const data = await safeJson(url);
  const feats = data?.features;
  if (!Array.isArray(feats)) return [];
  return feats.slice(0, 20).map((f: any) => ({
    area: String(f?.properties?.areaDesc || ""),
    severity: String(f?.properties?.severity || ""),
    effective: String(f?.properties?.effective || ""),
  }));
}

/** Detroit ArcGIS — newly issued business licenses (commercial trade leads) */
export async function fetchDetroitNewBusinessLicenses(): Promise<Array<{
  business_name: string; address: string; license_type: string; issued: string;
}>> {
  const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_business_licenses/FeatureServer/0/query?where=1%3D1&outFields=*&orderByFields=issued_date+DESC&resultRecordCount=100&f=json";
  const data = await safeJson(url);
  const feats = data?.features;
  if (!Array.isArray(feats)) return [];
  const cutoff = Date.now() - 60 * 24 * 3600 * 1000;
  return feats
    .filter((f: any) => Number(f?.attributes?.issued_date || 0) > cutoff)
    .slice(0, 50)
    .map((f: any) => ({
      business_name: String(f?.attributes?.business_name || ""),
      address: String(f?.attributes?.address || ""),
      license_type: String(f?.attributes?.license_type || ""),
      issued: new Date(Number(f?.attributes?.issued_date || 0)).toISOString().slice(0, 10),
    }));
}

// ============================================================================
// 2. MORTGAGE RADAR — 4 new sources
// ============================================================================

/** HUD USPS Vacant Address dataset — high-vacancy ZIPs (refi/foreclosure pressure) */
export async function fetchHUDVacancyByZip(zips: string[] = []): Promise<Array<{
  zip: string; vacant_pct: number;
}>> {
  // HUD publishes quarterly aggregate; using public CSV summary endpoint.
  const url = "https://www.huduser.gov/portal/datasets/usps/USPS_ZIP_2025Q4.csv";
  const txt = await safeText(url, undefined, 15000);
  if (!txt) return [];
  const out: Array<{ zip: string; vacant_pct: number }> = [];
  for (const line of txt.split(/\r?\n/).slice(1)) {
    const cols = line.split(",");
    const zip = cols[0]?.replace(/"/g, "").trim();
    const totRes = Number(cols[2] || 0);
    const vacRes = Number(cols[3] || 0);
    if (!zip || !totRes) continue;
    if (zips.length && !zips.includes(zip)) continue;
    const pct = (vacRes / totRes) * 100;
    if (pct > 5) out.push({ zip, vacant_pct: Math.round(pct * 10) / 10 });
    if (out.length >= 100) break;
  }
  return out;
}

/** Census Building Permits Survey — new construction velocity by metro */
export async function fetchCensusBuildingPermits(stateFips = "26"): Promise<Array<{
  county: string; permits: number; period: string;
}>> {
  const yr = new Date().getFullYear();
  const url = `https://api.census.gov/data/timeseries/eits/resconst?get=cell_value,data_type_code&for=us:*&time=from+${yr - 1}`;
  const data = await safeJson(url);
  if (!Array.isArray(data) || data.length < 2) return [];
  return data.slice(1, 10).map((r: any) => ({
    county: stateFips,
    permits: Number(r?.[0] || 0),
    period: String(r?.[2] || ""),
  }));
}

/** BLS Local Area Unemployment by metro */
export async function fetchBLSUnemployment(seriesIds: string[] = ["LAUMT261982000000003"]): Promise<Array<{
  series: string; rate: number; period: string;
}>> {
  const data = await safeJson("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesid: seriesIds }),
  });
  const series = data?.Results?.series;
  if (!Array.isArray(series)) return [];
  const out: Array<{ series: string; rate: number; period: string }> = [];
  for (const s of series) {
    const latest = s?.data?.[0];
    if (!latest) continue;
    out.push({
      series: String(s.seriesID || ""),
      rate: Number(latest.value || 0),
      period: `${latest.year}-${latest.period}`,
    });
  }
  return out;
}

/** Realtor.com price-cut RSS by ZIP (price-cut signal) */
export async function fetchRealtorPriceCuts(zip: string): Promise<Array<{
  address: string; price: string; cut: string;
}>> {
  const url = `https://www.realtor.com/realestateandhomes-search/${zip}/show-price-reduced/sby-6`;
  // Firecrawl exists, but the listing pages embed JSON-LD; fetch HTML.
  const html = await safeText(url, undefined, 10000);
  if (!html) return [];
  const out: Array<{ address: string; price: string; cut: string }> = [];
  const matches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const m of matches.slice(0, 25)) {
    try {
      const json = JSON.parse(m.replace(/<script[^>]*>|<\/script>/g, ""));
      if (json?.["@type"] === "SingleFamilyResidence" || json?.["@type"] === "House") {
        out.push({
          address: String(json?.address?.streetAddress || ""),
          price: String(json?.offers?.price || ""),
          cut: "listed",
        });
      }
    } catch {/* ignore */}
  }
  return out;
}

// ============================================================================
// 3. TECHALERT — 4 new sources
// ============================================================================

/** USAJobs API (public, just User-Agent + email header) — federal trade postings */
export async function fetchUSAJobsTrades(naicsKeywords: string[] = ["HVAC", "electrician", "plumber"]): Promise<Array<{
  title: string; org: string; location: string; url: string;
}>> {
  const out: Array<{ title: string; org: string; location: string; url: string }> = [];
  for (const kw of naicsKeywords) {
    const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(kw)}&LocationName=Michigan&ResultsPerPage=25`;
    const data = await safeJson(url, {
      headers: {
        "Host": "data.usajobs.gov",
        "User-Agent": "matt@detroitwebagent.com",
      },
    });
    const items = data?.SearchResult?.SearchResultItems;
    if (!Array.isArray(items)) continue;
    for (const it of items.slice(0, 10)) {
      const d = it?.MatchedObjectDescriptor;
      if (!d) continue;
      out.push({
        title: String(d.PositionTitle || ""),
        org: String(d.OrganizationName || ""),
        location: String(d.PositionLocationDisplay || ""),
        url: String(d.PositionURI || ""),
      });
    }
  }
  return out;
}

/** BLS QCEW NAICS — quarterly employment trends (proxy for hiring momentum) */
export async function fetchBLSQCEW(naics = "238220", areaFips = "26163"): Promise<Array<{
  period: string; employment: number;
}>> {
  const yr = new Date().getFullYear() - 1;
  const url = `https://data.bls.gov/cew/data/api/${yr}/1/area/${areaFips}.json`;
  const data = await safeJson(url);
  const items = data?.data;
  if (!Array.isArray(items)) return [];
  return items
    .filter((r: any) => String(r?.industry_code || "") === naics)
    .slice(0, 4)
    .map((r: any) => ({
      period: `${r.year}-Q${r.qtr}`,
      employment: Number(r?.month3_emplvl || 0),
    }));
}

/** ProPublica Nonprofit Explorer — Form 990 leadership turnover signal */
export async function fetchProPublicaNonprofits(state = "MI"): Promise<Array<{
  ein: string; name: string; revenue: number;
}>> {
  const url = `https://projects.propublica.org/nonprofits/api/v2/search.json?state%5Bid%5D=${state}&order=revenue&sort_order=desc`;
  const data = await safeJson(url);
  const orgs = data?.organizations;
  if (!Array.isArray(orgs)) return [];
  return orgs.slice(0, 50).map((o: any) => ({
    ein: String(o.ein || ""),
    name: String(o.name || ""),
    revenue: Number(o.income_amount || 0),
  }));
}

/** SAM.gov entity expansions — extended NAICS scan (uses existing SAM_GOV_API_KEY) */
export async function fetchSAMEntityExpansions(naics: string[] = ["238220", "238210", "238110"]): Promise<Array<{
  uei: string; name: string; naics: string;
}>> {
  const key = (globalThis as any).Deno?.env?.get?.("SAM_GOV_API_KEY");
  if (!key) return [];
  const out: Array<{ uei: string; name: string; naics: string }> = [];
  for (const n of naics) {
    const url = `https://api.sam.gov/entity-information/v3/entities?api_key=${key}&naicsCode=${n}&physicalAddressStateOrProvinceCode=MI&samRegistered=Yes&registrationStatus=A&includeSections=entityRegistration&size=25`;
    const data = await safeJson(url);
    const entities = data?.entityData;
    if (!Array.isArray(entities)) continue;
    for (const e of entities.slice(0, 25)) {
      out.push({
        uei: String(e?.entityRegistration?.ueiSAM || ""),
        name: String(e?.entityRegistration?.legalBusinessName || ""),
        naics: n,
      });
    }
  }
  return out;
}

// ============================================================================
// 4. DEMAND RADAR — 4 new sources
// ============================================================================

/** BidNet Direct RSS — public bid feed */
export async function fetchBidNetRSS(state = "MI"): Promise<Array<{
  title: string; agency: string; closes: string; url: string;
}>> {
  const url = `https://www.bidnetdirect.com/rss/${state.toLowerCase()}`;
  const xml = await safeText(url);
  if (!xml) return [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, 25).map((it) => ({
    title: (it.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, ""),
    agency: (it.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, ""),
    closes: (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || ""),
    url: (it.match(/<link>([\s\S]*?)<\/link>/)?.[1] || ""),
  }));
}

/** Michigan public bid postings — MITN-equivalent ArcGIS state portal */
export async function fetchMichiganBidsArcGIS(): Promise<Array<{
  title: string; agency: string; closes: string;
}>> {
  // Statewide e-procurement aggregator via SIGMA VSS (public list endpoint).
  const url = "https://sigma.michigan.gov/webapp/PRDVSS2X1/AltSelfService";
  const html = await safeText(url, undefined, 10000);
  if (!html) return [];
  // Light scrape — list page returns table rows.
  const rows = (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).slice(0, 25);
  return rows.map((r) => ({
    title: (r.match(/<td[^>]*>([\s\S]*?)<\/td>/)?.[1] || "").replace(/<[^>]*>/g, "").trim(),
    agency: "State of Michigan",
    closes: "",
  })).filter((r) => r.title.length > 5);
}

/** USAspending.gov contract opportunities — federal awards by NAICS */
export async function fetchUSAspendingNAICS(naics: string[] = ["238220", "238210", "238110"]): Promise<Array<{
  award_id: string; recipient: string; amount: number; naics: string;
}>> {
  const out: Array<{ award_id: string; recipient: string; amount: number; naics: string }> = [];
  for (const n of naics) {
    const data = await safeJson("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          place_of_performance_locations: [{ country: "USA", state: "MI" }],
          naics_codes: [n],
          award_type_codes: ["A", "B", "C", "D"],
          time_period: [{ start_date: `${new Date().getFullYear() - 1}-01-01`, end_date: new Date().toISOString().slice(0, 10) }],
        },
        fields: ["Award ID", "Recipient Name", "Award Amount"],
        page: 1,
        limit: 25,
        sort: "Award Amount",
        order: "desc",
      }),
    });
    const results = data?.results;
    if (!Array.isArray(results)) continue;
    for (const r of results) {
      out.push({
        award_id: String(r?.["Award ID"] || ""),
        recipient: String(r?.["Recipient Name"] || ""),
        amount: Number(r?.["Award Amount"] || 0),
        naics: n,
      });
    }
  }
  return out;
}

/** DemandStar — public bid-summary scrape */
export async function fetchDemandStarSummary(): Promise<Array<{ title: string; agency: string }>> {
  const url = "https://network.demandstar.com/bids/?state=MI";
  const html = await safeText(url, undefined, 10000);
  if (!html) return [];
  const out: Array<{ title: string; agency: string }> = [];
  const matches = html.match(/<div class="bid-title"[^>]*>([\s\S]*?)<\/div>/g) || [];
  for (const m of matches.slice(0, 25)) {
    out.push({
      title: m.replace(/<[^>]*>/g, "").trim(),
      agency: "DemandStar",
    });
  }
  return out;
}

// ============================================================================
// 5. INDUSTRY PULSE — 4 new sources
// ============================================================================

/** BLS Employment Situation by metro */
export async function fetchBLSEmploymentSituation(): Promise<Array<{ metric: string; value: number }>> {
  const data = await safeJson("https://api.bls.gov/publicAPI/v2/timeseries/data/CES0500000001");
  const series = data?.Results?.series?.[0]?.data?.[0];
  if (!series) return [];
  return [{ metric: "total_nonfarm_employment", value: Number(series.value || 0) }];
}

/** Census Business Formation Statistics weekly */
export async function fetchCensusBFS(): Promise<Array<{ week: string; applications: number }>> {
  const url = "https://api.census.gov/data/timeseries/bfs?get=cell_value&for=us:*&time=from+2026-01";
  const data = await safeJson(url);
  if (!Array.isArray(data) || data.length < 2) return [];
  return data.slice(1, 10).map((r: any) => ({
    week: String(r?.[1] || ""),
    applications: Number(r?.[0] || 0),
  }));
}

/** FRED economic indicators — housing starts + durable goods */
export async function fetchFREDIndicators(seriesIds: string[] = ["HOUST", "DGORDER"]): Promise<Array<{
  series: string; value: number; date: string;
}>> {
  const out: Array<{ series: string; value: number; date: string }> = [];
  for (const id of seriesIds) {
    // FRED has free no-key endpoint via fred.stlouisfed.org/graph/fredgraph.csv
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
    const txt = await safeText(url);
    if (!txt) continue;
    const lines = txt.trim().split(/\r?\n/);
    const last = lines[lines.length - 1]?.split(",");
    if (!last || last.length < 2) continue;
    out.push({ series: id, value: Number(last[1]) || 0, date: String(last[0] || "") });
  }
  return out;
}

/** LinkedIn company growth ping (uses existing LINKEDIN_ACCESS_TOKEN) */
export async function fetchLinkedInCompanyGrowth(orgIds: string[] = []): Promise<Array<{
  org: string; followers: number;
}>> {
  const tok = (globalThis as any).Deno?.env?.get?.("LINKEDIN_ACCESS_TOKEN");
  if (!tok || !orgIds.length) return [];
  const out: Array<{ org: string; followers: number }> = [];
  for (const id of orgIds.slice(0, 10)) {
    const data = await safeJson(`https://api.linkedin.com/v2/networkSizes/urn:li:organization:${id}?edgeType=CompanyFollowedByMember`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (data?.firstDegreeSize) out.push({ org: id, followers: Number(data.firstDegreeSize) });
  }
  return out;
}

// ============================================================================
// 6. DEAD LEAD POOL — 4 new sources
// ============================================================================

/** Detroit BSEED contractors — license expiring within 60 days */
export async function fetchDetroitContractorsExpiringSoon(): Promise<Array<{
  name: string; license_no: string; expires: string; trade: string;
}>> {
  const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Detroit_Business_Certification_Register/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=200&f=json";
  const data = await safeJson(url);
  const feats = data?.features;
  if (!Array.isArray(feats)) return [];
  const cutoff = Date.now() + 60 * 24 * 3600 * 1000;
  return feats
    .filter((f: any) => {
      const exp = Number(f?.attributes?.expiration_date || 0);
      return exp && exp < cutoff && exp > Date.now();
    })
    .slice(0, 100)
    .map((f: any) => ({
      name: String(f?.attributes?.business_name || f?.attributes?.legal_name || ""),
      license_no: String(f?.attributes?.certification_number || ""),
      expires: new Date(Number(f?.attributes?.expiration_date || 0)).toISOString().slice(0, 10),
      trade: String(f?.attributes?.nigp_class || ""),
    }));
}

/** Michigan LARA active builder list (public license search) */
export async function fetchLARABuilders(zip: string = ""): Promise<Array<{
  name: string; license: string; status: string;
}>> {
  // LARA public license verification has CSV download via portal.
  const url = `https://aca-prod.accela.com/MILARA/GeneralProperty/PropertyLookUp.aspx?zip=${zip}`;
  const html = await safeText(url);
  if (!html) return [];
  const rows = (html.match(/<tr[^>]*class="ACA_TabRow[^"]*"[^>]*>[\s\S]*?<\/tr>/g) || []).slice(0, 50);
  return rows.map((r) => ({
    name: (r.match(/<td[^>]*>([\s\S]*?)<\/td>/)?.[1] || "").replace(/<[^>]*>/g, "").trim(),
    license: "",
    status: "active",
  })).filter((r) => r.name.length > 3);
}

/** Better Business Bureau accredited members — Michigan scrape */
export async function fetchBBBAccreditedMI(category = "hvac"): Promise<Array<{
  name: string; phone: string; rating: string;
}>> {
  const url = `https://www.bbb.org/search?find_country=USA&find_loc=Michigan&find_text=${encodeURIComponent(category)}`;
  const html = await safeText(url, undefined, 12000);
  if (!html) return [];
  const cards = html.match(/<div class="result-item"[\s\S]*?<\/div>/g) || [];
  return cards.slice(0, 25).map((c) => ({
    name: (c.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] || "").replace(/<[^>]*>/g, "").trim(),
    phone: (c.match(/tel:([+\d\-() ]+)/)?.[1] || "").trim(),
    rating: (c.match(/rating-([A-F][+-]?)/)?.[1] || "").trim(),
  })).filter((r) => r.name);
}

/** Google Places permanently_closed — re-engage owners with new ventures */
export async function fetchGooglePlacesClosed(query = "HVAC contractor Detroit"): Promise<Array<{
  name: string; address: string; place_id: string;
}>> {
  const key = (globalThis as any).Deno?.env?.get?.("GOOGLE_MAPS_API_KEY");
  if (!key) return [];
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
  const data = await safeJson(url);
  const results = data?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r: any) => r?.business_status === "CLOSED_PERMANENTLY")
    .slice(0, 25)
    .map((r: any) => ({
      name: String(r.name || ""),
      address: String(r.formatted_address || ""),
      place_id: String(r.place_id || ""),
    }));
}

// ============================================================================
// 7. COUNSEL RECORDS — 4 new sources
// ============================================================================

/** Michigan LARA disciplinary actions RSS */
export async function fetchLARADisciplinaryRSS(): Promise<Array<{ name: string; action: string; date: string }>> {
  const url = "https://www.michigan.gov/lara/bureau-list/bpl/disc/disciplinary-action-reports";
  const html = await safeText(url, undefined, 12000);
  if (!html) return [];
  const rows = (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).slice(0, 50);
  return rows.map((r) => {
    const cells = r.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    return {
      name: (cells[0] || "").replace(/<[^>]*>/g, "").trim(),
      action: (cells[2] || "").replace(/<[^>]*>/g, "").trim(),
      date: (cells[3] || "").replace(/<[^>]*>/g, "").trim(),
    };
  }).filter((r) => r.name.length > 3);
}

/** Michigan Attorney Discipline Board public orders */
export async function fetchADBOrders(): Promise<Array<{ name: string; order: string; date: string }>> {
  const url = "https://www.adbmich.org/coveo/notices.php";
  const html = await safeText(url, undefined, 12000);
  if (!html) return [];
  const items = (html.match(/<div class="notice"[\s\S]*?<\/div>/g) || []).slice(0, 30);
  return items.map((i) => ({
    name: (i.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] || "").replace(/<[^>]*>/g, "").trim(),
    order: (i.match(/<p class="order">([\s\S]*?)<\/p>/)?.[1] || "").replace(/<[^>]*>/g, "").trim(),
    date: (i.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || ""),
  })).filter((r) => r.name);
}

/** US Tax Court opinions */
export async function fetchTaxCourtOpinions(query = ""): Promise<Array<{ caption: string; date: string; url: string }>> {
  const url = `https://www.ustaxcourt.gov/recent_opinions.html`;
  const html = await safeText(url, undefined, 10000);
  if (!html) return [];
  const rows = (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).slice(0, 25);
  return rows.map((r) => {
    const cells = r.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    return {
      caption: (cells[0] || "").replace(/<[^>]*>/g, "").trim(),
      date: (cells[2] || "").replace(/<[^>]*>/g, "").trim(),
      url: (r.match(/href="([^"]+)"/)?.[1] || ""),
    };
  }).filter((r) => r.caption.length > 5 && (!query || r.caption.toLowerCase().includes(query.toLowerCase())));
}

/** FEC individual contributions — political profile lookup */
export async function fetchFECContributions(name: string): Promise<Array<{
  name: string; amount: number; committee: string; date: string;
}>> {
  if (!name) return [];
  const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(name)}&per_page=20&sort=-contribution_receipt_date&api_key=DEMO_KEY`;
  const data = await safeJson(url);
  const results = data?.results;
  if (!Array.isArray(results)) return [];
  return results.slice(0, 20).map((r: any) => ({
    name: String(r.contributor_name || ""),
    amount: Number(r.contribution_receipt_amount || 0),
    committee: String(r.committee?.name || ""),
    date: String(r.contribution_receipt_date || ""),
  }));
}

// ============================================================================
// 8. CHANNEL PROSPECTOR — 4 new sources
// ============================================================================

/** OpenStreetMap Overpass API — trade businesses by Michigan polygon */
export async function fetchOSMOverpassTrades(trade = "hvac"): Promise<Array<{
  name: string; lat: number; lon: number; phone: string;
}>> {
  const tradeMap: Record<string, string> = {
    hvac: "trade=hvac|shop=heating",
    plumbing: "shop=plumbing|trade=plumbing",
    electrical: "shop=electrical|trade=electrical",
    roofing: "shop=roofing|trade=roofing",
  };
  const filter = tradeMap[trade] || "shop=hardware";
  const q = `[out:json][timeout:20];area[name="Michigan"]->.mi;node(area.mi)[${filter.split("|")[0]}];out 100;`;
  const data = await safeJson(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, undefined, 25000);
  const elems = data?.elements;
  if (!Array.isArray(elems)) return [];
  return elems.slice(0, 100).map((e: any) => ({
    name: String(e?.tags?.name || ""),
    lat: Number(e?.lat || 0),
    lon: Number(e?.lon || 0),
    phone: String(e?.tags?.phone || e?.tags?.["contact:phone"] || ""),
  })).filter((r) => r.name);
}

/** Wikidata SPARQL — Michigan companies by industry */
export async function fetchWikidataMichiganCompanies(industry = "construction"): Promise<Array<{
  name: string; website: string; revenue: number;
}>> {
  const sparql = `SELECT ?co ?coLabel ?website ?revenue WHERE { ?co wdt:P17 wd:Q30; wdt:P131 wd:Q1166; wdt:P452/rdfs:label "${industry}"@en. OPTIONAL { ?co wdt:P856 ?website }. OPTIONAL { ?co wdt:P2139 ?revenue }. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 50`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const data = await safeJson(url, undefined, 15000);
  const bindings = data?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((b: any) => ({
    name: String(b?.coLabel?.value || ""),
    website: String(b?.website?.value || ""),
    revenue: Number(b?.revenue?.value || 0),
  })).filter((r) => r.name);
}

/** Michigan SOS business entity filings — recent registrations */
export async function fetchMISOSEntities(query = "HVAC"): Promise<Array<{ name: string; id: string; date: string }>> {
  const url = `https://cofs.lara.state.mi.us/SearchApi/Search/EntitySearch?SEARCH_TYPE=ENTITY_NAME&SEARCH_VALUE=${encodeURIComponent(query)}`;
  const data = await safeJson(url, undefined, 12000);
  const results = data?.Rows;
  if (!Array.isArray(results)) return [];
  return results.slice(0, 25).map((r: any) => ({
    name: String(r?.EntityName || ""),
    id: String(r?.IdNumber || ""),
    date: String(r?.IncorporationDate || ""),
  }));
}

/** Detroit Open Business Registry — full trade NAICS sweep */
export async function fetchDetroitOpenBusinessRegistry(naicsPrefix = "238"): Promise<Array<{
  name: string; address: string; naics: string;
}>> {
  const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Currently_Open_Businesses/FeatureServer/0/query?where=naics_code+LIKE+'${naicsPrefix}%25'&outFields=*&resultRecordCount=200&f=json`;
  const data = await safeJson(url);
  const feats = data?.features;
  if (!Array.isArray(feats)) return [];
  return feats.slice(0, 100).map((f: any) => ({
    name: String(f?.attributes?.business_name || ""),
    address: String(f?.attributes?.address || ""),
    naics: String(f?.attributes?.naics_code || ""),
  })).filter((r) => r.name);
}

// ============================================================================
// 9. EMAIL / OWNER WATERFALL — 4 new sources
// ============================================================================

/** DNS TXT (SPF) record — reveals email infra clues */
export async function fetchDNSTextSPF(domain: string): Promise<{ spf: string; provider: string } | null> {
  if (!domain) return null;
  const data = await safeJson(`https://cloudflare-dns.com/dns-query?name=${domain}&type=TXT`, {
    headers: { Accept: "application/dns-json" },
  });
  const answers = data?.Answer;
  if (!Array.isArray(answers)) return null;
  const spf = answers.map((a: any) => String(a?.data || "")).find((d) => d.includes("v=spf1"));
  if (!spf) return null;
  let provider = "unknown";
  if (spf.includes("google.com")) provider = "google_workspace";
  else if (spf.includes("outlook.com") || spf.includes("protection.outlook")) provider = "microsoft_365";
  else if (spf.includes("zoho")) provider = "zoho";
  else if (spf.includes("mailgun")) provider = "mailgun";
  return { spf, provider };
}

/** WHOIS registrant email (public RDAP) */
export async function fetchWhoisEmail(domain: string): Promise<string | null> {
  if (!domain) return null;
  const data = await safeJson(`https://rdap.org/domain/${domain}`);
  const entities = data?.entities;
  if (!Array.isArray(entities)) return null;
  for (const e of entities) {
    const vcard = e?.vcardArray?.[1];
    if (!Array.isArray(vcard)) continue;
    for (const item of vcard) {
      if (Array.isArray(item) && item[0] === "email" && typeof item[3] === "string") {
        return item[3];
      }
    }
  }
  return null;
}

/** Schema.org JSON-LD `org:email` parser */
export async function fetchSchemaOrgEmail(domain: string): Promise<string | null> {
  if (!domain) return null;
  const html = await safeText(`https://${domain}`, undefined, 8000);
  if (!html) return null;
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const b of blocks) {
    try {
      const json = JSON.parse(b.replace(/<script[^>]*>|<\/script>/g, ""));
      const arr = Array.isArray(json) ? json : [json];
      for (const j of arr) {
        const email = j?.email || j?.contactPoint?.email;
        if (typeof email === "string" && email.includes("@")) return email.replace(/^mailto:/, "");
      }
    } catch {/* ignore */}
  }
  return null;
}

/** Sitemap.xml multi-language contact-page discovery */
export async function fetchSitemapContactPages(domain: string): Promise<string[]> {
  if (!domain) return [];
  const txt = await safeText(`https://${domain}/sitemap.xml`, undefined, 8000);
  if (!txt) return [];
  const locs = (txt.match(/<loc>([\s\S]*?)<\/loc>/g) || []).map((m) =>
    m.replace(/<\/?loc>/g, "").trim()
  );
  return locs.filter((u) => /contact|about|impressum|kontakt|contacto|nous-?contacter/i.test(u)).slice(0, 5);
}

// ============================================================================
// 10. SITERADAR VISITOR ENRICHMENT — 4 new sources
// ============================================================================

/** IPAPI.co free tier — ASN and org */
export async function fetchIPAPIco(ip: string): Promise<{ asn: string; org: string; city: string } | null> {
  if (!ip) return null;
  const data = await safeJson(`https://ipapi.co/${ip}/json/`);
  if (!data || data?.error) return null;
  return {
    asn: String(data.asn || ""),
    org: String(data.org || ""),
    city: String(data.city || ""),
  };
}

/** AbuseIPDB free reputation (no key for low volume) */
export async function fetchAbuseIPDB(ip: string): Promise<{ score: number; isp: string } | null> {
  if (!ip) return null;
  const data = await safeJson(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
    headers: { Accept: "application/json" },
  });
  const d = data?.data;
  if (!d) return null;
  return { score: Number(d.abuseConfidenceScore || 0), isp: String(d.isp || "") };
}

/** DNS reverse PTR lookup */
export async function fetchReverseDNS(ip: string): Promise<string | null> {
  if (!ip) return null;
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const reverse = `${parts.reverse().join(".")}.in-addr.arpa`;
  const data = await safeJson(`https://cloudflare-dns.com/dns-query?name=${reverse}&type=PTR`, {
    headers: { Accept: "application/dns-json" },
  });
  const ans = data?.Answer?.[0]?.data;
  return typeof ans === "string" ? ans.replace(/\.$/, "") : null;
}

/** BGP.tools ASN-to-company mapping */
export async function fetchBGPToolsASN(asn: string): Promise<{ name: string; country: string } | null> {
  const num = String(asn).replace(/^AS/i, "");
  if (!num) return null;
  const txt = await safeText(`https://bgp.tools/as/${num}.json`);
  if (!txt) return null;
  try {
    const j = JSON.parse(txt);
    return { name: String(j?.asn?.name || ""), country: String(j?.asn?.country || "") };
  } catch {
    return null;
  }
}
