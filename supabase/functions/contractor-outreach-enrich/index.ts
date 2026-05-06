// Contractor Outreach: enrich a prospect's email via full 6-stage waterfall.
//
// Waterfall (in order, stops when email found):
//   1. Hunter.io domain search  — if prospect already has a website/domain
//   2. Apollo Org Enrich        — surface org email + website by domain
//   3. Apollo Org Search        — find website by company name; then run Hunter on it
//   4. Apollo People Search     — owner/GM/founder email by name + city
//   5. Firecrawl contact scrape — scrape /about or /contact page for email
//   6. Pattern guess            — info@domain (last resort, unverified)
//
// Previously only ran Hunter → PDL. Bug: read HUNTER_API_KEY instead of HUNTER_IO_API_KEY
// (always null). Now uses _shared/hunter.ts which reads the correct env var name.
import { createClient } from "npm:@supabase/supabase-js@2";
import { hunterFindEmail } from "../_shared/hunter.ts";
import { apolloOrgEnrich, apolloOrgSearch, apolloMixedPeopleSearch } from "../_shared/apollo.ts";
import { extractContactInfo } from "../_shared/firecrawl.ts";
import { parseEnrichmentTrace } from "../_shared/safe-parse.ts";
import {
  isAggregatorDomain,
  isEnterprise,
  cleanWebsite,
  googlePlacesWebsite,
} from "../_shared/enrichment-pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch { return null; }
}

