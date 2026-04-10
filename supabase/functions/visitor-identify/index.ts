// visitor-identify — B2B anonymous visitor identification
// Called by the JS tracking snippet installed on client websites.
// Reverse-looks up the visitor IP → company/org name → inserts crm_visitor_events.
// Also auto-creates a prospect_pipeline lead for confirmed business visitors.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-visitor-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ISPs / hosting providers to ignore — not real business visitors
const NOISE_ORGS = [
  "google", "amazon", "aws", "microsoft", "cloudflare", "akamai", "comcast",
  "at&t", "verizon", "spectrum", "cox", "frontier", "centurylink", "lumen",
  "digitalocean", "linode", "vultr", "fastly", "cdn", "hosting", "data center",
  "datacenter", "internet", "broadband", "wireless", "mobile", "residential",
];

function isNoise(org: string): boolean {
  const lower = org.toLowerCase();
  return NOISE_ORGS.some((n) => lower.includes(n));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { script_key, page, referrer } = body;

    if (!script_key) {
      return new Response(JSON.stringify({ ok: false, error: "script_key required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up which client owns this script key
    const { data: client } = await sb
      .from("field_crm_clients")
      .select("id, business_name, status")
      .eq("visitor_script_key", script_key)
      .eq("status", "active")
      .maybeSingle();

    if (!client) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid script key" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get visitor IP — check standard proxy headers first
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (ip === "unknown" || ip.startsWith("127.") || ip.startsWith("::1")) {
      return new Response(JSON.stringify({ ok: true, skipped: "local" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich IP via ipinfo.io (free tier: 50k req/mo)
    let enrichment: Record<string, string> = {};
    let companyName = "";
    let org = "";
    let city = "";
    let region = "";
    let country = "";
    let isBusiness = false;

    try {
      const ipRes = await fetch(`https://ipinfo.io/${ip}/json`);
      if (ipRes.ok) {
        const data = await ipRes.json();
        org = data.org || "";          // e.g. "AS12345 ABC Industrial LLC"
        city = data.city || "";
        region = data.region || "";
        country = data.country || "";
        enrichment = data;

        // org format from ipinfo: "AS##### Company Name" — strip the ASN prefix
        const orgName = org.replace(/^AS\d+\s+/i, "").trim();
        isBusiness = orgName.length > 2 && !isNoise(orgName);
        companyName = isBusiness ? orgName : "";
      }
    } catch (_) {
      // Enrichment failed — still log the raw visit
    }

    // Upsert: if same IP + client visited today, increment count instead of duplicate
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: existing } = await sb
      .from("crm_visitor_events")
      .select("id, visit_count")
      .eq("client_id", client.id)
      .eq("ip_address", ip)
      .gte("created_at", todayStart.toISOString())
      .maybeSingle();

    let eventId: string;

    if (existing) {
      await sb
        .from("crm_visitor_events")
        .update({ visit_count: existing.visit_count + 1, last_seen_at: new Date().toISOString(), page_visited: page || null })
        .eq("id", existing.id);
      eventId = existing.id;
    } else {
      const { data: inserted } = await sb
        .from("crm_visitor_events")
        .insert({
          client_id: client.id,
          visitor_script_key: script_key,
          ip_address: ip,
          company_name: companyName || null,
          org,
          city,
          region,
          country,
          is_business: isBusiness,
          page_visited: page || null,
          referrer: referrer || null,
          enrichment_data: enrichment,
        })
        .select("id")
        .single();
      eventId = inserted?.id;
    }

    // Auto-create a pipeline lead for confirmed business visitors (first visit only)
    if (isBusiness && companyName && !existing) {
      // Check if this company is already in the pipeline for this client
      const { data: existingLead } = await sb
        .from("prospect_pipeline")
        .select("id")
        .ilike("business_name", companyName)
        .maybeSingle();

      if (!existingLead) {
        const { data: lead } = await sb
          .from("prospect_pipeline")
          .insert({
            business_name: companyName,
            city,
            pipeline_stage: "new_lead",
            lead_score: 7,
            website: null,
            industry: "visitor_identified",
            notes: `Auto-identified: visited ${page || "website"} (${city}, ${region}). IP enrichment via ipinfo.`,
            last_activity_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (lead) {
          // Log the identification as an activity
          await sb.from("lead_activities").insert({
            lead_id: lead.id,
            type: "researched",
            content: `Website visitor identified: ${companyName} visited ${page || "homepage"} from ${city}, ${region}`,
            metadata: { ip, source: "visitor_intel", page, referrer },
          });

          // Mark the visitor event as having created a lead
          if (eventId) {
            await sb.from("crm_visitor_events").update({ lead_auto_created: true, pipeline_lead_id: lead.id }).eq("id", eventId);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, identified: isBusiness, company: companyName || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
