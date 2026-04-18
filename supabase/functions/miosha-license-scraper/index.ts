// miosha-license-scraper — Planetary-Scale Hiring Intelligence Scanner
// SEVENTEEN data sources running in parallel + Sonar last:
// S1: NPI Registry — free federal API for healthcare workers
// S2: Michigan Nurse Aide Registry — state CNA registry
// S3: Michigan Open Data Portal — Socrata bulk license CSVs
// S4: Detroit Building Permits — THE MOAT (active tradespeople)
// S5: NATE Certified Technician Registry — HVAC certs via Firecrawl
// S6: Trade Union Directories — UA98/IBEW58/Boilermakers via Firecrawl
// S7: People Data Labs — people search API
// S8: Sonar Web Search — LinkedIn open-to-work, union spotlights, apprenticeship completions
// S9: Craigslist Skilled Trades — high-intent tradespeople posting availability
// S10: Michigan VAL License ID Enumeration — sequential LARA license IDs
// S11: Craigslist RSS — skilled trades services RSS feeds
// S12: Yelp Fusion API — contractor business owner-operators
// S13: Google Places API — contractor business discovery
// S14: Nursys — national nursing license database
// S15: PHCC Find a Contractor — plumbing/HVAC contractors
// S16: JATC Graduation Announcements — newly graduated journeymen
// S17: Thumbtack — contractor profiles with license numbers
//
// VALIDATION RULES:
// - Reject candidates with no license number AND no verifiable city
// - Reject names that look like company names (Inc, LLC, Corp, Co., dba)
// - Require name to be 2+ words (first + last)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const YELP_API_KEY = Deno.env.get("YELP_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface LicenseCandidate {
  full_name: string;
  license_type: string;
  license_number: string | null;
  license_expiry: string | null;
  city: string | null;
  source: string;
}

const COMPANY_SIGNALS = [
  "inc", "llc", "corp", "co.", "company", "contractors", "services", "service",
  "solutions", "group", "enterprises", "associates", "systems", "industries",
  "construction", "plumbing", "hvac", "mechanical", "electric", "electrical",
  "heating", "cooling", "dba", "d/b/a", "academy", "school", "university",
  "hospital", "clinic", "center", "association", "foundation", "institute",
  "authority", "department", "bureau", "commission", "council", "district",
  "board", "casino", "hotel", "resort", "comfort", "zone", "supreme", "keitz",
  "marvin", "appliance", "supply", "maintenance", "management", "properties",
  "realty", "investments", "pros", "pro", "handyman", "bargain", "rocket",
  "pipey", "downriver", "climate", "control", "repair", "holdings", "rentals",
  "leasing", "express", "all american", "friendly",
];

// Word-boundary patterns that indicate company names
const COMPANY_WORD_BOUNDARY = /\b(and|son|sons|brothers|bros|pros|pro|llc|inc|corp|co)\b/i;
// Pure phone-number pattern at start of name
const PHONE_PREFIX = /^[\(\d\s\)\-\+\.]+/;

function isPersonName(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 60) return false;
  // Phone numbers as names
  if (PHONE_PREFIX.test(trimmed)) return false;
  if (/^Phone[:\s]/i.test(trimmed)) return false;
  // Strip middle initials, count alpha-words ≥ 2 chars
  const lower = trimmed.toLowerCase();
  const alphaWords = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z][a-zA-Z\-']+$/.test(w) && w.length >= 2);
  if (alphaWords.length < 2) return false;
  if (COMPANY_SIGNALS.some((s) => lower.includes(s))) return false;
  if (COMPANY_WORD_BOUNDARY.test(lower)) return false;
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 8) return false;
  if (trimmed.includes("&")) return false;
  if (lower.endsWith(" and")) return false;
  // Must look like First Last — at least one capitalized word followed by another
  if (!/[A-Z][a-z]+\s+[A-Z][a-zA-Z\-']+/.test(trimmed)) return false;
  return true;
}

function looksLikeLicenseNumber(num: string): boolean {
  if (!num || num.length < 3) return false;
  if (!/\d/.test(num)) return false;
  if (/^\d{10}$/.test(num.replace(/\D/g, ""))) return false;
  return true;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&\w+;/g, " ").trim();
}

// Shared regex for stripping trade/business words from company names to extract person names
const TRADE_WORD_PATTERN = /\b(plumbing|hvac|heating|cooling|electric|electrical|mechanical|boiler|services|service|repair|company|contractors|solutions|co\.?|llc|inc|corp)\b/gi;

// ===== SOURCE 1: NPI Registry (Healthcare Workers) =====
const NPI_SEARCHES = [
  { taxonomy: "367H00000X", label: "Nurse Aide" },
  { taxonomy: "163W00000X", label: "Registered Nurse" },
  { taxonomy: "164W00000X", label: "Licensed Practical Nurse" },
  { taxonomy: "372600000X", label: "Home Health Aide" },
  { taxonomy: "363L00000X", label: "Nurse Practitioner" },
];

const MICHIGAN_CITIES = [
  "Detroit", "Warren", "Sterling Heights", "Dearborn", "Livonia",
  "Troy", "Southfield", "Pontiac", "Taylor", "Westland",
  "Roseville", "Royal Oak", "St. Clair Shores", "Macomb", "Clinton Township",
];

async function scanNPIRegistry(): Promise<LicenseCandidate[]> {
  const all: LicenseCandidate[] = [];
  const seen = new Set<string>();

  for (const { label } of NPI_SEARCHES) {
    for (const city of MICHIGAN_CITIES) {
      try {
        const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&city=${encodeURIComponent(city)}&state=MI&taxonomy_description=${encodeURIComponent(label)}&enumeration_type=NPI-1&limit=50`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) continue;
        const data = await res.json();
        for (const r of (data?.results || [])) {
          const fullName = `${r.basic?.first_name || ""} ${r.basic?.last_name || ""}`.trim();
          if (!fullName || !isPersonName(fullName)) continue;
          const key = `${fullName.toLowerCase()}-${r.number}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const address = r.addresses?.find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0];
          all.push({
            full_name: fullName, license_type: label,
            license_number: r.number?.toString() || null,
            license_expiry: null, city: address?.city || city, source: "npi",
          });
        }
      } catch { /* skip city */ }
    }
  }
  console.log(`[S1:NPI] Found ${all.length} healthcare candidates`);
  return all;
}

