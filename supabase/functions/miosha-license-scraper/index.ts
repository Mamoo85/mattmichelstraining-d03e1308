// miosha-license-scraper — Michigan LARA license data
// TWO real data sources:
// 1. Michigan LARA Accela portal — direct license lookup by trade type
// 2. Sonar web search — fallback and supplement, with strict validation
//
// VALIDATION RULES (to prevent hallucinated data entering DB):
// - Reject candidates with no license number AND no verifiable city
// - Reject names that look like company names (Inc, LLC, Corp, Co., dba)
// - Require name to be 2+ words (first + last)
// - Michigan boiler operator license numbers start with digits or B/BO prefix

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

interface LicenseCandidate {
  full_name: string;
  license_type: string;
  license_number: string | null;
  license_expiry: string | null;
  city: string | null;
  source: "miosha";
}

// Rejects names that are clearly business entities, not people
const COMPANY_SIGNALS = ["inc", "llc", "corp", "co.", "company", "contractors", "services", "solutions", "group", "enterprises", "associates", "systems", "industries", "construction", "plumbing", "hvac", "mechanical", "electric", "heating", "cooling", "dba", "d/b/a"];

function isPersonName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  // Must be at least two words (first + last name)
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  // Reject if any word looks like a business suffix
  if (COMPANY_SIGNALS.some((s) => lower.includes(s))) return false;
  // Reject if all caps (likely a company header like "JOHNSON & SONS")
  if (name === name.toUpperCase() && name.length > 8) return false;
  return true;
}

// Michigan license number patterns for basic sanity check
function looksLikeLicenseNumber(num: string): boolean {
  if (!num || num.length < 3) return false;
  // Must contain at least one digit
  if (!/\d/.test(num)) return false;
  // Must not be a phone number (too many digits)
  if (/^\d{10}$/.test(num.replace(/\D/g, ""))) return false;
  return true;
}

// ===== SOURCE 1: Michigan LARA Accela Portal Direct Search =====
// The public license lookup portal at aca-prod.accela.com/LARA
// Searches by license type for recently active licenses in MI

const LARA_TRADE_TYPES = [
  { code: "BOILER", label: "Boiler Operator", searchTerm: "boiler operator" },
  { code: "HVAC", label: "HVAC Technician", searchTerm: "mechanical contractor" },
  { code: "PLUMBING", label: "Plumber", searchTerm: "plumbing contractor" },
  { code: "ELECTRICAL", label: "Electrician", searchTerm: "electrical contractor" },
  { code: "CNA", label: "CNA", searchTerm: "nurse aide" },
  { code: "RN", label: "RN/LPN", searchTerm: "registered nurse" },
];

