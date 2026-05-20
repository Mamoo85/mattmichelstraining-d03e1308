// Read current Etsy shop title + announcement (uses OAuth tokens from DB).
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { apiKey, accessToken, shopId } = await getEtsyAuth();
    if (!shopId) throw new Error("No shop_id — reconnect Etsy");
    const r = await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}`, {
      headers: { "x-api-key": apiKey, Authorization: `Bearer ${accessToken}` },
    });
    const body = await r.text();
    if (!r.ok) throw new Error(`etsy ${r.status}: ${body}`);
    const d = JSON.parse(body);
    return new Response(JSON.stringify({
      ok: true,
      shop_id: d.shop_id,
      shop_name: d.shop_name,
      title: d.title ?? "",
      announcement: d.announcement ?? "",
      digital_listing_count: d.digital_listing_count,
      listing_active_count: d.listing_active_count,
      url: d.url,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
