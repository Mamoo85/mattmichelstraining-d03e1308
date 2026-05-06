// contractor-lead-prospector — proactive weekly Apollo.io sweep for MI home service companies.
// Finds roofing/HVAC/plumbing/electrical/pest/gutter/exterior companies not yet in our system
// and writes them to techalert_prospect_targets for the TechAlert outreach pipeline.
// Cron: weekly Sunday 7am ET (12:00 UTC)

import { createClient } from "npm:@supabase/supabase-js@2";
import { apolloOrganizationSearch } from "../_shared/apollo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRADE_QUERIES: Array<{ q: string; role: string }> = [
  { q: "roofing Michigan", role: "estimator" },
  { q: "HVAC heating cooling Michigan", role: "hvac_tech" },
  { q: "plumbing contractor Michigan", role: "field_tech" },
  { q: "electrical contractor Michigan", role: "field_tech" },
  { q: "pest control Michigan", role: "field_tech" },
  { q: "gutter installation Michigan", role: "field_tech" },
  { q: "siding painting exterior contractor Michigan", role: "estimator" },
  { q: "tree service arborist Michigan", role: "field_tech" },
  { q: "water damage restoration Michigan", role: "estimator" },
  { q: "demolition junk removal Michigan", role: "field_tech" },
  { q: "foundation waterproofing Michigan", role: "estimator" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let inserted = 0;
  let skipped = 0;
  let searched = 0;

  try {
    for (const { q, role } of TRADE_QUERIES) {
      try {
        const orgs = await apolloOrganizationSearch({
          q_organization_name: q,
          organization_locations: ["Michigan, United States"],
          per_page: 25,
        });
        searched += orgs.length;

        for (const org of orgs) {
          const name = (org.name || "").trim();
          if (!name) { skipped++; continue; }

          const city = [org.city, org.state].filter(Boolean).join(", ") || "Michigan";

          // Upsert into techalert_prospect_targets — same table as TechAlert pipeline
          const { data: existing } = await sb
            .from("techalert_prospect_targets")
            .select("id")
            .ilike("company_name", name)
            .maybeSingle();

          if (existing) { skipped++; continue; }

          const { error } = await sb.from("techalert_prospect_targets").insert({
            company_name: name,
            city,
            role,
            days_posted: null,
            repost_count: 0,
            open_roles_count: 0,
            is_boiler: false,
            score: 5,
            source_url: org.website_url || "https://www.apollo.io",
            source_label: "Apollo.io MI Trade Sweep",
            status: "new",
          });
          if (!error) inserted++;
          else skipped++;
        }
      } catch (e) {
        console.error(`[contractor-prospector] query "${q}":`, e instanceof Error ? e.message : e);
      }

      // Small delay between Apollo queries to avoid rate limits
      await new Promise((r) => setTimeout(r, 800));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "contractor-lead-prospector",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { searched, inserted, skipped, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, searched, inserted, skipped, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[contractor-prospector] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