function now() { return new Date().toISOString(); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) {
      return new Response(JSON.stringify({ error: "prospect_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: prospect, error: pErr } = await supabase
      .from("contractor_outreach_prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();
    if (pErr || !prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trace: Array<Record<string, unknown>> = parseEnrichmentTrace(prospect.enrichment_trace);
    let domain = extractDomain(prospect.website);
    let email: string | null = prospect.email;
    let owner: string | null = prospect.owner_name;
    let phone: string | null = prospect.phone;
    let verified = !!prospect.email_verified;
    let website: string | null = cleanWebsite(prospect.website);
    if (prospect.website && !website) {
      // existing website was an aggregator — clear it so we re-discover
      trace.push({ stage: "website_scrub_aggregator", original: prospect.website, ts: now() });
    }
    domain = extractDomain(website);

    // Skip enterprises early — wrong outreach motion (RFP, not cold email)
    if (isEnterprise(prospect.business_name)) {
      await supabase
        .from("contractor_outreach_prospects")
        .update({
          enriched_at: new Date().toISOString(),
          enrichment_trace: [...trace, { stage: "skipped_enterprise", ts: now() }],
        })
        .eq("id", prospect_id);
      return new Response(JSON.stringify({ ok: true, skipped: "enterprise" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Stage 1: Hunter.io domain search ─────────────────────────────────────
    if (!email && domain) {
      const hit = await hunterFindEmail(domain);
      trace.push({ stage: "hunter", domain, found: !!hit?.email, ts: now() });
      if (hit?.email) {
        email = hit.email;
        verified = true;
        if (!owner && (hit.first_name || hit.last_name)) {
          owner = [hit.first_name, hit.last_name].filter(Boolean).join(" ");
        }
        if (!phone && hit.phone_number) phone = hit.phone_number;
      }
    }

    // ── Stage 2: Apollo Org Enrich via domain ─────────────────────────────────
    if (!email && domain) {
      const orgR = await apolloOrgEnrich({ domain });
      if (orgR.ok && orgR.data) {
        const org = orgR.data.organization || orgR.data;
        const orgEmail = org.email || org.sanitized_email;
        trace.push({ stage: "apollo_org_enrich", domain, found: !!orgEmail, ts: now() });
        if (orgEmail) { email = orgEmail; verified = true; }
      }
    }

    // ── Stage 3: Apollo Org Search by name → discover website → Hunter ────────
    if (!email) {
      const searchR = await apolloOrgSearch({
        q_organization_name: prospect.business_name,
        organization_locations: [prospect.city ? `${prospect.city}, ${prospect.state || "MI"}` : (prospect.state || "Michigan")],
        per_page: 3,
      });
      if (searchR.ok && searchR.data?.organizations?.length > 0) {
        const org = searchR.data.organizations[0];
        const orgEmail = org.email || org.sanitized_email;
        trace.push({ stage: "apollo_org_search", found: !!orgEmail || !!org.website_url, ts: now() });
        if (orgEmail) { email = orgEmail; verified = true; }
        // Discovered a website — scrub aggregator hits, persist, then re-Hunter
        const candidate = cleanWebsite(org.website_url);
        if (!email && candidate && !website) {
          website = candidate;
          domain = extractDomain(website);
          await supabase.from("contractor_outreach_prospects")
            .update({ website }).eq("id", prospect_id);
          if (domain) {
            const hit = await hunterFindEmail(domain);
            trace.push({ stage: "hunter_after_apollo", domain, found: !!hit?.email, ts: now() });
            if (hit?.email) {
              email = hit.email;
              verified = true;
              if (!owner && (hit.first_name || hit.last_name)) {
                owner = [hit.first_name, hit.last_name].filter(Boolean).join(" ");
              }
            }
          }
        }
      }
    }

    // ── Stage 3.5: Google Places fallback ─────────────────────────────────────
    if (!website) {
      const places = await googlePlacesWebsite(prospect.business_name, prospect.city, prospect.state);
      trace.push({ stage: "google_places", found: !!places, ts: now() });
      if (places) {
        website = places;
        domain = extractDomain(website);
        await supabase.from("contractor_outreach_prospects")
          .update({ website }).eq("id", prospect_id);
        if (!email && domain) {
          const hit = await hunterFindEmail(domain);
          trace.push({ stage: "hunter_after_places", domain, found: !!hit?.email, ts: now() });
          if (hit?.email) {
            email = hit.email;
            verified = true;
            if (!owner && (hit.first_name || hit.last_name)) {
              owner = [hit.first_name, hit.last_name].filter(Boolean).join(" ");
            }
          }
        }
      }
    }

    // ── Stage 4: Apollo People Search — owner/GM/founder by name + city ───────
    if (!email) {
      const location = prospect.city
        ? `${prospect.city}, ${prospect.state || "MI"}`
        : (prospect.state || "Michigan");
      const peopleR = await apolloMixedPeopleSearch({
        q_organization_name: prospect.business_name,
        person_locations: [location],
        person_titles: ["owner", "president", "general manager", "ceo", "founder", "principal", "proprietor"],
        per_page: 5,
        reveal_personal_emails: true,
      });
      if (peopleR.ok && peopleR.data?.people?.length > 0) {
        const person = peopleR.data.people[0];
        trace.push({ stage: "apollo_people", found: !!person?.email, name: person?.name, ts: now() });
        if (person?.email) {
          email = person.email;
          owner = owner || person.name;
          verified = true;
        }
        if (!phone && person?.phone_numbers?.length > 0) {
          phone = person.phone_numbers[0].raw_number;
        }
      }
    }

    // ── Stage 5: Firecrawl contact page scrape ────────────────────────────────
    if (!email && website) {
      const contact = await extractContactInfo(website);
      trace.push({ stage: "firecrawl_contact", url: website, found: !!contact?.email, ts: now() });
      if (contact?.email) { email = contact.email; verified = false; }
      if (!owner && contact?.name) owner = contact.name;
    }

    // ── Stage 6: Pattern guess info@domain (last resort) ─────────────────────
    if (!email && domain) {
      email = `info@${domain}`;
      verified = false;
      trace.push({ stage: "pattern_guess", email, confidence: 0.3, ts: now() });
    }

    // Compute enrichment_confidence (0–100)
    let confidence = 0;
    if (email && verified) confidence += 40;
    else if (email) confidence += 15;
    if (owner) confidence += 20;
    if (phone) confidence += 15;
    if (domain) confidence += 10;
    const sources = trace.map((t) => String((t as any).stage ?? ""));
    if (sources.some((s) => ["hunter", "hunter_after_apollo", "apollo_people", "apollo_org_enrich"].includes(s))) confidence += 10;
    if (confidence > 100) confidence = 100;

    const { data: updated, error: uErr } = await supabase
      .from("contractor_outreach_prospects")
      .update({
        email,
        email_verified: verified,
        owner_name: owner,
        phone,
        website,
        enriched_at: new Date().toISOString(),
        enrichment_trace: trace,
        enrichment_confidence: confidence,
      })
      .eq("id", prospect_id)
      .select()
      .single();

    if (uErr) throw uErr;

    return new Response(JSON.stringify({ ok: true, prospect: updated, stages_tried: sources }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("contractor-outreach-enrich error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
