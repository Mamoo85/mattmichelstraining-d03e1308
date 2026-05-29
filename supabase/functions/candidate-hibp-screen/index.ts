// candidate-hibp-screen — HIBP "data hygiene" check for Talent Radar dossiers
// Looks up the candidate's email in Have I Been Pwned and surfaces a one-line risk note.
// Marketed as "Free background-data hygiene check on every candidate" for TechAlert clients.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";

async function hibpLookup(email: string): Promise<{ breaches: number; names: string[]; sensitive: number } | null> {
  if (!HIBP_API_KEY) return null;
  const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;
  try {
    const res = await fetch(url, {
      headers: { "hibp-api-key": HIBP_API_KEY, "user-agent": "DWA-TalentRadar/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return { breaches: 0, names: [], sensitive: 0 };
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr)) return { breaches: 0, names: [], sensitive: 0 };
    return {
      breaches: arr.length,
      names: arr.slice(0, 5).map((b: any) => b.Name),
      sensitive: arr.filter((b: any) => b.IsSensitive).length,
    };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { candidate_id } = await req.json();
    if (!candidate_id) return new Response(JSON.stringify({ ok: false, error: "candidate_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: cand, error } = await sb.from("hire_alert_candidates").select("id,name,email").eq("id", candidate_id).single();
    if (error || !cand) return new Response(JSON.stringify({ ok: false, error: "candidate not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    if (!cand.email) return new Response(JSON.stringify({ ok: true, skipped: "no email on candidate" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

    const result = await hibpLookup(cand.email);
    if (!result) return new Response(JSON.stringify({ ok: false, error: "HIBP lookup failed" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });

    let note: string;
    if (result.breaches === 0) note = "✅ No known breach exposure";
    else if (result.breaches <= 2) note = `⚠️ Appears in ${result.breaches} breach${result.breaches > 1 ? "es" : ""} (${result.names.join(", ")}) — low risk`;
    else note = `🚨 Appears in ${result.breaches} breaches${result.sensitive ? ` (${result.sensitive} sensitive)` : ""} — recommend security review before hire`;

    await sb.from("candidate_enrichment_log").insert({
      candidate_id, stage: 9, source: "hibp",
      hit_fields: result.breaches > 0 ? ["breach_count", "breach_names"] : [],
      success: true, cost_estimate: 0,
      raw_response: result,
    });

    return new Response(JSON.stringify({ ok: true, note, breaches: result.breaches, sample_names: result.names }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
