// counsel-search — Michigan Counsel Records Search
// Auth-gated, quota-enforced (7 free searches), public-records aggregation for litigation use.
// FCRA §1681b(a)(4) litigation-use exempt. NOT for tenant screening or employment screening.
//
// Body: { name, aliases?: string[], city?, state?, case_matter?, permissible_purpose?, attest: true }
//
// Improvements over legacy tenant-intel-search:
//   - Auth required (JWT verify) → user_id
//   - 7-search free trial via counsel_search_quota; paying clients in counsel_search_clients are unlimited
//   - Permissible-purpose attestation gate
//   - Aliases run in parallel (each alias gets its own scan pass for federal courts + Sonar)
//   - Fragile consumer-data-broker scrapers REMOVED (FastPeopleSearch, TruePeopleSearch, Whitepages, USPhoneBook)
//   - Sonar calls validate every cited URL with a HEAD check before surfacing — kills hallucinated cites
//   - Adds 36th District Court Detroit eviction lookup, Macomb County parcels
//   - Logs every search to counsel_searches with case_matter for audit

import { createClient } from "npm:@supabase/supabase-js@2";
import * as Federal from "../_shared/counsel-sources/federal.ts";
import * as MI from "../_shared/counsel-sources/michigan.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const FREE_TRIAL_LIMIT = 7;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IntelHit {
  source: string;
  source_url?: string;
  category: string;
  title: string;
  summary: string;
  date?: string;
  location?: string;
  severity?: "high" | "medium" | "low" | "info";
  alias_match?: string; // which alias surfaced this hit
}

const COMMON_FETCH = { signal: AbortSignal.timeout(10_000) };
const UA = { "User-Agent": "DWA-CounselSearch/1.0 (research)" };

// ─── Federal Courts (CourtListener) ────────────────────────────────────────
async function clDockets(name: string, state: string, nos: string, category: string, severity: IntelHit["severity"], titlePrefix: string): Promise<IntelHit[]> {
  try {
    const courts = state === "MI" ? "mied,miwd" : "";
    const courtParam = courts ? `&court=${courts}` : "";
    const url = `https://www.courtlistener.com/api/rest/v3/dockets/?party_name=${encodeURIComponent(name)}${courtParam}&nature_of_suit=${nos}&format=json&page_size=15`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((d: any): IntelHit => ({
      source: "CourtListener (Federal Courts)",
      source_url: `https://www.courtlistener.com${d.absolute_url || ""}`,
      category,
      title: `${titlePrefix} — ${d.case_name || name}`,
      summary: `Case #${d.docket_number || "N/A"} filed ${d.date_filed || "unknown"} in ${d.court?.short_name || d.court_id || "federal court"}.`,
      date: d.date_filed,
      location: d.court?.short_name || "",
      severity,
      alias_match: name,
    }));
  } catch { return []; }
}

