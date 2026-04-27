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
