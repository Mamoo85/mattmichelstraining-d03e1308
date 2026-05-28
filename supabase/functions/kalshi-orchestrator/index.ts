// Kalshi orchestrator — runs every minute, fans out to all enabled strategies.
// Each strategy is a pure function that produces 0..N Signals.
// MVP wires up Edge-A "highest success" strategies first (FedWatch, NWS temp, EIA, WASDE).
// More strategy modules will register themselves here as they're built.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/kalshi/risk.ts";
import { routeSignal, Signal } from "../_shared/kalshi/router.ts";

type StrategyFn = (sb: ReturnType<typeof adminClient>) => Promise<Signal[]>;

// Strategy registry. Stub functions for now — each Edge-A strategy gets its own
// module under _shared/kalshi/strategies/ as we build them out.
const REGISTRY: Record<string, StrategyFn> = {
  // Edge-A modules will be implemented one at a time. Each returns Signal[].
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = adminClient();
  const startedAt = Date.now();

  // Pull enabled strategies
  const { data: strategies, error } = await sb
    .from("kalshi_strategies")
    .select("id")
    .eq("enabled", true)
    .is("killed_at", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ strategy_id: string; signals: number; routed: number; reasons: string[] }> = [];

  for (const s of strategies ?? []) {
    const fn = REGISTRY[s.id];
    if (!fn) {
      results.push({ strategy_id: s.id, signals: 0, routed: 0, reasons: ["not_implemented"] });
      continue;
    }
    try {
      const signals = await fn(sb);
      let routed = 0;
      const reasons: string[] = [];
      for (const sig of signals) {
        const r = await routeSignal(sb, sig);
        if (r.ok) routed++;
        else reasons.push(r.reason ?? "unknown");
      }
      results.push({ strategy_id: s.id, signals: signals.length, routed, reasons });
    } catch (e) {
      results.push({
        strategy_id: s.id,
        signals: 0,
        routed: 0,
        reasons: [`error: ${(e as Error).message}`],
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      elapsed_ms: Date.now() - startedAt,
      strategies_run: results.length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