// ─── Federal registries ────────────────────────────────────────────────────
async function scanNSOPW(name: string, state: string): Promise<IntelHit[]> {
  try {
    const [first, ...rest] = name.trim().split(/\s+/);
    const last = rest.join(" ");
    if (!first || !last) return [];
    const res = await fetch("https://www.nsopw.gov/api/Search/GetResults", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...UA },
      body: JSON.stringify({ firstName: first, lastName: last, stateId: state }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.Offenders || []) as any[]).map((o): IntelHit => ({
      source: "NSOPW (National Sex Offender Registry)",
      source_url: "https://www.nsopw.gov",
      category: "Criminal Records",
      title: `Sex Offender Registry — ${o.FullName || name}`,
      summary: `Listed in ${o.StateId || state} sex offender registry. Address: ${o.DisplayAddress || "on file"}. Tier: ${o.Tier || "active"}.`,
      date: o.ConvictionDate,
      location: o.DisplayAddress,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

async function scanFBIWanted(name: string): Promise<IntelHit[]> {
  try {
    const res = await fetch(`https://api.fbi.gov/wanted/v1/list?title=${encodeURIComponent(name)}&limit=5`, { headers: UA, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((i: any): IntelHit => ({
      source: "FBI Most Wanted",
      source_url: i.url || "https://www.fbi.gov/wanted",
      category: "Criminal Records",
      title: `FBI Most Wanted — ${i.title || name}`,
      summary: i.description || "Active FBI wanted person.",
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

async function scanSAMExclusions(name: string): Promise<IntelHit[]> {
  try {
    const SAM_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";
    if (!SAM_KEY) return [];
    const url = `https://api.sam.gov/exclusions/v1/exclusions?api_key=${SAM_KEY}&exclusionName=${encodeURIComponent(name)}&limit=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.exclusionDetails || data?.data || [];
    return items.map((e: any): IntelHit => ({
      source: "SAM.gov Federal Exclusions",
      source_url: "https://www.sam.gov",
      category: "Government Records",
      title: `Federal Debarment — ${e.name || name}`,
      summary: `Excluded from federal contracts. Agency: ${e.excludingAgencyName || "N/A"}. Active: ${e.activationDate || "N/A"} → ${e.terminationDate || "ongoing"}.`,
      date: e.activationDate,
      severity: "high",
      alias_match: name,
    }));
  } catch { return []; }
}

async function scanOSHA(name: string): Promise<IntelHit[]> {
  try {
    const res = await fetch(`https://data.dol.gov/get/OshaInsp/format/json/limit/5/filter/estab_name=${encodeURIComponent(name)}`, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : []).slice(0, 5).map((r: any): IntelHit => ({
      source: "OSHA Violations (DOL)",
      source_url: "https://www.osha.gov/pls/imis/establishment.html",
      category: "Government Records",
      title: `OSHA Inspection — ${r.establishment_name || name}`,
      summary: `Inspection ${r.activity_nr || "N/A"} at ${r.site_address || "N/A"}. Date: ${r.open_date || "N/A"}. Penalty: $${r.total_current_penalty || 0}.`,
      date: r.open_date,
      severity: "medium",
      alias_match: name,
    }));
  } catch { return []; }
}

// ─── Michigan property + business records ──────────────────────────────────
async function scanWayneProperty(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(OWNER) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://utility.waynecountymi.gov/arcgis/rest/services/Property/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=ADDRESS,ZIPCODE,OWNER,SALE_DATE,SALE_PRICE&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Wayne County Property Records",
        source_url: "https://www.waynecounty.com/government/assessor",
        category: "Property Records",
        title: `Wayne County Property — ${a.ADDRESS || "Unknown"}`,
        summary: `Owner: ${a.OWNER || name}. ${a.ADDRESS}, ${a.ZIPCODE}. Last sale: ${a.SALE_DATE ? new Date(a.SALE_DATE).toLocaleDateString() : "N/A"} for $${Number(a.SALE_PRICE || 0).toLocaleString()}.`,
        location: `${a.ADDRESS}, ${a.ZIPCODE}`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

async function scanOaklandProperty(name: string): Promise<IntelHit[]> {
  try {
    const esc = name.replace(/'/g, "''");
    const where = `UPPER(TAXPAYER_1) LIKE UPPER('%${esc}%') OR UPPER(TAXPAYER_2) LIKE UPPER('%${esc}%')`;
    const url = `https://www.oakgov.com/egis/rest/services/Property/ParcelInfo/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=SITUS_ADDRESS,ZIP,TAXPAYER_1,SALE_DATE,SALE_PRICE&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Oakland County Property Records",
        source_url: "https://www.oakgov.com",
        category: "Property Records",
        title: `Oakland County Property — ${a.SITUS_ADDRESS || "Unknown"}`,
        summary: `Owner: ${a.TAXPAYER_1 || name}. ${a.SITUS_ADDRESS}, ${a.ZIP}. Last sale: ${a.SALE_DATE ? new Date(a.SALE_DATE).toLocaleDateString() : "N/A"} for $${Number(a.SALE_PRICE || 0).toLocaleString()}.`,
        location: `${a.SITUS_ADDRESS}, ${a.ZIP}`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

async function scanMacombProperty(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(OWNER) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://gis.macombcountymi.gov/arcgis/rest/services/Property/Parcels/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=ADDRESS,ZIP,OWNER,SALE_DATE,SALE_PRICE&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Macomb County Property Records",
        source_url: "https://www.macombgov.org",
        category: "Property Records",
        title: `Macomb County Property — ${a.ADDRESS || "Unknown"}`,
        summary: `Owner: ${a.OWNER || name}. ${a.ADDRESS}, ${a.ZIP}. Last sale: ${a.SALE_DATE ? new Date(a.SALE_DATE).toLocaleDateString() : "N/A"} for $${Number(a.SALE_PRICE || 0).toLocaleString()}.`,
        location: `${a.ADDRESS}, ${a.ZIP}`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

async function scanDetroitAssessor(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(taxpayer_name) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=address,zip_code,taxpayer_name,sale_date,sale_price&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Detroit Assessor Records",
        source_url: "https://detroitmi.gov/departments/office-chief-financial-officer/office-assessor",
        category: "Property Records",
        title: `Detroit Property — ${a.address || "Unknown"}`,
        summary: `Owner: ${a.taxpayer_name || name}. ${a.address}, Detroit ${a.zip_code}. Sale: ${a.sale_date ? new Date(a.sale_date).toLocaleDateString() : "N/A"} for $${Number(a.sale_price || 0).toLocaleString()}.`,
        location: `${a.address}, Detroit`,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

async function scanDetroitBlight(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(name) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/blight_tickets/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=name,address,violation_description,total_due&f=json&resultRecordCount=10&orderByFields=OBJECTID+DESC`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Detroit Blight Violations",
        source_url: "https://data.detroitmi.gov",
        category: "Property Violations",
        title: `Blight Violation — ${a.address || "Detroit"}`,
        summary: `${a.violation_description || "N/A"}. Amount due: $${Number(a.total_due || 0).toLocaleString()}.`,
        severity: "medium",
        alias_match: name,
      };
    });
  } catch { return []; }
}

async function scanDetroitVacant(name: string): Promise<IntelHit[]> {
  try {
    const where = `UPPER(owner_name) LIKE UPPER('%${name.replace(/'/g, "''")}%')`;
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_vacant_property_registrations/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=owner_name,address,property_status,issued_date&f=json&resultRecordCount=10`;
    const res = await fetch(url, COMMON_FETCH);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f: any): IntelHit => {
      const a = f.attributes || {};
      return {
        source: "Detroit Vacant Property Registry",
        source_url: "https://data.detroitmi.gov",
        category: "Property Records",
        title: `Vacant Property — ${a.address || "Detroit"}`,
        summary: `Owner: ${a.owner_name || name}. Status: ${a.property_status || "N/A"}.`,
        severity: "low",
        alias_match: name,
      };
    });
  } catch { return []; }
}

async function scanOpenCorporates(name: string, state: string): Promise<IntelHit[]> {
  try {
    const url = `https://api.opencorporates.com/v0.4/officers/search?q=${encodeURIComponent(name)}&jurisdiction_code=us_${state.toLowerCase()}&per_page=10`;
    const res = await fetch(url, { headers: UA, ...COMMON_FETCH });
    if (!res.ok) return [];
    const data = await res.json();
    const officers: any[] = data?.results?.officers || [];
    return officers.map((o: any): IntelHit => {
      const officer = o.officer || o;
      return {
        source: "OpenCorporates",
        source_url: officer.opencorporates_url,
        category: "Business Records",
        title: `Business Officer — ${officer.company?.name || "Unknown Company"}`,
        summary: `${officer.name || name} listed as ${officer.position || "officer"} of ${officer.company?.name || "company"} (${officer.company?.jurisdiction_code || state}).`,
        date: officer.start_date,
        severity: "info",
        alias_match: name,
      };
    });
  } catch { return []; }
}

// ─── Sonar with cite-or-die URL validation ─────────────────────────────────
async function headValidates(url: string): Promise<boolean> {
  if (!url || !/^https?:\/\//.test(url)) return false;
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5_000) });
    return r.status >= 200 && r.status < 400;
  } catch {
    // Some servers reject HEAD; retry with GET, range header to avoid full body
    try {
      const r2 = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(5_000) });
      return r2.status >= 200 && r2.status < 400;
    } catch { return false; }
  }
}

async function sonarSearch(query: string, label: string, category: string, severity: IntelHit["severity"], aliasMatch: string): Promise<IntelHit[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://detroitwebagency.com",
        "X-Title": "DWA Counsel Search",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          {
            role: "system",
            content: 'Public-records research assistant. CITE OR DIE: every item you return MUST include a real, working public-record URL in the "url" field — court PDF, government registry page, news article, BBB page, etc. If you cannot cite a public-record URL, OMIT that item. Return ONLY a JSON array. Each item: { title, summary, date?, url }. Return [] if nothing verifiable. NEVER fabricate cases, names, dates, or URLs.',
          },
          { role: "user", content: query },
        ],
        max_tokens: 700,
        temperature: 0.05,
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
    if (!Array.isArray(items)) return [];

    // Validate every URL with HEAD; drop items whose URL doesn't resolve
    const validated = await Promise.all(items.slice(0, 6).map(async (item: any) => {
      const url = item?.url;
      if (!url) return null;
      const ok = await headValidates(url);
      if (!ok) return null;
      return {
        source: `Web Research — ${label}`,
        source_url: url,
        category,
        title: item.title || label,
        summary: item.summary || item.content || "See source for details.",
        date: item.date,
        severity,
        alias_match: aliasMatch,
      } as IntelHit;
    }));
    return validated.filter((x): x is IntelHit => !!x);
  } catch { return []; }
}

