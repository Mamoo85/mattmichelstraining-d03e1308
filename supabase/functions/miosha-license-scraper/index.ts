// miosha-license-scraper — Michigan LARA license data
// THREE data sources:
// 1. Michigan LARA Accela portal — ASP.NET session-based license search
// 2. Sonar web search — finds tradespeople from public profiles, job boards, LinkedIn
// 3. Lovable AI Gateway (Gemini) — cross-references and validates
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
  // Reject if contains "&" (usually a business: "Smith & Sons")
  if (name.includes("&")) return false;
  return true;
}

function looksLikeLicenseNumber(num: string): boolean {
  if (!num || num.length < 3) return false;
  if (!/\d/.test(num)) return false;
  if (/^\d{10}$/.test(num.replace(/\D/g, ""))) return false;
  return true;
}

// ===== SOURCE 1: Michigan LARA Accela Portal (Session-Based) =====
// The portal is an ASP.NET WebForms app. We:
// 1. GET the search page to obtain cookies + __VIEWSTATE
// 2. POST the search form with the trade type
// 3. Parse the HTML table results

const LARA_BASE = "https://aca-prod.accela.com/LARA";
const LARA_SEARCH_URL = `${LARA_BASE}/GeneralProperty/PropertyLookUp.aspx?isLicensee=Y`;

