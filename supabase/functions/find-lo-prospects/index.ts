/**
 * find-lo-prospects
 * Finds Michigan mortgage loan originators via Apollo.io people search.
 * NMLS Consumer Access API was Cloudflare-blocked (returns HTML, not JSON).
 * Apollo free tier: 50 enrichments/mo. Returns up to 25 MI MLO prospects per run.
 *
 * POST {} → { ok, found, inserted, skipped }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function searchApolloMLOs(): Promise<any[]> {
  if (!APOLLO_API_KEY) return [];
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        q_organization_locations: ["Michigan, US"],
        q_not_person_titles: [],
        person_titles: ["Mortgage Loan Originator", "MLO", "Loan Officer", "Mortgage Banker"],
        page: 1,
        per_page: 25,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.people ?? [];
  } catch (e) {
    console.warn("[find-lo-prospects apollo]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const people = await searchApolloMLOs();

    if (!people.length) {
      return new Response(
        JSON.stringify({ ok: true, found: 0, inserted: 0, skipped: 0, note: APOLLO_API_KEY ? "Apollo returned no results" : "APOLLO_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Exclude paying subscribers
    const emails = people.map((p: any) => p.email).filter(Boolean);
    let subscriberEmails = new Set<string>();
    if (emails.length) {
      const { data: subs } = await sb.from("mortgage_radar_clients").select("email").in("email", emails);
      subscriberEmails = new Set((subs ?? []).map((s: any) => s.email));
    }

    let inserted = 0;
    let skipped = 0;

    for (const p of people) {
      if (p.email && subscriberEmails.has(p.email)) { skipped++; continue; }

      const apolloId = String(p.id || "");
      if (!apolloId && !p.email) { skipped++; continue; }

      const row = {
        nmls_id: `apollo_${apolloId}`,
        full_name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unknown",
        company_name: p.organization?.name ?? p.employment_history?.[0]?.organization_name ?? null,
        email: p.email ?? null,
        phone: p.phone_numbers?.[0]?.sanitized_number ?? null,
        fax_number: null,
        mailing_address: p.city || p.state ? {
          city: p.city ?? null,
          state: p.state ?? "MI",
          zip: p.postal_code ?? null,
        } : null,
        linkedin_url: p.linkedin_url ?? null,
        enrichment_source: "apollo",
        status: "active",
        warmth_score: (p.email ? 2 : 0) + (p.phone_numbers?.length ? 2 : 0) + (p.linkedin_url ? 1 : 0),
      };

      const { error } = await sb.from("marketplace_prospects")
        .upsert(row, { onConflict: "nmls_id" });
      if (!error) inserted++;
      else { console.warn("[find-lo] upsert error", error.message); skipped++; }
    }

    return new Response(
      JSON.stringify({ ok: true, found: people.length, inserted, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
