// miosha-license-scraper — Michigan LARA license data (SECONDARY source)
// Uses OpenRouter perplexity/sonar-pro to search the LARA Accela portal
// for individual licensees. Targets aca-prod.accela.com/MILARA specifically.
//
// IMPORTANT: This scraper searches for INDIVIDUAL PEOPLE with state licenses.
// It must NEVER return company names, school names, or organization names.

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
  license_issuer: string | null;
  source: "miosha";
}

// Corporate name filter — must match hire-alert-scanner
const CORPORATE_PATTERN = /\b(LLC|Inc|Corp|School|Casino|Hospital|Health\s*System|University|Energy|Solutions|Administration|Academy|Institute|Staffing|Group|Services|Sons|Mechanical|Electric|Company|Associates|Enterprises|Foundation|Authority|Board|Commission|Department|District|Center|Clinic|Medical|Nursing\s+Home|Assisted\s+Living|Home\s+Care|Senior\s+Living|Public\s+Schools|Community\s+College|Rehabilitation|Management|Consulting|Industries|Manufacturing|Plumbing|Heating|Cooling|Roofing|Construction|Contractors|Builders|Supply|Wholesale|Distributors|Holdings|Properties|Realty|Insurance|Financial|Bank|Credit\s+Union|Transit|Utility|Utilities|Water|Sewer|Electric\s+Co|Power|Township|County|City\s+of|State\s+of|Federal)\b/i;

function isCorporateName(name: string): boolean {
  if (!name) return true;
  if (CORPORATE_PATTERN.test(name)) return true;
  if (name === name.toUpperCase() && name.split(/\s+/).length > 3) return true;
  if (/\b(of the|of)\b/i.test(name) && name.split(/\s+/).length > 3) return true;
  if (name.trim().split(/\s+/).length === 1 && name.length > 3) return true;
  if (/\s&\s/.test(name) && name.split(/\s+/).length > 2) return true;
  return false;
}

const TRADE_QUERIES = [
  {
    query: `Search the Michigan LARA Accela portal at aca-prod.accela.com/MILARA and michigan.gov/lara for INDIVIDUAL PEOPLE who hold active Boiler Operator licenses in Michigan. Find their personal full name (first and last), Michigan state license number, license expiry date, and city. Look for recently issued or renewed licenses. DO NOT return company names, school names, or employer names.`,
    label: "Boiler Operator",
  },
  {
    query: `Search the Michigan LARA Accela portal at aca-prod.accela.com/MILARA for INDIVIDUAL PEOPLE who hold active HVAC or Mechanical Contractor licenses in Michigan. Find each person's full name, Michigan license number, expiry date, and city. Only return individual people, never companies or organizations.`,
    label: "HVAC Technician",
  },
  {
    query: `Search the Michigan LARA Accela portal at aca-prod.accela.com/MILARA for INDIVIDUAL PEOPLE who hold active Master Plumber or Journeyman Plumber licenses in Michigan. Find each person's full name, license number, expiry date, and city. Return only individual person names, not plumbing companies.`,
    label: "Plumber",
  },
  {
    query: `Search the Michigan LARA Accela portal at aca-prod.accela.com/MILARA for INDIVIDUAL PEOPLE who hold active Master Electrician or Journeyman Electrician licenses in Michigan. Find each person's full name, license number, expiry date, and city. Return only individual person names, never electrical companies or contractors.`,
    label: "Electrician",
  },
  {
    query: `Search Michigan Board of Nursing records and the Michigan LARA portal for INDIVIDUAL PEOPLE who recently obtained CNA (Certified Nursing Assistant) certification in Michigan. Find each person's full name, certification number, certification date, and city. Only return individual person names, never nursing homes, hospitals, or schools.`,
    label: "CNA",
  },
  {
    query: `Search Michigan Board of Nursing records and the Michigan LARA portal for INDIVIDUAL PEOPLE who recently obtained RN (Registered Nurse) or LPN (Licensed Practical Nurse) licenses in Michigan. Find each person's full name, license number, issue date, and city. Only return individual person names, never hospitals, clinics, or staffing agencies.`,
    label: "RN/LPN",
  },
];

async function searchLicenses(query: string, label: string): Promise<LicenseCandidate[]> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[miosha-scraper] No OPENROUTER_API_KEY — skipping");
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
            content: `You are a state licensing database researcher. Search for Michigan licensed INDIVIDUAL PEOPLE from the LARA/MiPLUS portal.

CRITICAL RULES:
1. Return ONLY individual person names (first and last). NEVER return employer names, school names, hospital names, staffing agencies, utility companies, or ANY organization name.
2. Each result MUST include the person's state license number if at all possible. If you cannot find a license number, only include the result if you're certain it's an individual person from a licensing record.
3. If you find a job posting (employer looking for candidates), SKIP IT entirely. We want the LICENSEE, not the employer.

Return ONLY a valid JSON array. Each object:
{
  "full_name": "person's first and last name",
  "license_number": "state license number or null",
  "city": "city or null",
  "license_expiry": "YYYY-MM-DD or null",
  "license_issuer": "Michigan LARA or Michigan Board of Nursing or null"
}
Max 8 results. No markdown formatting, no explanation text. If you cannot find specific individual license records, return [].`,
          },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      console.warn(`[miosha-scraper] OpenRouter HTTP ${res.status} for ${label}`);
      return [];
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";

    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.warn(`[miosha-scraper] No JSON array in response for ${label}`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      full_name: string;
      license_number?: string | null;
      city?: string | null;
      license_expiry?: string | null;
      license_issuer?: string | null;
    }>;

    return parsed
      .filter((r) => r.full_name && r.full_name.length >= 3)
      .filter((r) => !isCorporateName(r.full_name))
      .map((r) => ({
        full_name: r.full_name,
        license_type: label,
        license_number: r.license_number || null,
        license_expiry: r.license_expiry || null,
        city: r.city || null,
        license_issuer: r.license_issuer || "Michigan LARA",
        source: "miosha" as const,
      }));
  } catch (e) {
    console.warn(`[miosha-scraper] Error for ${label}:`, e instanceof Error ? e.message : String(e));
    return [];
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
  let corporateFiltered = 0;

  try {
    for (const { query, label } of TRADE_QUERIES) {
      const candidates = await searchLicenses(query, label);
      console.log(`[miosha-scraper] ${label}: found ${candidates.length} candidates`);

      for (const c of candidates) {
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
              .select("id, status")
              .eq("license_number", c.license_number)
              .maybeSingle();

            if (existing) {
              await sb.from("hire_alert_candidates")
                .update({ last_seen_at: new Date().toISOString() })
                .eq("id", existing.id);
              updatedCount++;
            } else {
              await sb.from("hire_alert_candidates").insert({
                ...row, status: "new", first_seen_at: new Date().toISOString(),
                raw_data: { license_issuer: c.license_issuer },
              });
              newCount++;
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
              await sb.from("hire_alert_candidates").insert({
                ...row, status: "new", first_seen_at: new Date().toISOString(),
                raw_data: { license_issuer: c.license_issuer },
              });
              newCount++;
            } else {
              updatedCount++;
            }
          }
        } catch (e) {
          console.error(`[miosha-scraper] insert error for ${c.full_name}:`, e);
          errorCount++;
        }
      }
    }

    console.log(`[miosha-scraper] done: new=${newCount} updated=${updatedCount} errors=${errorCount} corporate_filtered=${corporateFiltered}`);
    return new Response(
      JSON.stringify({ ok: true, new: newCount, updated: updatedCount, errors: errorCount, corporate_filtered: corporateFiltered }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[miosha-scraper] Fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
