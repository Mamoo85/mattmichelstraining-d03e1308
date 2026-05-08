// tenant-intel-search — Universal public-records intelligence engine.
// Accepts { name, city?, state?, dob?, mode? }
// mode: "tenant" (default) | "contractor" | "prospect" | "lawyer"
// Returns structured JSON with hits organized by category.
// All sources are public records — no FCRA consumer report data.
// Litigation use is FCRA-exempt under 15 U.S.C. § 1681b(a)(4).

import { createClient } from "npm:@supabase/supabase-js@2";
import { firecrawlScrape } from "../_shared/firecrawl.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface IntelHit {
  source: string;
  source_url?: string;
  category: string;
  title: string;
  summary: string;
  date?: string;
  location?: string;
  severity?: "high" | "medium" | "low" | "info";
  raw?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY A — Federal Court Records (CourtListener)
// ────────────────────────────────────────────────────────────────────────────

async function scanFederalBankruptcy(name: string, state: string): Promise<IntelHit[]> {
  try {
    const courts = state === "MI" ? "mied,miwd" : "";
    const courtParam = courts ? `&court=${courts}` : "";
    const url = `https://www.courtlistener.com/api/rest/v3/dockets/?party_name=${encodeURIComponent(name)}${courtParam}&nature_of_suit=470,480&format=json&page_size=15`;
    const res = await fetch(url, { headers: { "User-Agent": "DWA-Intel/1.0 (research)" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((d: any): IntelHit => ({
      source: "CourtListener (Federal Courts)",
      source_url: `https://www.courtlistener.com${d.absolute_url || ""}`,
      category: "Court Records",
      title: `Bankruptcy — ${d.case_name || name}`,
      summary: `Case #${d.docket_number || "N/A"} filed ${d.date_filed || "unknown"} in ${d.court?.short_name || d.court_id || "federal court"}. Status: ${d.pacer_case_id ? "Active PACER record" : "Historical"}.`,
      date: d.date_filed,
      location: d.court?.short_name || "",
      severity: "high",
      raw: d,
    }));
  } catch { return []; }
}

async function scanFederalEvictionCivil(name: string, state: string): Promise<IntelHit[]> {
  try {
    const courts = state === "MI" ? "mied,miwd" : "";
    const courtParam = courts ? `&court=${courts}` : "";
    // NOS 320 = real property / foreclosure; 190 = other contract (landlord-tenant)
    const url = `https://www.courtlistener.com/api/rest/v3/dockets/?party_name=${encodeURIComponent(name)}${courtParam}&nature_of_suit=320,190&format=json&page_size=15`;
    const res = await fetch(url, { headers: { "User-Agent": "DWA-Intel/1.0 (research)" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((d: any): IntelHit => ({
      source: "CourtListener (Federal Courts)",
      source_url: `https://www.courtlistener.com${d.absolute_url || ""}`,
      category: "Court Records",
      title: `Civil Suit — ${d.case_name || name}`,
      summary: `Case #${d.docket_number || "N/A"} — NOS ${d.nature_of_suit || ""}. Filed ${d.date_filed || "unknown"} in ${d.court?.short_name || d.court_id || "federal court"}.`,
      date: d.date_filed,
      location: d.court?.short_name || "",
      severity: "medium",
      raw: d,
    }));
  } catch { return []; }
}

async function scanFederalCriminal(name: string, state: string): Promise<IntelHit[]> {
  try {
    const courts = state === "MI" ? "mied,miwd" : "";
    const courtParam = courts ? `&court=${courts}` : "";
    const url = `https://www.courtlistener.com/api/rest/v3/dockets/?party_name=${encodeURIComponent(name)}${courtParam}&nature_of_suit=950,540,530,550&format=json&page_size=15`;
    const res = await fetch(url, { headers: { "User-Agent": "DWA-Intel/1.0 (research)" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((d: any): IntelHit => ({
      source: "CourtListener (Federal Courts)",
      source_url: `https://www.courtlistener.com${d.absolute_url || ""}`,
      category: "Criminal Records",
      title: `Federal Criminal — ${d.case_name || name}`,
      summary: `Case #${d.docket_number || "N/A"} filed ${d.date_filed || "unknown"} in ${d.court?.short_name || d.court_id || "federal court"}.`,
      date: d.date_filed,
      severity: "high",
      raw: d,
    }));
  } catch { return []; }
}

async function scanFederalTaxLiens(name: string, state: string): Promise<IntelHit[]> {
  try {
    const courts = state === "MI" ? "mied,miwd" : "";
    const courtParam = courts ? `&court=${courts}` : "";
    const url = `https://www.courtlistener.com/api/rest/v3/dockets/?party_name=${encodeURIComponent(name)}${courtParam}&nature_of_suit=870&format=json&page_size=10`;
    const res = await fetch(url, { headers: { "User-Agent": "DWA-Intel/1.0 (research)" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((d: any): IntelHit => ({
      source: "CourtListener (Federal Courts)",
      source_url: `https://www.courtlistener.com${d.absolute_url || ""}`,
      category: "Financial Records",
      title: `Federal Tax Suit — ${d.case_name || name}`,
      summary: `Tax case #${d.docket_number || "N/A"} filed ${d.date_filed || "unknown"}. Federal tax judgment or lien proceeding.`,
      date: d.date_filed,
      severity: "high",
      raw: d,
    }));
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY B — Sex Offender Registry (NSOPW — free federal API)
// ────────────────────────────────────────────────────────────────────────────

async function scanNSOPW(name: string, state: string): Promise<IntelHit[]> {
  try {
    const [first, ...rest] = name.trim().split(/\s+/);
    const last = rest.join(" ");
    if (!first || !last) return [];
    const body = { firstName: first, lastName: last, stateId: state };
    const res = await fetch("https://www.nsopw.gov/api/Search/GetResults", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "DWA-Intel/1.0" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const offenders: any[] = data?.Offenders || [];
    return offenders.map((o: any): IntelHit => ({
      source: "NSOPW (National Sex Offender Registry)",
      source_url: "https://www.nsopw.gov",
      category: "Criminal Records",
      title: `Sex Offender Registry — ${o.FullName || name}`,
      summary: `Listed in ${o.StateId || state} sex offender registry. Address: ${o.DisplayAddress || "on file"}. Registration: ${o.Tier || "active"}.`,
      date: o.ConvictionDate || undefined,
      location: o.DisplayAddress || "",
      severity: "high",
      raw: o,
    }));
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY C — FBI Most Wanted
// ────────────────────────────────────────────────────────────────────────────

async function scanFBIMostWanted(name: string): Promise<IntelHit[]> {
  try {
    const res = await fetch(`https://api.fbi.gov/wanted/v1/list?title=${encodeURIComponent(name)}&limit=5`, {
      headers: { "User-Agent": "DWA-Intel/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any): IntelHit => ({
      source: "FBI Most Wanted",
      source_url: item.url || "https://www.fbi.gov/wanted",
      category: "Criminal Records",
      title: `FBI Most Wanted — ${item.title || name}`,
      summary: `${item.description || "Active FBI wanted person"}. Category: ${item.field_offices?.join(", ") || "N/A"}. Status: ${item.status || "wanted"}.`,
      severity: "high",
      raw: item,
    }));
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY D — SAM.gov Exclusions (debarred from federal contracts)
// ────────────────────────────────────────────────────────────────────────────

async function scanSAMExclusions(name: string): Promise<IntelHit[]> {
  try {
    const SAM_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";
    const url = `https://api.sam.gov/exclusions/v1/exclusions?api_key=${SAM_KEY}&exclusionName=${encodeURIComponent(name)}&limit=10`;
    const res = await fetch(url, { headers: { "User-Agent": "DWA-Intel/1.0" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.exclusionDetails || data?.data || [];
    return items.map((e: any): IntelHit => ({
      source: "SAM.gov Federal Exclusions",
      source_url: "https://www.sam.gov",
      category: "Government Records",
      title: `Federal Debarment — ${e.name || name}`,
      summary: `Excluded from federal contracts/programs. Agency: ${e.excludingAgencyName || "N/A"}. Active from ${e.activationDate || "N/A"} to ${e.terminationDate || "ongoing"}.`,
      date: e.activationDate,
      severity: "high",
      raw: e,
    }));
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY E — Michigan Property Records (ArcGIS)
// ────────────────────────────────────────────────────────────────────────────

async function scanWayneCountyProperty(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(OWNER) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://utility.waynecountymi.gov/arcgis/rest/services/Property/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=ADDRESS,ZIPCODE,OWNER,SALE_DATE,SALE_PRICE&f=json&resultRecordCount=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Wayne County Property Records",
        source_url: "https://www.waynecounty.com/government/assessor",
        category: "Property Records",
        title: `Property Owner — ${a.ADDRESS || "Unknown Address"}`,
        summary: `Owner: ${a.OWNER || name}. Address: ${a.ADDRESS}, ${a.ZIPCODE}. Last sale: ${a.SALE_DATE ? new Date(a.SALE_DATE).toLocaleDateString() : "N/A"} for $${Number(a.SALE_PRICE || 0).toLocaleString()}.`,
        location: `${a.ADDRESS}, ${a.ZIPCODE}`,
        severity: "info",
        raw: a,
      };
    });
  } catch { return []; }
}

async function scanOaklandCountyProperty(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(TAXPAYER_1) LIKE UPPER('%${name.replace(/'/g, "''")}%') OR UPPER(TAXPAYER_2) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://www.oakgov.com/egis/rest/services/Property/ParcelInfo/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=SITUS_ADDRESS,ZIP,TAXPAYER_1,SALE_DATE,SALE_PRICE&f=json&resultRecordCount=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Oakland County Property Records",
        source_url: "https://www.oakgov.com",
        category: "Property Records",
        title: `Property Owner — ${a.SITUS_ADDRESS || "Unknown"}`,
        summary: `Owner: ${a.TAXPAYER_1 || name}. Address: ${a.SITUS_ADDRESS}, ${a.ZIP}. Last sale: ${a.SALE_DATE ? new Date(a.SALE_DATE).toLocaleDateString() : "N/A"} for $${Number(a.SALE_PRICE || 0).toLocaleString()}.`,
        location: `${a.SITUS_ADDRESS}, ${a.ZIP}`,
        severity: "info",
        raw: a,
      };
    });
  } catch { return []; }
}

async function scanDetroitAssessor(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(taxpayer_name) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=address,zip_code,taxpayer_name,sale_date,sale_price&f=json&resultRecordCount=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Detroit Assessor Records",
        source_url: "https://detroitmi.gov/departments/office-chief-financial-officer/office-assessor",
        category: "Property Records",
        title: `Detroit Property — ${a.address || "Unknown"}`,
        summary: `Owner: ${a.taxpayer_name || name}. Address: ${a.address}, Detroit ${a.zip_code}. Last sale: ${a.sale_date ? new Date(a.sale_date).toLocaleDateString() : "N/A"} for $${Number(a.sale_price || 0).toLocaleString()}.`,
        location: `${a.address}, Detroit`,
        severity: "info",
        raw: a,
      };
    });
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY F — Michigan Corrections (OTIS — public offender search)
// ────────────────────────────────────────────────────────────────────────────

async function scanMichiganOTIS(name: string): Promise<IntelHit[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const [first, ...rest] = name.trim().split(/\s+/);
    const last = rest.join(" ") || first;
    const scrapeUrl = `https://mdocweb.state.mi.us/otis2/otis2.aspx?mdocNumber=&last=${encodeURIComponent(last)}&first=${encodeURIComponent(first)}&birthdate=&dobFrom=&dobTo=&gender=&race=&height=&heightRange=0&weight=&weightRange=0&hair=&eyes=&btnSearch=Search`;
    const result = await firecrawlScrape(scrapeUrl, { onlyMainContent: true, timeout: 15_000 });
    if (!result?.markdown) return [];
    const md = result.markdown;
    // Parse table rows from OTIS results
    const rows = md.split("\n").filter(l => l.includes("|") && l.toLowerCase().includes(last.toLowerCase().split(" ")[0]));
    if (!rows.length) return [];
    return rows.slice(0, 5).map((row): IntelHit => ({
      source: "Michigan OTIS (Corrections)",
      source_url: "https://mdocweb.state.mi.us/otis2/otis2.aspx",
      category: "Criminal Records",
      title: `Michigan Corrections Record`,
      summary: `Active or historical Michigan Department of Corrections record found: ${row.replace(/\|/g, " | ").trim()}`,
      severity: "high",
    }));
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY G — People Search (address history, phone, relatives)
// ────────────────────────────────────────────────────────────────────────────

async function scanFastPeopleSearch(name: string, city: string, state: string): Promise<IntelHit[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const citySlug = city.toLowerCase().replace(/\s+/g, "-");
    const url = `https://www.fastpeoplesearch.com/name/${slug}_${citySlug}-${state.toLowerCase()}`;
    const result = await firecrawlScrape(url, { onlyMainContent: true, timeout: 15_000 });
    if (!result?.markdown) return [];
    const md = result.markdown;
    const hits: IntelHit[] = [];
    // Extract address blocks
    const addressMatches = md.match(/\d{2,5}\s+\w+.*?(?:Ave|St|Dr|Rd|Blvd|Ln|Way|Ct)[^\n]*/gi) || [];
    const phoneMatches = md.match(/\(\d{3}\)\s*\d{3}[-.\s]\d{4}/g) || [];
    const ageMatch = md.match(/Age[:\s]+(\d{2,3})/i);
    if (addressMatches.length || phoneMatches.length) {
      hits.push({
        source: "FastPeopleSearch",
        source_url: url,
        category: "Identity & Address History",
        title: `Public Profile — ${name}`,
        summary: [
          ageMatch ? `Age: ${ageMatch[1]}` : "",
          addressMatches.length ? `Addresses found: ${addressMatches.slice(0, 3).join("; ")}` : "",
          phoneMatches.length ? `Phone numbers: ${phoneMatches.slice(0, 3).join(", ")}` : "",
        ].filter(Boolean).join(". "),
        location: city,
        severity: "info",
      });
    }
    return hits;
  } catch { return []; }
}

async function scanTruePeopleSearch(name: string, city: string, state: string): Promise<IntelHit[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const url = `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(name)}&citystatezip=${encodeURIComponent(`${city} ${state}`)}`;
    const result = await firecrawlScrape(url, { onlyMainContent: true, timeout: 15_000 });
    if (!result?.markdown) return [];
    const md = result.markdown;
    const addressMatches = md.match(/\d{2,5}\s+\w+.*?(?:Ave|St|Dr|Rd|Blvd|Ln|Way|Ct)[^\n]*/gi) || [];
    const phoneMatches = md.match(/\(\d{3}\)\s*\d{3}[-.\s]\d{4}/g) || [];
    const relativeMatches = md.match(/(?:Related to|Associates?|Relatives?).*?[\n]/gi) || [];
    if (!addressMatches.length && !phoneMatches.length) return [];
    return [{
      source: "TruePeopleSearch",
      source_url: url,
      category: "Identity & Address History",
      title: `Public Records — ${name}`,
      summary: [
        addressMatches.length ? `Prior addresses: ${addressMatches.slice(0, 4).join("; ")}` : "",
        phoneMatches.length ? `Phone numbers: ${phoneMatches.slice(0, 3).join(", ")}` : "",
        relativeMatches.length ? relativeMatches[0].trim() : "",
      ].filter(Boolean).join(". "),
      location: city,
      severity: "info",
    }];
  } catch { return []; }
}

async function scanWhitepages(name: string, city: string, state: string): Promise<IntelHit[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const url = `https://www.whitepages.com/name/${encodeURIComponent(name.replace(/\s+/g, "+"))}/${encodeURIComponent(city.replace(/\s+/g, "+"))}+${state}`;
    const result = await firecrawlScrape(url, { onlyMainContent: true, timeout: 15_000 });
    if (!result?.markdown) return [];
    const md = result.markdown;
    const addressMatches = md.match(/\d{2,5}\s+\w+.*?(?:Ave|St|Dr|Rd|Blvd|Ln)[^\n]*/gi) || [];
    if (!addressMatches.length) return [];
    return [{
      source: "Whitepages",
      source_url: url,
      category: "Identity & Address History",
      title: `Whitepages — ${name}`,
      summary: `Found ${addressMatches.length} address(es): ${addressMatches.slice(0, 3).join("; ")}`,
      location: city,
      severity: "info",
    }];
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY H — Business Records
// ────────────────────────────────────────────────────────────────────────────

async function scanMichiganLARA(name: string): Promise<IntelHit[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const url = `https://cofs.lara.state.mi.us/CorpWeb/CorpSearch/CorpSearch.aspx?SearchType=CONTAINS&SearchValue=${encodeURIComponent(name)}`;
    const result = await firecrawlScrape(url, { onlyMainContent: true, timeout: 15_000 });
    if (!result?.markdown) return [];
    const md = result.markdown;
    const rows = md.split("\n").filter(l => l.includes("LLC") || l.includes("Corp") || l.includes("Inc") || l.includes("Active") || l.includes("Dissolved"));
    if (!rows.length) return [];
    return rows.slice(0, 5).map((row): IntelHit => ({
      source: "Michigan LARA Business Registry",
      source_url: url,
      category: "Business Records",
      title: `Michigan Business Entity`,
      summary: `Business registration found: ${row.trim()}. Subject appears as registered agent, officer, or owner.`,
      severity: "info",
    }));
  } catch { return []; }
}

async function scanOpenCorporates(name: string, state: string): Promise<IntelHit[]> {
  try {
    const url = `https://api.opencorporates.com/v0.4/officers/search?q=${encodeURIComponent(name)}&jurisdiction_code=us_${state.toLowerCase()}&per_page=10`;
    const res = await fetch(url, { headers: { "User-Agent": "DWA-Intel/1.0" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    const officers: any[] = data?.results?.officers || [];
    return officers.map((o: any): IntelHit => {
      const officer = o.officer || o;
      return {
        source: "OpenCorporates",
        source_url: `https://opencorporates.com${officer.opencorporates_url || ""}`,
        category: "Business Records",
        title: `Corporate Officer — ${officer.name || name}`,
        summary: `${officer.position || "Officer"} at ${officer.company?.name || "company"} (${officer.company?.jurisdiction_code || state}). Status: ${officer.company?.current_status || "unknown"}.`,
        severity: "info",
        raw: officer,
      };
    });
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY I — EPA, OSHA, Government Violations
// ────────────────────────────────────────────────────────────────────────────

async function scanOSHAViolations(name: string): Promise<IntelHit[]> {
  try {
    const url = `https://data.dol.gov/get/full_inspections/rows/10/offset/0?establishment_name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { "User-Agent": "DWA-Intel/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    const records: any[] = Array.isArray(data) ? data : (data?.data || []);
    return records.slice(0, 5).map((r: any): IntelHit => ({
      source: "OSHA Violations (DOL)",
      source_url: "https://www.osha.gov/pls/imis/establishment.html",
      category: "Government Records",
      title: `OSHA Inspection — ${r.establishment_name || name}`,
      summary: `Inspection ${r.activity_nr || "N/A"} at ${r.site_address || "N/A"}. Date: ${r.open_date || "N/A"}. Violations: ${r.total_current_penalty || 0} penalty.`,
      date: r.open_date,
      severity: "medium",
      raw: r,
    }));
  } catch { return []; }
}

async function scanEPAViolations(name: string, state: string): Promise<IntelHit[]> {
  try {
    const url = `https://data.epa.gov/efservice/CASE_ENFORCEMENT/NAME_TYPE/OWNER/${encodeURIComponent(name)}/STATE_CODE/${state}/rows/10/JSON`;
    const res = await fetch(url, { headers: { "User-Agent": "DWA-Intel/1.0" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    const records: any[] = Array.isArray(data) ? data : [];
    return records.slice(0, 5).map((r: any): IntelHit => ({
      source: "EPA Enforcement (ECHO)",
      source_url: "https://echo.epa.gov",
      category: "Government Records",
      title: `EPA Enforcement Action`,
      summary: `Case: ${r.case_name || "N/A"}. Facility: ${r.fac_name || "N/A"} in ${r.fac_city || "N/A"}, ${r.fac_state || state}. Status: ${r.case_status_desc || "N/A"}.`,
      severity: "medium",
      raw: r,
    }));
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY J — Eviction-Specific Records
// ────────────────────────────────────────────────────────────────────────────

async function scanEvictionLab(name: string, city: string, state: string): Promise<IntelHit[]> {
  // Eviction Lab provides aggregate stats, not individual records.
  // We use CourtListener for individual filings + AI research for state records.
  // Return empty — aggregate data is not useful for individual lookup.
  return [];
}

async function scanMichiganCourtEvictions(name: string, city: string): Promise<IntelHit[]> {
  // Sonar-powered Michigan district court search handled in AI research section.
  return [];
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY K — AI-Powered Web Research (Sonar/OpenRouter)
// ────────────────────────────────────────────────────────────────────────────

async function sonarSearch(query: string, label: string, category: string, severity: IntelHit["severity"] = "info"): Promise<IntelHit[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://detroitwebagency.com",
        "X-Title": "DWA Tenant Intel",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a public records research assistant. Search the web and return ONLY confirmed public record findings in valid JSON array format. Each item: { title, summary, date?, url? }. Return [] if nothing found. Be concise. Never fabricate records.",
          },
          { role: "user", content: query },
        ],
        max_tokens: 600,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    let items: any[];
    try { items = JSON.parse(match[0]); } catch { return []; }
    return (Array.isArray(items) ? items : []).slice(0, 5).map((item: any): IntelHit => ({
      source: `Web Research — ${label}`,
      source_url: item.url || undefined,
      category,
      title: item.title || label,
      summary: item.summary || item.content || "See source for details.",
      date: item.date || undefined,
      severity,
    }));
  } catch { return []; }
}

async function scanSonarEvictions(name: string, city: string, state: string): Promise<IntelHit[]> {
  return sonarSearch(
    `Search for eviction court records for "${name}" in ${city}, ${state}. Include case numbers, courts, dates, outcomes. Focus on Michigan district courts and 36th District Court Detroit. Return JSON array.`,
    "Eviction Search",
    "Eviction Records",
    "high"
  );
}

async function scanSonarCriminal(name: string, city: string, state: string): Promise<IntelHit[]> {
  return sonarSearch(
    `Search for criminal court records, arrests, or convictions for "${name}" in ${city}, ${state}. Include case numbers, charges, dates, and outcomes from public court records. Return JSON array.`,
    "Criminal Background Search",
    "Criminal Records",
    "high"
  );
}

async function scanSonarNews(name: string, city: string, state: string): Promise<IntelHit[]> {
  return sonarSearch(
    `Search for news articles about "${name}" from ${city}, ${state} involving legal trouble, arrests, evictions, fraud, lawsuits, or property disputes. Return JSON array with title, summary, date, url.`,
    "News & Media",
    "News & Public Notices",
    "medium"
  );
}

async function scanSonarSocialProfile(name: string, city: string): Promise<IntelHit[]> {
  return sonarSearch(
    `Find public social media profiles for "${name}" from ${city}. Include LinkedIn, Facebook, Instagram profiles that are publicly visible. Note any addresses or employers mentioned publicly. Return JSON array.`,
    "Social Media",
    "Social Media Presence",
    "info"
  );
}

async function scanSonarBusinessHistory(name: string, city: string, state: string): Promise<IntelHit[]> {
  return sonarSearch(
    `Search for businesses owned or operated by "${name}" in ${state}. Check for BBB complaints, business closures, fraud complaints, or regulatory actions. Return JSON array.`,
    "Business Background",
    "Business Records",
    "medium"
  );
}

async function scanSonarLiens(name: string, state: string): Promise<IntelHit[]> {
  return sonarSearch(
    `Search for tax liens, mechanic's liens, UCC filings, or judgment liens against "${name}" in ${state}. Return JSON array with amounts, filing dates, creditor names.`,
    "Liens & Judgments",
    "Financial Records",
    "high"
  );
}

async function scanSonarProbate(name: string, state: string): Promise<IntelHit[]> {
  return sonarSearch(
    `Search for probate court filings, estate proceedings, or guardianship cases involving "${name}" in ${state}. Return JSON array with case details.`,
    "Probate Records",
    "Court Records",
    "info"
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY L — Detroit/Wayne County Public Safety Records
// ────────────────────────────────────────────────────────────────────────────

async function scanDetroitBlight(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(name) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/blight_tickets/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=name,address,violation_description,ticket_issued_date,total_due&f=json&resultRecordCount=10&orderByFields=OBJECTID+DESC`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Detroit Blight Violations",
        source_url: "https://data.detroitmi.gov",
        category: "Property Violations",
        title: `Blight Violation — ${a.address || "Detroit"}`,
        summary: `Violation: ${a.violation_description || "N/A"}. Amount due: $${Number(a.total_due || 0).toLocaleString()}. Property: ${a.address || "N/A"}.`,
        severity: "medium",
        raw: a,
      };
    });
  } catch { return []; }
}

async function scanDetroitVacantProperties(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(owner_name) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_vacant_property_registrations/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=owner_name,address,property_status,issued_date&f=json&resultRecordCount=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Detroit Vacant Property Registry",
        source_url: "https://data.detroitmi.gov",
        category: "Property Records",
        title: `Vacant Property — ${a.address || "Detroit"}`,
        summary: `Owner: ${a.owner_name || name}. Status: ${a.property_status || "N/A"}. Registered: ${a.issued_date ? new Date(a.issued_date).toLocaleDateString() : "N/A"}.`,
        severity: "low",
        raw: a,
      };
    });
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY M — Phone / USPhoneBook
// ────────────────────────────────────────────────────────────────────────────

async function scanUSPhoneBook(name: string, city: string): Promise<IntelHit[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const citySlug = city.toLowerCase().replace(/\s+/g, "-");
    const url = `https://www.usphonebook.com/${slug}/${citySlug}`;
    const result = await firecrawlScrape(url, { onlyMainContent: true, timeout: 12_000 });
    if (!result?.markdown) return [];
    const md = result.markdown;
    const phoneMatches = md.match(/\(\d{3}\)\s*\d{3}[-.\s]\d{4}/g) || [];
    const addressMatches = md.match(/\d{2,5}\s+\w+.*?(?:Ave|St|Dr|Rd|Blvd|Ln)[^\n]*/gi) || [];
    if (!phoneMatches.length && !addressMatches.length) return [];
    return [{
      source: "US PhoneBook",
      source_url: url,
      category: "Identity & Address History",
      title: `Phone Directory — ${name}`,
      summary: [
        phoneMatches.length ? `Phones: ${phoneMatches.slice(0, 3).join(", ")}` : "",
        addressMatches.length ? `Addresses: ${addressMatches.slice(0, 2).join("; ")}` : "",
      ].filter(Boolean).join(". "),
      severity: "info",
    }];
  } catch { return []; }
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const name = String(body.name || "").trim();
  const city = String(body.city || "Detroit").trim();
  const state = String(body.state || "MI").trim().toUpperCase();
  const mode = String(body.mode || "tenant").trim();

  if (!name || name.length < 3) {
    return new Response(JSON.stringify({ error: "name_required", detail: "Provide at least first and last name." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const started = Date.now();

  // Run all sources in parallel — each fails gracefully
  const results = await Promise.allSettled([
    // Federal Courts
    scanFederalBankruptcy(name, state),
    scanFederalEvictionCivil(name, state),
    scanFederalCriminal(name, state),
    scanFederalTaxLiens(name, state),
    // Criminal
    scanNSOPW(name, state),
    scanFBIMostWanted(name),
    scanMichiganOTIS(name),
    // Government
    scanSAMExclusions(name),
    scanOSHAViolations(name),
    scanEPAViolations(name, state),
    // Property
    scanWayneCountyProperty(name),
    scanOaklandCountyProperty(name),
    scanDetroitAssessor(name),
    scanDetroitVacantProperties(name),
    scanDetroitBlight(name),
    // Business
    scanMichiganLARA(name),
    scanOpenCorporates(name, state),
    // Identity
    scanFastPeopleSearch(name, city, state),
    scanTruePeopleSearch(name, city, state),
    scanWhitepages(name, city, state),
    scanUSPhoneBook(name, city),
    // AI Research (last — slower)
    scanSonarEvictions(name, city, state),
    scanSonarCriminal(name, city, state),
    scanSonarNews(name, city, state),
    scanSonarSocialProfile(name, city),
    scanSonarBusinessHistory(name, city, state),
    scanSonarLiens(name, state),
    scanSonarProbate(name, state),
  ]);

  // Flatten all hits
  const allHits: IntelHit[] = [];
  let sourcesHit = 0;
  let sourcesReturned = 0;
  for (const r of results) {
    sourcesHit++;
    if (r.status === "fulfilled" && r.value.length > 0) {
      allHits.push(...r.value);
      sourcesReturned++;
    }
  }

  // Group by category
  const byCategory: Record<string, IntelHit[]> = {};
  for (const hit of allHits) {
    if (!byCategory[hit.category]) byCategory[hit.category] = [];
    byCategory[hit.category].push(hit);
  }

  // Summary counts
  const summary = Object.fromEntries(
    Object.entries(byCategory).map(([cat, hits]) => [cat, hits.length])
  );

  const highPriorityHits = allHits.filter(h => h.severity === "high");

  // Store search in DB (fire-and-forget)
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    sb.from("tenant_intel_searches").insert({
      searched_by: body.searched_by || "anonymous",
      query_name: name,
      query_city: city,
      query_state: state,
      result_summary: summary,
      full_results: { hits: allHits },
      sources_hit: sourcesHit,
      sources_returned: sourcesReturned,
    }).then(({ error: e }) => { if (e) console.error("[tenant-intel] insert:", e); });
  } catch { /* non-critical */ }

  const elapsed = Date.now() - started;

  return new Response(JSON.stringify({
    ok: true,
    query: { name, city, state, mode },
    elapsed_ms: elapsed,
    sources_hit: sourcesHit,
    sources_returned: sourcesReturned,
    total_hits: allHits.length,
    high_priority_hits: highPriorityHits.length,
    summary,
    results: byCategory,
    disclaimer: "All data is from public records. For litigation use (FCRA §1681b(a)(4)). Not for commercial tenant screening without FCRA-compliant process.",
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
