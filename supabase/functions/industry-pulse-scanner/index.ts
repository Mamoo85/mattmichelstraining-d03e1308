// industry-pulse-scanner — Predictive demand intelligence engine
// Scans Metro Detroit hiring patterns and predicts equipment/service needs.
// Uses Sonar (Perplexity) for hiring signal harvesting + Lovable AI Gateway for prediction.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const NOAA_API_KEY = Deno.env.get("NOAA_API_KEY") || "";
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";

// ── Apollo org validation (item 21) ──────────────────────────────────────────
async function apolloValidateCompany(name: string): Promise<{ valid: boolean; employee_count: number | null; size_tier: string }> {
  if (!APOLLO_API_KEY) return { valid: true, employee_count: null, size_tier: "unknown" };
  try {
    const res = await fetch(`https://api.apollo.io/api/v1/organizations/enrich?organization_name=${encodeURIComponent(name)}`, {
      headers: { "X-Api-Key": APOLLO_API_KEY },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { valid: true, employee_count: null, size_tier: "unknown" };
    const data = await res.json();
    const emp = data?.organization?.estimated_num_employees;
    const tier = !emp ? "unknown" : emp <= 10 ? "micro" : emp <= 50 ? "small" : emp <= 200 ? "mid" : "large";
    return { valid: !!data?.organization, employee_count: emp ?? null, size_tier: tier };
  } catch {
    return { valid: true, employee_count: null, size_tier: "unknown" };
  }
}

// ── Detroit BSEED permit surge harvester (item 19) ───────────────────────────
async function harvestBSEEDPermitSignals(sb: any): Promise<any[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    // Detroit BSEED ArcGIS REST endpoint for commercial permits
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth()+1).padStart(2,"0")}-${String(thirtyDaysAgo.getDate()).padStart(2,"0")}`;

    // Try ArcGIS first; fall back to Sonar web search
    // gis.detroitmi.gov DNS is dead — use services2.arcgis.com directly.
    // Real field names (verified): issued_date, permit_type, work_description, address, contact_business_name, zip_code
    let permitData: any[] = [];
    try {
      const arcRes = await fetch(
        `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/BSEED_Trades_Permits/FeatureServer/0/query?where=issued_date+>=+date+'${dateStr}'+AND+permit_type+IS+NOT+NULL&outFields=contact_business_name,permit_type,work_description,address,issued_date,zip_code&f=json&resultRecordCount=100`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (arcRes.ok) {
        const arcData = await arcRes.json();
        permitData = (arcData?.features || [])
          .map((f: any) => f.attributes)
          .filter((a: any) => a && a.contact_business_name)
          .map((a: any) => ({
            contractor_name: a.contact_business_name,
            permit_type: a.permit_type,
            estimated_cost: 75000, // ArcGIS dataset has no cost field — use median estimate
            address: a.address,
          }));
      }
    } catch { /* fall through to Sonar */ }

    if (!permitData.length) {
      // Sonar fallback: search recent BSEED permit filings
      const sonarRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages: [{ role: "user", content: `Search for recent building permits filed in Detroit Michigan in the last 30 days worth over $50,000: site:detroitmi.gov permits OR BSEED building permit 2025 commercial contractor

Extract: contractor company name, permit type, estimated value, address.
Return JSON array: [{"contractor_name":"...","permit_type":"...","estimated_cost":50000,"address":"..."}]
Return empty array [] if nothing found.` }],
          max_tokens: 800, temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (sonarRes.ok) {
        const sonarData = await sonarRes.json();
        const raw = sonarData?.choices?.[0]?.message?.content || "";
        try { permitData = extractJSON(raw) || []; } catch { permitData = []; }
      }
    }

    if (!permitData.length) return [];

    // Aggregate by contractor name (item 22 — multi-permit aggregation)
    const aggregated: Record<string, { contractor: string; count: number; total_value: number; types: string[] }> = {};
    for (const p of permitData) {
      const key = (p.contractor_name || "").toLowerCase().trim();
      if (!key || key.length < 3) continue;
      if (!aggregated[key]) aggregated[key] = { contractor: p.contractor_name, count: 0, total_value: 0, types: [] };
      aggregated[key].count++;
      aggregated[key].total_value += Number(p.estimated_cost) || 0;
      if (p.permit_type && !aggregated[key].types.includes(p.permit_type)) aggregated[key].types.push(p.permit_type);
    }

    // Only emit companies with 3+ permits (high-volume buyer signal)
    const hvbSignals: any[] = [];
    for (const agg of Object.values(aggregated)) {
      if (agg.count < 3) continue;
      const avgValue = Math.round(agg.total_value / agg.count);
      hvbSignals.push({
        company_name: agg.contractor,
        location: "Detroit, MI",
        industry: "Commercial Construction",
        hiring_roles: agg.types,
        hiring_count: agg.count,
        predicted_needs: ["Building materials", "HVAC equipment", "Electrical supplies", "Plumbing fixtures"],
        confidence: Math.min(10, 6 + Math.floor(agg.count / 2)),
        recommended_pitch: `⚡ HIGH-VOLUME BUYER: ${agg.contractor} has pulled ${agg.count} commercial permits in the last 30 days (avg $${avgValue.toLocaleString()}/permit). Active project pipeline — ideal for supply house outreach.`,
        source_urls: [],
        cross_referenced: false,
        signal_type: "permit_surge",
        sector: "construction",
      });
    }
    console.log(`[industry-pulse] BSEED: ${permitData.length} permits → ${hvbSignals.length} high-volume buyer signals`);
    return hvbSignals;
  } catch (e) {
    console.warn("[industry-pulse] BSEED harvest error:", e instanceof Error ? e.message : String(e));
    return [];
  }
}
// ── Item 23: Sonar competitor intel probe ─────────────────────────────────────
async function probeCompetitorContext(company: string, industry: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return "";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: `Name 2 supply companies selling ${industry} equipment/materials to companies like ${company} in Michigan. One sentence only.` }],
        max_tokens: 120, temperature: 0.2,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch { return ""; }
}

// ── Item 25: DOL H-2B visa filing monitor ─────────────────────────────────────
async function harvestH2BSignals(): Promise<any[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: "Search for Michigan companies that recently filed H-2B visa petitions for temporary workers (construction, landscaping, HVAC, hospitality) in 2025-2026 per DOL records.\n\nReturn JSON array: [{\"company\":\"...\",\"location\":\"...\",\"industry\":\"...\",\"count\":10,\"notes\":\"...\"}]\nReturn [] if nothing found." }],
        max_tokens: 600, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    let parsed: any[] = [];
    try { parsed = extractJSON(raw); } catch { return []; }
    return parsed.filter((p: any) => p.company).slice(0, 5).map((p: any) => ({
      company_name: p.company,
      location: p.location || "Michigan",
      industry: p.industry || "Construction",
      hiring_roles: ["H-2B Temporary Worker"],
      hiring_count: p.count || 0,
      predicted_needs: ["Temporary housing", "Bulk PPE", "Equipment rentals", "Safety training services"],
      confidence: 8,
      recommended_pitch: `H-2B filing: ${p.company} importing ${p.count || "multiple"} workers for ${p.industry || "seasonal"} work — immediate bulk supply need. ${p.notes || ""}`,
      source_urls: [],
      cross_referenced: false,
      signal_type: "h2b_filing",
      sector: "labor_import",
    }));
  } catch { return []; }
}

// ── Item 26: Google review score harvesting ───────────────────────────────────
async function getGoogleReviewScore(company: string, location: string): Promise<{ rating: number; count: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const query = encodeURIComponent(`${company} ${location}`);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=rating,user_ratings_total&key=${GOOGLE_MAPS_API_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const candidate = data?.candidates?.[0];
    if (!candidate?.rating) return null;
    return { rating: candidate.rating, count: candidate.user_ratings_total || 0 };
  } catch { return null; }
}

// ── Item 27: Apollo decision-maker mapping ────────────────────────────────────
// Returns up to 3 named decision-makers per company. Net is wide on purpose so
// we get at least one hit even when a company doesn't have the "ideal" title.
export type DecisionMaker = {
  name: string;
  title: string;
  email: string;
  email_status?: string;
  linkedin_url?: string;
  seniority?: string;
};

export async function findDecisionMakers(
  companyName: string,
  domain?: string,
): Promise<DecisionMaker[]> {
  if (!APOLLO_API_KEY || !companyName) return [];
  try {
    const body: Record<string, unknown> = {
      person_titles: [
        "owner", "president", "ceo", "coo", "cfo",
        "general manager", "operations manager", "plant manager",
        "vp operations", "vp of operations", "director of operations",
        "hr director", "human resources", "hr manager",
        "purchasing manager", "procurement manager", "facilities manager",
      ],
      page: 1,
      per_page: 5,
    };
    if (domain) body.q_organization_domains = [domain];
    else body.organization_name = companyName;

    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[apollo-dm] ${companyName}: HTTP ${res.status} (free plan blocks this endpoint)`);
      return [];
    }
    const data = await res.json();
    const rawPeople = data?.people ?? data?.contacts ?? data?.results ?? [];
    const people = (Array.isArray(rawPeople) ? rawPeople : []) as any[];
    return people.slice(0, 3).map((p) => ({
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      title: p.title || "",
      email: p.email || "",
      email_status: p.email_status || undefined,
      linkedin_url: p.linkedin_url || undefined,
      seniority: p.seniority || undefined,
    })).filter((p) => p.name);
  } catch (e) {
    console.warn(`[apollo-dm] ${companyName} error:`, e instanceof Error ? e.message : e);
    return [];
  }
}

