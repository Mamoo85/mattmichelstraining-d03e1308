// outreach-leads-enrich — daily 11am ET
// Enriches outreach_leads (from channel-prospector) that have no owner_email.
// Waterfall: Apollo org search → Hunter.io domain search → Firecrawl website scrape.
// Fills owner_name, owner_email, owner_phone so follow-up drip has targets.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const BATCH = 20; // Apollo rate limit ceiling per run

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_TITLES = ["owner", "president", "general manager", "operations manager", "vp operations", "director", "founder", "principal"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let enriched = 0, failed = 0, skipped = 0;

  try {
    // Fetch leads with no owner_email — exclude ones already tried (enriched_at set)
    const { data: leads, error } = await (sb.from as any)("outreach_leads")
      .select("id, business_name, city, industry, phone")
      .is("owner_email", null)
      .is("enriched_at", null)
      .order("created_at", { ascending: false })
      .limit(BATCH);

    if (error) throw error;
    if (!leads?.length) {
      return new Response(
        JSON.stringify({ ok: true, enriched: 0, note: "no unenriched leads" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const lead of leads) {
      try {
        let ownerName: string | null = null;
        let ownerEmail: string | null = null;
        let ownerPhone: string | null = null;
        let website: string | null = null;

        // Skip enterprise targets early
        if (isEnterprise(lead.business_name)) {
          await (sb.from as any)("outreach_leads").update({
            enriched_at: new Date().toISOString(),
            notes: "skipped_enterprise",
          }).eq("id", lead.id);
          skipped++;
          continue;
        }

        // Tier 1 — Apollo: org + people search
        const orgs = await apolloOrganizationSearch({
          q_organization_name: lead.business_name,
          organization_locations: lead.city ? [lead.city] : ["Michigan"],
          per_page: 1,
        });
        const org = orgs[0] || null;
        website = cleanWebsite(org?.website_url) || null;

        const people = await apolloPeopleSearch({
          organization_name: lead.business_name,
          person_titles: OWNER_TITLES,
          person_locations: lead.city ? [lead.city] : ["Michigan"],
          per_page: 3,
        });
        const apolloContact = people[0] || null;
        ownerEmail = apolloContact?.email || null;
        ownerPhone = apolloContact?.phone_numbers?.[0]?.raw_number || lead.phone || null;
        ownerName = apolloContact?.name ||
          (apolloContact?.first_name && apolloContact?.last_name
            ? `${apolloContact.first_name} ${apolloContact.last_name}` : null);

        // Tier 1.5 — Google Places fallback when Apollo gave no website
        if (!website) {
          website = await googlePlacesWebsite(lead.business_name, lead.city, "MI");
        }

        // Tier 2 — Hunter.io: domain search when Apollo has no email
        if (!ownerEmail && website) {
          const domain = domainFromUrl(website);
          if (domain && !isAggregatorDomain(domain)) {
            const hunterContact = await hunterFindEmail(domain);
            if (hunterContact?.email) {
              ownerEmail = hunterContact.email;
              ownerName = ownerName || (hunterContact.first_name && hunterContact.last_name
                ? `${hunterContact.first_name} ${hunterContact.last_name}` : null);
              ownerPhone = ownerPhone || hunterContact.phone_number || null;
            }
          }
        }

        // Tier 3 — Firecrawl: scrape contact/about page
        if (!ownerEmail && website) {
          const scraped = await extractContactInfo(website);
          if (scraped?.email) ownerEmail = scraped.email;
          if (!ownerName && scraped?.name) ownerName = scraped.name;
        }

        await (sb.from as any)("outreach_leads").update({
          owner_name: ownerName,
          owner_email: ownerEmail,
          owner_phone: ownerPhone,
          website,
          enriched_at: new Date().toISOString(),
        }).eq("id", lead.id);

        enriched++;
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.error(`[outreach-enrich] ${lead.business_name}:`, e instanceof Error ? e.message : e);
        // Mark enriched_at anyway to avoid infinite retry on bad data
        await (sb.from as any)("outreach_leads").update({ enriched_at: new Date().toISOString() }).eq("id", lead.id);
        failed++;
      }
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "outreach-leads-enrich",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { enriched, failed, skipped, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, enriched, failed, skipped, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