// ===== SOURCE 2: Michigan Nurse Aide Registry =====
async function scanMichiganNurseAide(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  try {
    // The MI NAR search is ASP.NET form-based; try direct search via known URLs
    const counties = ["Wayne", "Oakland", "Macomb"];
    for (const county of counties) {
      try {
        const url = `https://miidss.state.mi.us/NARSearch.aspx`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `county=${encodeURIComponent(county)}&btnSearch=Search`,
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) continue;
        const html = await res.text();
        // Extract names from HTML table rows
        const nameRegex = />([\w'-]+),\s*([\w'-]+(?:\s+[\w'-]+)?)\s*</g;
        let match;
        while ((match = nameRegex.exec(html)) !== null) {
          const lastName = match[1].trim();
          const firstName = match[2].trim();
          const fullName = `${firstName} ${lastName}`;
          if (!isPersonName(fullName)) continue;
          candidates.push({
            full_name: fullName, license_type: "Nurse Aide",
            license_number: null, license_expiry: null,
            city: null, source: "nurse_aide_registry",
          });
        }
      } catch { /* skip county */ }
    }
  } catch (e) {
    console.warn(`[S2:NAR] Error: ${e instanceof Error ? e.message : String(e)}`);
  }
  console.log(`[S2:NAR] Found ${candidates.length} CNA candidates`);
  return candidates;
}

// ===== SOURCE 3: Michigan Open Data Portal (Socrata) — DYNAMIC DATASET DISCOVERY =====
// Old hardcoded dataset IDs (r25e-29bj, 5gkx-k3qs, midl-yni7) returned 404.
// Now: discovers live LARA license datasets via Socrata metadata search.
async function scanMichiganOpenData(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // STEP 1: Discover live LARA license datasets dynamically
  let datasetIds: string[] = [];
  try {
    const metaUrl = `https://data.michigan.gov/api/views/metadata/v1?q=license&limit=50`;
    const metaRes = await fetch(metaUrl, { signal: AbortSignal.timeout(15_000) });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const rows = Array.isArray(meta) ? meta : (meta?.results || meta?.data || []);
      for (const r of rows) {
        const id = r.id || r.resource?.id;
        const name = (r.name || r.resource?.name || "").toLowerCase();
        const dept = (r.attribution || r.resource?.attribution || "").toLowerCase();
        const isLicenseRoster = /licens|profession|registr|practitioner|nurs|cosmet|trade|electric|plumb|hvac|boiler|mechanic/i.test(name);
        const isLARA = dept.includes("lara") || dept.includes("regulat") || name.includes("lara");
        if (id && isLicenseRoster && (isLARA || dept.includes("michigan"))) {
          datasetIds.push(id);
        }
      }
      console.log(`[S3:OpenData] Discovered ${datasetIds.length} candidate datasets via metadata API`);
    }
  } catch (e) {
    console.warn(`[S3:OpenData] Metadata discovery failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  // Cap at 8 to stay within wall-clock budget
  datasetIds = datasetIds.slice(0, 8);

  // STEP 2: Query each discovered dataset, with field-name fallback
  for (const ds of datasetIds) {
    try {
      const url = `https://data.michigan.gov/resource/${ds}.json?$limit=200&$order=:created_at DESC`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        console.warn(`[S3:OpenData] HTTP ${res.status} for ${ds}`);
        continue;
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      // Log first row schema once per dataset for debugging
      console.log(`[S3:OpenData] ${ds} sample keys: ${Object.keys(data[0]).slice(0, 12).join(",")}`);

      for (const row of data) {
        // Field-name fallback — Socrata schemas vary wildly across datasets
        const firstName = row.first_name || row.firstname || row.licensee_first_name || row.lic_first_name || row.f_name || row.first || "";
        const lastName = row.last_name || row.lastname || row.licensee_last_name || row.lic_last_name || row.l_name || row.last || row.surname || "";
        let fullName = row.full_name || row.licensee_name || row.name || row.dba_name || `${firstName} ${lastName}`.trim();
        if (!fullName || !isPersonName(fullName)) continue;

        const licNum = row.license_number || row.license_no || row.licensee_number || row.lic_no || row.permit_number || null;
        const city = row.city || row.licensee_city || row.business_city || null;
        const county = (row.county || row.licensee_county || "").toLowerCase();
        const licType = row.license_type || row.profession || row.license_classification || row.permit_type || "Trade Professional";
        const status = (row.license_status || row.status || row.lic_status || "ACTIVE").toUpperCase();
        const issued = row.issue_date || row.license_issue_date || row.date_issued || null;

        // Filter: must be ACTIVE
        if (status && !status.includes("ACTIVE") && !status.includes("CURRENT") && !status.includes("VALID")) continue;
        // Filter: Wayne/Oakland/Macomb (or city not specified — let it through)
        if (county && !["wayne", "oakland", "macomb"].some(c => county.includes(c))) continue;
        // Filter: trade-relevant only
        const lt = (licType || "").toUpperCase();
        const isRelevant = /ELECTR|PLUMB|HVAC|MECHANIC|BOILER|NURS|CNA|RN|LPN|REFRIG|SHEET|PIPE|WELD/i.test(lt);
        if (!isRelevant) continue;
        // Filter: issued in last 30 days if date present
        if (issued && issued < since) continue;

        let mappedType = "Trade Professional";
        if (lt.includes("ELECTR")) mappedType = "Electrician";
        else if (lt.includes("PLUMB")) mappedType = "Plumber";
        else if (lt.includes("HVAC") || lt.includes("MECHANIC") || lt.includes("REFRIG")) mappedType = "HVAC Technician";
        else if (lt.includes("BOILER")) mappedType = "Boiler Operator";
        else if (lt.includes("RN") || lt.includes("NURS")) mappedType = "Registered Nurse";
        else if (lt.includes("LPN")) mappedType = "Licensed Practical Nurse";
        else if (lt.includes("CNA")) mappedType = "Certified Nurse Aide";

        const key = fullName.toLowerCase() + (licNum || "");
        if (seen.has(key)) continue;
        seen.add(key);

        candidates.push({
          full_name: fullName, license_type: mappedType,
          license_number: licNum ? String(licNum) : null,
          license_expiry: null, city: city || null, source: "lara_socrata",
        });
      }
    } catch (e) {
      console.warn(`[S3:OpenData] ${ds} error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S3:OpenData] Found ${candidates.length} LARA candidates from Socrata datasets`);
  return candidates;
}

// ===== SOURCE 4: Detroit Building Permits — THE MOAT =====
// Detroit uses ArcGIS Hub. Real service ID: qvkbeam7Wirps6zC
// Trades Permits has: contact_name, contact_business_name, permit_type
async function scanBuildingPermits(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();

  // Real Detroit ArcGIS endpoints (discovered from data.detroitmi.gov DCAT feed)
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const dateFilter = `issued_date > TIMESTAMP '${new Date(ninetyDaysAgo).toISOString().split("T")[0]}'`;

  const endpoints = [
    {
      url: `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=${encodeURIComponent(dateFilter)}&outFields=contact_name,contact_business_name,permit_type,address&resultRecordCount=200&f=json&orderByFields=issued_date+DESC`,
      nameField: "contact_name",
    },
  ];

  for (const { url, nameField } of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        console.warn(`[S4:Permits] HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data.error) {
        console.warn(`[S4:Permits] ArcGIS error: ${JSON.stringify(data.error).slice(0, 200)}`);
        continue;
      }
      const features = data?.features || [];
      for (const f of features) {
        const attrs = f.attributes || {};
        const name = attrs[nameField] || "";
        if (!name || !isPersonName(name)) continue;
        const key = name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);

        const permitType = (attrs.permit_type || "").toUpperCase();
        let licenseType = "Trade Professional";
        if (permitType.includes("MECHANIC") || permitType.includes("HVAC")) licenseType = "HVAC Technician";
        else if (permitType.includes("PLUMB")) licenseType = "Plumber";
        else if (permitType.includes("ELECTR")) licenseType = "Electrician";
        else if (permitType.includes("BOILER")) licenseType = "Boiler Operator";

        candidates.push({
          full_name: name.trim(), license_type: licenseType,
          license_number: null, license_expiry: null,
          city: "Detroit", source: "building_permits",
        });
      }
      console.log(`[S4:Permits] Processed ${features.length} features → ${candidates.length} people`);
    } catch (e) {
      console.warn(`[S4:Permits] Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S4:Permits] Found ${candidates.length} active tradespeople from Detroit permits`);
  return candidates;
}

// Extracts person names from Firecrawl markdown using AI (OpenRouter) with regex fallback.
// Used by NATE (S5), Trade Unions (S6), and Craigslist (S9) scanners.
async function extractNamesFromMarkdown(markdown: string, role: string, source: string): Promise<LicenseCandidate[]> {
  if (!markdown || markdown.length < 50) return [];

  // Regex fallback — works without API key, catches obvious "First Last" patterns
  const extractByRegex = (): LicenseCandidate[] => {
    const seen = new Set<string>();
    const pattern = /\b([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,20})\b/g;
    let m: RegExpExecArray | null;
    const results: LicenseCandidate[] = [];
    while ((m = pattern.exec(markdown)) !== null) {
      const name = `${m[1]} ${m[2]}`;
      if (!seen.has(name) && isPersonName(name)) {
        seen.add(name);
        results.push({ full_name: name, license_type: role, license_number: null, license_expiry: null, city: null, source });
      }
    }
    return results.slice(0, 20);
  };

  if (!OPENROUTER_API_KEY) return extractByRegex();

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [{ role: "user", content: `Extract all individual person names (NOT company or business names) from this text. Return ONLY a JSON array of strings like ["First Last", ...]. If none found, return [].\n\n${markdown.slice(0, 4000)}` }],
        max_tokens: 400,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return extractByRegex();
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "[]";
    const match = content.match(/\[[\s\S]*?\]/);
    if (!match) return extractByRegex();
    const names: string[] = JSON.parse(match[0]);
    return names
      .filter((n) => typeof n === "string" && isPersonName(n))
      .slice(0, 30)
      .map((name) => ({ full_name: name, license_type: role, license_number: null, license_expiry: null, city: null, source }));
  } catch {
    return extractByRegex();
  }
}

// ===== SOURCE 5: NATE Certified Technician Registry (Firecrawl) =====
async function scanNATERegistry(): Promise<LicenseCandidate[]> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("[S5:NATE] No FIRECRAWL_API_KEY — skipping");
    return [];
  }

  const candidates: LicenseCandidate[] = [];
  const metroDetroitZips = ["48201", "48226", "48235", "48009", "48304", "48075", "48091", "48089"];

  for (const zip of metroDetroitZips) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://www.natex.org/site/find-a-technician?zip=${zip}&radius=25`,
          formats: ["markdown"],
          waitFor: 3000,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const markdown = data?.data?.markdown || data?.markdown || "";
      if (!markdown || markdown.length < 50) continue;

      // Extract names from markdown using Gemini
      const extracted = await extractNamesFromMarkdown(markdown, "HVAC Technician", "nate");
      candidates.push(...extracted);
    } catch (e) {
      console.warn(`[S5:NATE] Error for zip ${zip}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S5:NATE] Found ${candidates.length} HVAC technicians`);
  return candidates;
}

// ===== SOURCE 6: Trade Union Directories (Firecrawl) =====
async function scanTradeUnions(): Promise<LicenseCandidate[]> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("[S6:Unions] No FIRECRAWL_API_KEY — skipping");
    return [];
  }

  const candidates: LicenseCandidate[] = [];
  const UNION_URLS = [
    { url: "https://www.ua98.org/contractors", trade: "Plumber" },
    { url: "https://www.ua98.org/officers", trade: "Plumber" },
    { url: "https://www.ibew58.org/", trade: "Electrician" },
    { url: "https://smwia80.org/", trade: "HVAC Technician" },
    { url: "https://smw80jac.org/about-us", trade: "HVAC Technician" },
    { url: "https://www.michiganpipetrades.org/contractors", trade: "Plumber" },
    { url: "https://boilermakers169.org/", trade: "Boiler Operator" },
    { url: "https://www.ualocal636.org/", trade: "Plumber" },
    { url: "https://michiganbuildingtrades.org/", trade: "Trade Professional" },
  ];

  for (const { url, trade } of UNION_URLS) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], waitFor: 3000 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        console.warn(`[S6:Unions] HTTP ${res.status} for ${url}`);
        continue;
      }
      const data = await res.json();
      const markdown = data?.data?.markdown || data?.markdown || "";
      if (!markdown || markdown.length < 50) continue;

      const extracted = await extractNamesFromMarkdown(markdown, trade, "union");
      candidates.push(...extracted);
      console.log(`[S6:Unions] ${url} → ${extracted.length} names`);
    } catch (e) {
      console.warn(`[S6:Unions] Error for ${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S6:Unions] Total: ${candidates.length} union candidates`);
  return candidates;
}

