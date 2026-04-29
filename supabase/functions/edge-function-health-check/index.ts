// Pings every public edge function endpoint and records status into edge_health_events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Read-only endpoints that should respond OK or 405 to a HEAD/OPTIONS probe.
// Add to this list as new public functions ship.
const ENDPOINTS = [
  "visitor-identify",
  "claim-session",
  "missed-call-status",
  "create-mortgage-radar-checkout",
  "check-mortgage-radar-zips",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const results = await Promise.all(ENDPOINTS.map(async (fn) => {
    const url = `${SUPABASE_URL}/functions/v1/${fn}`;
    const t0 = Date.now();
    let status = 0;
    let ok = false;
    let error: string | null = null;
    try {
      const r = await fetch(url, { method: "OPTIONS", signal: AbortSignal.timeout(8_000) });
      status = r.status;
      ok = r.status < 500;
      await r.text().catch(() => "");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const latency_ms = Date.now() - t0;
    await (sb.from as any)("edge_health_events").insert({
      function_name: fn, http_status: status, ok, latency_ms, error,
    });
    return { fn, status, ok, latency_ms, error };
  }));

  const failing = results.filter((r) => !r.ok);
  return new Response(JSON.stringify({ ok: failing.length === 0, results, failing_count: failing.length }), {
    status: failing.length > 0 ? 207 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
