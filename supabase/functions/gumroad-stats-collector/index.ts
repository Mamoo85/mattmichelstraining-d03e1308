// gumroad-stats-collector — Daily Gumroad sales + view stats collector
//
// Writes to gumroad_stats table for dashboard visibility.
// Cron: daily 7am UTC
//
// Gumroad API v2:
//   GET /v2/sales?before=<date>&after=<date> — sales in date range
//   GET /v2/products — all products with view_count

import { createClient } from "npm:@supabase/supabase-js@2";

const GUMROAD_TOKEN = Deno.env.get("GUMROAD_ACCESS_TOKEN") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[GUMROAD-STATS] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

async function gumroadGet(path: string): Promise<unknown> {
  const res = await fetch(`https://api.gumroad.com/v2${path}`, {
    headers: { "Authorization": `Bearer ${GUMROAD_TOKEN}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Gumroad ${path} → ${res.status}`);
  return res.json();
}

async function fetchAllSales(after: string, before: string): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  let page = 1;
  while (true) {
    const data = await gumroadGet(`/sales?after=${after}&before=${before}&page=${page}`) as any;
    const sales = Array.isArray(data?.sales) ? data.sales : [];
    all.push(...sales);
    if (!data?.next_page_url || sales.length === 0) break;
    page++;
    if (page > 10) break;
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!GUMROAD_TOKEN) {
    return new Response(JSON.stringify({
      error: "GUMROAD_ACCESS_TOKEN required",
      setup: "gumroad.com → Settings → Advanced → Generate Access Token. Set as GUMROAD_ACCESS_TOKEN in Supabase secrets.",
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  log("Collecting Gumroad stats");

  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const afterStr = yesterday.toISOString().split("T")[0];
    const beforeStr = today.toISOString().split("T")[0];
    const dateLabel = afterStr;

    const [salesData, productsData] = await Promise.all([
      fetchAllSales(afterStr, beforeStr).catch(() => []),
      gumroadGet("/products").catch(() => ({ products: [] })),
    ]);

    const sales = salesData as Array<Record<string, unknown>>;
    const products = Array.isArray((productsData as any)?.products) ? (productsData as any).products : [];

    // Aggregate daily sales stats
    const totalRevenueCents = sales.reduce((sum, s: any) => sum + ((s.price || 0)), 0);
    const totalUnits = sales.length;
    const uniqueProducts = new Set(sales.map((s: any) => s.product_id)).size;

    // Total lifetime stats from products
    const totalViews = products.reduce((sum: number, p: any) => sum + (p.view_count || 0), 0);
    const totalSalesAllTime = products.reduce((sum: number, p: any) => sum + (p.sales_count || 0), 0);
    const totalRevAllTime = products.reduce((sum: number, p: any) => sum + (p.revenue || 0), 0);

    log("Stats", { date: dateLabel, units: totalUnits, revenueCents: totalRevenueCents, products: products.length });

    // Upsert daily row
    await sb.from("gumroad_stats" as any).upsert({
      date: dateLabel,
      sales_count: totalUnits,
      revenue_cents: totalRevenueCents,
      unique_products_sold: uniqueProducts,
      total_views_lifetime: totalViews,
      total_sales_lifetime: totalSalesAllTime,
      total_revenue_lifetime_cents: totalRevAllTime,
      product_count: products.length,
      raw_sales: JSON.stringify(sales.slice(0, 100)),
    }, { onConflict: "date" }).catch((e: unknown) => log("Upsert error", { error: String(e) }));

    // Also update per-product stats in gumroad_digital_products
    for (const p of products) {
      await sb.from("gumroad_digital_products" as any)
        .update({
          view_count: p.view_count ?? 0,
          sales_count: p.sales_count ?? 0,
        })
        .eq("gumroad_id", p.id)
        .catch(() => {});
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "gumroad-stats-collector",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ date: dateLabel, sales: totalUnits, products: products.length }),
    }, { onConflict: "agent_name" }).catch(() => {});

    return new Response(JSON.stringify({
      status: "ok",
      date: dateLabel,
      daily_sales: totalUnits,
      daily_revenue_cents: totalRevenueCents,
      daily_revenue_usd: (totalRevenueCents / 100).toFixed(2),
      unique_products_sold_today: uniqueProducts,
      total_products: products.length,
      total_views_lifetime: totalViews,
      total_sales_lifetime: totalSalesAllTime,
      total_revenue_lifetime_usd: (totalRevAllTime / 100).toFixed(2),
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    log(`Fatal: ${err}`);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
