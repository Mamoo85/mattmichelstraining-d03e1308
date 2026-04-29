// techalert-enrich — 7am ET daily
// Takes new rows from techalert_prospect_targets (enriched_at IS NULL)
// and fills owner contact info via Apollo. Runs after the 6am hunter.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  apolloOrganizationSearch,
  apolloPeopleSearch,
} from "../_shared/apollo.ts";
import { hunterFindEmail } from "../_shared/hunter.ts";
import { extractContactInfo } from "../_shared/firecrawl.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Titles most likely to own the hiring decision at a small trades shop
const OWNER_TITLES = [
  "owner",
  "president",
  "general manager",
  "operations manager",
  "vp operations",
  "director of operations",
  "hr manager",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let enriched = 0, skipped = 0, failed = 0;

  try {
    // Fetch up to 25 unenriched new prospects per run (Apollo rate limits)
    const { data: targets, error } = await sb
      .from("techalert_prospect_targets")
      .select("id, company_name, city, role")
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
        // Tier 1 — Apollo: org domain + decision-maker contact
        const orgs = await apolloOrganizationSearch({
          q_organization_name: target.company_name,
          organization_locations: target.city ? [target.city] : ["Michigan"],
          per_page: 1,
        });
        const org = orgs[0] || null;
        const website = org?.website_url || null;
        const employeeCount = org?.estimated_num_employees || org?.employee_count || null;

        const people = await apolloPeopleSearch({
          organization_name: target.company_name,
          person_titles: OWNER_TITLES,
          person_locations: target.city ? [target.city] : ["Michigan"],
          per_page: 3,
        });
        const apolloContact = people[0] || null;

        let ownerEmail: string | null = apolloContact?.email || null;
        let ownerPhone: string | null = apolloContact?.phone_numbers?.[0]?.raw_number || null;
        let ownerName: string | null = apolloContact?.name ||
          (apolloContact?.first_name && apolloContact?.last_name
            ? `${apolloContact.first_name} ${apolloContact.last_name}` : null);
        const ownerLinkedin: string | null = apolloContact?.linkedin_url || null;

        // Tier 2 — Hunter.io: if Apollo didn't return an email, search by domain
        if (!ownerEmail && (website || org?.website_url)) {
          const domain = (website || org?.website_url || "")
            .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
          if (domain) {
            const hunterContact = await hunterFindEmail(domain);
            if (hunterContact?.email) {
              ownerEmail = hunterContact.email;
              ownerName = ownerName || (hunterContact.first_name && hunterContact.last_name
                ? `${hunterContact.first_name} ${hunterContact.last_name}` : ownerName);
              ownerPhone = ownerPhone || hunterContact.phone_number || null;
            }
          }
        }

        // Tier 3 — Firecrawl: scrape website contact/about page for email + owner name
        if (!ownerEmail && website) {
          const scraped = await extractContactInfo(website);
          if (scraped?.email) ownerEmail = scraped.email;
          if (!ownerName && scraped?.name) ownerName = scraped.name;
        }

        await sb
          .from("techalert_prospect_targets")
          .update({
            owner_name: ownerName,
            owner_email: ownerEmail,
            owner_phone: ownerPhone,
            owner_linkedin: ownerLinkedin,
            website,
            employee_count: employeeCount,
            enriched_at: new Date().toISOString(),
          })
          .eq("id", target.id);

        enriched++;
        // Throttle to stay within Apollo rate limits
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.error(`[enrich] ${target.company_name}:`, e instanceof Error ? e.message : e);
        failed++;
      }
    }

    // Heartbeat
    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-enrich",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { enriched, skipped, failed, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, enriched, skipped, failed, duration_ms: Date.now() - startedAt }),
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
