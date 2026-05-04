// visitor-identify — B2B anonymous visitor identification
// Called by the JS tracking snippet installed on client websites.
// Reverse-looks up the visitor IP → company/org name → inserts crm_visitor_events.
// Also auto-creates a prospect_pipeline lead for confirmed business visitors.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CLEARBIT_API_KEY = Deno.env.get("CLEARBIT_API_KEY") || "";

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

    // Clearbit Reveal (legacy IP→company; service is sunset, kept as fallback if key still works)
    if (!isBusiness && CLEARBIT_API_KEY) {
      try {
        const cbRes = await fetch(`https://reveal.clearbit.com/v1/companies/find?ip=${ip}`, {
          headers: { Authorization: `Bearer ${CLEARBIT_API_KEY}` },
          signal: AbortSignal.timeout(5_000),
        });
        if (cbRes.ok) {
          const cb = await cbRes.json();
          const cbName: string = cb?.name || "";
          if (cbName && !isNoise(cbName)) {
            companyName = cbName;
            isBusiness = true;
            city = city || cb?.geo?.city || "";
            region = region || cb?.geo?.stateCode || "";
            enrichment = { ...enrichment, clearbit_domain: cb?.domain, clearbit_industry: cb?.category?.industry, clearbit_employees: String(cb?.metrics?.employees || ""), clearbit_type: cb?.type };
          }
        }
      } catch (_) { /* fallthrough to HubSpot Breeze */ }
    }

    // HubSpot Breeze Intelligence: enrich by domain (industry, employees, name).
    // Note: HubSpot has no IP→company reveal; we use any domain hint we have.
    const domainHint: string = (enrichment as any)?.clearbit_domain
      || (companyName && companyName.includes(".") ? companyName : "")
      || "";
    if (domainHint) {
      try {
        const { lookupCompanyByDomain } = await import("../_shared/hubspot.ts");
        const breeze = await lookupCompanyByDomain(domainHint);
        if (breeze && !isNoise(breeze.name || "")) {
          if (breeze.name) { companyName = breeze.name; isBusiness = true; }
          enrichment = {
            ...enrichment,
            hubspot_domain: breeze.domain,
            hubspot_industry: breeze.industry,
            hubspot_employees: String(breeze.numberofemployees || ""),
            hubspot_city: breeze.city,
            hubspot_state: breeze.state,
          };
        }
      } catch (_) { /* Breeze enrichment optional */ }
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

    // High-intent SMS: page contains /pricing or /contact → alert client immediately
    const pageLower = (page || "").toLowerCase();
    if (isBusiness && companyName && (pageLower.includes("pricing") || pageLower.includes("contact"))) {
      const { data: clientRow } = await sb
        .from("field_crm_clients")
        .select("owner_phone, business_name")
        .eq("id", client.id)
        .maybeSingle();
      const ownerPhone = (clientRow as { owner_phone?: string } | null)?.owner_phone;
      if (ownerPhone) {
        const opener = pageLower.includes("pricing")
          ? `pricing page`
          : `contact page`;
        await fetch(`${SUPABASE_URL}/functions/v1/send-sms-internal`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: ownerPhone,
            body: `🔥 ${companyName} (${city || "unknown city"}) just hit your ${opener}. Strike while it's hot: call or text them now.`,
            product: "site_radar_alert",
          }),
        }).catch(() => {/* fire-and-forget */});
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