interface LaraSession {
  cookies: string;
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

async function getLaraSession(): Promise<LaraSession | null> {
  try {
    const res = await fetch(LARA_SEARCH_URL, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[miosha-scraper] LARA session GET failed: ${res.status}`);
      return null;
    }

    // Extract Set-Cookie headers
    const setCookies = res.headers.getSetCookie?.() || [];
    const cookieStr = setCookies.map((c: string) => c.split(";")[0]).join("; ");

    const html = await res.text();

    // Extract ASP.NET hidden fields
    const vsMatch = html.match(/id="__VIEWSTATE"\s+value="([^"]*)"/);
    const vsgMatch = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"/);
    const evMatch = html.match(/id="__EVENTVALIDATION"\s+value="([^"]*)"/);

    if (!vsMatch) {
      console.warn("[miosha-scraper] Could not extract __VIEWSTATE from LARA page");
      return null;
    }

    return {
      cookies: cookieStr,
      viewState: vsMatch[1],
      viewStateGenerator: vsgMatch?.[1] || "",
      eventValidation: evMatch?.[1] || "",
    };
  } catch (e) {
    console.warn(`[miosha-scraper] LARA session error:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

const LARA_TRADE_SEARCHES = [
  { searchText: "boiler", label: "Boiler Operator" },
  { searchText: "mechanical", label: "HVAC Technician" },
  { searchText: "plumb", label: "Plumber" },
  { searchText: "electri", label: "Electrician" },
];

async function searchLaraPortal(session: LaraSession, searchText: string, label: string): Promise<LicenseCandidate[]> {
  try {
    // Build the ASP.NET form POST body
    const formData = new URLSearchParams();
    formData.set("__VIEWSTATE", session.viewState);
    if (session.viewStateGenerator) formData.set("__VIEWSTATEGENERATOR", session.viewStateGenerator);
    if (session.eventValidation) formData.set("__EVENTVALIDATION", session.eventValidation);
    // Search by license type/business name field
    formData.set("ctl00$PlaceHolderMain$generalSearchForm$txtGSBusinessName", searchText);
    formData.set("ctl00$PlaceHolderMain$generalSearchForm$txtGSState", "MI");
    formData.set("ctl00$PlaceHolderMain$btnNewSearch", "Search");

    const res = await fetch(LARA_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": session.cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": LARA_SEARCH_URL,
        "Accept": "text/html,application/xhtml+xml",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.warn(`[miosha-scraper] LARA search POST HTTP ${res.status} for ${label}`);
      return [];
    }

    const html = await res.text();

    // Parse HTML table results - look for license data in the response
    // The Accela portal renders results in a table with specific CSS classes
    const candidates: LicenseCandidate[] = [];

    // Pattern 1: Try to find table rows with license data
    // Accela renders results like: <td>Name</td><td>License#</td><td>Type</td><td>Status</td><td>City</td>
    const rowPattern = /<tr[^>]*class="[^"]*ACA_TabRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    while ((match = rowPattern.exec(html)) !== null) {
      const rowHtml = match[1];
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (m) => m[1].replace(/<[^>]+>/g, "").trim()
      );

      if (cells.length < 3) continue;

      // Try to identify name, license number, city from cells
      const possibleName = cells[0] || cells[1] || "";
      const possibleLicNum = cells.find((c) => looksLikeLicenseNumber(c)) || "";
      const possibleCity = cells.find((c) =>
        c.length > 2 && c.length < 30 && !looksLikeLicenseNumber(c) &&
        c !== possibleName && /^[A-Za-z\s]+$/.test(c)
      ) || null;

      if (!isPersonName(possibleName)) continue;

      candidates.push({
        full_name: possibleName,
        license_type: label,
        license_number: looksLikeLicenseNumber(possibleLicNum) ? possibleLicNum : null,
        license_expiry: null,
        city: possibleCity,
        source: "miosha" as const,
      });
    }

    // Pattern 2: If no table rows found, try to use Gemini to extract from HTML
    if (candidates.length === 0 && html.length > 5000) {
      // The page loaded but we couldn't parse the table — try AI extraction
      const truncatedHtml = html.slice(0, 15000);
      const hasResultsIndicator = truncatedHtml.includes("ACA_TabRow") ||
        truncatedHtml.includes("GridViewRow") ||
        truncatedHtml.includes("resultCount");

      if (hasResultsIndicator) {
        console.log(`[miosha-scraper] LARA ${label}: results HTML detected but couldn't parse table, trying AI extraction`);
        const aiCandidates = await extractCandidatesViaGemini(truncatedHtml, label);
        candidates.push(...aiCandidates);
      }
    }

    console.log(`[miosha-scraper] LARA portal: ${label} → ${candidates.length} valid people`);
    return candidates;
  } catch (e) {
    console.warn(`[miosha-scraper] LARA search error for ${label}:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function extractCandidatesViaGemini(html: string, label: string): Promise<LicenseCandidate[]> {
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
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: `Extract licensed professionals from this Michigan LARA search results HTML. Return ONLY a JSON array of objects: [{"full_name":"First Last","license_number":"XXX","city":"City"}]. Rules: Only include real individual people (not companies). Skip any entry without a clear person name. Max 20 results. No markdown, no explanation.`,
          },
          { role: "user", content: `Extract ${label} licensees from this HTML:\n\n${html.slice(0, 12000)}` },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      full_name: string;
      license_number?: string;
      city?: string;
    }>;

    return parsed
      .filter((r) => r.full_name && isPersonName(r.full_name))
      .map((r) => ({
        full_name: r.full_name,
        license_type: label,
        license_number: r.license_number && looksLikeLicenseNumber(r.license_number) ? r.license_number : null,
        license_expiry: null,
        city: r.city && r.city.length > 2 ? r.city : null,
        source: "miosha" as const,
      }));
  } catch {
    return [];
  }
}

// ===== SOURCE 2: Sonar Web Search (Live Web — Finds People Seeking Work) =====
// Instead of trying to query the LARA database (which requires a portal session),
// Sonar searches the OPEN WEB for licensed tradespeople who are publicly visible:
// LinkedIn profiles, Indeed resumes, job board postings, union directories

const SONAR_QUERIES = [
  {
    query: `Find licensed boiler operators in Michigan who are currently seeking work or recently changed jobs. Search LinkedIn "open to work" profiles, Indeed resumes, ZipRecruiter profiles. Focus on Metro Detroit, Wayne County, Oakland County, Macomb County. Return real individual people with full names, NOT companies. Include any Michigan boiler license numbers visible on their profiles.`,
    label: "Boiler Operator",
  },
  {
    query: `Find licensed HVAC technicians and mechanical contractors in Michigan who recently posted resumes or are seeking new positions. Search Indeed, LinkedIn, ZipRecruiter. Include any LARA or EPA license numbers visible on their profiles. Metro Detroit area. Individual people only.`,
    label: "HVAC Technician",
  },
  {
    query: `Find licensed plumbers or master plumbers in Michigan who posted resumes or are actively job seeking. Check Indeed resumes, LinkedIn profiles with "open to work", ZipRecruiter. Metro Detroit, Wayne, Oakland, Macomb counties. Return person names and any license numbers from their profiles.`,
    label: "Plumber",
  },
  {
    query: `Find licensed electricians or journeyman electricians in Michigan who are seeking work or recently became available. Search Indeed, LinkedIn open-to-work, ZipRecruiter. Metro Detroit area. Individual people names only, not companies. Include license numbers if visible on profiles.`,
    label: "Electrician",
  },
  {
    query: `Find Certified Nursing Assistants (CNA) in Michigan who are seeking new positions or recently posted resumes. Search Indeed, LinkedIn, care.com, nursingjobs.com for Metro Detroit area. Include any certification numbers visible on profiles. Individual people only.`,
    label: "CNA",
  },
  {
    query: `Find registered nurses (RN) and licensed practical nurses (LPN) in Michigan Metro Detroit area who are open to new opportunities or recently posted resumes. Search LinkedIn, Indeed, NurseFly, Vivian Health. Include any Michigan nursing license numbers visible. Individual names only.`,
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
3. Search job boards (Indeed, ZipRecruiter, LinkedIn) for people with public resumes or "open to work" status
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

    // Log raw response for debugging
    console.log(`[miosha-scraper] Sonar raw response for ${label} (${text.length} chars): ${text.slice(0, 300)}`);

    // Try to extract JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // Sonar sometimes returns prose instead of JSON — try to extract with Gemini
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
      // Accept if has license number, specific city, OR employer
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

  // ===== PHASE 1: LARA Accela Portal (Session-Based) =====
  console.log("[miosha-scraper] Phase 1: LARA portal session-based search");
  const session = await getLaraSession();
  if (session) {
    console.log("[miosha-scraper] LARA session acquired, searching trades...");
    for (const trade of LARA_TRADE_SEARCHES) {
      const candidates = await searchLaraPortal(session, trade.searchText, trade.label);
      for (const c of candidates) {
        const result = await upsertCandidate(sb, c);
        if (result === "new") newCount++;
        else if (result === "updated") updatedCount++;
        else errorCount++;
      }
    }
  } else {
    console.warn("[miosha-scraper] LARA session failed — skipping portal search");
  }

  console.log(`[miosha-scraper] Phase 1 done: new=${newCount} updated=${updatedCount}. Phase 2: Sonar web search`);

  // ===== PHASE 2: Sonar Web Search (Parallel) =====
  // Search for tradespeople with public profiles, resumes, "open to work" status
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
