#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * calibrate-intelligence.ts
 * Local calibration tool for the Competitor Espionage & Intelligence Machine.
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/calibrate-intelligence.ts
 *
 * Requires .env file at repo root with:
 *   ETSY_API_KEY=...
 *   SUPABASE_URL=...            (optional — skips yesterday delta if absent)
 *   SUPABASE_SERVICE_ROLE_KEY=... (optional)
 *
 * What it does:
 *   - Calls Etsy Public API for all 20 seed shops
 *   - Falls back to HTML scrape if API returns no data
 *   - Fetches yesterday's review counts from DB (if SUPABASE creds present)
 *   - Outputs console.table with: shop_name, total_reviews, review_delta,
 *     estimated_daily_sales, avg_price_usd, estimated_daily_revenue, data_source
 */

// Load .env if present
try {
  const env = await Deno.readTextFile(".env").catch(() => "");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !Deno.env.get(key)) Deno.env.set(key, val);
  }
} catch { /* no .env — use real env vars */ }

const ETSY_API_KEY         = Deno.env.get("ETSY_API_KEY") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!ETSY_API_KEY) {
  console.error("ERROR: ETSY_API_KEY not set. Add it to .env or environment.");
  Deno.exit(1);
}

const SEED_SHOPS = [
  "PersonalizationMall",
  "CaitlynMinimalist",
  "ModParty",
  "TheCrownPrints",
  "PiperLouCollection",
  "Mugsby",
  "ZoeysAttic",
  "TheCreativeRaccoon",
  "TheSaltyHustle",
  "PlannerKate",
  "Shop3D",
  "DesignMakers",
  "NicheGiftCo",
  "SimplyNameIt",
  "ILYBDesigns",
  "Frostbeard",
  "BellaAndCanvasTees",
  "PrintAndClay",
  "LittleWeeShop",
  "TheMugBoutique",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];
let uaIdx = 0;