// ===== SOURCE 7: People Data Labs =====
// ROTATION: splits 10 titles across days to avoid daily credit cap
async function scanPDL(): Promise<LicenseCandidate[]> {
  if (!PDL_API_KEY) {
    console.warn("[S7:PDL] No PDL_API_KEY — skipping");
    return [];
  }

  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();

  const ALL_TITLES = [
    "boiler operator", "stationary engineer", "chief engineer",
    "HVAC technician", "master plumber", "journeyman plumber",
    "master electrician", "journeyman electrician",
    "certified nursing assistant", "licensed practical nurse",
  ];

  // Rotate: 3-4 titles per day based on day-of-week (0=Sun..6=Sat)
  const dayOfWeek = new Date().getDay();
  const titleGroups = [
    [0, 1, 2],       // Sun: boiler operator, stationary engineer, chief engineer
    [3, 4],           // Mon: HVAC technician, master plumber
    [5, 6],           // Tue: journeyman plumber, master electrician
    [7, 8, 9],        // Wed: journeyman electrician, CNA, LPN
    [0, 3, 6],        // Thu: boiler operator, HVAC tech, master electrician
    [1, 4, 7],        // Fri: stationary engineer, master plumber, journeyman electrician
    [2, 5, 8, 9],     // Sat: chief engineer, journeyman plumber, CNA, LPN
  ];
  const todayIndices = titleGroups[dayOfWeek] || [0, 1, 2];
  const todayTitles = todayIndices.map(i => ALL_TITLES[i]);

  console.log(`[S7:PDL] Day ${dayOfWeek} — searching: ${todayTitles.join(", ")}`);

  for (const title of todayTitles) {
    try {
      const res = await fetch("https://api.peopledatalabs.com/v5/person/search", {
        method: "POST",
        headers: {
          "X-Api-Key": PDL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            bool: {
              must: [
                { match: { job_title: title } },
                { match: { location_region: "michigan" } },
              ],
            },
          },
          size: 25,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`[S7:PDL] HTTP ${res.status} for "${title}": ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await res.json();
      const people = data?.data || [];
      for (const p of people) {
        const fullName = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
        if (!fullName || !isPersonName(fullName)) continue;
        const key = fullName.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        // FIX: Properly extract city — guard against booleans and invalid values
        let city: string | null = null;
        const rawCity = p.location_metro || p.location_locality || p.location_name || null;
        if (rawCity && typeof rawCity === "string" && rawCity.length > 2 && rawCity !== "true" && rawCity !== "false") {
          city = rawCity;
        }

        candidates.push({
          full_name: fullName,
          license_type: mapTitleToLicenseType(title),
          license_number: null,
          license_expiry: null,
          city,
          source: "pdl",
        });
      }
      console.log(`[S7:PDL] "${title}" → ${people.length} people found`);
    } catch (e) {
      console.warn(`[S7:PDL] Error for "${title}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S7:PDL] Found ${candidates.length} candidates (${todayTitles.length} titles today)`);
  return candidates;
}

function mapTitleToLicenseType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("boiler") || lower.includes("stationary") || lower.includes("chief engineer")) return "Boiler Operator";
  if (lower.includes("hvac")) return "HVAC Technician";
  if (lower.includes("plumb")) return "Plumber";
  if (lower.includes("electr")) return "Electrician";
  if (lower.includes("nursing assistant") || lower.includes("cna")) return "Nurse Aide";
  if (lower.includes("practical nurse") || lower.includes("lpn")) return "Licensed Practical Nurse";
  return "Trade Professional";
}

// ===== SOURCE 9: Craigslist Skilled Trades (Metro Detroit — free, high-intent) =====
async function scanCraigslist(): Promise<LicenseCandidate[]> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("[S9:Craigslist] No FIRECRAWL_API_KEY — skipping");
    return [];
  }

  const candidates: LicenseCandidate[] = [];
  const searches = [
    { q: "boiler+operator", trade: "Boiler Operator" },
    { q: "licensed+plumber", trade: "Plumber" },
    { q: "hvac+technician", trade: "HVAC Technician" },
    { q: "electrician+licensed", trade: "Electrician" },
  ];

  for (const { q, trade } of searches) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://detroit.craigslist.org/search/trd?query=${q}`,
          formats: ["markdown"],
          waitFor: 3000,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        console.warn(`[S9:Craigslist] HTTP ${res.status} for ${trade}`);
        continue;
      }
      const data = await res.json();
      const markdown = data?.data?.markdown || data?.markdown || "";
      if (!markdown || markdown.length < 50) continue;

      const extracted = await extractNamesFromMarkdown(markdown, trade, "craigslist");
      candidates.push(...extracted);
      console.log(`[S9:Craigslist] ${trade} → ${extracted.length} names`);
    } catch (e) {
      console.warn(`[S9:Craigslist] Error for ${trade}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S9:Craigslist] Total: ${candidates.length} high-intent candidates`);
  return candidates;
}

// ===== SOURCE 12: Yelp Fusion API (contractor business owner-operators) =====
const YELP_TRADES = ["boiler repair", "hvac contractor", "plumber", "electrician"];
const YELP_CITIES = ["Detroit", "Warren", "Dearborn", "Troy", "Southfield", "Sterling Heights"];

const YELP_TRADE_MAP: Record<string, string> = {
  "boiler repair": "Boiler Operator",
  "hvac contractor": "HVAC Technician",
  "plumber": "Plumber",
  "electrician": "Electrician",
};

async function scanYelp(): Promise<LicenseCandidate[]> {
  if (!YELP_API_KEY) {
    console.log("[S12:Yelp] No YELP_API_KEY — skipping");
    return [];
  }
  const seen = new Set<string>();
  const candidates: LicenseCandidate[] = [];

  const pairs = YELP_TRADES.flatMap(term => YELP_CITIES.map(city => ({ term, city })));
  const responses = await Promise.all(pairs.map(({ term, city }) =>
    fetch(`https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(city + ", MI")}&limit=10`, {
      headers: { Authorization: `Bearer ${YELP_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    })
      .then(r => r.ok ? r.json().then(d => ({ term, city, businesses: d?.businesses || [] })) : null)
      .catch(() => null)
  ));

  for (const result of responses) {
    if (!result) continue;
    for (const biz of result.businesses) {
      const rawName = (biz.name || "").trim();
      const stripped = rawName.replace(TRADE_WORD_PATTERN, "").replace(/\s+/g, " ").trim();
      if (!stripped || !isPersonName(stripped)) continue;
      const key = stripped.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        full_name: stripped,
        license_type: YELP_TRADE_MAP[result.term] || "Trade Professional",
        license_number: null,
        license_expiry: null,
        city: biz.location?.city || result.city,
        source: "yelp",
      });
    }
  }
  console.log(`[S12:Yelp] Found ${candidates.length} candidates`);
  return candidates;
}

// ===== SOURCE 14: Nursys — National Nursing License Lookup =====
// ===== SOURCE 14: Nursys e-Notify JSON API (authenticated) =====
// Real API at api.nursys.com/api/enotify — async POST/GET pattern.
// Step 1: POST /notificationlookup with date window → returns TransactionId
// Step 2: GET /notificationlookup?transactionId=X → license-change events
// Step 3 (optional): POST /nurselookup for full details on each license number
const NURSYS_BASE = "https://api.nursys.com/api/enotify";
const NURSYS_USERNAME = Deno.env.get("NURSYS_USERNAME") || "";
const NURSYS_PASSWORD = Deno.env.get("NURSYS_PASSWORD") || "";

async function nursysCall(method: string, endpoint: string, body?: unknown): Promise<any> {
  const headers: Record<string, string> = {
    username: NURSYS_USERNAME,
    password: NURSYS_PASSWORD,
    "Content-Type": "application/json",
  };
  const opts: RequestInit = { method, headers, signal: AbortSignal.timeout(20_000) };
  if (body && method === "POST") opts.body = JSON.stringify(body);
  const res = await fetch(`${NURSYS_BASE}${endpoint}`, opts);
  const raw = await res.text();
  try { return { status: res.status, data: JSON.parse(raw) }; }
  catch { return { status: res.status, data: raw }; }
}

function classifyNursysLicType(t: string): string {
  const u = (t || "").toUpperCase();
  if (u.includes("APRN") || u.includes("ADVANCED")) return "Advanced Practice Registered Nurse";
  if (u.includes("CRNA")) return "Certified Registered Nurse Anesthetist";
  if (u.includes("NP") || u.includes("NURSE PRACTITIONER")) return "Nurse Practitioner";
  if (u.includes("RN") || u.includes("REGISTERED")) return "Registered Nurse";
  if (u.includes("LPN") || u.includes("PRACTICAL")) return "Licensed Practical Nurse";
  return "Nurse";
}

async function scanNursys(): Promise<LicenseCandidate[]> {
  if (!NURSYS_USERNAME || !NURSYS_PASSWORD) {
    console.log("[S14:Nursys] credentials not configured — skipping");
    return [];
  }
  const candidates: LicenseCandidate[] = [];
  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    // Step 1: request notification window
    const init = await nursysCall("POST", "/notificationlookup", { StartDate: startDate, EndDate: endDate });
    const txId = init.data?.Transaction?.TransactionId || init.data?.TransactionId;
    if (!txId) {
      console.log(`[S14:Nursys] No TransactionId in init response (status ${init.status})`);
      return [];
    }

    // Step 2: poll for results (Nursys is async; wait then GET)
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await nursysCall("GET", `/notificationlookup?transactionId=${encodeURIComponent(txId)}`);
    const notifications: any[] =
      poll.data?.Notifications ||
      poll.data?.NotificationResults ||
      poll.data?.Transaction?.Notifications ||
      [];

    if (!Array.isArray(notifications) || notifications.length === 0) {
      console.log(`[S14:Nursys] 0 notifications in window ${startDate}→${endDate}`);
      return [];
    }

    const seen = new Set<string>();
    for (const n of notifications) {
      const jurisdiction = (n.JurisdictionAbbreviation || n.Jurisdiction || "").toUpperCase();
      if (jurisdiction !== "MI") continue; // Michigan only

      const first = (n.FirstName || n.First || "").trim();
      const last = (n.LastName || n.Last || "").trim();
      if (!first || !last) continue;
      const fullName = `${first} ${last}`;
      if (!isPersonName(fullName)) continue;

      const licNum = String(n.LicenseNumber || n.LicNumber || "").trim() || null;
      const licType = classifyNursysLicType(String(n.LicenseType || n.LicType || ""));

      const key = `${fullName.toLowerCase()}|${licNum || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        full_name: fullName,
        license_type: licType,
        license_number: licNum,
        license_expiry: n.ExpirationDate || n.Expiration || null,
        city: n.City || null,
        source: "nursys_api",
      });
    }
  } catch (e) {
    console.warn(`[S14:Nursys] Error: ${e instanceof Error ? e.message : String(e)}`);
  }
  console.log(`[S14:Nursys] Found ${candidates.length} MI nurse candidates`);
  return candidates;
}

// ===== SOURCE 15: PHCC Find a Contractor Directory =====
const PHCC_ZIP_CODES = [
  "48201", "48202", "48204", "48205", // Detroit core
  "48030", "48220", "48237", "48236", // Oak Park, Ferndale, Royal Oak area
  "48089", "48091", "48092", "48093", // Warren, Sterling Heights
  "48126", "48124", "48128",           // Dearborn, Dearborn Heights
  "48301", "48302", "48304",           // Bloomfield
  "48085", "48083", "48084",           // Troy, Rochester Hills
];

async function scanPHCC(): Promise<LicenseCandidate[]> {
  const seen = new Set<string>();

  // Rotate through all zip codes 10 at a time — covers all zips across 3 days
  const dayOffset = (new Date().getDay() * 7) % PHCC_ZIP_CODES.length;
  const zipsThisRun = Array.from({ length: 10 }, (_, i) => PHCC_ZIP_CODES[(dayOffset + i) % PHCC_ZIP_CODES.length]);

  const htmlResults = await Promise.all(zipsThisRun.map(zip =>
    fetch("https://www.phccweb.org/tools-resources/find-a-contractor/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; research bot)",
      },
      body: `zip=${zip}&radius=10&type=member`,
      signal: AbortSignal.timeout(15_000),
    })
      .then(r => r.ok ? r.text().then(html => ({ zip, html })) : null)
      .catch(() => null)
  ));

  const candidates: LicenseCandidate[] = [];
  for (const result of htmlResults) {
    if (!result || !result.html || result.html.length < 200) continue;
    const { html } = result;

    const namePattern = /<(?:h[2-4]|strong|b|div[^>]*class="[^"]*(?:name|title|company)[^"]*")[^>]*>([\s\S]*?)<\/(?:h[2-4]|strong|b|div)>/gi;
    let nameMatch;
    while ((nameMatch = namePattern.exec(html)) !== null) {
      const rawCompany = stripHtml(nameMatch[1]);
      if (!rawCompany || rawCompany.length < 3) continue;

      const stripped = rawCompany.replace(TRADE_WORD_PATTERN, "").replace(/['']/g, "'").replace(/\s+/g, " ").trim();
      if (!stripped || !isPersonName(stripped)) continue;

      const key = stripped.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const lower = rawCompany.toLowerCase();
      let licType = "Plumber";
      if (lower.includes("hvac") || lower.includes("heating") || lower.includes("cooling")) licType = "HVAC Technician";
      else if (lower.includes("electric")) licType = "Electrician";

      candidates.push({
        full_name: stripped,
        license_type: licType,
        license_number: null,
        license_expiry: null,
        city: null,
        source: "phcc",
      });
    }
  }
  console.log(`[S15:PHCC] Found ${candidates.length} candidates`);
  return candidates;
}