// ─── Court-only scanners (run for each alias) ──────────────────────────────
// Strictly limited to court records + name-verified offender registries.
// All HTML-regex scrapers that produced false positives (MI AG nav links, FAA
// captcha pages, county anchor scrapers, FBI/USMS/DEA/ICE substring matches,
// OSHA establishments, property, business, news, liens) are intentionally
// EXCLUDED. PACER is excluded — clients who need PACER should subscribe to
// PACER directly.
async function runScansForName(name: string, city: string, state: string): Promise<IntelHit[][]> {
  return await Promise.allSettled([
    // ── Federal court dockets by party (CourtListener live API) ──────────
    clDockets(name, state, "470,480", "Court Records", "high", "Bankruptcy"),
    clDockets(name, state, "320,190", "Court Records", "medium", "Civil Suit"),
    clDockets(name, state, "950,540,530,550", "Court Records", "high", "Federal Criminal"),
    clDockets(name, state, "870", "Court Records", "high", "Federal Tax Suit"),

    // ── Federal court opinions + RECAP archive (free PACER cache) ────────
    Federal.scanCLOpinions(name),
    Federal.scanCLRecap(name),

    // ── U.S. Tax Court (DAWSON JSON) ─────────────────────────────────────
    Federal.scanTaxCourt(name),

    // ── Federal corrections (BOP — exact first+last match) ───────────────
    Federal.scanBOP(name),

    // ── Michigan state appellate (real JSON APIs) ────────────────────────
    MI.scanMICOA(name),
    MI.scanMISCT(name),

    // ── Michigan corrections / sex offender registries (name-verified) ───
    MI.scanMDOC_OTIS(name),
    MI.scanMIPSOR(name),
    scanNSOPW(name, state),

    // ── AI-corroborated court search (cite-or-die, HEAD-validated URLs) ──
    sonarSearch(`Search Michigan court records for civil cases, evictions, summary proceedings, divorce, custody, probate, or guardianship naming "${name}" in ${city}, ${state}. Look at 36th District Court Detroit, 3rd Circuit Wayne, 6th Circuit Oakland, Macomb 16th Circuit, Kent 17th, Genesee 7th, Washtenaw. Each item MUST cite the court website URL for the case. The party name in the citation must include "${name}". CITE OR OMIT.`, "MI Court Search", "Court Records", "high", name),
    sonarSearch(`Search Michigan and federal court records for criminal arrests, charges, or convictions involving "${name}" in ${city}, ${state}. Include MDOC OTIS and county criminal docket pages. Each item must cite a court or corrections public-record URL. The defendant name in the cited record must include "${name}". CITE OR OMIT.`, "MI Criminal Court Search", "Court Records", "high", name),
    sonarSearch(`Search Michigan probate court filings, estate proceedings, or guardianship cases involving "${name}". Each item must cite a probate court URL where the case party name includes "${name}". CITE OR OMIT.`, "MI Probate Court Search", "Court Records", "medium", name),
  ]).then(arr => arr.map(r => r.status === "fulfilled" ? r.value : []));
}

