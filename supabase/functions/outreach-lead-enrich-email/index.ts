// outreach-lead-enrich-email
// Looks up the best email for an outreach_leads row using the same waterfall
// pattern as contractor-outreach-enrich (Hunter → Snov pattern → site guess).
// Persists enriched_email, source, confidence, trace.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const SNOV_USER_ID = Deno.env.get("SNOV_USER_ID") || "";
const SNOV_SECRET = Deno.env.get("SNOV_SECRET") || "";

function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch { return null; }
}

function isPlaceholderDomain(d: string): boolean {
  const bad = ["facebook.com", "instagram.com", "yelp.com", "google.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com"];
  return bad.some(b => d.endsWith(b));
}

async function hunterDomainSearch(domain: string) {
  if (!HUNTER_API_KEY) return null;
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=5`);
    const data = await res.json();
    const emails = data?.data?.emails || [];
    const priority = ["owner", "ceo", "founder", "president", "manager", "general"];
    for (const role of priority) {
      const hit = emails.find((e: any) => (e.position || "").toLowerCase().includes(role));
      if (hit) return { email: hit.value, confidence: hit.confidence ?? 70, first: hit.first_name, last: hit.last_name };
    }
    if (emails[0]) return { email: emails[0].value, confidence: emails[0].confidence ?? 60, first: emails[0].first_name, last: emails[0].last_name };
    return null;
  } catch { return null; }
}

async function snovToken(): Promise<string | null> {
  if (!SNOV_USER_ID || !SNOV_SECRET) return null;
  try {
    const r = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_USER_ID}&client_secret=${SNOV_SECRET}`,
    });
    const d = await r.json();
    return d?.access_token || null;
  } catch { return null; }
}

async function snovDomainSearch(domain: string) {
  const tok = await snovToken();
  if (!tok) return null;
  try {
    const r = await fetch(`https://api.snov.io/v2/domain-emails-with-info?domain=${domain}&type=all&limit=5&access_token=${tok}`);
    const d = await r.json();
    const emails = d?.emails || [];
    if (emails[0]?.email) return { email: emails[0].email, confidence: 75, first: emails[0].firstName, last: emails[0].lastName };
    return null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { outreach_lead_id } = await req.json();
    if (!outreach_lead_id) {
      return new Response(JSON.stringify({ error: "outreach_lead_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: lead, error: lErr } = await supabase
      .from("outreach_leads")
      .select("id, business_name, website, city, industry, enriched_email, enrichment_trace, owner_name, first_name, last_name")
      .eq("id", outreach_lead_id)
      .single();
    if (lErr || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Already enriched? short-circuit.
    if (lead.enriched_email) {
      return new Response(JSON.stringify({ ok: true, email: lead.enriched_email, source: "cache", cached: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const trace: any[] = Array.isArray(lead.enrichment_trace) ? lead.enrichment_trace : [];
    const domain = extractDomain(lead.website);

    let email: string | null = null;
    let source: string | null = null;
    let confidence = 0;
    let owner = lead.owner_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null;

    if (!domain) {
      trace.push({ stage: "no_domain", ts: new Date().toISOString() });
    } else if (isPlaceholderDomain(domain)) {
      trace.push({ stage: "placeholder_domain", domain, ts: new Date().toISOString() });
    } else {
      // Stage 1: Snov
      const snov = await snovDomainSearch(domain);
      trace.push({ stage: "snov", domain, found: !!snov?.email, ts: new Date().toISOString() });
      if (snov?.email) {
        email = snov.email; source = "snov"; confidence = snov.confidence;
        if (!owner && (snov.first || snov.last)) owner = [snov.first, snov.last].filter(Boolean).join(" ");
      }

      // Stage 2: Hunter
      if (!email) {
        const hunter = await hunterDomainSearch(domain);
        trace.push({ stage: "hunter", domain, found: !!hunter?.email, ts: new Date().toISOString() });
        if (hunter?.email) {
          email = hunter.email; source = "hunter"; confidence = hunter.confidence;
          if (!owner && (hunter.first || hunter.last)) owner = [hunter.first, hunter.last].filter(Boolean).join(" ");
        }
      }

      // Stage 3: pattern guess (low confidence — operator should treat as best-effort)
      if (!email) {
        email = `info@${domain}`;
        source = "pattern_guess";
        confidence = 20;
        trace.push({ stage: "pattern_guess", email, ts: new Date().toISOString() });
      }
    }

    const update: Record<string, unknown> = {
      enrichment_trace: trace,
      enriched_email_at: new Date().toISOString(),
    };
    if (email) {
      update.enriched_email = email;
      update.enriched_email_source = source;
      update.enriched_email_confidence = confidence;
    }
    if (owner && !lead.owner_name) update.owner_name = owner;

    const { error: uErr } = await supabase
      .from("outreach_leads")
      .update(update)
      .eq("id", outreach_lead_id);
    if (uErr) throw uErr;

    return new Response(JSON.stringify({ ok: !!email, email, source, confidence, trace }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("outreach-lead-enrich-email error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