// ===== SOURCE 16: JATC Graduation Announcements (newly graduated journeymen) =====
const JATC_SOURCES = [
  { url: "https://www.detroiteitc.org/news", trade: "Electrician", city: "Detroit" },
  { url: "https://www.aaejatc.org/news", trade: "Electrician", city: "Ann Arbor" },
  { url: "https://ualocal98.org/news", trade: "Plumber", city: "Detroit" },
  { url: "https://local80.org/news", trade: "HVAC Technician", city: "Detroit" },
];

async function scanJATCGraduations(): Promise<LicenseCandidate[]> {
  const seen = new Set<string>();
  const GRAD_KEYWORDS = /graduation|graduated|new journeyman|journeyman.*complet|apprentice.*graduat|apprenticeship.*complet|class of 20/i;

  const fetched = await Promise.all(JATC_SOURCES.map(({ url, trade, city }) =>
    fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research bot)" },
      signal: AbortSignal.timeout(10_000),
    })
      .then(r => r.ok ? r.text().then(html => ({ url, trade, city, html })) : null)
      .catch(() => null)
  ));

  const candidates: LicenseCandidate[] = [];
  for (const result of fetched) {
    if (!result || !GRAD_KEYWORDS.test(result.html)) continue;
    const { trade, city, html } = result;

    const sections = html.split(/graduation|graduated|new journeyman|apprentice.*graduat/i);
    for (let i = 1; i < sections.length; i++) {
      const cleaned = sections[i].substring(0, 2000).replace(/<[^>]+>/g, " ").replace(/&\w+;/g, " ");
      const nameMatches = cleaned.match(/\b([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+(?:\s+(?:Jr|Sr|III|IV|II)\.?)?)\b/g);
      if (!nameMatches) continue;

      for (const name of nameMatches) {
        const trimmed = name.trim();
        if (!isPersonName(trimmed)) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          full_name: trimmed, license_type: trade,
          license_number: null, license_expiry: null,
          city, source: "jatc_graduation",
        });
      }
    }
  }
  console.log(`[S16:JATC] Found ${candidates.length} candidates`);
  return candidates;
}

// ===== SOURCE 17: Thumbtack Pro Profiles =====
const THUMBTACK_SEARCHES = [
  { url: "https://www.thumbtack.com/mi/detroit/boiler-repair/", trade: "Boiler Operator" },
  { url: "https://www.thumbtack.com/mi/detroit/hvac/", trade: "HVAC Technician" },
  { url: "https://www.thumbtack.com/mi/detroit/plumbers/", trade: "Plumber" },
  { url: "https://www.thumbtack.com/mi/detroit/electricians/", trade: "Electrician" },
  { url: "https://www.thumbtack.com/mi/detroit/cna/", trade: "CNA" },
];

async function scanThumbtack(): Promise<LicenseCandidate[]> {
  const seen = new Set<string>();

  const fetched = await Promise.all(THUMBTACK_SEARCHES.map(({ url, trade }) =>
    fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research bot)" },
      signal: AbortSignal.timeout(15_000),
    })
      .then(r => r.ok ? r.text().then(html => ({ trade, html })) : null)
      .catch(() => null)
  ));

  const candidates: LicenseCandidate[] = [];
  for (const result of fetched) {
    if (!result || result.html.length < 500) continue;
    const { trade, html } = result;

    // Try JSON-LD first (Thumbtack embeds structured data)
    const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let jsonMatch;
    while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
      try {
        const ld = JSON.parse(jsonMatch[1]);
        const items = Array.isArray(ld) ? ld : [ld];
        for (const item of items) {
          if (item["@type"] !== "Person" && item["@type"] !== "LocalBusiness") continue;
          const name = (item.name || "").trim();
          if (!name || !isPersonName(name)) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({
            full_name: name, license_type: trade,
            license_number: null, license_expiry: null,
            city: item.address?.addressLocality || "Detroit",
            source: "thumbtack",
          });
        }
      } catch { /* invalid JSON-LD, skip */ }
    }

    // Fallback: regex for profile name patterns
    const profilePattern = /data-testid="pro-name"[^>]*>([^<]+)</gi;
    let profileMatch;
    while ((profileMatch = profilePattern.exec(html)) !== null) {
      const name = profileMatch[1].trim();
      if (!isPersonName(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        full_name: name, license_type: trade,
        license_number: null, license_expiry: null,
        city: "Detroit", source: "thumbtack",
      });
    }
  }
  console.log(`[S17:Thumbtack] Found ${candidates.length} candidates`);
  return candidates;
}

// ===== SOURCE 8: Sonar Web Search (LinkedIn open-to-work, union spotlights, apprenticeship completions) =====
const SONAR_QUERIES = [
  {
    query: `Find individual licensed boiler operators or stationary engineers in Metro Detroit Michigan with public LinkedIn profiles showing "open to work" OR who are listed on UA Local 636 member pages OR mentioned in Michigan Building Tradesman newspaper articles. Search LinkedIn, Manta, YellowPages contractor listings, and trade association member pages. Return only individual people (first + last name) with their city. Max 10 results.`,
    label: "Boiler Operator",
  },
  {
    query: `Find individual HVAC technicians in Metro Detroit Michigan with LinkedIn profiles showing "open to work" OR listed in NATE certified technician directories OR mentioned in SMW Local 80 apprenticeship graduations. Search Indeed public resumes, ZipRecruiter profiles, and trade directories. Return person names with city only. Max 10 results.`,
    label: "HVAC Technician",
  },
  {
    query: `Find individual licensed plumbers in Metro Detroit Michigan with LinkedIn profiles showing "open to work" OR listed in UA Local 98 member directories OR mentioned in Michigan Pipe Trades Association announcements. Search Indeed resumes, trade union news, and apprenticeship completion announcements. Person names with city only. Max 10 results.`,
    label: "Plumber",
  },
  {
    query: `Search LinkedIn for electricians in Michigan with "open to work" status or who recently updated their profile. Also search IBEW Local 58 member spotlights, news articles, and Michigan electrical apprenticeship completion announcements. Include anyone who mentions Michigan journeyman or master electrician license. Return name and city only. Max 10 results.`,
    label: "Electrician",
  },
  {
    query: `Find people who recently completed registered apprenticeships in Michigan for electrical, plumbing, HVAC, pipefitting, or boiler operation. Search: Henry Ford College skilled trades program graduation lists, Macomb Community College HVAC/electrical program completions, Michigan Joint Apprenticeship Committee (JAC) completion ceremony announcements, UA Local 98 apprenticeship graduates, IBEW Local 58 new journeymen announcements, Michigan Building Tradesman newspaper mentions of new journeymen or apprenticeship completions. Return individual names (First Last) with city and trade. Max 15 results.`,
    label: "Trade Professional",
  },
];

async function scanViaSonar(): Promise<LicenseCandidate[]> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[S8:Sonar] No OPENROUTER_API_KEY — skipping");
    return [];
  }

  const all: LicenseCandidate[] = [];

  for (const { query, label } of SONAR_QUERIES) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages: [
            {
              role: "system",
              content: `You are a recruiting intelligence researcher finding tradespeople in Michigan.

CRITICAL RULES:
1. Return ONLY individual people — NEVER company names, LLC, Inc, contractors, organizations
2. Each result MUST have: a real person's full name (First Last) AND at least one of: specific Michigan city, current employer, or license number
3. Search sources: LinkedIn "open to work" profiles, Indeed public resumes, trade union directories, apprenticeship completion announcements, professional certification directories, Building Tradesman newspaper mentions
4. Do NOT fabricate names — only include people you actually find mentioned by name in real sources
5. It's OK to return fewer results if you can only verify a few real individuals

Return ONLY valid JSON array. Each object: { "full_name": "First Last", "license_number": "number or null", "city": "Michigan city or null", "current_employer": "company or null" }. Max 15 results. No markdown. No explanation. If you find nothing, return [].`,
            },
            { role: "user", content: query },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.warn(`[S8:Sonar] HTTP ${res.status} for ${label}`);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        if (text.length > 50 && LOVABLE_API_KEY) {
          const extracted = await extractNamesFromProse(text, label, "sonar");
          all.push(...extracted);
        }
        continue;
      }

      let parsed: any[];
      try { parsed = JSON.parse(jsonMatch[0]); } catch { continue; }
      if (!Array.isArray(parsed)) continue;

      for (const r of parsed) {
        if (!r.full_name || !isPersonName(r.full_name)) continue;
        const hasLicNum = r.license_number && looksLikeLicenseNumber(String(r.license_number));
        const hasCity = r.city && r.city.toLowerCase() !== "michigan" && r.city.length > 2;
        const hasEmployer = r.current_employer && r.current_employer.length > 2;
        if (!hasLicNum && !hasCity && !hasEmployer) continue;

        all.push({
          full_name: r.full_name, license_type: label,
          license_number: hasLicNum ? String(r.license_number) : null,
          license_expiry: null,
          city: hasCity ? r.city : null, source: "sonar",
        });
      }
      console.log(`[S8:Sonar] ${label}: ${parsed.length} raw → ${all.length} total`);
    } catch (e) {
      console.warn(`[S8:Sonar] Error for ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S8:Sonar] Total: ${all.length} candidates`);
  return all;
}

// ===== SHARED: Gemini name extraction from markdown/prose =====
async function extractNamesFromMarkdown(markdown: string, label: string, source: string): Promise<LicenseCandidate[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: `Extract individual people's names from this page content about ${label}s in Michigan. Return ONLY a JSON array: [{"full_name":"First Last","city":"City or null"}]. Only include real individual people, not companies. No markdown. Max 30 results.`,
          },
          { role: "user", content: markdown.slice(0, 8000) },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ full_name: string; city?: string }>;
    return parsed
      .filter((r) => r.full_name && isPersonName(r.full_name))
      .map((r) => ({
        full_name: r.full_name, license_type: label,
        license_number: null, license_expiry: null,
        city: r.city && r.city.length > 2 ? r.city : null, source,
      }));
  } catch { return []; }
}