// Back-compat shim — returns the top contact in the old shape.
async function findDecisionMaker(companyName: string): Promise<{ name: string; title: string; email: string } | null> {
  const list = await findDecisionMakers(companyName);
  return list[0] || null;
}

// ── Item 29: Michigan SOS new business velocity ───────────────────────────────
async function harvestSOSNewBusinessSignals(): Promise<any[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: "Search for new construction, HVAC, plumbing, electrical, or roofing businesses that recently registered in Michigan (Secretary of State filings) in 2025-2026.\n\nReturn JSON array: [{\"company\":\"...\",\"location\":\"...\",\"industry\":\"...\"}]\nReturn [] if nothing found." }],
        max_tokens: 500, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    let parsed: any[] = [];
    try { parsed = extractJSON(raw); } catch { return []; }
    return parsed.filter((p: any) => p.company).slice(0, 8).map((p: any) => ({
      company_name: p.company,
      location: p.location || "Michigan",
      industry: p.industry || "General Construction",
      hiring_roles: ["New Business"],
      hiring_count: 0,
      predicted_needs: ["Startup equipment", "Initial tool inventory", "Safety supplies", "Uniforms/workwear"],
      confidence: 5,
      recommended_pitch: `New MI ${p.industry || "trade"} business: ${p.company} recently registered — first-mover supply relationship opportunity.`,
      source_urls: [],
      cross_referenced: false,
      signal_type: "new_business",
      sector: "new_formation",
    }));
  } catch { return []; }
}

