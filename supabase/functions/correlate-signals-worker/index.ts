// Signal correlation worker (E44).
// Walks recent industry_pulse_signals and calls the correlate_pulse_to_candidates
// RPC to populate signal_correlations. Cross-product link between Industry Pulse
// growth signals and live HireAlert candidates at the same employer.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Pulse signals from the last 48h with confidence >= 6
    const { data: signals, error } = await sb
      .from("industry_pulse_signals")
      .select("id, company_name, vertical, county, confidence")
      .gte("created_at", new Date(Date.now() - 48 * 3600_000).toISOString())
      .gte("confidence", 6)
      .not("company_name", "is", null)
      .limit(200);

    if (error) throw new Error(error.message ?? JSON.stringify(error));

    let correlated = 0;
    let pairs = 0;

    for (const s of signals ?? []) {
      const { data, error: rpcErr } = await sb.rpc("correlate_pulse_to_candidates", {
        p_pulse_id: s.id,
      });
      if (rpcErr) continue;
      correlated++;
      pairs += Number(data ?? 0);
    }

    return new Response(
      JSON.stringify({ ok: true, signals_processed: signals?.length ?? 0, correlated, pairs_created: pairs }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (typeof e === "object" ? JSON.stringify(e) : String(e));
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