async function extractNamesFromProse(prose: string, label: string, source: string): Promise<LicenseCandidate[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: `Extract individual people's names from this text about ${label}s in Michigan. Return ONLY a JSON array: [{"full_name":"First Last","city":"City or null","license_number":"number or null"}]. Only include real individual people, not companies. No markdown.`,
          },
          { role: "user", content: prose },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      full_name: string; city?: string; license_number?: string;
    }>;
    return parsed
      .filter((r) => r.full_name && isPersonName(r.full_name))
      .map((r) => ({
        full_name: r.full_name, license_type: label,
        license_number: r.license_number && looksLikeLicenseNumber(r.license_number) ? r.license_number : null,
        license_expiry: null,
        city: r.city && r.city.length > 2 && r.city.toLowerCase() !== "michigan" ? r.city : null,
        source,
      }));
  } catch { return []; }
}

// ===== DATA COMPLETENESS CALCULATOR =====
function calculateCompleteness(row: Record<string, unknown>): number {
  let score = 0;
  if (row.full_name) score += 20;
  const city = row.city as string | null;
  if (city && city.length > 2 && city.toLowerCase() !== "michigan" && city.toLowerCase() !== "mi") score += 20;
  if (row.license_type) score += 20;
  if (row.license_number) score += 20;
  if (row.license_expiry) score += 10;
  if (row.linkedin_url) score += 10;
  return score;
}

// ===== DB UPSERT =====
// CRITICAL: Always writes BOTH `name` AND `full_name` — the `name` column is NOT NULL
const BUSINESS_SOURCES = new Set([
  "yelp", "phcc", "building_permits", "thumbtack", "google_places",
  // New company-routed sources (S22, S23, S25)
  "lara_contractor_co", "osha_establishment", "michigan_sos_co",
]);

async function upsertCandidate(sb: any, c: LicenseCandidate): Promise<"new" | "updated" | "error"> {
  try {
    // Phase 1 fix: business-directory sources never go to candidates table.
    // Route to techalert_business_prospects (B2B prospect feeder for TechAlert sales).
    if (BUSINESS_SOURCES.has(c.source)) {
      try {
        await sb.from("techalert_business_prospects").upsert({
          business_name: c.full_name,
          trade: c.license_type,
          city: c.city,
          source: c.source,
          raw_data: c as any,
        }, { onConflict: "business_name,city" });
        return "updated";
      } catch { return "error"; }
    }

    const row: Record<string, unknown> = {
      name: c.full_name,           // REQUIRED — NOT NULL column
      full_name: c.full_name,      // Also write full_name
      license_type: c.license_type,
      source: c.source,
      last_seen_at: new Date().toISOString(),
    };
    if (c.license_number) row.license_number = c.license_number;
    if (c.license_expiry) row.license_expiry = c.license_expiry;
    if (c.city) row.city = c.city;

    // Calculate data completeness
    row.data_completeness = calculateCompleteness(row);

    let candidateId: string | null = null;
    let isNew = false;

    if (c.license_number) {
      const { data: existing } = await sb
        .from("hire_alert_candidates")
        .select("id")
        .eq("license_number", c.license_number)
        .maybeSingle();

      if (existing) {
        await sb.from("hire_alert_candidates").update({ last_seen_at: new Date().toISOString(), name: c.full_name, data_completeness: row.data_completeness }).eq("id", existing.id);
        candidateId = existing.id;
      } else {
        const { data: inserted } = await sb.from("hire_alert_candidates").insert({ ...row, status: "new", first_seen_at: new Date().toISOString() }).select("id").maybeSingle();
        candidateId = inserted?.id || null;
        isNew = true;
      }
    } else {
      const { data: existing } = await sb
        .from("hire_alert_candidates")
        .select("id")
        .eq("full_name", c.full_name)
        .eq("license_type", c.license_type)
        .eq("source", c.source)
        .maybeSingle();

      if (!existing) {
        const { data: inserted } = await sb.from("hire_alert_candidates").insert({ ...row, status: "new", first_seen_at: new Date().toISOString() }).select("id").maybeSingle();
        candidateId = inserted?.id || null;
        isNew = true;
      } else {
        await sb.from("hire_alert_candidates").update({ last_seen_at: new Date().toISOString(), name: c.full_name, data_completeness: row.data_completeness }).eq("id", existing.id);
        candidateId = existing.id;
      }
    }

    // Cross-reference check: same name + city + license_type from DIFFERENT source
    if (candidateId && c.city && c.full_name) {
      try {
        const { data: crossMatches } = await sb
          .from("hire_alert_candidates")
          .select("id")
          .eq("full_name", c.full_name)
          .eq("license_type", c.license_type)
          .eq("city", c.city)
          .neq("id", candidateId);

        if (crossMatches && crossMatches.length > 0) {
          // Mark all matching rows as cross-referenced
          const allIds = [candidateId, ...crossMatches.map((m: any) => m.id)];
          await sb.from("hire_alert_candidates").update({ cross_referenced: true }).in("id", allIds);
          console.log(`[upsert] ⚡ Cross-referenced: ${c.full_name} (${allIds.length} records)`);
        }
      } catch { /* non-critical */ }
    }

    return isNew ? "new" : "updated";
  } catch (e) {
    console.error(`[upsert] Error for ${c.full_name}:`, e);
    return "error";
  }
}

// ===== S10: LARA/MiPLUS Adapter with Full Resilience & Health Monitoring =====
// Gemini Strategy: "MiPLUS migration is an existential risk. Build resilience."
//
// RESILIENCE LAYERS:
//   1. Retry with exponential backoff (3 retries: 2s, 4s, 8s)
//   2. User-Agent rotation (5 browser fingerprints)
//   3. CAPTCHA/Cloudflare detection → graceful degradation
//   4. Format change detection (new MiPLUS portal layout detection)
//   5. Health logging to `lara_health_log` table (pattern detection over time)
//   6. SMS alert to Matt when LARA goes down 2+ consecutive days
//   7. Automatic fallback amplification: when LARA is blocked, boost Sonar + OpenData
//   8. Alternative URL probing (multiple LARA endpoints)
//
const MIPLUS_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
];

// Multiple LARA endpoints to probe — if MiPLUS migrates, one of these may still work
const LARA_ENDPOINTS = [
  { url: "https://aca-prod.accela.com/LARA/Cap/CapHome.aspx?module=Licensing&TabName=Licensing", label: "Accela MiPLUS" },
  { url: "https://miplus.michigan.gov", label: "MiPLUS Direct" },
  { url: "https://www.michigan.gov/lara/bureau-list/bcc/licensee-search", label: "LARA BCC Search" },
];

// Known HTML fingerprints that indicate LARA format we understand
const KNOWN_FORMAT_SIGNATURES = [
  "CapHome",
  "module=Licensing",
  "ACA_",
  "Accela",
  "licensee",
];

let laraStatus: "ok" | "blocked" | "down" | "captcha" | "timeout" | "format_changed" | "not_attempted" = "not_attempted";
let laraHttpStatus = 0;
let laraResponseBytes = 0;
let laraResponseTimeMs = 0;
let laraErrorMessage = "";
let laraFallbackActivated = false;

// ===== S10A: LARA Health Probe (preserved — internal monitoring only, returns no candidates) =====
async function probeLARAHealth(): Promise<void> {
  const maxRetries = 2;
  const baseDelay = 1500;
  for (const endpoint of LARA_ENDPOINTS) {
    let success = false;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const ua = MIPLUS_USER_AGENTS[Math.floor(Math.random() * MIPLUS_USER_AGENTS.length)];
      const startTime = Date.now();
      try {
        const res = await fetch(endpoint.url, {
          headers: { "User-Agent": ua, "Accept": "text/html,*/*", "Accept-Language": "en-US,en;q=0.9" },
          redirect: "follow", signal: AbortSignal.timeout(10_000),
        });
        laraResponseTimeMs = Date.now() - startTime;
        laraHttpStatus = res.status;
        if (res.status === 403 || res.status === 429) {
          laraStatus = "blocked"; laraErrorMessage = `HTTP ${res.status} from ${endpoint.label}`;
          if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt))); continue; }
          break;
        }
        if (!res.ok) {
          laraStatus = "down"; laraErrorMessage = `HTTP ${res.status} from ${endpoint.label}`;
          break;
        }
        const html = await res.text();
        laraResponseBytes = html.length;
        if (html.includes("captcha") || html.includes("cf-challenge") || html.includes("Just a moment")) {
          laraStatus = "captcha"; laraErrorMessage = `CAPTCHA on ${endpoint.label}`;
          break;
        }
        const known = KNOWN_FORMAT_SIGNATURES.some(sig => html.includes(sig));
        if (!known && html.length > 1000) {
          laraStatus = "format_changed"; laraErrorMessage = `Format changed on ${endpoint.label}`;
          break;
        }
        laraStatus = "ok"; laraErrorMessage = "";
        success = true;
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        laraResponseTimeMs = Date.now() - startTime;
        laraStatus = msg.includes("timeout") ? "timeout" : "down";
        laraErrorMessage = `${endpoint.label}: ${msg}`;
        if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
      }
    }
    if (success) break;
  }
  if (laraStatus !== "ok" && laraStatus !== "not_attempted") {
    laraFallbackActivated = true;
  }
}

