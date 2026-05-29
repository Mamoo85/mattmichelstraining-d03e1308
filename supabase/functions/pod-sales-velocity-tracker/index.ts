// pod-sales-velocity-tracker — Printify Sales Velocity Ground-Truth Feedback Loop (#2)
// Cron: daily 8:30am UTC (after pod-price-spy, before pod-new-products)
//
// Fetches last 30 days of Printify orders, computes sales velocity per product type,
// stores in pod_sales_metrics. pod-new-products reads this to weight type selection
// toward proven sellers rather than static rotation.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[SALES-VELOCITY] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

type ProductType = "mug" | "tshirt" | "hoodie" | "sock" | "hat" | "mousepad" | "onesie" | "tumbler" | "blanket" | "sweatshirt" | "longsleeve" | "travelmug";

// Mirrors detectType from printify-product-creator
function detectType(blueprintId: number): ProductType {
  if (blueprintId === 68)   return "mug";
  if (blueprintId === 77)   return "hoodie";
  if (blueprintId === 365)  return "sock";
  if (blueprintId === 1447) return "hat";
  if (blueprintId === 608)  return "mousepad";
  if (blueprintId === 568)  return "onesie";
  if (blueprintId === 353)  return "tumbler";
  if (blueprintId === 238)  return "blanket";
  if (blueprintId === 49)   return "sweatshirt";
  if (blueprintId === 41)   return "longsleeve";
  if (blueprintId === 70)   return "travelmug";
  return "tshirt"; // default (blueprint 12 and unknowns)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN");
  const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!PRINTIFY_KEY) {
    return new Response(JSON.stringify({ error: "PRINTIFY_API_TOKEN not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const pHeaders = {
    Authorization: `Bearer ${PRINTIFY_KEY}`,
    "Content-Type": "application/json",
  };

  // Get shop ID
  let shopId = PRINTIFY_SHOP_ID ?? "";
  if (!shopId) {
    const shopsRes = await fetch("https://api.printify.com/v1/shops.json", {
      headers: pHeaders, signal: AbortSignal.timeout(10_000),
    });
    if (shopsRes.ok) {
      const shops = await shopsRes.json();
      shopId = String(shops?.[0]?.id ?? "");
    }
  }
  if (!shopId) {
    return new Response(JSON.stringify({ error: "Could not resolve Printify shop ID" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Fetch orders from last 30 days (paginated)
  const ordersByType: Record<string, { units7d: number; units30d: number }> = {};
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let page = 1;
  let totalOrders = 0;
  let hasMore = true;

  while (hasMore && page <= 10) { // max 10 pages = 1000 orders
    const ordersRes = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders.json?page=${page}&limit=100`,
      { headers: pHeaders, signal: AbortSignal.timeout(15_000) },
    );

    if (!ordersRes.ok) {
      log("Orders fetch failed", { page, status: ordersRes.status });
      break;
    }

    const ordersData = await ordersRes.json();
    const orders: Array<{
      created_at: string;
      line_items: Array<{ product_id: string; blueprint_id?: number; quantity: number }>;
    }> = ordersData.data ?? [];

    if (orders.length === 0) {
      hasMore = false;
      break;
    }

    // Check if oldest order in this page is older than 30 days
    const oldestOrder = orders[orders.length - 1];
    const oldestTime = new Date(oldestOrder.created_at).getTime();
    if (oldestTime < thirtyDaysAgo) hasMore = false;

    for (const order of orders) {
      const orderTime = new Date(order.created_at).getTime();
      if (orderTime < thirtyDaysAgo) continue;

      for (const item of order.line_items) {
        const blueprintId = item.blueprint_id ?? 0;
        const type = detectType(blueprintId);
        const qty = item.quantity ?? 1;

        if (!ordersByType[type]) ordersByType[type] = { units7d: 0, units30d: 0 };
        ordersByType[type].units30d += qty;
        if (orderTime >= sevenDaysAgo) ordersByType[type].units7d += qty;
        totalOrders++;
      }
    }

    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  log("Orders processed", { total: totalOrders, types: Object.keys(ordersByType) });

  // Compute velocity (units per day) and upsert
  const daysTracked = 30;
  let updated = 0;

  for (const [type, { units7d, units30d }] of Object.entries(ordersByType)) {
    const velocity = units30d / daysTracked;
    await sb.from("pod_sales_metrics").upsert({
      product_type: type,
      units_last_7d: units7d,
      units_last_30d: units30d,
      sales_velocity: velocity,
      updated_at: new Date().toISOString(),
    }, { onConflict: "product_type" });
    updated++;
    log("Updated metrics", { type, units30d, velocity: velocity.toFixed(3) });
  }

  // Zero out types with no sales (to avoid stale data)
  const allTypes: ProductType[] = ["mug", "tshirt", "hoodie", "sock", "hat", "mousepad", "onesie", "tumbler", "blanket", "sweatshirt", "longsleeve", "travelmug"];
  for (const type of allTypes) {
    if (!ordersByType[type]) {
      await sb.from("pod_sales_metrics").upsert({
        product_type: type,
        units_last_7d: 0,
        units_last_30d: 0,
        sales_velocity: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "product_type" });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    ordersProcessed: totalOrders,
    typesUpdated: updated,
    breakdown: ordersByType,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