async function fetchShopApi(shopName: string): Promise<{
  total_reviews: number;
  active_listing_count: number;
  avg_listing_price_cents: number;
  etsy_shop_id: string;
  data_source: "api";
} | null> {
  try {
    const res = await fetch(
      `https://openapi.etsy.com/v3/application/shops?shop_name=${encodeURIComponent(shopName)}`,
      {
        headers: { "x-api-key": ETSY_API_KEY, Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const shop = data?.results?.[0];
    if (!shop) return null;

    const etsy_shop_id = String(shop.shop_id);
    await new Promise((r) => setTimeout(r, 400));

    let avg_listing_price_cents = 0;
    try {
      const listRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${etsy_shop_id}/listings?state=active&limit=25`,
        { headers: { "x-api-key": ETSY_API_KEY }, signal: AbortSignal.timeout(12_000) }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const prices = (listData?.results ?? [])
          .map((l: { price?: { amount?: number; divisor?: number } }) => {
            const a = l.price?.amount ?? 0;
            const d = l.price?.divisor ?? 100;
            return d > 0 ? Math.round((a / d) * 100) : 0;
          })
          .filter((p: number) => p > 0);
        if (prices.length > 0) {
          avg_listing_price_cents = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);
        }
      }
    } catch { /* skip avg price */ }

    return {
      total_reviews: Number(shop.review_count ?? 0),
      active_listing_count: Number(shop.listing_active_count ?? 0),
      avg_listing_price_cents,
      etsy_shop_id,
      data_source: "api",
    };
  } catch {
    return null;
  }
}

async function fetchShopScrape(shopName: string): Promise<{
  total_reviews: number;
  active_listing_count: number;
  avg_listing_price_cents: number;
  etsy_shop_id: string;
  data_source: "scrape";
} | null> {
  try {
    const res = await fetch(`https://www.etsy.com/shop/${encodeURIComponent(shopName)}`, {
      headers: { "User-Agent": USER_AGENTS[uaIdx++ % USER_AGENTS.length] },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    let total_reviews = 0;
    for (const pattern of [/(\d[\d,]+)\s+reviews?/i, /"reviewCount"\s*:\s*(\d+)/]) {
      const m = html.match(pattern);
      if (m) { total_reviews = parseInt(m[1].replace(/,/g, ""), 10); break; }
    }

    let active_listing_count = 0;
    const lm = html.match(/"listingCount"\s*:\s*(\d+)/) || html.match(/(\d+)\s+items?\s+from/i);
    if (lm) active_listing_count = parseInt(lm[1].replace(/,/g, ""), 10);

    const sm = html.match(/"shopId"\s*:\s*(\d+)/);
    const etsy_shop_id = sm ? sm[1] : "";

    if (total_reviews === 0) return null;
    return { total_reviews, active_listing_count, avg_listing_price_cents: 0, etsy_shop_id, data_source: "scrape" };
  } catch {
    return null;
  }
}

// Fetch yesterday metrics from DB (optional)
async function fetchYesterdayMetrics(): Promise<Map<string, number>> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return new Map();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shop_daily_metrics?select=shop_id,total_reviews&metric_date=eq.${yesterday}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!res.ok) return new Map();
    const rows = await res.json() as Array<{ shop_id: string; total_reviews: number }>;
    return new Map(rows.map((r) => [r.shop_id, r.total_reviews]));
  } catch {
    return new Map();
  }
}

// Main
console.log(`\n🔍 DWA Competitor Intelligence Calibration — ${new Date().toISOString()}\n`);
console.log(`API Key: ${ETSY_API_KEY.slice(0, 8)}...`);
console.log(`Processing ${SEED_SHOPS.length} shops...\n`);

const yesterdayMap = await fetchYesterdayMetrics();

type ResultRow = {
  shop_name: string;
  total_reviews: number | string;
  review_delta: number | string;
  est_daily_sales: number | string;
  avg_price_usd: string;
  est_daily_revenue: string;
  data_source: string;
};

const rows: ResultRow[] = [];

for (const shopName of SEED_SHOPS) {
  process.stdout.write?.(`  → ${shopName.padEnd(25)} `);

  let data = await fetchShopApi(shopName);
  if (!data) {
    await new Promise((r) => setTimeout(r, 600));
    const scrapeData = await fetchShopScrape(shopName);
    if (scrapeData) data = scrapeData as typeof data;
  }

  if (!data) {
    console.log("❌ no data");
    rows.push({ shop_name: shopName, total_reviews: "N/A", review_delta: "N/A", est_daily_sales: "N/A", avg_price_usd: "N/A", est_daily_revenue: "N/A", data_source: "failed" });
    await new Promise((r) => setTimeout(r, 400));
    continue;
  }

  const reviewDelta = Math.max(0, data.total_reviews - (yesterdayMap.get(data.etsy_shop_id) ?? 0));
  const estSales = parseFloat((reviewDelta * 4.5).toFixed(2));
  const avgPriceUsd = data.avg_listing_price_cents / 100;
  const estRevenue = parseFloat((estSales * avgPriceUsd).toFixed(2));

  console.log(`✅ ${data.total_reviews.toLocaleString()} reviews, $${avgPriceUsd.toFixed(2)} avg [${data.data_source}]`);

  rows.push({
    shop_name: shopName,
    total_reviews: data.total_reviews,
    review_delta: reviewDelta,
    est_daily_sales: estSales,
    avg_price_usd: `$${avgPriceUsd.toFixed(2)}`,
    est_daily_revenue: `$${estRevenue.toFixed(2)}`,
    data_source: data.data_source,
  });

  await new Promise((r) => setTimeout(r, 600));
}

console.log("\n📊 Intelligence Summary:\n");
console.table(rows);

// Revenue ranking
const ranked = rows
  .filter((r) => typeof r.est_daily_revenue === "string" && r.est_daily_revenue !== "N/A")
  .sort((a, b) => parseFloat(String(b.est_daily_revenue).replace("$", "")) - parseFloat(String(a.est_daily_revenue).replace("$", "")));

if (ranked.length > 0) {
  console.log("\n🏆 Revenue Ranking (estimated daily revenue):");
  ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.shop_name.padEnd(25)} ${r.est_daily_revenue} (${r.est_daily_sales} sales @ ${r.avg_price_usd})`);
  });
}

console.log("\nDone.\n");
