// Kalshi health check — verifies API key works, returns balance + market count.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getBalance, listMarkets, isConfigured, KALSHI_BASE } from "../_shared/kalshi/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isConfigured()) {
    return new Response(
      JSON.stringify({
        ok: false,
        configured: false,
        base: KALSHI_BASE,
        message: "KALSHI_API_KEY_ID and KALSHI_PRIVATE_KEY_PEM not set",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const [bal, mkts] = await Promise.all([
      getBalance(),
      listMarkets({ status: "open", limit: 5 }),
    ]);
    return new Response(
      JSON.stringify({
        ok: true,
        configured: true,
        base: KALSHI_BASE,
        balance_cents: bal.balance,
        sample_markets: mkts.markets?.map((m) => ({ ticker: m.ticker, yes_ask: m.yes_ask })) ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, configured: true, error: (e as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
