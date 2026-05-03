// techalert-enrich — 7am ET daily
// Takes new rows from techalert_prospect_targets (enriched_at IS NULL)
// and fills owner contact info using the UNIFIED 10-stage email waterfall
// (site_scrape → Snov → Apollo → pattern_verify → Hunter → PDL → PDL-name
//  → crt.sh → RDAP/whois → OpenCorporates) plus Apollo people-search for
// owner name / phone / LinkedIn. Always persists `website` even when no
// email is found, so subsequent runs can extend the waterfall.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  apolloOrganizationSearch,
  apolloPeopleSearch,
} from "../_shared/apollo.ts";
import { runEmailWaterfall, type WaterfallCounters } from "../_shared/email-waterfall.ts";
import {
  isAggregatorDomain,
  isEnterprise,
  cleanWebsite,
  domainFromUrl,
  googlePlacesWebsite,
} from "../_shared/enrichment-pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Titles most likely to own the hiring decision at a small trades shop.
// Skip enterprise titles (CEO/CFO at GM, DTE, etc.) — those orgs are filtered separately.
const OWNER_TITLES = [
  "owner",
  "president",
  "general manager",
  "operations manager",
  "vp operations",
  "director of operations",
  "hr manager",
  "facilities director",
  "facilities manager",
];

// Aggregator filter, enterprise guard, and Google Places fallback are all
// imported from _shared/enrichment-pipeline.ts (single source of truth).

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let enriched = 0, skipped = 0, failed = 0;
  const waterfallCounters: WaterfallCounters = {};

  try {
    // Fetch up to 25 unenriched new prospects per run
    const { data: targets, error } = await sb
      .from("techalert_prospect_targets")
      .select("id, company_name, city, state, role, source_url")
      .is("enriched_at", null)
      .eq("status", "new")
      .order("score", { ascending: false })
      .limit(25);

    if (error) throw error;
    if (!targets?.length) {
      return new Response(
        JSON.stringify({ ok: true, enriched: 0, skipped: 0, failed: 0, note: "no unenriched prospects" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const target of targets) {
      try {
        // Tier 0 — Apollo org lookup (gets website, employee count, owner contact)
        let website: string | null = null;
        let employeeCount: number | null = null;
        let ownerEmail: string | null = null;
        let ownerPhone: string | null = null;
        let ownerName: string | null = null;
        let ownerLinkedin: string | null = null;
        let firstName: string | null = null;
        let lastName: string | null = null;

        try {
          const orgs = await apolloOrganizationSearch({
            q_organization_name: target.company_name,
            organization_locations: target.city ? [target.city] : ["Michigan"],
            per_page: 1,
          });
          const org = orgs[0] || null;
          website = org?.website_url || org?.primary_domain
            ? (org.website_url || `https://${org.primary_domain}`)
            : null;
          if (isAggregatorDomain(domainFromUrl(website))) website = null;
          employeeCount = org?.estimated_num_employees || org?.employee_count || null;
        } catch (e) {
          console.warn(`[enrich] apollo org ${target.company_name}:`, e instanceof Error ? e.message : e);
        }

        // Skip enterprises before burning Apollo people-search credits
        if (isEnterprise(target.company_name, employeeCount)) {
          await sb.from("techalert_prospect_targets").update({
            website,
            employee_count: employeeCount,
            enriched_at: new Date().toISOString(),
            outreach_status: "skipped_enterprise",
            notes: `Skipped: enterprise (${employeeCount || "n/a"} employees)`,
          }).eq("id", target.id);
          skipped++;
          continue;
        }

        // Tier 1 — Apollo people search (owner name + LinkedIn + maybe email/phone)
        try {
          const people = await apolloPeopleSearch({
            organization_name: target.company_name,
            person_titles: OWNER_TITLES,
            person_locations: target.city ? [target.city] : ["Michigan"],
            per_page: 3,
          });
          const apolloContact = people[0] || null;
          if (apolloContact) {
            ownerEmail = apolloContact.email || null;
            ownerPhone = apolloContact.phone_numbers?.[0]?.raw_number || null;
            ownerName = apolloContact.name ||
              (apolloContact.first_name && apolloContact.last_name
                ? `${apolloContact.first_name} ${apolloContact.last_name}` : null);
            ownerLinkedin = apolloContact.linkedin_url || null;
            firstName = apolloContact.first_name || null;
            lastName = apolloContact.last_name || null;
          }
        } catch (e) {
          console.warn(`[enrich] apollo people ${target.company_name}:`, e instanceof Error ? e.message : e);
        }

        // Fallback website: derive from source_url if Apollo didn't give one
        if (!website && target.source_url) {
          const d = domainFromUrl(target.source_url);
          if (d && !isAggregatorDomain(d)) website = `https://${d}`;
        }

        // Tier 1.5 — Google Places fallback for an authentic business website
        if (!website) {
          website = await googlePlacesWebsite(target.company_name, target.city, target.state);
        }

        // Tier 2 — Unified 10-stage email waterfall (only if we still need email)
        let waterfallTrace: any[] = [];
        if (!ownerEmail) {
          const wf = await runEmailWaterfall(sb, {
            website,
            business_name: target.company_name,
            city: target.city || null,
            state: target.state || "MI",
            contact_first_name: firstName,
            contact_last_name: lastName,
          }, waterfallCounters);
          ownerEmail = wf.email;
          waterfallTrace = wf.trace;
          if (wf.email && !ownerName) {
            // Extract a name from the email local-part as a soft fallback
            const local = wf.email.split("@")[0];
            if (/^[a-z]+\.[a-z]+$/i.test(local)) {
              const [f, l] = local.split(".");
              ownerName = `${f.charAt(0).toUpperCase() + f.slice(1)} ${l.charAt(0).toUpperCase() + l.slice(1)}`;
            }
          }
        }

        await sb.from("techalert_prospect_targets").update({
          owner_name: ownerName,
          owner_email: ownerEmail,
          owner_phone: ownerPhone,
          owner_linkedin: ownerLinkedin,
          website,
          employee_count: employeeCount,
          enriched_at: new Date().toISOString(),
          notes: waterfallTrace.length
            ? `Waterfall: ${waterfallTrace.map((t) => `${t.source}=${t.ok ? "✓" : "✗"}`).join(", ")}`
            : null,
        }).eq("id", target.id);

        enriched++;
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.error(`[enrich] ${target.company_name}:`, e instanceof Error ? e.message : e);
        failed++;
      }
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-enrich",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { enriched, skipped, failed, waterfall: waterfallCounters, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, enriched, skipped, failed, waterfall: waterfallCounters, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[enrich] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
