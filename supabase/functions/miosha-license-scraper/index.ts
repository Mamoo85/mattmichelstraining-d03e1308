// miosha-license-scraper — queries Michigan LARA data via Socrata API (data.michigan.gov)
// Reliable public API — no scraping, no form interaction needed.
// Called by hire-alert-scanner OR run standalone via cron/admin trigger.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Michigan LARA publishes license data on data.michigan.gov via Socrata API
// Dataset: Professional Licensing — all active licensees
// No API key needed for basic queries (up to 50k rows/request)
const SOCRATA_DATASETS = [
  {
    // LARA Active Licenses dataset
    url: "https://data.michigan.gov/resource/ngpe-x3yj.json",
    label: "Michigan License DB",
    tradeFilters: [
      { where: "upper(license_type_description) LIKE '%BOILER%'", label: "Boiler Operator" },
      { where: "upper(license_type_description) LIKE '%HVAC%' OR upper(license_type_description) LIKE '%HEATING%' OR upper(license_type_description) LIKE '%REFRIGERATION%'", label: "HVAC Technician" },
      { where: "upper(license_type_description) LIKE '%PLUMB%'", label: "Plumber" },
      { where: "upper(license_type_description) LIKE '%ELECTRI%'", label: "Electrician" },
      { where: "upper(license_type_description) LIKE '%STEAM%'", label: "Steam Engineer" },
    ],
  },
];

// Fallback: direct LARA BPL Excel downloads (Phase 10)
const BPL_EXCEL_URLS = [
  { url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bpl/Licensing-Lists/Boiler-Operators.xlsx", label: "Boiler Operator" },
  { url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bpl/Licensing-Lists/HVAC.xlsx", label: "HVAC Technician" },
  { url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bpl/Licensing-Lists/Plumbing.xlsx", label: "Plumber" },
  { url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bpl/Licensing-Lists/Electrical.xlsx", label: "Electrician" },
];

interface LicenseCandidate {
  full_name: string;
  license_type: string;
  license_number: string | null;
  license_expiry: string | null;
  city: string | null;
  source: "miosha";
}

// Primary: Socrata API query
async function querySocrata(datasetUrl: string, whereClause: string, label: string): Promise<LicenseCandidate[]> {
  try {
    // Get licenses issued or renewed in last 90 days — these are the "new to market" ones
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const fullWhere = `(${whereClause}) AND issue_date >= '${ninetyDaysAgo}' AND upper(license_status) = 'ACTIVE'`;
    
    const params = new URLSearchParams({
      "$where": fullWhere,
      "$limit": "100",
      "$order": "issue_date DESC",
    });

    const res = await fetch(`${datasetUrl}?${params}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[miosha-scraper] Socrata HTTP ${res.status} for ${label}`);
      return [];
    }

    const rows = await res.json();
    if (!Array.isArray(rows)) return [];

    console.log(`[miosha-scraper] Socrata: ${rows.length} results for ${label}`);

    return rows.map((r: Record<string, string>) => {
      const firstName = r.first_name || r.licensee_first_name || "";
      const lastName = r.last_name || r.licensee_last_name || "";
      const fullName = r.licensee_name || r.full_name || `${firstName} ${lastName}`.trim();
      
      return {
        full_name: fullName,
        license_type: label,
        license_number: r.license_number || r.license_no || null,
        license_expiry: r.expiration_date || r.license_expiration_date || null,
        city: r.city || r.licensee_city || null,
        source: "miosha" as const,
      };
    }).filter((c) => c.full_name.length >= 3);
  } catch (e) {
    console.warn(`[miosha-scraper] Socrata error for ${label}:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Fallback: Try BPL Excel download pages (just fetch the page to check if xlsx links are accessible)
async function queryBPLFallback(): Promise<LicenseCandidate[]> {
  const candidates: LicenseCandidate[] = [];
  
  for (const bpl of BPL_EXCEL_URLS) {
    try {
      // HEAD request to check if file exists — actual parsing requires SheetJS which is heavy
      const res = await fetch(bpl.url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        console.log(`[miosha-scraper] BPL Excel available for ${bpl.label} (${res.headers.get("content-length")} bytes)`);
        // We log availability but don't parse XLSX in this lightweight function
        // The main scanner can call this for full parse if needed
      }
    } catch {
      // BPL files may be periodically unavailable
    }
  }
  
  return candidates;
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
    // Query all trade types from Socrata
    for (const dataset of SOCRATA_DATASETS) {
      for (const filter of dataset.tradeFilters) {
        const candidates = await querySocrata(dataset.url, filter.where, filter.label);
        console.log(`[miosha-scraper] ${filter.label}: found ${candidates.length} candidates`);

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
    }

    // Check BPL availability as a secondary signal
    await queryBPLFallback();

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
