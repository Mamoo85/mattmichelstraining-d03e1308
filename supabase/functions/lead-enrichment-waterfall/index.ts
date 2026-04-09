import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const SNOV_API_KEY = Deno.env.get("SNOV_API_KEY") || "";
const SNOV_USER_ID = Deno.env.get("SNOV_USER_ID") || "";
const LUSHA_API_KEY = Deno.env.get("LUSHA_API_KEY") || "";
const CLAY_API_KEY = Deno.env.get("CLAY_API_KEY") || "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[ENRICH] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── HUNTER.IO ──
async function hunterSearch(domain: string) {
  if (!HUNTER_API_KEY || !domain) return null;
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}&limit=5`);
    const body = await res.text();
    if (!res.ok) { log("Hunter error", { status: res.status, body: body.slice(0, 200) }); return null; }
    const data = JSON.parse(body);
    const emails = data?.data?.emails || [];
    if (emails.length === 0) return null;
    const personal = emails.find((e: any) => e.type === "personal" && e.confidence >= 50);
    const best = personal || emails[0];
    return {
      email: best.value,
      name: `${best.first_name || ""} ${best.last_name || ""}`.trim() || null,
      title: best.position || null,
      confidence: best.confidence || 0,
      source: "hunter",
    };
  } catch (e) { log("Hunter exception", { error: String(e) }); return null; }
}

async function hunterVerify(email: string): Promise<boolean> {
  if (!HUNTER_API_KEY || !email) return false;
  try {
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`);
    if (!res.ok) return false;
    const data = await res.json();
    const result = data?.data?.result;
    return result === "deliverable" || result === "risky";
  } catch { return false; }
}

// ── APOLLO.IO — use v1/people/match (single lookup, more reliable than search) ──
async function apolloSearch(domain: string, businessName: string) {
  if (!APOLLO_API_KEY || !domain) return null;
  try {
    // Try people search with organization domain
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify({
        q_organization_domains: domain,
        page: 1,
        per_page: 3,
        person_seniorities: ["owner", "founder", "c_suite", "vp", "director"],
      }),
    });
    const body = await res.text();
    if (!res.ok) { log("Apollo error", { status: res.status, body: body.slice(0, 200) }); return null; }
    const data = JSON.parse(body);
    const person = data?.people?.[0];
    if (!person?.email) return null;
    return {
      email: person.email,
      name: `${person.first_name || ""} ${person.last_name || ""}`.trim() || null,
      title: person.title || null,
      source: "apollo",
    };
  } catch (e) { log("Apollo exception", { error: String(e) }); return null; }
}

// ── SNOV.IO — uses OAuth2 client_credentials flow ──
let _snovToken: string | null = null;
let _snovTokenExpiry = 0;

async function getSnovToken(): Promise<string | null> {
  if (_snovToken && Date.now() < _snovTokenExpiry) return _snovToken;
  if (!SNOV_USER_ID || !SNOV_API_KEY) return null;
  try {
    const res = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: SNOV_USER_ID, client_secret: SNOV_API_KEY }),
    });
    if (!res.ok) { log("Snov token error", { status: res.status }); return null; }
    const data = await res.json();
    _snovToken = data.access_token;
    _snovTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
    return _snovToken;
  } catch (e) { log("Snov token exception", { error: String(e) }); return null; }
}

async function snovSearch(domain: string) {
  const token = await getSnovToken();
  if (!token || !domain) return null;
  try {
    const res = await fetch("https://api.snov.io/v2/domain-emails-with-info", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain, limit: 5, type: "personal" }),
    });
    const body = await res.text();
    if (!res.ok) { log("Snov error", { status: res.status, body: body.slice(0, 200) }); return null; }
    const data = JSON.parse(body);
    const emails = data?.emails || data?.data?.emails || [];
    if (emails.length === 0) return null;
    const best = emails[0];
    return {
      email: best.email || best.value || "",
      name: `${best.firstName || best.first_name || ""} ${best.lastName || best.last_name || ""}`.trim() || null,
      title: best.position || best.title || null,
      source: "snov",
    };
  } catch (e) { log("Snov exception", { error: String(e) }); return null; }
}

// ── LUSHA — correct v2 API endpoint ──
async function lushaSearch(domain: string, businessName: string) {
  if (!LUSHA_API_KEY || !domain) return null;
  try {
    const res = await fetch("https://api.lusha.com/prospecting/api/v2/person/enrich", {
      method: "POST",
      headers: { "api_key": LUSHA_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ requestBody: { company: { domain } }, limit: 1, outputColumns: ["full_name", "email_address", "phone_number", "job_title"] }),
    });
    const body = await res.text();
    if (!res.ok) { log("Lusha error", { status: res.status, body: body.slice(0, 200) }); return null; }
    const data = JSON.parse(body);
    const contact = data?.data?.[0] || data?.contacts?.[0];
    if (!contact) return null;
    return {
      email: contact.email_address || contact.email || "",
      phone: contact.phone_number || contact.phone || "",
      name: contact.full_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || null,
      title: contact.job_title || contact.title || null,
      source: "lusha",
    };
  } catch (e) { log("Lusha exception", { error: String(e) }); return null; }
}

