// Read current Etsy shop title + announcement.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY")!;
  const ETSY_ACCESS_TOKEN = Deno.env.get("ETSY_ACCESS_TOKEN")!;
  const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID")!;
  try {
    const r = await fetch(`https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}`, {
      headers: { "x-api-key": ETSY_API_KEY, Authorization: `Bearer ${ETSY_ACCESS_TOKEN}` },
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