// ===== S10B: LARA BCC via Sonar — REAL CANDIDATE EXTRACTION =====
// Bureau of Construction Codes (boiler/electrical/plumbing/HVAC) doesn't bulk-publish.
// Use Sonar (perplexity/sonar-pro) with targeted queries to pull recently licensed individuals.
async function scanLARABCCViaSonar(): Promise<LicenseCandidate[]> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") || "";
  if (!apiKey) { console.warn("[S10B:BCC] OPENROUTER_API_KEY missing"); return []; }
  const candidates: LicenseCandidate[] = [];
  const trades = [
    { type: "Boiler Operator", q: "Michigan LARA boiler operator license newly issued 2026 Wayne OR Oakland OR Macomb County" },
    { type: "Electrician", q: "Michigan journeyman electrician license 2026 newly licensed metro Detroit" },
    { type: "Plumber", q: "Michigan journeyman plumber license 2026 newly issued Wayne Oakland Macomb" },
    { type: "HVAC Technician", q: "Michigan mechanical contractor HVAC license 2026 newly licensed metro Detroit" },
  ];
  for (const t of trades) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages: [
            { role: "system", content: "Return ONLY a JSON array. No prose, no markdown. Each item: {full_name, license_number, city}. Empty array if none found." },
            { role: "user", content: `${t.q}. Source: aca-prod.accela.com or michigan.gov LARA pages. Real names of individuals only — exclude businesses. Return up to 10 records as JSON array. JSON only.` },
          ],
          max_tokens: 700, temperature: 0.1,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) continue;
      let arr: any[] = [];
      try { arr = JSON.parse(m[0]); } catch { continue; }
      for (const row of arr) {
        const name = (row.full_name || row.name || "").trim();
        if (!name || !isPersonName(name)) continue;
        candidates.push({
          full_name: name, license_type: t.type,
          license_number: row.license_number ? String(row.license_number) : null,
          license_expiry: null, city: row.city || null, source: "lara_bcc",
        });
      }
    } catch (e) {
      console.warn(`[S10B:BCC] ${t.type} error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`[S10B:BCC] Found ${candidates.length} BCC candidates via Sonar`);
  return candidates;
}

// ===== S10C: LARA VAL ID Enumeration — INSTANT NEW LICENSE RADAR =====
// Sequentially probes the next N license IDs. New license issued = new ID = caught within minutes.
async function scanLARAValEnumeration(): Promise<LicenseCandidate[]> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const candidates: LicenseCandidate[] = [];
  // Get cursor
  const { data: cursor } = await sb.from("lara_val_cursor").select("last_val_id").eq("id", 1).maybeSingle();
  let lastId = cursor?.last_val_id || 6500000; // sensible LARA range starting point
  const PROBE_COUNT = 30; // keep small per run; runs every 30 min
  let probed = 0;
  for (let i = 1; i <= PROBE_COUNT; i++) {
    const valId = lastId + i;
    probed++;
    try {
      const url = `https://aca-prod.accela.com/LARA/Cap/CapDetail.aspx?Module=Licensing&capID1=23VAL&capID2=00000&capID3=${valId}`;
      const res = await fetch(url, {
        headers: { "User-Agent": MIPLUS_USER_AGENTS[Math.floor(Math.random() * MIPLUS_USER_AGENTS.length)] },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) { await new Promise(r => setTimeout(r, 1000)); continue; }
      const html = await res.text();
      // Match licensee name in detail page
      const nameMatch = html.match(/Licensee\s*[:<][^>]*>\s*([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){1,3})/i);
      const licMatch = html.match(/License\s*Number[:<][^>]*>\s*([A-Z0-9\-]+)/i);
      const typeMatch = html.match(/License\s*Type[:<][^>]*>\s*([A-Za-z\s]+?)</i);
      const cityMatch = html.match(/(?:City|Address)[^<]*<[^>]*>\s*[^,]*,\s*([A-Za-z\s]+?),\s*MI/i);
      if (nameMatch && isPersonName(nameMatch[1])) {
        const lt = (typeMatch?.[1] || "").toUpperCase();
        let mappedType = "Trade Professional";
        if (lt.includes("ELECTR")) mappedType = "Electrician";
        else if (lt.includes("PLUMB")) mappedType = "Plumber";
        else if (lt.includes("BOILER")) mappedType = "Boiler Operator";
        else if (lt.includes("HVAC") || lt.includes("MECHANIC")) mappedType = "HVAC Technician";
        candidates.push({
          full_name: nameMatch[1].trim(), license_type: mappedType,
          license_number: licMatch?.[1] || `VAL-${valId}`,
          license_expiry: null, city: cityMatch?.[1]?.trim() || null,
          source: "lara_val",
        });
      }
      await new Promise(r => setTimeout(r, 1000)); // 1 req/sec — be polite
    } catch { /* skip */ }
  }
  // Update cursor
  await sb.from("lara_val_cursor").upsert({ id: 1, last_val_id: lastId + probed, updated_at: new Date().toISOString() }, { onConflict: "id" });
  console.log(`[S10C:VAL] Probed ${probed} IDs ${lastId + 1}-${lastId + probed}, found ${candidates.length}`);
  return candidates;
}

// ===== S10 Wrapper: runs health probe + LARA BCC Sonar extractor =====
// NOTE: VAL ID enumeration was moved to standalone `lara-fast-scanner` edge
// function (30-min cron) for instant new-license detection. This wrapper now
// only handles BCC Sonar so the main 4-hour scanner isn't slowed by VAL probes.
async function scanMiPLUS(): Promise<LicenseCandidate[]> {
  await probeLARAHealth();
  const bcc = await scanLARABCCViaSonar().catch(() => []);
  if (laraStatus !== "ok" && laraStatus !== "not_attempted") {
    console.warn(`[MiPLUS] 🔄 LARA portal status: ${laraStatus}. Real-data extraction continues via BCC Sonar (VAL via lara-fast-scanner).`);
  }
  return bcc;
}

// ===== Twilio SMS helper for LARA alerts (uses shared TCPA-compliant helper) =====
import { sendSMS as sharedSendSMS, ADMIN_PHONE as SHARED_ADMIN_PHONE } from "../_shared/twilio.ts";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_PHONE = SHARED_ADMIN_PHONE;
async function sendSMS(to: string, body: string): Promise<void> {
  await sharedSendSMS(to, TWILIO_PHONE_NUMBER, body, "lara_health_alert");
}

// Log LARA health to database and alert Matt if needed
async function logLaraHealthAndAlert(sb: any): Promise<void> {
  try {
    // Log health check
    const fallbackSources: string[] = [];
    if (laraFallbackActivated) {
      fallbackSources.push("Sonar (expanded)", "OpenData (expanded)", "NPI", "Permits");
    }

    await sb.from("lara_health_log").insert({
      status: laraStatus === "not_attempted" ? "ok" : laraStatus,
      http_status: laraHttpStatus || null,
      response_bytes: laraResponseBytes || null,
      response_time_ms: laraResponseTimeMs || null,
      error_message: laraErrorMessage || null,
      fallback_activated: laraFallbackActivated,
      fallback_sources: fallbackSources.length ? fallbackSources : null,
      candidates_from_fallback: 0, // Updated after Sonar runs
    } as any);

    // Alert Matt if LARA has been down 2+ consecutive days
    if (laraStatus !== "ok" && laraStatus !== "not_attempted") {
      const { data: recentLogs } = await sb
        .from("lara_health_log")
        .select("status, checked_at")
        .order("checked_at", { ascending: false })
        .limit(3);

      const consecutiveFailures = (recentLogs as any[] | null)?.filter((l: any) => l.status !== "ok").length ?? 0;

      if (consecutiveFailures >= 2) {
        const alertMsg = `🚨 LARA ALERT: Portal ${laraStatus} for ${consecutiveFailures} consecutive checks. Last error: ${laraErrorMessage.substring(0, 100)}. Fallback sources active but consider manual investigation.`;
        try {
          await sendSMS(ADMIN_PHONE, alertMsg);
          console.log("[MiPLUS] 📱 Alert SMS sent to Matt — LARA down consecutive checks");
        } catch {
          console.error("[MiPLUS] Failed to send alert SMS");
        }
      }

      // Extra alert for format changes — this is the existential risk
      if (laraStatus === "format_changed") {
        const formatAlert = `⚠️ CRITICAL: LARA portal FORMAT CHANGED — our scraper signatures no longer match. This may be the MiPLUS migration. Immediate investigation needed. Error: ${laraErrorMessage.substring(0, 120)}`;
        try {
          await sendSMS(ADMIN_PHONE, formatAlert);
          console.log("[MiPLUS] 🚨 FORMAT CHANGE alert sent to Matt");
        } catch {
          console.error("[MiPLUS] Failed to send format change alert");
        }
      }
    }
  } catch (e) {
    console.error("[MiPLUS] Failed to log LARA health:", e instanceof Error ? e.message : String(e));
  }
}