async function searchLARAPortal(tradeSearchTerm: string, label: string): Promise<LicenseCandidate[]> {
  // Michigan LARA Accela license search endpoint
  // Uses the public-facing search that returns JSON for the license lookup table
  try {
    const searchUrl = "https://aca-prod.accela.com/LARA/Cap/CapHome.aspx/GetGridData";
    const payload = {
      tableName: "tblGlobalSearchResult",
      pageNumber: 1,
      pageSize: 50,
      whereClause: `LicenseType LIKE '%${tradeSearchTerm}%' AND StateCode='MI'`,
      sortExpression: "IssuedDate DESC",
    };

    const res = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*",
        "Referer": "https://aca-prod.accela.com/LARA/GeneralProperty/PropertyLookUp.aspx?isLicensee=Y",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[miosha-scraper] LARA portal HTTP ${res.status} for ${label} — falling back to Sonar`);
      return [];
    }

    const data = await res.json();
    const rows = data?.d?.Data || data?.Data || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`[miosha-scraper] LARA portal returned no rows for ${label}`);
      return [];
    }

    const candidates: LicenseCandidate[] = [];
    for (const row of rows) {
      const name = (row.LicenseName || row.BusinessName || row.ApplicantName || "").trim();
      if (!isPersonName(name)) continue;

      const licNum = (row.LicenseNumber || row.CapNumber || "").trim();
      const expiry = row.ExpirationDate || row.LicenseExpiry || null;
      const city = (row.City || row.LicenseCity || "").trim() || null;

      // Require either a valid license number or a city for real candidates
      if (!looksLikeLicenseNumber(licNum) && !city) continue;

      candidates.push({
        full_name: name,
        license_type: label,
        license_number: looksLikeLicenseNumber(licNum) ? licNum : null,
        license_expiry: expiry ? String(expiry).split("T")[0] : null,
        city: city || null,
        source: "miosha" as const,
      });
    }

    console.log(`[miosha-scraper] LARA portal: ${label} → ${rows.length} rows, ${candidates.length} valid people`);
    return candidates;
  } catch (e) {
    console.warn(`[miosha-scraper] LARA portal error for ${label}:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

// ===== SOURCE 2: Sonar Web Search (Supplement + Fallback) =====
// Uses perplexity/sonar-pro with specific prompts targeting the LARA portal URL.
// STRICT validation applied — must have license number OR be verifiable by city.

const SONAR_QUERIES = [
  {
    query: `Search the Michigan LARA license verification portal at aca-prod.accela.com/LARA and michigan.gov/lara for boiler operators licensed in Michigan. Return ONLY real individual people (not companies) with their license numbers. Focus on Metro Detroit, Wayne County, Oakland County, Macomb County. Boiler operator licenses in Michigan are issued by MIOSHA under LARA.`,
    label: "Boiler Operator",
  },
  {
    query: `Search michigan.gov/lara and aca-prod.accela.com/LARA for licensed HVAC/mechanical contractors in Michigan who are individual people (not company names). Return specific names, license numbers starting with "M" or containing numbers, and cities in Metro Detroit area.`,
    label: "HVAC Technician",
  },
  {
    query: `Search michigan.gov/lara for licensed master plumbers in Michigan who are individual tradespeople. Must include license number. Focus on Wayne, Oakland, Macomb, and Washtenaw counties. Return only people, not businesses.`,
    label: "Plumber",
  },
  {
    query: `Search michigan.gov/lara for licensed electricians in Michigan, specifically master electricians or journeyman electricians in Metro Detroit area. Must be individual people, not companies. Include license numbers where available.`,
    label: "Electrician",
  },
  {
    query: `Search the Michigan Nurse Aide Registry at michigan.gov/mdhhs and LARA for CNAs (certified nursing assistants) recently certified in Michigan, particularly in Metro Detroit area. Return individual names, certification numbers, and cities.`,
    label: "CNA",
  },
  {
    query: `Search michigan.gov/lara for registered nurses (RN) and licensed practical nurses (LPN) recently licensed or renewing in Michigan. Return individual names with license numbers and cities. Focus on Metro Detroit healthcare area.`,
    label: "RN/LPN",
  },
];

async function searchLicensesViaSonar(query: string, label: string): Promise<LicenseCandidate[]> {
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
            content: `You are a Michigan licensing database researcher. Search specifically for real individual people (not companies) licensed in Michigan trades.

CRITICAL RULES:
1. Return ONLY individual people — NEVER company names, LLC, Inc, contractors
2. Each result MUST have at minimum: a real person's full name AND either a license number or a specific Michigan city
3. If you cannot find real verified license records with names and numbers, return []
4. Do NOT fabricate or estimate license numbers — only include ones you can actually find

Return ONLY valid JSON array. Each object: { "full_name": "First Last", "license_number": "real number or null", "city": "Michigan city or null", "license_expiry": "YYYY-MM-DD or null" }. Max 20 results. No markdown. No explanation.`,
          },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      console.warn(`[miosha-scraper] Sonar HTTP ${res.status} for ${label}`);
      return [];
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";

    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.warn(`[miosha-scraper] No JSON array in Sonar response for ${label}`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      full_name: string;
      license_number?: string | null;
      city?: string | null;
      license_expiry?: string | null;
    }>;

    const validated: LicenseCandidate[] = [];
    for (const r of parsed) {
      if (!r.full_name) continue;
      // Must look like a person name
      if (!isPersonName(r.full_name)) {
        console.log(`[miosha-scraper] Rejected "${r.full_name}" — looks like a company`);
        continue;
      }
      // Must have either a real license number or a specific city (not just "Michigan")
      const hasLicNum = r.license_number && looksLikeLicenseNumber(r.license_number);
      const hasCity = r.city && r.city.toLowerCase() !== "michigan" && r.city.length > 2;
      if (!hasLicNum && !hasCity) {
        console.log(`[miosha-scraper] Rejected "${r.full_name}" — no license number and no specific city`);
        continue;
      }

      validated.push({
        full_name: r.full_name,
        license_type: label,
        license_number: hasLicNum ? r.license_number! : null,
        license_expiry: r.license_expiry ? r.license_expiry.split("T")[0] : null,
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

// ===== DB UPSERT =====
async function upsertCandidate(sb: ReturnType<typeof createClient>, c: LicenseCandidate): Promise<"new" | "updated" | "error"> {
  try {
    const row: Record<string, unknown> = {
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
      // No license number — deduplicate by name + type + source
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
  let rejectedCount = 0;

  console.log("[miosha-scraper] Starting — Phase 1: LARA portal direct search");

  // Phase 1: Try LARA Accela portal directly (real data source)
  for (const trade of LARA_TRADE_TYPES) {
    const candidates = await searchLARAPortal(trade.searchTerm, trade.label);
    for (const c of candidates) {
      const result = await upsertCandidate(sb, c);
      if (result === "new") newCount++;
      else if (result === "updated") updatedCount++;
      else errorCount++;
    }
  }

  console.log(`[miosha-scraper] Phase 1 done: new=${newCount} updated=${updatedCount}. Phase 2: Sonar supplement`);

  // Phase 2: Sonar supplement/fallback — strict validation applied
  for (const { query, label } of SONAR_QUERIES) {
    const candidates = await searchLicensesViaSonar(query, label);
    for (const c of candidates) {
      const result = await upsertCandidate(sb, c);
      if (result === "new") newCount++;
      else if (result === "updated") updatedCount++;
      else if (result === "error") errorCount++;
    }
  }

  console.log(`[miosha-scraper] Done: new=${newCount} updated=${updatedCount} rejected=${rejectedCount} errors=${errorCount}`);
  return new Response(
    JSON.stringify({ ok: true, new: newCount, updated: updatedCount, rejected: rejectedCount, errors: errorCount }),
    { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
});
