/**
 * find-lo-prospects
 * Fetches Michigan MLOs from NMLS Consumer Access (free public API, no key).
 * Upserts into marketplace_prospects (keyed on nmls_id).
 * Skips anyone already in mortgage_radar_clients (paying subscribers).
 *
 * POST {} → { ok, found, inserted, skipped }
 *
 * NOTE: Does NOT touch any scanner tables. Additive only.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NMLS Consumer Access — free federal API, no key required
// Docs: https://www.nmlsconsumeraccess.org/API/
const NMLS_BASE = "https://api.nmlsconsumeraccess.org";

async function fetchNMLSPage(page: number): Promise<any[]> {
  const params = new URLSearchParams({
    state: "MI",
    licenseType: "MLO",
    page: String(page),
    pageSize: "100",
  });
  try {
    const res = await fetch(`${NMLS_BASE}/api/Search/Licensees?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // NMLS returns either { results: [...] } or a plain array
    return Array.isArray(data) ? data : (data?.results ?? data?.Results ?? []);
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const records: any[] = [];

    // Fetch up to 5 pages (500 MLOs) per run to stay within function timeout
    for (let page = 1; page <= 5; page++) {
      const batch = await fetchNMLSPage(page);
      if (!batch.length) break;
      records.push(...batch);
      if (batch.length < 100) break; // last page reached
    }

    if (!records.length) {
      return new Response(
        JSON.stringify({ ok: true, found: 0, inserted: 0, skipped: 0, note: "NMLS returned no results for MI MLO" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalise field names — NMLS API response shape varies by version
    const normalised = records.map((r: any) => ({
      nmls_id: String(r.nmlsId ?? r.NmlsId ?? r.id ?? r.Id ?? ""),
      full_name: (r.fullName ?? r.FullName ?? r.name ?? r.Name ?? "").trim(),
      company_name: r.companyName ?? r.CompanyName ?? r.employer ?? r.Employer ?? null,
      email: r.email ?? r.Email ?? null,
      phone: r.phone ?? r.Phone ?? null,
      fax: r.fax ?? r.Fax ?? null,
      address: r.address ?? r.Address ?? null,
    })).filter((r) => r.nmls_id && r.full_name);

    // Pull existing nmls_ids so we only process new ones
    const nmlsIds = normalised.map((r) => r.nmls_id);
    const { data: existing } = await (sb.from as any)("marketplace_prospects")
      .select("nmls_id")
      .in("nmls_id", nmlsIds);
    const existingSet = new Set((existing ?? []).map((e: any) => e.nmls_id));

    // Exclude paying subscribers (they're already customers)
    const emails = normalised.map((r) => r.email).filter(Boolean);
    let subscriberEmails = new Set<string>();
    if (emails.length) {
      const { data: subs } = await (sb.from as any)("mortgage_radar_clients")
        .select("email")
        .in("email", emails);
      subscriberEmails = new Set((subs ?? []).map((s: any) => s.email));
    }

    let inserted = 0;
    let skipped = 0;

    for (const r of normalised) {
      if (existingSet.has(r.nmls_id)) { skipped++; continue; }
      if (r.email && subscriberEmails.has(r.email)) { skipped++; continue; }

      const row = {
        nmls_id: r.nmls_id,
        full_name: r.full_name,
        company_name: r.company_name,
        email: r.email,
        phone: r.phone,
        fax_number: r.fax,
        mailing_address: r.address
          ? {
              street: r.address.street ?? r.address.line1 ?? null,
              city: r.address.city ?? null,
              state: r.address.state ?? "MI",
              zip: r.address.zip ?? r.address.postalCode ?? null,
            }
          : null,
        enrichment_source: "nmls",
        status: "active",
        warmth_score: (r.fax ? 2 : 0) + (r.email ? 1 : 0) + (r.phone ? 1 : 0),
      };

      const { error } = await (sb.from as any)("marketplace_prospects")
        .upsert(row, { onConflict: "nmls_id" });
      if (!error) inserted++;
      else skipped++;
    }

    return new Response(
      JSON.stringify({ ok: true, found: normalised.length, inserted, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
