import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const SNOV_API_KEY = Deno.env.get("SNOV_API_KEY") || "";
const LUSHA_API_KEY = Deno.env.get("LUSHA_API_KEY") || "";
const CLAY_API_KEY = Deno.env.get("CLAY_API_KEY") || "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[ENRICH] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── HUNTER.IO: Domain email search + verification ──
async function hunterSearch(domain: string): Promise<{ emails: Array<{ value: string; type: string; first_name: string; last_name: string; position: string; confidence: number }>; source: string } | null> {
  if (!HUNTER_API_KEY || !domain) return null;
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}&limit=5`);
    if (!res.ok) { log("Hunter API error", { status: res.status }); return null; }
    const data = await res.json();
    const emails = data?.data?.emails || [];
    if (emails.length === 0) return null;
    return {
      emails: emails.map((e: any) => ({
        value: e.value,
        type: e.type || "generic",
        first_name: e.first_name || "",
        last_name: e.last_name || "",
        position: e.position || "",
        confidence: e.confidence || 0,
      })),
      source: "hunter",
    };
  } catch (e) { log("Hunter error", { error: String(e) }); return null; }
}

async function hunterVerify(email: string): Promise<boolean> {
  if (!HUNTER_API_KEY || !email) return false;
  try {
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.data?.result === "deliverable";
  } catch { return false; }
}

// ── APOLLO.IO: People search / company enrichment ──
async function apolloSearch(domain: string, businessName: string): Promise<{ email: string; name: string; title: string; source: string } | null> {
  if (!APOLLO_API_KEY || !domain) return null;
  try {
    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify({
        q_organization_domains: domain,
        page: 1,
        per_page: 3,
        person_seniorities: ["owner", "founder", "c_suite", "vp", "director", "manager"],
      }),
    });
    if (!res.ok) { log("Apollo API error", { status: res.status }); return null; }
    const data = await res.json();
    const person = data?.people?.[0];
    if (!person?.email) return null;
    return {
      email: person.email,
      name: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
      title: person.title || "",
      source: "apollo",
    };
  } catch (e) { log("Apollo error", { error: String(e) }); return null; }
}

// ── SNOV.IO: Domain email finder ──
async function snovSearch(domain: string): Promise<{ email: string; name: string; title: string; source: string } | null> {
  if (!SNOV_API_KEY || !domain) return null;
  try {
    // Snov.io uses user ID + API secret, but their v2 API accepts API key
    const res = await fetch(`https://api.snov.io/v2/domain-emails-with-info?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${SNOV_API_KEY}` },
    });
    if (!res.ok) { log("Snov API error", { status: res.status }); return null; }
    const data = await res.json();
    const emails = data?.emails || data?.data?.emails || [];
    if (emails.length === 0) return null;
    const best = emails[0];
    return {
      email: best.email || best.value || "",
      name: `${best.firstName || ""} ${best.lastName || ""}`.trim(),
      title: best.position || best.title || "",
      source: "snov",
    };
  } catch (e) { log("Snov error", { error: String(e) }); return null; }
}

// ── LUSHA: Contact enrichment (phone + email) ──
async function lushaSearch(domain: string, businessName: string): Promise<{ email: string; phone: string; name: string; title: string; source: string } | null> {
  if (!LUSHA_API_KEY || !domain) return null;
  try {
    const res = await fetch(`https://api.lusha.com/person?company=${encodeURIComponent(businessName)}&companyDomain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${LUSHA_API_KEY}`, "Content-Type": "application/json" },
    });
    if (!res.ok) { log("Lusha API error", { status: res.status }); return null; }
    const data = await res.json();
    const contact = data?.data || data;
    if (!contact) return null;
    return {
      email: contact.emailAddress || contact.email || "",
      phone: contact.phoneNumber || contact.phone || contact.directDial || "",
      name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
      title: contact.title || contact.jobTitle || "",
      source: "lusha",
    };
  } catch (e) { log("Lusha error", { error: String(e) }); return null; }
}

