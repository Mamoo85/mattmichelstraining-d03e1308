// Contractor Outreach: enrich a prospect's email via Hunter → PDL → pattern guess.
// Lightweight version of the unified waterfall, focused on domain-based discovery.
//
// Sprint E hardening: every external call wrapped with safeJson + typed parsers,
// fetchWithRetry for 429 handling, response bodies always cancelled on early exit
// (Deno resource leak prevention), enrichment_trace defensively parsed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry } from "../_shared/fetch-with-retry.ts";
import {
  safeJson,
  parseHunterDomainSearch,
  parsePdlPersonSearch,
  parseEnrichmentTrace,
  asEmail,
} from "../_shared/safe-parse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
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
    const res = await fetchWithRetry(
      "https://api.peopledatalabs.com/v5/person/search",
      {
        method: "POST",
        headers: { "X-Api-Key": PDL_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      },
      { label: "PDL-Search-Lite", maxRetries: 2 },
    );
    if (!res.ok) { await res.body?.cancel(); return null; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return null;
    const r = parsePdlPersonSearch(parsed.value);
    if (!r.ok) return null;
    return { email: r.value.email, phone: r.value.phone, confidence: r.value.confidence / 100 };
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
    const res = await fetchWithRetry(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}&limit=5`,
      { signal: AbortSignal.timeout(6000) },
      { label: "Hunter-Lite", maxRetries: 2 },
    );
    if (!res.ok) { await res.body?.cancel(); return null; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return null;
    const r = parseHunterDomainSearch(parsed.value);
    if (!r.ok) return null;
    // Prefer owner/CEO/manager/founder
    const priority = ["owner", "ceo", "founder", "president", "manager", "general"];
    for (const role of priority) {
      const hit = r.value.find((e) => (e.position ?? "").toLowerCase().includes(role));
      if (hit && asEmail(hit.email)) return { email: hit.email, first: hit.first, last: hit.last };
    }
    const first = r.value[0];
    if (first && asEmail(first.email)) return { email: first.email, first: first.first, last: first.last };
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

    let phone: string | null = prospect.phone;

    // PDL name-only fallback (healthcare records: RN/CNA/LPN with no business+city domain)
    if (!email && prospect.owner_name) {
      const pdl = await pdlNameOnlySearch(prospect.owner_name, prospect.city, prospect.state);
      trace.push({ stage: "pdl_name_only", name: prospect.owner_name, found: !!(pdl?.email || pdl?.phone), confidence: pdl?.confidence ?? 0, ts: new Date().toISOString() });
      if (pdl?.email) { email = pdl.email; verified = true; }
      if (pdl?.phone && !phone) phone = pdl.phone;
    }

    // Fallback: pattern guess info@domain
    if (!email && domain) {
      email = `info@${domain}`;
      verified = false;
      trace.push({ stage: "pattern_guess", email, confidence: 0.3, ts: new Date().toISOString() });
    }

    const { data: updated, error: uErr } = await supabase
      .from("contractor_outreach_prospects")
      .update({
        email,
        email_verified: verified,
        owner_name: owner,
        phone,
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
