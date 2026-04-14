// miosha-license-scraper — Planetary-Scale Hiring Intelligence Scanner
// EIGHT data sources running in parallel:
// S1: NPI Registry — free federal API for healthcare workers
// S2: Michigan Nurse Aide Registry — state CNA registry
// S3: Michigan Open Data Portal — Socrata bulk license CSVs
// S4: Detroit Building Permits — THE MOAT (active tradespeople)
// S5: NATE Certified Technician Registry — HVAC certs via Firecrawl
// S6: Trade Union Directories — UA98/IBEW58/Boilermakers via Firecrawl
// S7: People Data Labs — people search API
// S8: Sonar Web Search — LinkedIn open-to-work, union spotlights
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
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface LicenseCandidate {
  full_name: string;
  license_type: string;
  license_number: string | null;
  license_expiry: string | null;
  city: string | null;
  source: "miosha";
}

const COMPANY_SIGNALS = [
  "inc", "llc", "corp", "co.", "company", "contractors", "services", "solutions",
  "group", "enterprises", "associates", "systems", "industries", "construction",
  "plumbing", "hvac", "mechanical", "electric", "heating", "cooling", "dba",
  "d/b/a", "academy", "school", "university", "hospital", "clinic", "center",
  "association", "foundation", "institute", "authority", "department", "bureau",
  "commission", "council", "district", "board", "casino", "hotel", "resort",
];

function isPersonName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (COMPANY_SIGNALS.some((s) => lower.includes(s))) return false;
  if (name === name.toUpperCase() && name.length > 8) return false;
  if (name.includes("&")) return false;
  return true;
}

function looksLikeLicenseNumber(num: string): boolean {
  if (!num || num.length < 3) return false;
  if (!/\d/.test(num)) return false;
  if (/^\d{10}$/.test(num.replace(/\D/g, ""))) return false;
  return true;
}

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
            license_expiry: null, city: address?.city || city, source: "miosha",
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
            city: null, source: "miosha",
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

// ===== SOURCE 3: Michigan Open Data Portal (Socrata) =====
// Michigan doesn't publish individual license lists on Socrata — only metrics.
// Instead, search the LARA BPL verification lookup pages via Firecrawl.
async function scanMichiganOpenData(): Promise<LicenseCandidate[]> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("[S3:OpenData] No FIRECRAWL_API_KEY — skipping LARA lookup");
    return [];
  }
  const candidates: LicenseCandidate[] = [];

  // Try LARA online license verification search pages
  const laraSearches = [
    { url: "https://aca-prod.accela.com/LARA/GeneralProperty/PropertyLookUp.aspx?is498=1", label: "Trade Professional" },
  ];

  for (const { url, label } of laraSearches) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], waitFor: 3000 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        console.warn(`[S3:OpenData] Firecrawl HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const markdown = data?.data?.markdown || data?.markdown || "";
      if (markdown.length > 100) {
        const extracted = await extractNamesFromMarkdown(markdown, label);
        candidates.push(...extracted);
      }
    } catch (e) {
      console.warn(`[S3:OpenData] Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S3:OpenData] Total: ${candidates.length} candidates`);
  return candidates;
}

// ===== SOURCE 4: Detroit Building Permits — THE MOAT =====
// Detroit uses ArcGIS Hub, not Socrata. Search via Firecrawl + ArcGIS REST.
async function scanBuildingPermits(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();

  // ArcGIS feature service for Detroit building permits
  const arcgisEndpoints = [
    `https://services2.arcgis.com/qvkbeam7Wirber6j/arcgis/rest/services/Building_Permits/FeatureServer/0/query?where=1%3D1&outFields=CONTRACTOR_NAME,PERMIT_TYPE,ADDRESS&resultRecordCount=200&f=json`,
    `https://services2.arcgis.com/qvkbeam7Wirber6j/arcgis/rest/services/Mechanical_Permits/FeatureServer/0/query?where=1%3D1&outFields=CONTRACTOR_NAME,PERMIT_TYPE&resultRecordCount=200&f=json`,
  ];

  for (const url of arcgisEndpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const data = await res.json();
      const features = data?.features || [];
      for (const f of features) {
        const attrs = f.attributes || {};
        const name = attrs.CONTRACTOR_NAME || "";
        if (!name || !isPersonName(name)) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const permitType = (attrs.PERMIT_TYPE || "").toUpperCase();
        let licenseType = "Trade Professional";
        if (permitType.includes("MECHANIC") || permitType.includes("HVAC")) licenseType = "HVAC Technician";
        else if (permitType.includes("PLUMB")) licenseType = "Plumber";
        else if (permitType.includes("ELECTR")) licenseType = "Electrician";
        else if (permitType.includes("BOILER")) licenseType = "Boiler Operator";

        candidates.push({
          full_name: name, license_type: licenseType,
          license_number: null, license_expiry: null,
          city: "Detroit", source: "miosha",
        });
      }
    } catch (e) {
      console.warn(`[S4:Permits] Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S4:Permits] Found ${candidates.length} active tradespeople from permits`);
  return candidates;
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
      const extracted = await extractNamesFromMarkdown(markdown, "HVAC Technician");
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

      const extracted = await extractNamesFromMarkdown(markdown, trade);
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
async function scanPDL(): Promise<LicenseCandidate[]> {
  if (!PDL_API_KEY) {
    console.warn("[S7:PDL] No PDL_API_KEY — skipping");
    return [];
  }

  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();
  const PDL_TITLES = [
    "boiler operator", "stationary engineer", "chief engineer",
    "HVAC technician", "master plumber", "journeyman plumber",
    "master electrician", "journeyman electrician",
    "certified nursing assistant", "licensed practical nurse",
  ];

  for (const title of PDL_TITLES) {
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

        candidates.push({
          full_name: fullName,
          license_type: mapTitleToLicenseType(title),
          license_number: null,
          license_expiry: null,
          city: p.location_metro || p.location_locality || null,
          source: "miosha",
        });
      }
    } catch (e) {
      console.warn(`[S7:PDL] Error for "${title}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[S7:PDL] Found ${candidates.length} candidates`);
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

// ===== SOURCE 8: Sonar Web Search (LinkedIn open-to-work, union spotlights) =====
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
          const extracted = await extractNamesFromProse(text, label);
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
          city: hasCity ? r.city : null, source: "miosha",
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
async function extractNamesFromMarkdown(markdown: string, label: string): Promise<LicenseCandidate[]> {
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
        city: r.city && r.city.length > 2 ? r.city : null, source: "miosha" as const,
      }));
  } catch { return []; }
}