// ── CLAY.COM ──
async function clayEnrich(domain: string, businessName: string) {
  if (!CLAY_API_KEY || !domain) return null;
  try {
    const res = await fetch("https://api.clay.com/v3/sources/enrichments", {
      method: "POST",
      headers: { Authorization: `Bearer ${CLAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ domain, company_name: businessName, enrichment_type: "company_contacts" }),
    });
    const body = await res.text();
    if (!res.ok) { log("Clay error", { status: res.status, body: body.slice(0, 200) }); return null; }
    const data = JSON.parse(body);
    const contact = data?.results?.[0] || data?.data?.[0];
    if (!contact) return null;
    return {
      email: contact.email || contact.work_email || "",
      phone: contact.phone || contact.direct_phone || "",
      name: contact.full_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || null,
      title: contact.title || contact.job_title || null,
      source: "clay",
    };
  } catch (e) { log("Clay exception", { error: String(e) }); return null; }
}

// ── Email Pattern Guess: Generate common email patterns without needing API credits ──
async function guessEmail(domain: string, name: string | null, businessName: string): Promise<string | null> {
  if (!domain) return null;

  // Build candidate list based on common small business patterns
  const candidates: string[] = [];

  if (name) {
    const parts = name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const first = parts[0] || "";
    const last = parts[parts.length - 1] || "";
    if (first && last && first !== last) {
      candidates.push(`${first}@${domain}`);
      candidates.push(`${first}.${last}@${domain}`);
      candidates.push(`${first}${last}@${domain}`);
      candidates.push(`${first[0]}${last}@${domain}`);
    } else if (first) {
      candidates.push(`${first}@${domain}`);
    }
  }

  // Common generic addresses (most small businesses use these)
  candidates.push(`info@${domain}`, `contact@${domain}`, `hello@${domain}`,
    `office@${domain}`, `admin@${domain}`, `sales@${domain}`);

  // Try Hunter verify if available (even on free plan, verify has separate quota)
  if (HUNTER_API_KEY) {
    for (const email of candidates.slice(0, 4)) {
      const verified = await hunterVerify(email);
      if (verified) {
        log("Email pattern verified via Hunter", { email });
        return email;
      }
    }
  }

  // If Hunter is exhausted too, return the most likely generic — info@ is most common for SMBs
  // We can't verify but it's better than nothing
  const bestGuess = `info@${domain}`;
  log("Email pattern guess (unverified)", { email: bestGuess });
  return bestGuess;
}
    }
  }
  return null;
}

function extractDomain(url: string): string {
  try {
    let clean = url.trim();
    if (!clean.startsWith("http")) clean = `https://${clean}`;
    return new URL(clean).hostname.replace("www.", "");
  } catch { return ""; }
}

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
    email: null, verified_email: false, decision_maker_name: null,
    decision_maker_title: null, direct_phone: null, enrichment_source: "none",
    enrichment_data: {},
  };

  // Step 1: Hunter.io
  log("Step 1: Hunter.io", { domain });
  const hunterResult = await hunterSearch(domain);
  if (hunterResult?.email) {
    result.email = hunterResult.email;
    result.enrichment_source = "hunter";
    result.decision_maker_name = hunterResult.name;
    result.decision_maker_title = hunterResult.title;
    result.enrichment_data.hunter = hunterResult;
    const verified = await hunterVerify(hunterResult.email);
    result.verified_email = verified;
    log("Hunter found", { email: hunterResult.email, verified });
  }

  // Step 2: Apollo.io
  if (!result.email || !result.decision_maker_name) {
    log("Step 2: Apollo.io", { domain });
    const apolloResult = await apolloSearch(domain, businessName);
    if (apolloResult) {
      if (!result.email && apolloResult.email) { result.email = apolloResult.email; result.enrichment_source = "apollo"; }
      if (!result.decision_maker_name && apolloResult.name) result.decision_maker_name = apolloResult.name;
      if (!result.decision_maker_title && apolloResult.title) result.decision_maker_title = apolloResult.title;
      result.enrichment_data.apollo = apolloResult;
      log("Apollo found", apolloResult);
    }
  }

  // Step 3: Snov.io
  if (!result.email) {
    log("Step 3: Snov.io", { domain });
    const snovResult = await snovSearch(domain);
    if (snovResult?.email) {
      result.email = snovResult.email;
      result.enrichment_source = "snov";
      if (!result.decision_maker_name && snovResult.name) result.decision_maker_name = snovResult.name;
      if (!result.decision_maker_title && snovResult.title) result.decision_maker_title = snovResult.title;
      result.enrichment_data.snov = snovResult;
      log("Snov found", snovResult);
    }
  }

  // Step 4: Lusha
  if (!result.direct_phone || !result.email) {
    log("Step 4: Lusha", { domain });
    const lushaResult = await lushaSearch(domain, businessName);
    if (lushaResult) {
      if (lushaResult.phone) result.direct_phone = lushaResult.phone;
      if (!result.email && lushaResult.email) { result.email = lushaResult.email; result.enrichment_source = "lusha"; }
      if (!result.decision_maker_name && lushaResult.name) result.decision_maker_name = lushaResult.name;
      if (!result.decision_maker_title && lushaResult.title) result.decision_maker_title = lushaResult.title;
      result.enrichment_data.lusha = lushaResult;
      log("Lusha found", lushaResult);
    }
  }

  // Step 5: Clay.com
  if (!result.email || !result.direct_phone) {
    log("Step 5: Clay.com", { domain });
    const clayResult = await clayEnrich(domain, businessName);
    if (clayResult) {
      if (!result.email && clayResult.email) { result.email = clayResult.email; result.enrichment_source = "clay"; }
      if (!result.direct_phone && clayResult.phone) result.direct_phone = clayResult.phone;
      if (!result.decision_maker_name && clayResult.name) result.decision_maker_name = clayResult.name;
      if (!result.decision_maker_title && clayResult.title) result.decision_maker_title = clayResult.title;
      result.enrichment_data.clay = clayResult;
      log("Clay found", clayResult);
    }
  }

  // Step 6: AI email guess fallback — try Hunter email-finder or common patterns
  if (!result.email) {
    log("Step 6: Email guess fallback", { domain, name: result.decision_maker_name });
    const guessed = await guessAndVerifyEmail(domain, result.decision_maker_name);
    if (guessed) {
      result.email = guessed;
      result.enrichment_source = "email_guess";
      result.verified_email = true; // We verified it before returning
      log("Fallback email found", { email: guessed });
    }
  }

  log("Waterfall complete", { email: result.email, source: result.enrichment_source, name: result.decision_maker_name });
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { prospect_id, domain, business_name, website, mode, industry } = body;

    // ── BATCH MODE ──
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

      let enriched = 0, failed = 0;
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
            ...(result.email && !prospect.email ? { email: result.email } : {}),
          }).eq("id", prospect.id);
          enriched++;
          await new Promise(r => setTimeout(r, 500));
        } catch (e) { log("Batch error", { id: prospect.id, error: String(e) }); failed++; }
      }

      return new Response(JSON.stringify({ ok: true, enriched, failed, total: pending.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── STATS MODE ──
    if (mode === "stats") {
      const [t, e, p, n] = await Promise.all([
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_status", "enriched"),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).or("enrichment_status.eq.pending,enrichment_status.is.null"),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_status", "no_data"),
      ]);
      const sourceBreakdown: Record<string, number> = {};
      for (const source of ["hunter", "apollo", "snov", "lusha", "clay", "email_guess"]) {
        const { count } = await sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_source", source);
        sourceBreakdown[source] = count || 0;
      }
      return new Response(JSON.stringify({
        ok: true, total: t.count || 0, enriched: e.count || 0, pending: p.count || 0,
        no_data: n.count || 0, by_source: sourceBreakdown,
        apis_configured: { hunter: !!HUNTER_API_KEY, apollo: !!APOLLO_API_KEY, snov: !!(SNOV_API_KEY && SNOV_USER_ID), lusha: !!LUSHA_API_KEY, clay: !!CLAY_API_KEY },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SINGLE ENRICHMENT MODE (called by omni-lead-engine) ──
    const targetDomain = domain || (website ? extractDomain(website) : "");
    if (!targetDomain) {
      return new Response(JSON.stringify({ error: "domain or website required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await runWaterfall(targetDomain, business_name || "");

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

    return new Response(JSON.stringify({
      ok: true,
      email: result.email,
      verified_email: result.verified_email,
      contact_name: result.decision_maker_name,
      decision_maker_name: result.decision_maker_name,
      decision_maker_title: result.decision_maker_title,
      direct_phone: result.direct_phone,
      phone: result.direct_phone,
      enrichment_source: result.enrichment_source,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[ENRICH]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: corsHeaders });
  }
});