// ── CLAY.COM: Enrichment API ──
async function clayEnrich(domain: string, businessName: string): Promise<{ email: string; phone: string; name: string; title: string; source: string } | null> {
  if (!CLAY_API_KEY || !domain) return null;
  try {
    const res = await fetch("https://api.clay.com/v1/enrichments", {
      method: "POST",
      headers: { Authorization: `Bearer ${CLAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        domain,
        company_name: businessName,
        enrichment_type: "company_contacts",
      }),
    });
    if (!res.ok) { log("Clay API error", { status: res.status }); return null; }
    const data = await res.json();
    const contact = data?.results?.[0] || data?.data?.[0];
    if (!contact) return null;
    return {
      email: contact.email || contact.work_email || "",
      phone: contact.phone || contact.direct_phone || "",
      name: contact.full_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
      title: contact.title || contact.job_title || "",
      source: "clay",
    };
  } catch (e) { log("Clay error", { error: String(e) }); return null; }
}

// ── Extract domain from URL ──
function extractDomain(url: string): string {
  try {
    let clean = url.trim();
    if (!clean.startsWith("http")) clean = `https://${clean}`;
    return new URL(clean).hostname.replace("www.", "");
  } catch { return ""; }
}

// ── Main waterfall enrichment ──
interface EnrichmentResult {
  email: string | null;
  verified_email: boolean;
  decision_maker_name: string | null;
  decision_maker_title: string | null;
  direct_phone: string | null;
  enrichment_source: string;
  enrichment_data: Record<string, any>;
}

async function runWaterfall(domain: string, businessName: string): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    email: null,
    verified_email: false,
    decision_maker_name: null,
    decision_maker_title: null,
    direct_phone: null,
    enrichment_source: "none",
    enrichment_data: {},
  };

  // Step 1: Hunter.io — fastest, cheapest
  log("Step 1: Hunter.io", { domain });
  const hunterResult = await hunterSearch(domain);
  if (hunterResult && hunterResult.emails.length > 0) {
    // Pick highest confidence personal email, fallback to generic
    const personal = hunterResult.emails.find(e => e.type === "personal" && e.confidence >= 70);
    const best = personal || hunterResult.emails[0];
    result.email = best.value;
    result.enrichment_source = "hunter";
    if (best.first_name || best.last_name) {
      result.decision_maker_name = `${best.first_name} ${best.last_name}`.trim();
    }
    if (best.position) result.decision_maker_title = best.position;
    result.enrichment_data.hunter = hunterResult;

    // Verify the email
    const verified = await hunterVerify(best.value);
    result.verified_email = verified;
    log("Hunter found email", { email: best.value, verified, confidence: best.confidence });
  }

  // Step 2: Apollo.io — decision maker lookup (run if no email OR no name)
  if (!result.email || !result.decision_maker_name) {
    log("Step 2: Apollo.io", { domain });
    const apolloResult = await apolloSearch(domain, businessName);
    if (apolloResult) {
      if (!result.email) {
        result.email = apolloResult.email;
        result.enrichment_source = "apollo";
      }
      if (!result.decision_maker_name && apolloResult.name) {
        result.decision_maker_name = apolloResult.name;
      }
      if (!result.decision_maker_title && apolloResult.title) {
        result.decision_maker_title = apolloResult.title;
      }
      result.enrichment_data.apollo = apolloResult;
      log("Apollo found contact", { name: apolloResult.name, title: apolloResult.title });
    }
  }

  // Step 3: Snov.io — fallback email finder
  if (!result.email) {
    log("Step 3: Snov.io", { domain });
    const snovResult = await snovSearch(domain);
    if (snovResult && snovResult.email) {
      result.email = snovResult.email;
      result.enrichment_source = "snov";
      if (!result.decision_maker_name && snovResult.name) result.decision_maker_name = snovResult.name;
      if (!result.decision_maker_title && snovResult.title) result.decision_maker_title = snovResult.title;
      result.enrichment_data.snov = snovResult;
      log("Snov found email", { email: snovResult.email });
    }
  }

  // Step 4: Lusha — phone number enrichment (run for all prospects, phone is high value)
  if (!result.direct_phone) {
    log("Step 4: Lusha", { domain });
    const lushaResult = await lushaSearch(domain, businessName);
    if (lushaResult) {
      if (lushaResult.phone) result.direct_phone = lushaResult.phone;
      if (!result.email && lushaResult.email) {
        result.email = lushaResult.email;
        result.enrichment_source = "lusha";
      }
      if (!result.decision_maker_name && lushaResult.name) result.decision_maker_name = lushaResult.name;
      if (!result.decision_maker_title && lushaResult.title) result.decision_maker_title = lushaResult.title;
      result.enrichment_data.lusha = lushaResult;
      log("Lusha found contact", { phone: lushaResult.phone, name: lushaResult.name });
    }
  }

  // Step 5: Clay.com — final enrichment pass for remaining gaps
  if (!result.email || !result.direct_phone) {
    log("Step 5: Clay.com", { domain });
    const clayResult = await clayEnrich(domain, businessName);
    if (clayResult) {
      if (!result.email && clayResult.email) {
        result.email = clayResult.email;
        result.enrichment_source = "clay";
      }
      if (!result.direct_phone && clayResult.phone) result.direct_phone = clayResult.phone;
      if (!result.decision_maker_name && clayResult.name) result.decision_maker_name = clayResult.name;
      if (!result.decision_maker_title && clayResult.title) result.decision_maker_title = clayResult.title;
      result.enrichment_data.clay = clayResult;
      log("Clay found data", { email: clayResult.email, phone: clayResult.phone });
    }
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { prospect_id, domain, business_name, website, mode } = body;

    // ── BATCH MODE: Enrich all pending prospects ──
    if (mode === "batch") {
      const batchLimit = body.limit || 20;
      const { data: pending } = await sb
        .from("prospect_businesses")
        .select("id, business_name, website, email")
        .or("enrichment_status.eq.pending,enrichment_status.is.null")
        .not("website", "is", null)
        .order("created_at", { ascending: false })
        .limit(batchLimit);

      if (!pending || pending.length === 0) {
        return new Response(JSON.stringify({ ok: true, enriched: 0, message: "No pending prospects" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let enriched = 0;
      let failed = 0;

      for (const prospect of pending) {
        try {
          const dom = extractDomain(prospect.website || "");
          if (!dom) { failed++; continue; }

          const result = await runWaterfall(dom, prospect.business_name);

          await sb.from("prospect_businesses").update({
            enrichment_source: result.enrichment_source,
            enrichment_status: result.email ? "enriched" : "no_data",
            verified_email: result.verified_email,
            decision_maker_name: result.decision_maker_name,
            decision_maker_title: result.decision_maker_title,
            direct_phone: result.direct_phone,
            enriched_at: new Date().toISOString(),
            enrichment_data: result.enrichment_data,
            // Update email if we found one and they didn't have one
            ...(result.email && !prospect.email ? { email: result.email } : {}),
          }).eq("id", prospect.id);

          enriched++;
          log("Batch enriched", { id: prospect.id, source: result.enrichment_source });

          // Rate limit: 500ms between prospects
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          log("Batch prospect error", { id: prospect.id, error: String(e) });
          failed++;
        }
      }

      return new Response(JSON.stringify({ ok: true, enriched, failed, total: pending.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── STATS MODE: Return enrichment statistics ──
    if (mode === "stats") {
      const [
        { count: total },
        { count: enriched },
        { count: pending },
        { count: noData },
      ] = await Promise.all([
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_status", "enriched"),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).or("enrichment_status.eq.pending,enrichment_status.is.null"),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_status", "no_data"),
      ]);

      // Source breakdown
      const sourceBreakdown: Record<string, number> = {};
      for (const source of ["hunter", "apollo", "snov", "lusha", "clay"]) {
        const { count } = await sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_source", source);
        sourceBreakdown[source] = count || 0;
      }

      return new Response(JSON.stringify({
        ok: true,
        total: total || 0,
        enriched: enriched || 0,
        pending: pending || 0,
        no_data: noData || 0,
        by_source: sourceBreakdown,
        apis_configured: {
          hunter: !!HUNTER_API_KEY,
          apollo: !!APOLLO_API_KEY,
          snov: !!SNOV_API_KEY,
          lusha: !!LUSHA_API_KEY,
          clay: !!CLAY_API_KEY,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SINGLE ENRICHMENT MODE ──
    const targetDomain = domain || (website ? extractDomain(website) : "");
    if (!targetDomain) {
      return new Response(JSON.stringify({ error: "domain or website required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await runWaterfall(targetDomain, business_name || "");

    // Update prospect_businesses if prospect_id provided
    if (prospect_id) {
      await sb.from("prospect_businesses").update({
        enrichment_source: result.enrichment_source,
        enrichment_status: result.email ? "enriched" : "no_data",
        verified_email: result.verified_email,
        decision_maker_name: result.decision_maker_name,
        decision_maker_title: result.decision_maker_title,
        direct_phone: result.direct_phone,
        enriched_at: new Date().toISOString(),
        enrichment_data: result.enrichment_data,
        ...(result.email ? { email: result.email } : {}),
      }).eq("id", prospect_id);
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[ENRICH]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: corsHeaders });
  }
});