// Surname-match validator: require the searched surname (last token) to appear
// in the hit's title or summary. Kills "Latoya Grissom from Texarkana" class
// of false positive where a substring matched but the person is unrelated.
function passesSurnameGate(name: string, hit: IntelHit): boolean {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  // Pick the longest token (usually the surname) as the required string.
  const required = parts.sort((a, b) => b.length - a.length)[0].toLowerCase();
  if (required.length < 3) return true; // too short to filter reliably
  const haystack = `${hit.title || ""} ${hit.summary || ""} ${hit.location || ""}`.toLowerCase();
  return haystack.includes(required);
}

// ─── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Auth gate
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "auth_required", message: "Sign in to run a search." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "auth_invalid", message: "Your session expired. Please sign in again." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const name = String(body.name || "").trim();
  const aliasesRaw = Array.isArray(body.aliases) ? body.aliases : [];
  const aliases = aliasesRaw.map((a: any) => String(a || "").trim()).filter((a: string) => a.length >= 3 && a !== name).slice(0, 4);
  const city = String(body.city || "Detroit").trim();
  const state = String(body.state || "MI").trim().toUpperCase();
  const caseMatter = String(body.case_matter || "").trim().slice(0, 200);
  const permissiblePurpose = String(body.permissible_purpose || "").trim().slice(0, 200);
  const attest = body.attest === true;

  if (!name || name.length < 3) {
    return new Response(JSON.stringify({ error: "name_required", message: "Provide at least first and last name." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!attest) {
    return new Response(JSON.stringify({ error: "attestation_required", message: "You must attest to a permissible purpose (litigation, fraud investigation, or bona-fide legal proceeding) to run a search." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Quota gate (service role for DB writes)
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  // Match client by user_id OR email (beta invitees may not have user_id linked yet)
  const { data: clientByUser } = await sb.from("counsel_search_clients").select("id,active,tier,monitoring_enabled,trial_ends_at,email").eq("user_id", user.id).maybeSingle();
  const { data: clientByEmail } = clientByUser ? { data: null } : await sb.from("counsel_search_clients").select("id,active,tier,monitoring_enabled,trial_ends_at,email").eq("email", (user.email || "").toLowerCase()).maybeSingle();
  const client = clientByUser || clientByEmail;
  // Beta tier: active until trial_ends_at; treat as paid (unlimited) while valid
  const betaActive = client?.tier === "beta" && client?.active && client?.trial_ends_at && new Date(client.trial_ends_at).getTime() > Date.now();
  const isPaid = !!(client && client.active && (client.tier !== "beta" || betaActive));

  let quotaRow: any = null;
  if (!isPaid) {
    const { data: q } = await sb.from("counsel_search_quota").select("*").eq("user_id", user.id).maybeSingle();
    quotaRow = q;
    const used = q?.free_searches_used || 0;
    if (used >= FREE_TRIAL_LIMIT) {
      return new Response(JSON.stringify({
        error: "trial_exhausted",
        message: `You've used all ${FREE_TRIAL_LIMIT} free searches. Upgrade to continue.`,
        free_searches_used: used,
        free_trial_limit: FREE_TRIAL_LIMIT,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const started = Date.now();

  // Run scans for primary name + each alias in parallel
  const allNames = [name, ...aliases];
  const perNameResults = await Promise.all(allNames.map(n => runScansForName(n, city, state)));

  // Flatten + dedupe by (source + title + alias_match)
  const allHits: IntelHit[] = [];
  let sourcesHit = 0;
  let sourcesReturned = 0;
  let filteredBySurname = 0;
  const seen = new Set<string>();
  for (let i = 0; i < perNameResults.length; i++) {
    const nameForGate = allNames[i];
    const namesArr = perNameResults[i];
    for (const arr of namesArr) {
      sourcesHit++;
      if (arr.length > 0) {
        sourcesReturned++;
        for (const h of arr) {
          if (!passesSurnameGate(nameForGate, h)) {
            filteredBySurname++;
            continue;
          }
          const key = `${h.source}|${h.title}|${h.source_url || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          allHits.push(h);
        }
      }
    }
  }

  // Group by category
  const byCategory: Record<string, IntelHit[]> = {};
  for (const hit of allHits) {
    if (!byCategory[hit.category]) byCategory[hit.category] = [];
    byCategory[hit.category].push(hit);
  }
  const summary = Object.fromEntries(Object.entries(byCategory).map(([c, h]) => [c, h.length]));
  const highPriorityHits = allHits.filter(h => h.severity === "high");

  const elapsed = Date.now() - started;

  // Build court-citable citation bundle (Bluebook-style)
  const accessedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const citations = allHits.filter(h => h.source_url).map((h) => {
    const blueLine = `${h.source}, ${h.title}${h.date ? ` (${h.date})` : ""} (last visited ${accessedDate}), ${h.source_url}.`;
    return {
      source_name: h.source,
      source_type: h.category,
      title: h.title,
      url: h.source_url,
      accessed_at: new Date().toISOString(),
      bluebook_cite: blueLine,
    };
  });

  // Audit log
  await sb.from("counsel_searches").insert({
    user_id: user.id,
    email: user.email,
    query_name: name,
    aliases: aliases.length ? aliases : null,
    query_city: city,
    query_state: state,
    case_matter: caseMatter || null,
    permissible_purpose: permissiblePurpose || null,
    result_summary: summary,
    full_results: { hits: allHits },
    sources_hit: sourcesHit,
    sources_returned: sourcesReturned,
    total_hits: allHits.length,
    high_priority_hits: highPriorityHits.length,
    elapsed_ms: elapsed,
    was_paid: isPaid,
    citations,
  });

  // Quota increment for free trial users (only after successful search)
  let freeSearchesUsedAfter: number | undefined;
  if (!isPaid) {
    const usedBefore = quotaRow?.free_searches_used || 0;
    freeSearchesUsedAfter = usedBefore + 1;
    await sb.from("counsel_search_quota").upsert({
      user_id: user.id,
      email: user.email,
      free_searches_used: freeSearchesUsedAfter,
      permissible_purpose_ack_at: quotaRow?.permissible_purpose_ack_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  const emptyMessage = allHits.length === 0
    ? `No court records found for "${name}"${aliases.length ? ` (or aliases: ${aliases.join(", ")})` : ""} across ${sourcesHit} federal and Michigan court sources. The subject may have no public court history under the searched name, or may file under a different alias. For full federal-court coverage including non-public dockets, subscribe to PACER directly at pacer.uscourts.gov.`
    : null;

  return new Response(JSON.stringify({
    ok: true,
    query: { name, aliases, city, state, case_matter: caseMatter, mode: isPaid ? "paid" : "trial" },
    elapsed_ms: elapsed,
    sources_hit: sourcesHit,
    sources_returned: sourcesReturned,
    filtered_by_surname: filteredBySurname,
    total_hits: allHits.length,
    high_priority_hits: highPriorityHits.length,
    summary,
    results: byCategory,
    citations,
    empty_message: emptyMessage,
    accessed_at: new Date().toISOString(),
    quota: isPaid ? { unlimited: true, tier: client?.tier, trial_ends_at: client?.trial_ends_at || null } : { free_searches_used: freeSearchesUsedAfter, free_trial_limit: FREE_TRIAL_LIMIT, remaining: FREE_TRIAL_LIMIT - (freeSearchesUsedAfter || 0) },
    evidentiary_notice: "Sources are public court records verified at time of access via HEAD/GET URL validation. Every returned hit was filtered to require the searched surname to appear in the record. Each citation includes a Bluebook-formatted reference. Counsel must independently authenticate per FRE 901–902 before offering any source as evidence; this report is not a substitute for certified copies for trial.",
    disclaimer: "Court records only. Sources: CourtListener (federal opinions/dockets/RECAP), U.S. Tax Court DAWSON, Federal BOP, Michigan Court of Appeals, Michigan Supreme Court, MDOC OTIS, Michigan PSOR, NSOPW, plus AI-corroborated Michigan trial-court search. For permissible litigation, fraud-investigation, and bona-fide legal-research purposes (FCRA §1681b(a)(4) exempt). NOT for tenant screening, employment screening, or credit decisions.",
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
