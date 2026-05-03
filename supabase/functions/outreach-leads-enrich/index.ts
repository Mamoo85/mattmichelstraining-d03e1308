// outreach-leads-enrich
// Enriches outreach_leads / contractor_outreach_prospects rows that have no email.
//
// Free-first waterfall (cheapest sources first to keep paid spend down):
//   1. Google Places — free tier, returns website
//   2. Firecrawl scrape of the website's contact/about page (cheap)
//   3. Hunter.io domain search (paid but cheap, $0.01/lookup)
//   4. Apollo people + org search (most expensive, last resort)
//
// Modes:
//   - default (cron): one batch then return
//   - { drain: true }: loop until no leads remain or 4-min runtime budget hit
//   - { batch: N }: override batch size (rebalancer scales up under shortfall)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apolloOrganizationSearch, apolloPeopleSearch } from "../_shared/apollo.ts";
import { hunterFindEmail } from "../_shared/hunter.ts";
import { extractContactInfo } from "../_shared/firecrawl.ts";
import { isEmailBlocked } from "../_shared/email-suppression.ts";
import {
  isAggregatorDomain,
  isEnterprise,
  cleanWebsite,
  domainFromUrl,
  googlePlacesWebsite,
} from "../_shared/enrichment-pipeline.ts";
import { canSpend, PROVIDER_COST_ESTIMATES, type Provider } from "../_shared/enrichment-budget.ts";

interface ProviderTally { ok: number; fail: number; cost_cents: number; capped: number; ms: number; }
const newTally = (): ProviderTally => ({ ok: 0, fail: 0, cost_cents: 0, capped: 0, ms: 0 });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DEFAULT_BATCH = 30;
const HARD_MAX_BATCH = 100;
const DRAIN_TIME_BUDGET_MS = 4 * 60 * 1000; // 4 min — leave headroom under 6-min edge timeout

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_TITLES = ["owner", "president", "general manager", "operations manager", "vp operations", "director", "founder", "principal"];

interface EnrichSource { name: string; ms: number; got_email: boolean; }

async function enrichOne(sb: any, lead: any): Promise<{ status: "enriched" | "skipped" | "failed"; trace: EnrichSource[]; }> {
  const trace: EnrichSource[] = [];
  let ownerName: string | null = null;
  let ownerEmail: string | null = null;
  let ownerPhone: string | null = lead.phone || null;
  let website: string | null = lead.website || null;

  if (isEnterprise(lead.business_name)) {
    await sb.from("outreach_leads").update({
      enriched_at: new Date().toISOString(),
      notes: "skipped_enterprise",
    }).eq("id", lead.id);
    return { status: "skipped", trace };
  }

  // ── Tier 1 (FREE): Google Places → website
  if (!website) {
    const t = Date.now();
    website = await googlePlacesWebsite(lead.business_name, lead.city, "MI").catch(() => null);
    trace.push({ name: "google_places", ms: Date.now() - t, got_email: false });
  }

  // ── Tier 2 (CHEAP): Firecrawl scrape of contact page
  if (!ownerEmail && website) {
    const t = Date.now();
    try {
      const scraped = await extractContactInfo(website);
      if (scraped?.email) ownerEmail = scraped.email;
      if (!ownerName && scraped?.name) ownerName = scraped.name;
    } catch (_) { /* ignore */ }
    trace.push({ name: "firecrawl", ms: Date.now() - t, got_email: !!ownerEmail });
  }

  // ── Tier 3 (PAID-CHEAP): Hunter domain search
  if (!ownerEmail && website) {
    const t = Date.now();
    const domain = domainFromUrl(website);
    if (domain && !isAggregatorDomain(domain)) {
      try {
        const hc = await hunterFindEmail(domain);
        if (hc?.email) {
          ownerEmail = hc.email;
          ownerName = ownerName || (hc.first_name && hc.last_name ? `${hc.first_name} ${hc.last_name}` : null);
          ownerPhone = ownerPhone || hc.phone_number || null;
        }
      } catch (_) { /* ignore */ }
    }
    trace.push({ name: "hunter", ms: Date.now() - t, got_email: !!ownerEmail });
  }

  // ── Tier 4 (PAID-EXPENSIVE): Apollo people/org last resort
  if (!ownerEmail) {
    const t = Date.now();
    try {
      const orgs = await apolloOrganizationSearch({
        q_organization_name: lead.business_name,
        organization_locations: lead.city ? [lead.city] : ["Michigan"],
        per_page: 1,
      });
      const org = orgs[0] || null;
      website = website || cleanWebsite(org?.website_url) || null;
      const people = await apolloPeopleSearch({
        organization_name: lead.business_name,
        person_titles: OWNER_TITLES,
        person_locations: lead.city ? [lead.city] : ["Michigan"],
        per_page: 3,
      });
      const p = people[0] || null;
      ownerEmail = ownerEmail || p?.email || null;
      ownerPhone = ownerPhone || p?.phone_numbers?.[0]?.raw_number || null;
      ownerName = ownerName || p?.name || (p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : null);
    } catch (_) { /* ignore */ }
    trace.push({ name: "apollo", ms: Date.now() - t, got_email: !!ownerEmail });
  }

  // Reject if email is suppressed/duplicate before we save it
  if (ownerEmail && await isEmailBlocked(sb, ownerEmail)) {
    ownerEmail = null;
    trace.push({ name: "suppression_block", ms: 0, got_email: false });
  }

  await sb.from("outreach_leads").update({
    owner_name: ownerName,
    owner_email: ownerEmail,
    owner_phone: ownerPhone,
    website,
    enriched_at: new Date().toISOString(),
    enrichment_trace: trace,
  }).eq("id", lead.id);

  return { status: ownerEmail ? "enriched" : "failed", trace };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let enriched = 0, failed = 0, skipped = 0, batches = 0;

  const body = await req.json().catch(() => ({} as any));
  const drain = body?.drain === true;
  const requestedBatch = Number(body?.batch) || DEFAULT_BATCH;
  const BATCH = Math.max(1, Math.min(HARD_MAX_BATCH, requestedBatch));

  try {
    while (true) {
      // Pull leads with no email at all (NULL owner_email AND NULL email AND NULL validated/enriched)
      const { data: leads, error } = await sb.from("outreach_leads")
        .select("id, business_name, city, industry, phone, website")
        .is("owner_email", null)
        .is("email", null)
        .is("validated_email", null)
        .is("enriched_email", null)
        .is("enriched_at", null)
        .order("created_at", { ascending: false })
        .limit(BATCH);
      if (error) throw error;
      if (!leads?.length) break;
      batches++;

      for (const lead of leads) {
        try {
          const r = await enrichOne(sb, lead);
          if (r.status === "enriched") enriched++;
          else if (r.status === "skipped") skipped++;
          else failed++;
        } catch (e) {
          await sb.from("outreach_leads").update({ enriched_at: new Date().toISOString() }).eq("id", lead.id);
          failed++;
          console.error(`[enrich] ${lead.business_name}:`, e instanceof Error ? e.message : e);
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      if (!drain) break;
      if (Date.now() - startedAt > DRAIN_TIME_BUDGET_MS) break;
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "outreach-leads-enrich",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { enriched, failed, skipped, batches, drain, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, enriched, failed, skipped, batches, drain, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg, enriched, failed, skipped }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
