// miosha-license-scraper — Michigan trade candidate data
// THREE data sources:
// 1. NPI Registry — free federal API for healthcare workers (CNA, RN, LPN)
// 2. Sonar web search — finds tradespeople mentioned in news, LinkedIn posts, union directories
// 3. Gemini prose extraction fallback
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
// Free federal API — searches for RN, LPN, CNA by name patterns in Michigan
// Returns real licensed professionals with NPI numbers

const NPI_SEARCHES = [
  { taxonomy: "367H00000X", label: "CNA" },
  { taxonomy: "163W00000X", label: "RN" },
  { taxonomy: "164W00000X", label: "LPN" },
  { taxonomy: "372600000X", label: "Home Health Aide" },
  { taxonomy: "363L00000X", label: "RN" },
  { taxonomy: "364S00000X", label: "Clinical Nurse Specialist" },
];

const MICHIGAN_CITIES = [
  "Detroit", "Warren", "Sterling Heights", "Dearborn", "Livonia",
  "Troy", "Southfield", "Pontiac", "Taylor", "Westland",
  "Roseville", "Royal Oak", "St. Clair Shores", "Macomb", "Clinton Township",
];

async function searchNPIRegistry(taxonomy: string, label: string): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  const seen = new Set<string>();

  // Search NPI by taxonomy code + state
  for (const city of MICHIGAN_CITIES.slice(0, 8)) {
    try {
      const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&city=${encodeURIComponent(city)}&state=MI&taxonomy_description=${encodeURIComponent(label)}&enumeration_type=NPI-1&limit=10`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        console.warn(`[miosha-scraper] NPI HTTP ${res.status} for ${label} in ${city}`);
        continue;
      }
      const data = await res.json();
      const results = data?.results || [];

      for (const r of results) {
        const firstName = r.basic?.first_name || "";
        const lastName = r.basic?.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim();
        if (!fullName || !isPersonName(fullName)) continue;

        const key = `${fullName.toLowerCase()}-${r.number}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const address = r.addresses?.find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0];

        candidates.push({
          full_name: fullName,
          license_type: label,
          license_number: r.number?.toString() || null,
          license_expiry: null,
          city: address?.city || city,
          source: "miosha" as const,
        });
      }
    } catch (e) {
      console.warn(`[miosha-scraper] NPI error for ${label} in ${city}:`, e instanceof Error ? e.message : String(e));
    }
  }

  console.log(`[miosha-scraper] NPI ${label}: ${candidates.length} licensed professionals found`);
  return candidates;
}

// ===== SOURCE 2: Sonar Web Search (Trades — Non-Healthcare) =====
// Sonar can't find individual resumes (privacy walls) but CAN find:
// - People mentioned in news articles about trade shortages
// - LinkedIn posts by tradespeople
// - Trade union announcements
// - Apprenticeship completion announcements

const SONAR_QUERIES = [
  {
    query: `Find individual boiler operators, stationary engineers, or boiler technicians in Metro Detroit Michigan. Search for: LinkedIn posts by people who work as boiler operators, news articles mentioning specific boiler operators by name, UA Local 636 member spotlights, Michigan LARA license verification results showing individual boiler operator names. Focus on Wayne, Oakland, and Macomb counties. Return real individual person names with their city.`,
    label: "Boiler Operator",
  },
  {
    query: `Find individual HVAC technicians, HVAC installers, or mechanical contractors in Metro Detroit Michigan. Search for: LinkedIn profiles listing HVAC as current job title, Facebook posts by HVAC techs looking for work, local news articles mentioning specific HVAC workers, NATE certification directory listings. Individual people only, not companies.`,
    label: "HVAC Technician",
  },
  {
    query: `Find individual licensed plumbers or master plumbers in Metro Detroit Michigan. Search for: LinkedIn profiles of plumbers, local news articles mentioning specific plumbers by name, Michigan plumbing apprenticeship completions, UA Local 98 member spotlights or announcements. Wayne, Oakland, Macomb counties. Return person names with city.`,
    label: "Plumber",
  },
  {
    query: `Find individual licensed electricians or journeyman electricians in Metro Detroit Michigan. Search for: LinkedIn profiles of electricians, IBEW Local 58 member spotlights, news articles mentioning specific electricians, Michigan electrical apprenticeship completion announcements. Individual people only.`,
    label: "Electrician",
  },
];

async function searchViaSonar(query: string, label: string): Promise<LicenseCandidate[]> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[miosha-scraper] No OPENROUTER_API_KEY — skipping Sonar");
    return [];
  }

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
3. Search sources: LinkedIn profiles, Facebook professional posts, local news articles, trade union directories, apprenticeship completion announcements, professional certification directories
4. Do NOT fabricate names — only include people you actually find mentioned by name in real sources
5. It's OK to return fewer results if you can only verify a few real individuals