// ===== MAIN HANDLER =====
// ===== SOURCE 18: DOL Apprenticeship Completions (federal RAPIDS) =====
// Scrapes the public DOL apprenticeship sponsor directory for newly minted journeymen
// Free DOL_API_KEY required (https://developer.dol.gov/)
const DOL_API_KEY = Deno.env.get("DOL_API_KEY") || "";
async function scanDOLApprenticeships(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  if (!DOL_API_KEY) { console.warn("[S18:DOL] DOL_API_KEY missing"); return candidates; }
  try {
    // DOL Open Data: Apprenticeship Active Sponsors for MI — gives sponsor names + occupations
    const url = `https://apiprod.dol.gov/v4/get/eta/apprenticeship/json?state=MI&limit=100&X-API-KEY=${DOL_API_KEY}`;
    const res = await fetch(url, {
      headers: { "X-API-KEY": DOL_API_KEY, "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { console.warn(`[S18:DOL] HTTP ${res.status}`); return candidates; }
    const data = await res.json();
    const rows = Array.isArray(data?.data) ? data.data : (data?.results || []);
    for (const row of rows) {
      // DOL exposes sponsor + occupation; we treat the apprentice/journeyworker name field if present
      const name = row.apprentice_name || row.journeyworker_name || row.sponsor_name || "";
      if (!name || !isPersonName(name)) continue;
      const occ = (row.occupation_title || row.occupation || "").toString();
      let licenseType = "Trade Professional";
      const o = occ.toUpperCase();
      if (o.includes("ELECTR")) licenseType = "Electrician";
      else if (o.includes("PLUMB")) licenseType = "Plumber";
      else if (o.includes("HVAC") || o.includes("MECHANIC")) licenseType = "HVAC Technician";
      else if (o.includes("BOILER") || o.includes("PIPEFITTER")) licenseType = "Boiler Operator";
      else if (o.includes("CARPEN")) licenseType = "Carpenter";
      candidates.push({
        full_name: name, license_type: licenseType,
        license_number: row.registration_number?.toString() || null,
        license_expiry: null, city: row.city || null, source: "dol_apprenticeship",
      });
    }
  } catch (e) { console.warn(`[S18:DOL] Error: ${e instanceof Error ? e.message : String(e)}`); }
  console.log(`[S18:DOL] Found ${candidates.length} apprenticeship candidates`);
  return candidates;
}

// ===== SOURCE 19: LARA Cosmetology / Barbers (Socrata fallback to MiPLUS search HTML) =====
async function scanLARACosmetology(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  try {
    const url = `https://data.michigan.gov/resource/midl-yni7.json?$where=upper(profession)%20like%20%27%25COSMETOL%25%27%20OR%20upper(profession)%20like%20%27%25BARBER%25%27&$limit=200`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return candidates;
    const rows = await res.json();
    for (const r of (Array.isArray(rows) ? rows : [])) {
      const fn = r.first_name || ""; const ln = r.last_name || "";
      const full = `${fn} ${ln}`.trim();
      if (!isPersonName(full)) continue;
      candidates.push({
        full_name: full,
        license_type: (r.profession || "Cosmetologist").toString().split(" ")[0],
        license_number: r.license_number ? String(r.license_number) : null,
        license_expiry: r.expiration_date || null,
        city: r.city || null, source: "lara_cosmetology",
      });
    }
  } catch (e) { console.warn(`[S19:Cosmo] ${e instanceof Error ? e.message : String(e)}`); }
  console.log(`[S19:Cosmo] Found ${candidates.length} cosmetology/barber candidates`);
  return candidates;
}

// ===== SOURCE 20: LARA Real Estate / Insurance (Socrata) =====
async function scanLARARealEstate(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  try {
    const url = `https://data.michigan.gov/resource/midl-yni7.json?$where=upper(profession)%20like%20%27%25REAL%20ESTATE%25%27%20OR%20upper(profession)%20like%20%27%25INSURANCE%25%27&$limit=200`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return candidates;
    const rows = await res.json();
    for (const r of (Array.isArray(rows) ? rows : [])) {
      const fn = r.first_name || ""; const ln = r.last_name || "";
      const full = `${fn} ${ln}`.trim();
      if (!isPersonName(full)) continue;
      candidates.push({
        full_name: full,
        license_type: (r.profession || "Real Estate").toString().split(" ").slice(0,2).join(" "),
        license_number: r.license_number ? String(r.license_number) : null,
        license_expiry: r.expiration_date || null,
        city: r.city || null, source: "lara_real_estate",
      });
    }
  } catch (e) { console.warn(`[S20:RE] ${e instanceof Error ? e.message : String(e)}`); }
  console.log(`[S20:RE] Found ${candidates.length} real estate/insurance candidates`);
  return candidates;
}

// ===== S21: BPL Newly-Issued 7-Day Delta (Socrata explicit issue_date filter) =====
// Tighter than S3's 30-day window. Explicitly filters on issue_date so we only
// surface people who were JUST licensed — the highest-intent availability signal.
async function scanBPLNewlyIssued(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Discover LARA trade datasets from Socrata, same as S3 but we apply a strict issue_date WHERE clause
  const knownDatasetIds: string[] = [];
  try {
    const meta = await fetch("https://data.michigan.gov/api/views/metadata/v1?q=license&limit=50", { signal: AbortSignal.timeout(10_000) });
    if (meta.ok) {
      const rows: any[] = await meta.json().then((d: any) => Array.isArray(d) ? d : (d?.results || []));
      for (const r of rows) {
        const id = r.id || r.resource?.id;
        const name = (r.name || r.resource?.name || "").toLowerCase();
        const dept = (r.attribution || r.resource?.attribution || "").toLowerCase();
        if (id && /licens|electric|plumb|hvac|boiler|mechanic|nurs/i.test(name) && (dept.includes("lara") || dept.includes("michigan"))) {
          knownDatasetIds.push(id);
        }
      }
    }
  } catch { /* fall through with empty list */ }

  for (const ds of knownDatasetIds.slice(0, 6)) {
    try {
      // Socrata WHERE on issue_date — many LARA datasets expose this column
      const url = `https://data.michigan.gov/resource/${ds}.json?$where=issue_date>='${since7}'&$limit=200&$order=issue_date DESC`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const data: any[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      for (const row of data) {
        const firstName = row.first_name || row.licensee_first_name || row.f_name || "";
        const lastName = row.last_name || row.licensee_last_name || row.l_name || "";
        const fullName = row.full_name || row.licensee_name || `${firstName} ${lastName}`.trim();
        if (!fullName || !isPersonName(fullName)) continue;
        const licType = row.license_type || row.profession || row.license_classification || "Trade Professional";
        const lt = licType.toUpperCase();
        if (!/ELECTR|PLUMB|HVAC|MECHANIC|BOILER|NURS|CNA|RN|LPN/i.test(lt)) continue;
        const status = (row.license_status || row.status || "ACTIVE").toUpperCase();
        if (!status.includes("ACTIVE") && !status.includes("CURRENT") && !status.includes("VALID")) continue;
        const key = fullName.toLowerCase() + (row.license_number || "");
        if (seen.has(key)) continue;
        seen.add(key);

        let mappedType = "Trade Professional";
        if (lt.includes("ELECTR")) mappedType = "Electrician";
        else if (lt.includes("PLUMB")) mappedType = "Plumber";
        else if (lt.includes("HVAC") || lt.includes("MECHANIC")) mappedType = "HVAC Technician";
        else if (lt.includes("BOILER")) mappedType = "Boiler Operator";
        else if (lt.includes("RN") || lt.includes("NURS")) mappedType = "Registered Nurse";
        else if (lt.includes("LPN")) mappedType = "Licensed Practical Nurse";
        else if (lt.includes("CNA")) mappedType = "Certified Nurse Aide";

        candidates.push({
          full_name: fullName,
          license_type: mappedType,
          license_number: row.license_number ? String(row.license_number) : null,
          license_expiry: row.expiration_date || null,
          city: row.city || row.licensee_city || null,
          source: "lara_newly_issued",
        });
      }
    } catch { /* skip dataset */ }
  }
  console.log(`[S21:NewlyIssued] Found ${candidates.length} candidates issued in last 7 days`);
  return candidates;
}

// ===== S22: BPL Contractor Company License Extraction =====
// The same Socrata LARA datasets contain COMPANY licenses (ELECTRICAL CONTRACTOR,
// MECHANICAL CONTRACTOR, PLUMBING CONTRACTOR, etc.) mixed with individual licenses.
// Extract those and route them to techalert_business_prospects via source "lara_contractor_co".
// This surfaces newly licensed trade businesses — companies that NEED workers right now.
async function scanBPLContractorCompanies(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let datasetIds: string[] = [];
  try {
    const meta = await fetch("https://data.michigan.gov/api/views/metadata/v1?q=contractor+license&limit=30", { signal: AbortSignal.timeout(10_000) });
    if (meta.ok) {
      const rows: any[] = await meta.json().then((d: any) => Array.isArray(d) ? d : (d?.results || []));
      for (const r of rows) {
        const id = r.id || r.resource?.id;
        const name = (r.name || r.resource?.name || "").toLowerCase();
        if (id && /licens|contractor|electric|plumb|hvac|mechanic/i.test(name)) datasetIds.push(id);
      }
    }
  } catch { /* fall through */ }

  for (const ds of datasetIds.slice(0, 5)) {
    try {
      // Query for CONTRACTOR license types specifically
      const where = encodeURIComponent(`license_type like '%CONTRACTOR%' OR license_type like '%COMPANY%' OR license_type like '%FIRM%'`);
      const url = `https://data.michigan.gov/resource/${ds}.json?$where=${where}&$limit=200&$order=issue_date DESC`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const data: any[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      for (const row of data) {
        const bizName = row.company_name || row.business_name || row.licensee_name || row.dba_name || row.full_name || row.name || "";
        if (!bizName || bizName.length < 3) continue;
        const licType = row.license_type || row.profession || "Contractor";
        const lt = licType.toUpperCase();
        if (!/ELECTR|PLUMB|HVAC|MECHANIC|BOILER|HEATING|COOLING|PIPE/i.test(lt)) continue;
        const issued = row.issue_date || row.effective_date || null;
        if (issued && issued < since30) continue;
        const key = bizName.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        candidates.push({
          full_name: bizName,
          license_type: licType,
          license_number: row.license_number ? String(row.license_number) : null,
          license_expiry: row.expiration_date || null,
          city: row.city || row.business_city || null,
          source: "lara_contractor_co",
        });
      }
    } catch { /* skip */ }
  }
  console.log(`[S22:ContractorCo] Found ${candidates.length} newly licensed contractor companies`);
  return candidates;
}

// ===== S23: OSHA Michigan Trade Establishments =====
// OSHA publishes inspection data for all establishments via a free REST API.
// Filters for Michigan + trade NAICS codes. Routes to techalert_business_prospects
// (active employers with inspections = actively operating, likely hiring).
async function scanOSHAMichiganEstablishments(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();
  // NAICS codes: 238210=Electrical, 238220=Plumbing+HVAC, 238290=Other building equipment (boilers)
  const naicsCodes = ["238210", "238220", "238290", "238110"];
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const naics of naicsCodes) {
    try {
      const url = `https://enforcements.osha.gov/api/search/inspections?state=MI&naics=${naics}&size=50&sort=open_date:desc`;
      const res = await fetch(url, {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 research" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        console.warn(`[S23:OSHA] HTTP ${res.status} for NAICS ${naics}`);
        continue;
      }
      const data = await res.json();
      const inspections: any[] = data?.hits?.hits?.map((h: any) => h._source) ||
        data?.inspections || data?.results || data?.data || [];

      for (const insp of inspections) {
        const bizName = insp.estab_name || insp.establishment_name || insp.company || "";
        if (!bizName || bizName.length < 3) continue;
        const openDate = insp.open_date || insp.date_opened || "";
        if (openDate && openDate < cutoff) continue;
        const city = insp.site_city || insp.city || "";
        const state = (insp.site_state || insp.state || "").toUpperCase();
        if (state && state !== "MI") continue;
        const key = bizName.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        let trade = "Trade Professional";
        if (naics === "238210") trade = "Electrician";
        else if (naics === "238220") trade = "HVAC/Plumbing";
        else if (naics === "238290" || naics === "238110") trade = "Boiler/Mechanical";

        candidates.push({
          full_name: bizName,
          license_type: trade,
          license_number: insp.activity_nr ? String(insp.activity_nr) : null,
          license_expiry: null,
          city: city || null,
          source: "osha_establishment",
        });
      }
    } catch (e) {
      console.warn(`[S23:OSHA] NAICS ${naics} error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`[S23:OSHA] Found ${candidates.length} active Michigan trade establishments`);
  return candidates;
}

// ===== S24: LARA Disciplinary Reinstatements (Firecrawl) =====
// BPL board order pages list license reinstatements (suspended → cleared).
// Reinstated workers are immediately available and actively looking for work.
const BPL_BOARD_PAGES = [
  { url: "https://www.michigan.gov/lara/bureau-list/bpl/occ/professional-licensing/boards-commissions/michigan-boiler-rules", trade: "Boiler Operator" },
  { url: "https://www.michigan.gov/lara/bureau-list/bpl/occ/professional-licensing/boards-commissions/michigan-board-of-electricians", trade: "Electrician" },
  { url: "https://www.michigan.gov/lara/bureau-list/bpl/occ/professional-licensing/boards-commissions/Michigan-Board-of-Plumbing-Examiners", trade: "Plumber" },
  { url: "https://www.michigan.gov/lara/bureau-list/bpl/occ/professional-licensing/boards-commissions/board-of-mechanical-rules", trade: "HVAC Technician" },
];

async function scanLARADisciplinaryReinstatements(): Promise<LicenseCandidate[]> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("[S24:Reinstate] No FIRECRAWL_API_KEY — skipping");
    return [];
  }
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();

  for (const { url, trade } of BPL_BOARD_PAGES) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], waitFor: 2000 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const markdown: string = data?.data?.markdown || data?.markdown || "";
      if (!markdown || markdown.length < 100) continue;

      // Split on reinstatement keywords and extract names from surrounding context
      const REINSTATE_PATTERN = /reinstate[dm]?|restoration of license|license restored|order of reinstatement/gi;
      if (!REINSTATE_PATTERN.test(markdown)) continue;

      // Reset lastIndex after test()
      REINSTATE_PATTERN.lastIndex = 0;
      const sections = markdown.split(REINSTATE_PATTERN);
      for (let i = 1; i < sections.length; i++) {
        const context = sections[i].slice(0, 600);
        const nameMatches = context.match(/\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,25})\b/g) || [];
        for (const rawName of nameMatches) {
          if (!isPersonName(rawName)) continue;
          const key = rawName.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({
            full_name: rawName,
            license_type: trade,
            license_number: null,
            license_expiry: null,
            city: null,
            source: "lara_reinstatement",
          });
        }
      }
    } catch (e) {
      console.warn(`[S24:Reinstate] ${trade} error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`[S24:Reinstate] Found ${candidates.length} reinstated license holders`);
  return candidates;
}

// ===== S25: Michigan New Trade Business Filings (Sonar) =====
// Sonar searches Michigan SOS filings and news for recently formed trade LLCs/corps.
// Owner names → hire_alert_candidates (they just went independent = job change signal)
// Company names → techalert_business_prospects (new company = needs workers)
async function scanMichiganNewTradeBusinesses(): Promise<LicenseCandidate[]> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[S25:SOS] No OPENROUTER_API_KEY — skipping");
    return [];
  }
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();

  const queries = [
    { trade: "HVAC Technician", q: "new Michigan LLC formed 2026 HVAC heating cooling mechanical contractor Michigan Secretary of State filing" },
    { trade: "Electrician", q: "new Michigan electrical contractor LLC corporation formed 2026 Metro Detroit Wayne Oakland Macomb" },
    { trade: "Plumber", q: "new Michigan plumbing contractor LLC incorporated 2026 Metro Detroit licensed plumber sole proprietor" },
    { trade: "Boiler Operator", q: "new Michigan boiler mechanical LLC corporation 2026 licensed boiler operator Metro Detroit independent" },
  ];

  for (const { trade, q } of queries) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages: [
            {
              role: "system",
              content: `You are researching recently formed Michigan trade businesses. Return a JSON array only — no prose. Each item must have: full_name (owner's name or company name), is_company (boolean), city (Michigan city or null). Only include entries with verifiable source data. Max 10 results. Empty array if none found.`,
            },
            { role: "user", content: q },
          ],
          max_tokens: 600,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content || "";
      const m = text.match(/\[[\s\S]*?\]/);
      if (!m) continue;
      let arr: any[];
      try { arr = JSON.parse(m[0]); } catch { continue; }

      for (const r of arr) {
        const name = (r.full_name || r.name || "").trim();
        if (!name || name.length < 4) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        // Companies go to techalert_business_prospects via source tag; individuals go to candidates
        const isCompany = r.is_company === true || !isPersonName(name);
        candidates.push({
          full_name: name,
          license_type: trade,
          license_number: null,
          license_expiry: null,
          city: r.city && typeof r.city === "string" && r.city.length > 2 ? r.city : null,
          source: isCompany ? "michigan_sos_co" : "michigan_sos",
        });
      }
    } catch (e) {
      console.warn(`[S25:SOS] ${trade} error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`[S25:SOS] Found ${candidates.length} new Michigan trade businesses/owners`);
  return candidates;
}

// ============= CHECKPOINTED ORCHESTRATION =============
// Each source has a min-interval (hours). Skipped if last_completed_at < interval ago.
// Resilient to Edge Function timeouts: next cron tick picks up un-run sources.
const SOURCE_REGISTRY: Array<{ label: string; fn: () => Promise<LicenseCandidate[]>; intervalH: number }> = [
  { label: "NPI",        fn: scanNPIRegistry,       intervalH: 24 },
  { label: "NAR",        fn: scanMichiganNurseAide, intervalH: 24 },
  { label: "OpenData",   fn: scanMichiganOpenData,  intervalH: 12 },
  { label: "Permits",    fn: scanBuildingPermits,   intervalH: 6  },
  { label: "NATE",       fn: scanNATERegistry,      intervalH: 48 },
  { label: "Unions",     fn: scanTradeUnions,       intervalH: 48 },
  { label: "PDL",        fn: scanPDL,               intervalH: 24 },
  { label: "Craigslist", fn: scanCraigslist,        intervalH: 6  },
  { label: "MiPLUS",     fn: scanMiPLUS,            intervalH: 12 },
  { label: "Yelp",       fn: scanYelp,              intervalH: 48 },
  { label: "Nursys",     fn: scanNursys,            intervalH: 24 },
  { label: "PHCC",       fn: scanPHCC,              intervalH: 48 },
  { label: "JATC",       fn: scanJATCGraduations,   intervalH: 24 },
  { label: "Thumbtack",  fn: scanThumbtack,         intervalH: 48 },
  { label: "DOL",        fn: scanDOLApprenticeships,intervalH: 24 },
  { label: "Cosmetology",fn: scanLARACosmetology,         intervalH: 48 },
  { label: "RealEstate", fn: scanLARARealEstate,          intervalH: 48 },
  { label: "NewlyIssued",fn: scanBPLNewlyIssued,          intervalH: 6  },
  { label: "ContractorCo",fn: scanBPLContractorCompanies, intervalH: 24 },
  { label: "OSHA",       fn: scanOSHAMichiganEstablishments, intervalH: 24 },
  { label: "Reinstate",  fn: scanLARADisciplinaryReinstatements, intervalH: 48 },
  { label: "MiSOS",      fn: scanMichiganNewTradeBusinesses, intervalH: 24 },
];

const WALL_CLOCK_BUDGET_MS = 120_000; // leave headroom under 150s edge timeout

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sourceCounts: Record<string, number> = {};
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  const startedAt = Date.now();

  console.log(`[miosha-scraper] 🚀 Checkpointed scanner starting — ${SOURCE_REGISTRY.length} sources, ${WALL_CLOCK_BUDGET_MS}ms budget`);

  // Pull all checkpoints in one query
  const { data: ckpts } = await sb.from("hire_alert_scanner_checkpoints").select("source,last_completed_at,status");
  const ckptMap = new Map<string, { last_completed_at: string | null; status: string | null }>();
  (ckpts || []).forEach((c: any) => ckptMap.set(c.source, { last_completed_at: c.last_completed_at, status: c.status }));

  // Sort sources by oldest checkpoint first (so we always make progress on stale ones)
  const due = SOURCE_REGISTRY.filter((s) => {
    const c = ckptMap.get(s.label);
    if (!c?.last_completed_at) return true;
    const ageH = (Date.now() - new Date(c.last_completed_at).getTime()) / 3_600_000;
    return ageH >= s.intervalH;
  }).sort((a, b) => {
    const ta = ckptMap.get(a.label)?.last_completed_at ? new Date(ckptMap.get(a.label)!.last_completed_at!).getTime() : 0;
    const tb = ckptMap.get(b.label)?.last_completed_at ? new Date(ckptMap.get(b.label)!.last_completed_at!).getTime() : 0;
    return ta - tb;
  });

  console.log(`[miosha-scraper] ${due.length}/${SOURCE_REGISTRY.length} sources due this run`);

  const skipped: string[] = SOURCE_REGISTRY.filter((s) => !due.includes(s)).map((s) => s.label);
  const ranLabels: string[] = [];

  for (const source of due) {
    if (Date.now() - startedAt > WALL_CLOCK_BUDGET_MS) {
      console.warn(`[miosha-scraper] ⏰ Budget exceeded — deferring ${source.label} to next tick`);
      break;
    }
    // Mark started
    await sb.from("hire_alert_scanner_checkpoints").upsert({
      source: source.label, last_started_at: new Date().toISOString(), status: "running",
    }, { onConflict: "source" });

    try {
      const found = await source.fn();
      sourceCounts[source.label] = found.length;
      ranLabels.push(source.label);
      for (const c of found) {
        const res = await upsertCandidate(sb, c);
        if (res === "new") newCount++;
        else if (res === "updated") updatedCount++;
        else errorCount++;
      }
      await sb.from("hire_alert_scanner_checkpoints").upsert({
        source: source.label,
        last_completed_at: new Date().toISOString(),
        last_count: found.length,
        status: "ok",
        error_message: null,
      }, { onConflict: "source" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sourceCounts[source.label] = 0;
      console.error(`[miosha-scraper] ${source.label} FAILED:`, msg);
      await sb.from("hire_alert_scanner_checkpoints").upsert({
        source: source.label, status: "error", error_message: msg.slice(0, 500),
      }, { onConflict: "source" });
    }
  }

  // Sonar runs only if we still have budget (it's slow — 30s window)
  if (Date.now() - startedAt < WALL_CLOCK_BUDGET_MS - 30_000) {
    const sonarMode = laraFallbackActivated ? "expanded" : "normal";
    console.log(`[miosha-scraper] ⏳ Running Sonar (${sonarMode} mode)...`);
    try {
      const sonarCandidates = await scanViaSonar();
      sourceCounts["Sonar"] = sonarCandidates.length;
      for (const c of sonarCandidates) {
        const res = await upsertCandidate(sb, c);
        if (res === "new") newCount++;
        else if (res === "updated") updatedCount++;
        else errorCount++;
      }
      await sb.from("hire_alert_scanner_checkpoints").upsert({
        source: "Sonar", last_completed_at: new Date().toISOString(),
        last_count: sonarCandidates.length, status: "ok",
      }, { onConflict: "source" });
    } catch (e) {
      sourceCounts["Sonar"] = 0;
      console.error(`[miosha-scraper] Sonar FAILED:`, e);
    }
  } else {
    console.warn("[miosha-scraper] ⏰ Skipping Sonar — budget exhausted");
  }
  void skipped;

  // Log LARA health status and alert Matt if needed
  await logLaraHealthAndAlert(sb);

  const laraNote = laraStatus !== "ok" ? ` | ⚠️ LARA=${laraStatus}${laraFallbackActivated ? " (fallbacks active)" : ""}` : " | LARA=ok";
  const summary = `✅ Done: new=${newCount} updated=${updatedCount} errors=${errorCount}${laraNote} | ${Object.entries(sourceCounts).map(([k, v]) => `${k}=${v}`).join(" ")}`;
  console.log(`[miosha-scraper] ${summary}`);

  return new Response(
    JSON.stringify({
      ok: true,
      new: newCount,
      updated: updatedCount,
      errors: errorCount,
      sources: sourceCounts,
      lara: {
        status: laraStatus,
        http_status: laraHttpStatus,
        response_time_ms: laraResponseTimeMs,
        fallback_activated: laraFallbackActivated,
        error: laraErrorMessage || null,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[miosha-scraper] Unhandled error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
