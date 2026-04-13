// miosha-license-scraper — Michigan LARA license data
// Uses OpenRouter perplexity/sonar-pro for live web search of Michigan license databases.
// Called by hire-alert-scanner OR run standalone via cron/admin trigger.
//
// Michigan LARA publishes licensing lists at michigan.gov/lara but blocks automated downloads.
// This scraper uses live web search to find recently licensed tradespeople.

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

const TRADE_QUERIES = [
  {
    query: "Search Michigan LARA licensing database for recently licensed boiler operators in Michigan. Find specific names, license numbers, cities. Focus on new licenses issued in the last 90 days.",
    label: "Boiler Operator",
  },
  {
    query: "Search Michigan LARA licensing database for recently licensed HVAC contractors and mechanical contractors in Michigan. Find specific names, license numbers, cities.",
    label: "HVAC Technician",
  },
  {
    query: "Search Michigan LARA licensing database for recently licensed plumbing contractors in Michigan. Find specific names, license numbers, cities.",
    label: "Plumber",
  },
  {
    query: "Search Michigan LARA licensing database for recently licensed electricians and electrical contractors in Michigan. Find specific names, license numbers, cities.",
    label: "Electrician",
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
            content: `You are a licensing database researcher. Search for Michigan licensed tradespeople. Return ONLY a valid JSON array. Each object: { "full_name": "string", "license_number": "string or null", "city": "string or null", "license_expiry": "YYYY-MM-DD or null" }. Max 20 results. No markdown formatting, no explanation text. If you cannot find specific license records, return [].`,
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
    }>;

    return parsed
      .filter((r) => r.full_name && r.full_name.length >= 3)
      .map((r) => ({
        full_name: r.full_name,
        license_type: label,
        license_number: r.license_number || null,
        license_expiry: r.license_expiry || null,
        city: r.city || null,
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

    console.log(`[miosha-scraper] done: new=${newCount} updated=${updatedCount} errors=${errorCount}`);
    return new Response(
      JSON.stringify({ ok: true, new: newCount, updated: updatedCount, errors: errorCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[miosha-scraper] Fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
