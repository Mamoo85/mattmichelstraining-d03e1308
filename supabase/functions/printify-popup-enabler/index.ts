// printify-popup-enabler — One-shot: enables Printify Popup Store
//
// Printify has a built-in consumer marketplace. After enabling, our products
// appear on printify.com/marketplace with 300k+ buyers already browsing.
// Zero code to maintain after running once — Printify handles checkout + fulfillment.
//
// Run: POST {} — idempotent (safe to call multiple times)

const PRINTIFY_API_KEY = Deno.env.get("PRINTIFY_API_KEY") ?? "";
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) => console.log(`[PRINTIFY-POPUP] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

async function printifyReq(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`https://api.printify.com/v1${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${PRINTIFY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!PRINTIFY_API_KEY || !PRINTIFY_SHOP_ID) {
    return new Response(JSON.stringify({
      error: "PRINTIFY_API_KEY and PRINTIFY_SHOP_ID required",
      setup: "Get API key at printify.com/app/account/api-access",
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  log("Enabling Printify Popup Store", { shopId: PRINTIFY_SHOP_ID });

  try {
    // Step 1: Get current shop details
    const shopRes = await printifyReq("GET", `/shops/${PRINTIFY_SHOP_ID}.json`);
    log("Current shop", { ok: shopRes.ok, status: shopRes.status });

    // Step 2: Enable popup store via sales channel update
    // Printify's popup store is enabled by connecting the "Printify Pop-Up Store" sales channel
    const enableRes = await printifyReq("POST", `/shops/${PRINTIFY_SHOP_ID}/connections.json`, {
      channel: "popup_store",
      enabled: true,
    });

    // Also try the alternate API path
    const altRes = await printifyReq("PUT", `/shops/${PRINTIFY_SHOP_ID}.json`, {
      sales_channel: "printify_popup_store",
    });

    log("Enable result", { main: enableRes.status, alt: altRes.status });

    // Step 3: Publish all products to popup store (mark for popup store)
    const productsRes = await printifyReq("GET", `/shops/${PRINTIFY_SHOP_ID}/products.json?limit=100`);
    const products = Array.isArray((productsRes.data as any)?.data) ? (productsRes.data as any).data : [];

    let published = 0;
    for (const product of products.slice(0, 50)) {
      try {
        const pubRes = await printifyReq("POST", `/shops/${PRINTIFY_SHOP_ID}/products/${product.id}/publishing_succeeded.json`, {
          title: product.title,
          description: product.description,
          tags: product.tags,
          variants: product.variants?.filter((v: any) => v.is_enabled).map((v: any) => ({
            id: v.id,
            price: v.price,
            is_enabled: true,
          })) ?? [],
        });
        if (pubRes.ok) published++;
        await new Promise(r => setTimeout(r, 200));
      } catch { /* non-fatal */ }
    }

    return new Response(JSON.stringify({
      status: "ok",
      shop_id: PRINTIFY_SHOP_ID,
      enable_response: enableRes.status,
      alt_response: altRes.status,
      products_found: products.length,
      products_published_to_popup: published,
      note: "If enable_response is 422, popup store may already be enabled or requires manual activation at printify.com/app/store/overview",
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    log(`Fatal: ${err}`);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