// ── Item 30: NOAA storm event × permit lag correlation ────────────────────────
async function boostStormCorrelatedPermitSignals(signals: any[]): Promise<void> {
  if (!NOAA_API_KEY) return;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(
      `https://www.ncdc.noaa.gov/cdo-web/api/v2/events?locationid=FIPS:26&startdate=${thirtyDaysAgo}&enddate=${today}&limit=10`,
      { headers: { token: NOAA_API_KEY }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return;
    const data = await res.json();
    const stormRaw = data?.results ?? data?.data ?? [];
    const stormEvents = (Array.isArray(stormRaw) ? stormRaw : []).filter((e: any) =>
      /wind|hail|storm|tornado|flood/i.test(e.type || e.event_type || e.eventType || ""));
    if (!stormEvents.length) return;
    for (const sig of signals) {
      if (sig.signal_type === "permit_surge") {
        sig.confidence = Math.min(10, sig.confidence + 2);
        sig.recommended_pitch = `🌩️ STORM CORRELATION (${stormEvents.length} MI storm events last 30 days): ${sig.recommended_pitch}`;
      }
    }
    console.log(`[industry-pulse] Storm correlation: ${stormEvents.length} events boosted permit signals`);
  } catch (e) {
    console.warn("[industry-pulse] NOAA error:", e instanceof Error ? e.message : String(e));
  }
}

// ── Item 32: HIBP company domain breach check ─────────────────────────────────
async function checkCompanyDomainBreach(domain: string): Promise<boolean> {
  if (!HIBP_API_KEY || !domain) return false;
  try {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, {
      headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": "DetroitWebAgency-IntelligenceScanner" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return false;
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}


const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trade categories to scan
const TRADE_QUERIES = [
  { industry: "HVAC", query: '"hiring" "HVAC technician" OR "HVAC installer" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "CNC/Machining", query: '"hiring" "CNC machinist" OR "CNC operator" OR "CNC programmer" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "Welding", query: '"hiring" "welder" OR "welding" OR "fabricator" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "Electrical", query: '"hiring" "electrician" OR "electrical" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "Boiler/Pressure", query: '"hiring" "boiler operator" OR "boiler technician" OR "pressure vessel" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "Plumbing", query: '"hiring" "plumber" OR "plumbing" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
];

// Hardcoded fallback mappings
const FALLBACK_MAPPINGS: Record<string, string[]> = {
  "HVAC": ["Refrigerant", "Ductwork", "Recovery equipment", "HVAC tools", "Sheet metal"],
  "CNC/Machining": ["Tooling", "Coolant", "Fixturing", "New CNC machines", "Metrology equipment"],
  "Welding": ["Welding gas", "Rod/wire", "PPE", "Fume extraction", "Welding machines"],
  "Electrical": ["Panel upgrades", "Conduit", "Testing equipment", "Wire/cable", "Transformers"],
  "Boiler/Pressure": ["Boiler parts", "Maintenance contracts", "Safety inspection services", "Pressure gauges", "Water treatment"],
  "Plumbing": ["Pipe fittings", "Water heaters", "Drain equipment", "Backflow preventers", "PEX supplies"],
};

function extractJSON(raw: string): any {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("[extractJSON] Ingestion Pipeline parse failed:", String(e), "raw prefix:", cleaned.slice(0, 150));
    return [];
  }
}

async function harvestHiringSignals(query: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return "";
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
            role: "user",
            content: `Search the web for recent hiring activity: ${query}

For each company you find hiring, extract:
- Company name
- Location (city, state)
- Roles they're hiring for
- Approximate number of positions (if visible)
- Source URL

Return ONLY valid JSON array:
[{"company":"...","location":"...","roles":["..."],"count":1,"source_url":"..."}]

If no results found, return empty array: []`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return "";
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

async function predictNeeds(company: string, roles: string[], count: number, industry: string): Promise<{ predicted_needs: string[]; confidence: number; recommended_pitch: string }> {
  // Fallback
  const fallback = {
    predicted_needs: FALLBACK_MAPPINGS[industry] || ["Equipment", "Maintenance contracts"],
    confidence: 4,
    recommended_pitch: `${company} is hiring ${count}+ ${roles.join("/")} — likely expanding operations. Reach out with ${industry} equipment/service proposals.`,
  };

  if (!LOVABLE_API_KEY) return fallback;

  try {
    const prompt = `A company called "${company}" is hiring ${count} people for these roles: ${roles.join(", ")}. Industry: ${industry}.

Based on these hiring patterns, predict:
1. What capital equipment, supplies, or service contracts will they likely need in the next 90 days?
2. How confident are you? (1-10 scale, where 10 = certain purchase, 1 = speculative)
3. Write a 2-sentence recommended pitch angle for a salesperson selling to this company.

Rules:
- Multiple trades hiring at once = facility expansion = highest confidence (8-10)
- Single trade = normal replacement = lower confidence (3-5)
- 3+ same trade = growth/new contracts = medium-high confidence (6-8)

Return ONLY valid JSON:
{"predicted_needs":["..."],"confidence":7,"recommended_pitch":"..."}`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return fallback;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(raw);
    return {
      predicted_needs: parsed.predicted_needs || fallback.predicted_needs,
      confidence: Math.min(10, Math.max(1, parsed.confidence || 4)),
      recommended_pitch: parsed.recommended_pitch || fallback.recommended_pitch,
    };
  } catch {
    return fallback;
  }
}

// SBA loan approvals — Metro Detroit companies that just received capital are expanding
// Source: USASpending.gov API (verified working — SBA CKAN datastore is not active/queryable)
async function harvestSBACapitalSignals(): Promise<any[]> {
  try {
    const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const body = {
      subawards: false, page: 1, limit: 50, sort: "Issued Date", order: "desc",
      fields: ["Award ID", "Recipient Name", "Loan Value", "Issued Date", "recipient_location_city_name", "recipient_location_state_code", "naics_code", "naics_description"],
      filters: {
        award_type_codes: ["08"], // SBA 7(a) guaranteed loans
        place_of_performance_locations: [{ country: "USA", state: "MI" }],
        time_period: [{ start_date: cutoff, end_date: today }],
      },
    };
    const r = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const records: any[] = j?.results || [];

    const targetNAICS: Record<string, string> = {
      "238": "Construction Trades",
      "237": "Heavy Construction",
      "236": "Building Construction",
      "333": "Machinery Manufacturing",
      "332": "Fabricated Metal Products",
      "336": "Transportation Equipment",
      "484": "Trucking",
      "811": "Repair & Maintenance",
      "622": "Hospitals",
      "623": "Nursing & Residential Care",
    };

    const metro = /detroit|dearborn|warren|livonia|sterling|troy|pontiac|southfield|ann arbor|canton|westland|farmington|grosse pointe|hamtramck|highland park/i;

    return records
      .filter((rec: any) =>
        metro.test(rec.recipient_location_city_name || "") &&
        Number(rec["Loan Value"] || 0) >= 50_000 &&
        Object.keys(targetNAICS).some((code) => String(rec.naics_code || "").startsWith(code))
      )
      .slice(0, 25)
      .map((rec: any) => {
        const industry = Object.entries(targetNAICS).find(([code]) => String(rec.naics_code || "").startsWith(code))?.[1] || "Trade/Construction";
        const amount = Number(rec["Loan Value"] || 0);
        return {
          company_name: rec["Recipient Name"] || "Unknown",
          location: `${rec.recipient_location_city_name || "Metro Detroit"}, MI`,
          industry,
          hiring_roles: ["Equipment purchases", "Workforce expansion", "Facility upgrades"],
          hiring_count: 1,
          predicted_needs: ["Equipment financing", "Tech stack", "Field service software", "Insurance"],
          confidence: amount >= 500_000 ? 9 : amount >= 100_000 ? 8 : 7,
          recommended_pitch: `💰 SBA CAPITAL: ${rec["Recipient Name"]} received $${amount.toLocaleString()} SBA loan (${rec["Issued Date"]?.slice(0, 10) || "recent"}). Company is in active expansion — ideal window for TechAlert, FieldDesk, or Growth Radar pitch.`,
          source_urls: [],
          cross_referenced: false,
          signal_type: "sba_capital",
          sector: "sba_expansion",
        };
      });
  } catch (e) {
    console.warn("[industry-pulse] SBA capital harvest error:", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Michigan Economic Development Corporation grant recipients — state-funded expansion = buying mode
async function harvestMEDCGrantSignals(): Promise<any[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a public records researcher. Return ONLY valid JSON array, no prose, no markdown." },
          { role: "user", content: `Search MEDC (Michigan Economic Development Corporation) press releases and public announcements from the last 60 days for Metro Detroit companies receiving grants, tax incentives, or Michigan Business Development Program awards. Focus on manufacturing, construction, healthcare, and trade companies. Return JSON: [{"company_name":"string","city":"string","grant_amount":0,"grant_type":"string","jobs_created":0,"industry":"string","source_url":"string"}]. Return [] if nothing found.` },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let arr: any[];
    try {
      const parsed = JSON.parse(cleaned);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("[Ingestion Pipeline] JSON parse failed:", String(e), "raw:", cleaned.slice(0, 150));
      arr = [];
    }
    return arr.map((item: any) => ({
      company_name: item.company_name || item.name || "Unknown",
      location: `${item.city || "Metro Detroit"}, MI`,
      industry: item.industry || "Manufacturing",
      hiring_roles: [`${item.jobs_created || "?"} jobs planned`],
      hiring_count: item.jobs_created || 1,
      predicted_needs: ["Equipment", "Tech stack", "Workforce management", "Field service software"],
      confidence: 9,
      recommended_pitch: `🏛️ MEDC GRANT: ${item.company_name} received ${item.grant_type || "state economic development grant"} ($${Number(item.grant_amount || 0).toLocaleString()}). Expansion is state-funded — very high buying probability. Jobs: ${item.jobs_created || "?"}. Source: ${item.source_url || "MEDC.michigan.gov"}`,
      source_urls: item.source_url ? [item.source_url] : [],
      cross_referenced: false,
      signal_type: "medc_grant",
      sector: "state_funded",
    }));
  } catch (e) {
    console.warn("[industry-pulse] MEDC grant harvest error:", e instanceof Error ? e.message : String(e));
    return [];
  }
}

import { withRunLog } from "../_shared/demand-radar-log.ts";

serve(withRunLog("industry-pulse-scanner", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const signals: any[] = [];
    let totalScanned = 0;

    // Scan each trade category
    for (const trade of TRADE_QUERIES) {
      console.log(`[industry-pulse] Scanning ${trade.industry}...`);
      const raw = await harvestHiringSignals(trade.query);
      if (!raw) continue;

      try {
        const companies = extractJSON(raw);
        if (!Array.isArray(companies)) continue;
        totalScanned += companies.length;

        for (const co of companies.slice(0, 5)) {
          if (!co.company || !co.roles?.length) continue;

          // Filter out job board names and aggregator junk
          const junkNames = ["indeed", "ziprecruiter", "linkedin", "multiple employers", "various", "confidential", "staffing agency", "temp agency"];
          if (junkNames.some(j => co.company.toLowerCase().includes(j))) continue;
          if (co.company.length < 3 || co.company.length > 100) continue;

          const prediction = await predictNeeds(
            co.company,
            co.roles,
            co.count || 1,
            trade.industry
          );

          // Item 21: Apollo org validation — skip junk companies, get size_tier
          const apolloCheck = await apolloValidateCompany(co.company);
          if (!apolloCheck.valid) continue;
          // Boost confidence for small companies (growing fast = hot prospect)
          let adjConfidence = prediction.confidence;
          if (apolloCheck.size_tier === "micro") adjConfidence = Math.min(10, adjConfidence + 1);

          signals.push({
            company_name: co.company,
            location: co.location || "Metro Detroit, MI",
            industry: trade.industry,
            hiring_roles: co.roles,
            hiring_count: co.count || 1,
            predicted_needs: prediction.predicted_needs,
            confidence: adjConfidence,
            recommended_pitch: prediction.recommended_pitch,
            source_urls: co.source_url ? [co.source_url] : [],
            cross_referenced: false,
            sector: apolloCheck.size_tier !== "unknown" ? apolloCheck.size_tier : null,
          });
        }
      } catch {
        console.log(`[industry-pulse] Failed to parse ${trade.industry} results`);
      }
    }

    // Item 19: Harvest BSEED permit surge signals (aggregated by contractor, item 22)
    const bseedSignals = await harvestBSEEDPermitSignals(sb);
    signals.push(...bseedSignals);

    // Items 25 & 29: H-2B visa filings + Michigan SOS new business velocity
    const [h2bSignals, sosSignals, sbaCapitalSignals, medcSignals] = await Promise.all([
      harvestH2BSignals(),
      harvestSOSNewBusinessSignals(),
      harvestSBACapitalSignals(),
      harvestMEDCGrantSignals(),
    ]);
    signals.push(...h2bSignals, ...sosSignals, ...sbaCapitalSignals, ...medcSignals);

    // Item 30: Boost permit_surge signals when NOAA storm events detected
    await boostStormCorrelatedPermitSignals(signals);

    // Item 28: N-way cluster scoring — 3+ distinct signal types for same company = triple-confirmed
    const companySignalTypes: Record<string, Set<string>> = {};
    for (const sig of signals) {
      const key = sig.company_name.toLowerCase();
      if (!companySignalTypes[key]) companySignalTypes[key] = new Set();
      companySignalTypes[key].add(sig.signal_type || sig.industry || "hiring");
    }
    for (const sig of signals) {
      const typeCount = companySignalTypes[sig.company_name.toLowerCase()]?.size || 1;
      if (typeCount >= 3 && !sig.cross_referenced) {
        sig.cross_referenced = true;
        sig.confidence = Math.min(10, sig.confidence + 3);
        sig.recommended_pitch = `🎯 TRIPLE-CONFIRMED (${typeCount} signal types): ${sig.recommended_pitch}`;
      }
    }

    // Cross-reference: check if any companies also appear in industrial growth intel
    if (signals.length > 0) {
      const companyNames = signals.map((s) => s.company_name.toLowerCase());

      // Check existing expansion news signals
      const { data: existingNews } = await sb
        .from("industry_pulse_signals")
        .select("company_name")
        .eq("cross_referenced", false)
        .gte("detected_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const existingCompanies = new Set((existingNews || []).map((n: any) => n.company_name.toLowerCase()));

      for (const signal of signals) {
        if (existingCompanies.has(signal.company_name.toLowerCase())) {
          signal.cross_referenced = true;
          signal.confidence = Math.min(10, signal.confidence + 2);
          signal.recommended_pitch = `⚡ HIGH CONFIDENCE: ${signal.company_name} appears in BOTH hiring AND expansion news. ${signal.recommended_pitch}`;
        }
      }
    }

    // Deduplicate: skip any company+industry seen in the last 7 days
    if (signals.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSignals } = await sb
        .from("industry_pulse_signals")
        .select("company_name, industry")
        .gte("detected_at", sevenDaysAgo);

      const recentKeys = new Set(
        (recentSignals || []).map((r: any) => `${r.company_name.toLowerCase()}|${(r.industry || "").toLowerCase()}`)
      );

      const deduped = signals.filter((s) =>
        !recentKeys.has(`${s.company_name.toLowerCase()}|${(s.industry || "").toLowerCase()}`)
      );

      if (deduped.length > 0) {
        // Item 31: FieldDesk upsell flag — trade industry + Apollo employee range (no extra API cost)
        const fieldDeskTrades = new Set(["HVAC", "Electrical", "Plumbing", "Boiler/Pressure"]);
        for (const sig of deduped) {
          if (fieldDeskTrades.has(sig.industry) && sig.confidence >= 7) {
            sig.recommended_pitch = `🔧 FIELDESK PROSPECT | ${sig.recommended_pitch}`;
          }
        }

        // Items 23, 26, 27, 32: Enrich top 3 highest-confidence signals (API calls limited to top signals)
        const topSignals = [...deduped].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
        await Promise.all(topSignals.map(async (sig) => {
          const [compCtx, dm, reviewScore] = await Promise.all([
            probeCompetitorContext(sig.company_name, sig.industry),
            findDecisionMaker(sig.company_name),
            getGoogleReviewScore(sig.company_name, sig.location || "Michigan"),
          ]);
          if (compCtx) sig.recommended_pitch += ` Competitor intel: ${compCtx}`;
          if (dm?.name) sig.recommended_pitch += ` | Contact: ${dm.name}${dm.title ? ` (${dm.title})` : ""}${dm.email ? ` — ${dm.email}` : ""}`;
          if (reviewScore) {
            const reviewNote = reviewScore.rating < 3.5
              ? ` | 🔴 LOW RATING ${reviewScore.rating}/5 (${reviewScore.count} reviews) — Review Monitor upsell opportunity`
              : ` | Google: ${reviewScore.rating}/5 (${reviewScore.count} reviews)`;
            sig.recommended_pitch += reviewNote;
          }

          // Item 32: HIBP domain breach check
          const domain = sig.company_name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
          const breached = await checkCompanyDomainBreach(domain);
          if (breached) sig.recommended_pitch = `🔒 DATA BREACH ON FILE | ${sig.recommended_pitch}`;
        }));

        const { error: insertErr } = await sb
          .from("industry_pulse_signals")
          .insert(deduped);
        if (insertErr) console.error("[industry-pulse] Insert error:", insertErr);
      }
      console.log(`[industry-pulse] Deduped: ${signals.length} found, ${deduped.length} new`);
    }

    // Update agent heartbeat
    await sb
      .from("agent_heartbeats")
      .upsert(
        { agent_name: "industry-pulse-scanner", last_beat: new Date().toISOString(), metadata: { signals_found: signals.length, total_scanned: totalScanned } },
        { onConflict: "agent_name" }
      );

    // Notify Matt if high-confidence signals found
    const highConf = signals.filter((s) => s.confidence >= 7);
    if (highConf.length > 0 && RESEND_API_KEY) {
      const rows = highConf.map((s) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:#fff;font-weight:bold">${s.company_name}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:#94a3b8">${s.hiring_roles.join(", ")}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:#00d4ff;font-weight:bold">${s.confidence}/10${s.cross_referenced ? " ⚡" : ""}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:#94a3b8">${s.predicted_needs.slice(0, 3).join(", ")}</td>
        </tr>
      `).join("");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: ["matt@detroitwebagent.com"],
          subject: `🔮 Industry Pulse: ${highConf.length} high-confidence signals detected`,
          html: `
            <div style="background:#0a1628;padding:24px;font-family:system-ui">
              <h2 style="color:#00d4ff;margin:0 0 16px">🔮 Industry Pulse Report</h2>
              <p style="color:#94a3b8;margin:0 0 16px">${signals.length} total signals · ${highConf.length} high confidence · ${signals.filter(s => s.cross_referenced).length} cross-referenced</p>
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #1e293b;color:#64748b;font-size:11px">COMPANY</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #1e293b;color:#64748b;font-size:11px">HIRING</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #1e293b;color:#64748b;font-size:11px">CONFIDENCE</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #1e293b;color:#64748b;font-size:11px">PREDICTED NEEDS</th>
                </tr>
                ${rows}
              </table>
              <p style="color:#475569;font-size:11px;margin:16px 0 0">View full details in DWA Admin → Growth Signals</p>
            </div>
          `,
        }),
      });
    }

    console.log(`[industry-pulse] Complete: ${signals.length} signals, ${highConf.length} high-confidence`);

    // Phase 20: waterfall drop-off snapshot
    try {
      await sb.from("raw_signals_dump").insert({
        scanner: "industry-pulse-scanner",
        source: "mixed",
        vertical: "commercial",
        raw_payload: { sample: signals.slice(0, 25) },
        pulled_count: signals.length,
        kept_after_gate: signals.length,
        enriched_count: signals.filter((s: any) => s.predicted_needs?.length).length,
        final_inserted: highConf.length,
        notes: `cross_ref=${signals.filter((s: any) => s.cross_referenced).length}`,
      });
    } catch (e) { console.warn("[industry-pulse-scanner] raw dump failed:", e); }

    return new Response(JSON.stringify({
      success: true,
      signals_found: signals.length,
      high_confidence: highConf.length,
      cross_referenced: signals.filter((s) => s.cross_referenced).length,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[industry-pulse-scanner]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}));
