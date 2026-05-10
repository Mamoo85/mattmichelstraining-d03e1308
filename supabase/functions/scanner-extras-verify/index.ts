import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { runPhaseAExtras, SUPPORTED_PRODUCTS } from "../_shared/scanner-extras-dispatcher.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url);
    const product = url.searchParams.get("product") || "";
    if (product === "all") {
      const all = [];
      for (const p of SUPPORTED_PRODUCTS) {
        all.push(await runPhaseAExtras(p));
      }
      return new Response(JSON.stringify({ ok: true, all }, null, 2), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!SUPPORTED_PRODUCTS.includes(product)) {
      return new Response(
        JSON.stringify({ ok: false, error: "unknown product", supported: SUPPORTED_PRODUCTS }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    const result = await runPhaseAExtras(product);
    return new Response(JSON.stringify({ ok: true, ...result }, null, 2), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