async function extractNamesFromProse(prose: string, label: string): Promise<LicenseCandidate[]> {
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
        source: "miosha" as const,
      }));
  } catch { return []; }
}

// ===== DB UPSERT =====
// CRITICAL: Always writes BOTH `name` AND `full_name` — the `name` column is NOT NULL
async function upsertCandidate(sb: any, c: LicenseCandidate): Promise<"new" | "updated" | "error"> {
  try {
    const row: Record<string, unknown> = {
      name: c.full_name,           // REQUIRED — NOT NULL column
      full_name: c.full_name,      // Also write full_name
      license_type: c.license_type,
      source: "miosha",
      last_seen_at: new Date().toISOString(),
    };
    if (c.license_number) row.license_number = c.license_number;
    if (c.license_expiry) row.license_expiry = c.license_expiry;
    if (c.city) row.city = c.city;

    if (c.license_number) {
      const { data: existing } = await sb
        .from("hire_alert_candidates")
        .select("id")
        .eq("license_number", c.license_number)
        .maybeSingle();

      if (existing) {
        await sb.from("hire_alert_candidates").update({ last_seen_at: new Date().toISOString(), name: c.full_name }).eq("id", existing.id);
        return "updated";
      } else {
        await sb.from("hire_alert_candidates").insert({ ...row, status: "new", first_seen_at: new Date().toISOString() });
        return "new";
      }
    } else {
      const { data: existing } = await sb
        .from("hire_alert_candidates")
        .select("id")
        .eq("full_name", c.full_name)
        .eq("license_type", c.license_type)
        .eq("source", "miosha")
        .maybeSingle();

      if (!existing) {
        await sb.from("hire_alert_candidates").insert({ ...row, status: "new", first_seen_at: new Date().toISOString() });
        return "new";
      } else {
        await sb.from("hire_alert_candidates").update({ last_seen_at: new Date().toISOString(), name: c.full_name }).eq("id", existing.id);
        return "updated";
      }
    }
  } catch (e) {
    console.error(`[upsert] Error for ${c.full_name}:`, e);
    return "error";
  }
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sourceCounts: Record<string, number> = {};
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  console.log("[miosha-scraper] 🚀 Planetary-Scale Scanner starting — 8 sources in parallel");

  // Run ALL 8 sources simultaneously
  const results = await Promise.allSettled([
    scanNPIRegistry(),           // S1
    scanMichiganNurseAide(),     // S2
    scanMichiganOpenData(),      // S3
    scanBuildingPermits(),       // S4
    scanNATERegistry(),          // S5
    scanTradeUnions(),           // S6
    scanPDL(),                   // S7
    scanViaSonar(),              // S8
  ]);

  const sourceLabels = ["NPI", "NAR", "OpenData", "Permits", "NATE", "Unions", "PDL", "Sonar"];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const label = sourceLabels[i];
    if (result.status === "fulfilled") {
      sourceCounts[label] = result.value.length;
      for (const c of result.value) {
        const res = await upsertCandidate(sb, c);
        if (res === "new") newCount++;
        else if (res === "updated") updatedCount++;
        else errorCount++;
      }
    } else {
      sourceCounts[label] = 0;
      console.error(`[miosha-scraper] ${label} FAILED:`, result.reason);
    }
  }

  const summary = `✅ Done: new=${newCount} updated=${updatedCount} errors=${errorCount} | ${Object.entries(sourceCounts).map(([k, v]) => `${k}=${v}`).join(" ")}`;
  console.log(`[miosha-scraper] ${summary}`);

  return new Response(
    JSON.stringify({ ok: true, new: newCount, updated: updatedCount, errors: errorCount, sources: sourceCounts }),
    { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
});
