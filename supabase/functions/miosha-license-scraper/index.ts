// miosha-license-scraper — Michigan trade candidate data
// TWO data sources:
// 1. Apollo.io People Search — finds tradespeople by title + location
// 2. Sonar web search — finds tradespeople from LinkedIn, Indeed, union directories
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
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
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

// ===== SOURCE 1: Apollo.io People Search =====
// Searches for tradespeople by job title in Michigan

const APOLLO_TRADE_SEARCHES = [
  { title: "boiler operator", label: "Boiler Operator" },
  { title: "HVAC technician", label: "HVAC Technician" },
  { title: "master plumber", label: "Plumber" },
  { title: "journeyman electrician", label: "Electrician" },
  { title: "certified nursing assistant", label: "CNA" },
  { title: "licensed practical nurse", label: "RN/LPN" },
];

async function searchViaApollo(tradeTitle: string, label: string): Promise<LicenseCandidate[]> {
  if (!APOLLO_API_KEY) {
    console.warn("[miosha-scraper] No APOLLO_API_KEY — skipping Apollo search");
    return [];
  }

  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "X-Api-Key": APOLLO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        person_titles: [tradeTitle],
        person_locations: ["Michigan, United States"],
        per_page: 25,
        page: 1,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[miosha-scraper] Apollo HTTP ${res.status} for ${label}: ${errText.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();
    const people = data?.people || [];
    console.log(`[miosha-scraper] Apollo raw results for ${label}: ${people.length}`);

    const candidates: LicenseCandidate[] = [];
    for (const person of people) {
      const name = person.name || `${person.first_name || ""} ${person.last_name || ""}`.trim();
      if (!name || !isPersonName(name)) {
        console.log(`[miosha-scraper] Apollo: rejected "${name}" — not a person name`);
        continue;
      }

      const city = person.city || person.state || null;

      candidates.push({
        full_name: name,
        license_type: label,
        license_number: null,
        license_expiry: null,
        city: city,
        source: "miosha" as const,
      });
    }

    console.log(`[miosha-scraper] Apollo ${label}: ${people.length} raw → ${candidates.length} validated`);
    return candidates;
  } catch (e) {
    console.warn(`[miosha-scraper] Apollo error for ${label}:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

// ===== SOURCE 2: Sonar Web Search (Live Web — Finds People on Public Profiles) =====

const SONAR_QUERIES = [
  {
    query: `Find LinkedIn profiles, personal websites, or trade union member pages for individual licensed boiler operators in Metro Detroit Michigan who are actively job seeking or open to work. Search LinkedIn "open to work" profiles, Indeed public resumes, UA Local 636 directory. Return real individual people with full names, NOT companies. Include any Michigan boiler license numbers visible on their profiles.`,
    label: "Boiler Operator",
  },
  {
    query: `Find LinkedIn profiles, Indeed public resumes, or professional association listings for individual licensed HVAC technicians and mechanical contractors in Metro Detroit Michigan who are open to work or recently posted resumes. Include any LARA or EPA license numbers visible on their profiles. Individual people only.`,
    label: "HVAC Technician",
  },
  {
    query: `Find LinkedIn profiles, Indeed public resumes, or trade association directories for individual licensed plumbers or master plumbers in Metro Detroit Michigan who are open to work or actively job seeking. Wayne, Oakland, Macomb counties. Return person names and any license numbers from their profiles.`,
    label: "Plumber",
  },
  {
    query: `Find LinkedIn profiles, Indeed public resumes, or IBEW Local 58 member pages for individual licensed electricians or journeyman electricians in Metro Detroit Michigan who are open to work or seeking new positions. Individual people names only, not companies. Include license numbers if visible on profiles.`,
    label: "Electrician",
  },
  {
    query: `Find LinkedIn profiles, Indeed public resumes, or care.com profiles for individual Certified Nursing Assistants (CNA) in Metro Detroit Michigan who are seeking new positions or open to work. Include any certification numbers visible on profiles. Individual people only.`,
    label: "CNA",
  },
  {
    query: `Find LinkedIn profiles, Indeed public resumes, or NurseFly/Vivian Health profiles for individual registered nurses (RN) and licensed practical nurses (LPN) in Metro Detroit Michigan who are open to new opportunities. Include any Michigan nursing license numbers visible. Individual names only.`,
    label: "RN/LPN",
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
            content: `You are a recruiting intelligence researcher finding tradespeople who are actively seeking work or recently became available in Michigan.

CRITICAL RULES:
1. Return ONLY individual people — NEVER company names, LLC, Inc, contractors, organizations
2. Each result MUST have: a real person's full name (First Last) AND at least one of: license number, specific Michigan city, or current employer
3. Search LinkedIn "open to work" profiles, Indeed public resumes, trade union directories, and professional association listings
4. If you find real people but can't verify license numbers, still include them with city
5. Do NOT fabricate names or license numbers — only include what you actually find in search results

Return ONLY valid JSON array. Each object: { "full_name": "First Last", "license_number": "number or null", "city": "Michigan city or null", "current_employer": "company or null" }. Max 20 results. No markdown. No explanation. If you truly find nothing, return [].`,
          },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
        temperature: 0.2,
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

    const jsonMatch = text.match(/\[[\s\S]*\]/);
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

  // ===== PHASE 1: Apollo.io People Search =====
  console.log("[miosha-scraper] Phase 1: Apollo.io people search");
  if (APOLLO_API_KEY) {
    const apolloResults = await Promise.allSettled(
      APOLLO_TRADE_SEARCHES.map(({ title, label }) => searchViaApollo(title, label))
    );

    for (const result of apolloResults) {
      if (result.status === "fulfilled") {
        for (const c of result.value) {
          const res = await upsertCandidate(sb, c);
          if (res === "new") newCount++;
          else if (res === "updated") updatedCount++;
          else errorCount++;
        }
      } else {
        console.warn("[miosha-scraper] Apollo search failed:", result.reason);
      }
    }
  } else {
    console.warn("[miosha-scraper] No APOLLO_API_KEY — skipping Phase 1");
  }

  console.log(`[miosha-scraper] Phase 1 done: new=${newCount} updated=${updatedCount}. Phase 2: Sonar web search`);

  // ===== PHASE 2: Sonar Web Search (Parallel) =====
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
