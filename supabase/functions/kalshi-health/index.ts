// Kalshi health check — verifies API key works, returns balance + market count.
// v2 — force cold start after secrets propagation
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getBalance, listMarkets, isConfigured, KALSHI_BASE } from "../_shared/kalshi/client.ts";

// Debug: report whether env vars are visible at module scope
const _DEBUG_KEY_ID_LEN = (Deno.env.get("KALSHI_API_KEY_ID") ?? "").length;
const _DEBUG_PEM_LEN = (Deno.env.get("KALSHI_PRIVATE_KEY_PEM") ?? "").length;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isConfigured()) {
    return new Response(
      JSON.stringify({
        ok: false,
        configured: false,
        base: KALSHI_BASE,
        message: "KALSHI_API_KEY_ID and KALSHI_PRIVATE_KEY_PEM not set",
        debug: { key_id_len: _DEBUG_KEY_ID_LEN, pem_len: _DEBUG_PEM_LEN },
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
