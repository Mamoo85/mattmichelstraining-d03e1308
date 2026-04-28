// Contractor Outreach: enrich a prospect's email via Hunter → Snov → pattern guess.
// Lightweight version of the unified waterfall, focused on domain-based discovery.
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
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";

async function pdlNameOnlySearch(name: string, city?: string | null, state?: string | null):
  Promise<{ email?: string; phone?: string; confidence: number } | null> {
  if (!PDL_API_KEY || !name) return null;
  try {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const sql: string[] = [`first_name='${parts[0].replace(/'/g, "")}'`, `last_name='${parts.slice(-1)[0].replace(/'/g, "")}'`];
    if (city) sql.push(`location_locality='${city.replace(/'/g, "")}'`);
    if (state) sql.push(`location_region='${state.replace(/'/g, "")}'`);
    const body = { sql: `SELECT * FROM person WHERE ${sql.join(" AND ")}`, size: 1 };
    const res = await fetch("https://api.peopledatalabs.com/v5/person/search", {
      method: "POST",
      headers: { "X-Api-Key": PDL_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.data?.[0];
    if (!hit) return null;
    const email = hit.work_email || hit.personal_emails?.[0] || null;
    const phone = hit.mobile_phone || hit.phone_numbers?.[0] || null;
    if (!email && !phone) return null;
    return { email: email || undefined, phone: phone || undefined, confidence: 0.7 };
  } catch { return null; }
}

function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch { return null; }
}

async function hunterDomainSearch(domain: string): Promise<{ email?: string; first?: string; last?: string } | null> {
  if (!HUNTER_API_KEY) return null;
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=5`);
    const data = await res.json();
    const emails = data?.data?.emails || [];
    // Prefer owner/CEO/manager/founder
    const priority = ["owner", "ceo", "founder", "president", "manager", "general"];
    for (const role of priority) {
      const hit = emails.find((e: any) => (e.position || "").toLowerCase().includes(role));
      if (hit) return { email: hit.value, first: hit.first_name, last: hit.last_name };
    }
    if (emails[0]) return { email: emails[0].value, first: emails[0].first_name, last: emails[0].last_name };
    return null;
  } catch { return null; }
}

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

    const trace: any[] = Array.isArray(prospect.enrichment_trace) ? prospect.enrichment_trace : [];
    const domain = extractDomain(prospect.website);

    let email: string | null = prospect.email;
    let owner: string | null = prospect.owner_name;
    let verified = !!prospect.email_verified;

    if (!email && domain) {
      const hunter = await hunterDomainSearch(domain);
      trace.push({ stage: "hunter", domain, found: !!hunter?.email, ts: new Date().toISOString() });
      if (hunter?.email) {
        email = hunter.email;
        verified = true;
        if (!owner && (hunter.first || hunter.last)) {
          owner = [hunter.first, hunter.last].filter(Boolean).join(" ");
        }
      }
    }

    // Fallback: pattern guess info@domain
    if (!email && domain) {
      email = `info@${domain}`;
      verified = false;
      trace.push({ stage: "pattern_guess", email, ts: new Date().toISOString() });
    }

    const { data: updated, error: uErr } = await supabase
      .from("contractor_outreach_prospects")
      .update({
        email,
        email_verified: verified,
        owner_name: owner,
        enriched_at: new Date().toISOString(),
        enrichment_trace: trace,
      })
      .eq("id", prospect_id)
      .select()
      .single();

    if (uErr) throw uErr;

    return new Response(JSON.stringify({ ok: true, prospect: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("contractor-outreach-enrich error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
