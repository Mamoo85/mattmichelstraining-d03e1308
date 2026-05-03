// Roofing prospect enrichment — drains roofing_prospects rows lacking owner_email.
// Apollo organization → people search waterfall. 20 records/run, daily 11am ET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { apolloOrganizationSearch, apolloPeopleSearch } from "../_shared/apollo.ts";
import { hunterFindEmail } from "../_shared/hunter.ts";
import { extractContactInfo } from "../_shared/firecrawl.ts";
import {
  isAggregatorDomain,
  isEnterprise,
  cleanWebsite,
  domainFromUrl,
  googlePlacesWebsite,
} from "../_shared/enrichment-pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const summary = { processed: 0, enriched: 0, failed: 0 };

  try {
    const { data: prospects, error } = await sb
      .from("roofing_prospects")
      .select("id, company_name, city, state")
      .is("owner_email", null)
      .is("enriched_at", null)
      .limit(20);

    if (error) throw error;

    for (const p of prospects ?? []) {
      summary.processed++;
      try {
        const orgs = await apolloOrganizationSearch({
          q_organization_name: p.company_name,
          per_page: 1,
        });
        const org = orgs?.[0];
        let owner_name: string | null = null;
        let owner_email: string | null = null;
        let owner_phone: string | null = null;
        let website: string | null = org?.website_url ?? null;

        if (org?.name) {
          const people = await apolloPeopleSearch({
            organization_name: org.name,
            person_titles: ["owner", "president", "ceo", "founder", "general manager"],
            per_page: 1,
          });
          const person = people?.[0];
          if (person) {
            owner_name = [person.first_name, person.last_name].filter(Boolean).join(" ") || null;
            owner_email = person.email ?? null;
            owner_phone = person.phone_numbers?.[0]?.sanitized_number ?? null;
          }
        }

        await sb
          .from("roofing_prospects")
          .update({
            owner_name,
            owner_email,
            owner_phone,
            website,
            enriched_at: new Date().toISOString(),
            outreach_status: owner_email ? "ready" : "no_contact",
          })
          .eq("id", p.id);

        if (owner_email) summary.enriched++;
      } catch (err) {
        summary.failed++;
        await sb
          .from("roofing_prospects")
          .update({ enriched_at: new Date().toISOString(), outreach_status: "enrich_failed" })
          .eq("id", p.id);
        console.error("[roofing-enrich]", p.company_name, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[roofing-enrich] fatal", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