Return ONLY valid JSON array. Each object: { "full_name": "First Last", "license_number": "number or null", "city": "Michigan city or null", "current_employer": "company or null" }. Max 20 results. No markdown. No explanation. If you truly find nothing, return [].`,
          },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[miosha-scraper] Sonar HTTP ${res.status} for ${label}: ${errText.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";

    console.log(`[miosha-scraper] Sonar raw response for ${label} (${text.length} chars): ${text.slice(0, 300)}`);

    // Strip markdown code fences
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log(`[miosha-scraper] Sonar ${label}: no JSON array found, trying Gemini extraction`);
      if (text.length > 50 && LOVABLE_API_KEY) {
        return extractNamesFromProse(text, label);
      }
      return [];
    }

    let parsed: Array<{
      full_name: string;
      license_number?: string | null;
      city?: string | null;
      current_employer?: string | null;
    }>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn(`[miosha-scraper] JSON parse failed for ${label}`);
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    const validated: LicenseCandidate[] = [];
    for (const r of parsed) {
      if (!r.full_name) continue;
      if (!isPersonName(r.full_name)) {
        console.log(`[miosha-scraper] Rejected "${r.full_name}" — looks like a company`);
        continue;
      }
      const hasLicNum = r.license_number && looksLikeLicenseNumber(String(r.license_number));
      const hasCity = r.city && r.city.toLowerCase() !== "michigan" && r.city.length > 2;
      const hasEmployer = r.current_employer && r.current_employer.length > 2;
      if (!hasLicNum && !hasCity && !hasEmployer) {
        console.log(`[miosha-scraper] Rejected "${r.full_name}" — no license, city, or employer`);
        continue;
      }

      validated.push({
        full_name: r.full_name,
        license_type: label,
        license_number: hasLicNum ? String(r.license_number) : null,
        license_expiry: null,
        city: hasCity ? r.city! : null,
        source: "miosha" as const,
      });
    }

    console.log(`[miosha-scraper] Sonar ${label}: ${parsed.length} raw → ${validated.length} validated`);
    return validated;
  } catch (e) {
    console.warn(`[miosha-scraper] Sonar error for ${label}:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

// When Sonar returns prose instead of JSON, use Gemini to extract names
async function extractNamesFromProse(prose: string, label: string): Promise<LicenseCandidate[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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
        full_name: r.full_name,
        license_type: label,
        license_number: r.license_number && looksLikeLicenseNumber(r.license_number) ? r.license_number : null,
        license_expiry: null,
        city: r.city && r.city.length > 2 && r.city.toLowerCase() !== "michigan" ? r.city : null,
        source: "miosha" as const,
      }));
  } catch {
    return [];
  }
}

// ===== DB UPSERT =====
async function upsertCandidate(sb: ReturnType<typeof createClient>, c: LicenseCandidate): Promise<"new" | "updated" | "error"> {
  try {
    const row: Record<string, unknown> = {
      name: c.full_name,
      full_name: c.full_name,
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
        await sb.from("hire_alert_candidates").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
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
        await sb.from("hire_alert_candidates").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
        return "updated";
      }
    }
  } catch (e) {
    console.error(`[miosha-scraper] upsert error for ${c.full_name}:`, e);
    return "error";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  // ===== PHASE 1: NPI Registry (Healthcare Workers) =====
  console.log("[miosha-scraper] Phase 1: NPI Registry healthcare search");
  const npiResults = await Promise.allSettled(
    NPI_SEARCHES.map(({ taxonomy, label }) => searchNPIRegistry(taxonomy, label))
  );

  for (const result of npiResults) {
    if (result.status === "fulfilled") {
      for (const c of result.value) {
        const res = await upsertCandidate(sb, c);
        if (res === "new") newCount++;
        else if (res === "updated") updatedCount++;
        else errorCount++;
      }
    } else {
      console.warn("[miosha-scraper] NPI search failed:", result.reason);
    }
  }

  console.log(`[miosha-scraper] Phase 1 done: new=${newCount} updated=${updatedCount}. Phase 2: Sonar trades search`);

  // ===== PHASE 2: Sonar Web Search (Trades — Parallel) =====
  const sonarResults = await Promise.allSettled(
    SONAR_QUERIES.map(({ query, label }) => searchViaSonar(query, label))
  );

  for (const result of sonarResults) {
    if (result.status === "fulfilled") {
      for (const c of result.value) {
        const res = await upsertCandidate(sb, c);
        if (res === "new") newCount++;
        else if (res === "updated") updatedCount++;
        else if (res === "error") errorCount++;
      }
    }
  }

  console.log(`[miosha-scraper] Done: new=${newCount} updated=${updatedCount} errors=${errorCount}`);
  return new Response(
    JSON.stringify({ ok: true, new: newCount, updated: updatedCount, errors: errorCount }),
    { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
});
