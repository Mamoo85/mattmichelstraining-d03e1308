// pod-price-spy — Real-time competitor price intelligence (#13)
// Cron: daily 8am UTC (before pod-new-products at 9am)
//
// Queries Etsy API for top listings in our core niches, builds price distributions
// (p25/median/p75) per product type, and stores in pod_market_prices.
// pod-new-products reads this table to set dynamic prices at p65 (above median).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-PRICE-SPY] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

type ProductType = "mug" | "tshirt" | "hoodie" | "tumbler" | "sock" | "hat" | "mousepad" | "onesie" | "blanket" | "sweatshirt" | "longsleeve" | "travelmug";

// Niches to sample per product type (1 per type = 12 Etsy calls/day, down from 36)
const SAMPLE_NICHES: Record<string, string[]> = {
  mug:        ["funny coffee mug gift"],
  tshirt:     ["funny graphic tee gift"],
  hoodie:     ["funny hoodie gift"],
  tumbler:    ["funny tumbler gift"],
  sock:       ["funny novelty socks"],
  hat:        ["funny dad hat"],
  mousepad:   ["funny mousepad desk"],
  onesie:     ["funny baby onesie"],
  blanket:    ["funny throw blanket gift"],
  sweatshirt: ["funny sweatshirt gift"],
  longsleeve: ["funny long sleeve shirt"],
  travelmug:  ["funny travel mug gift"],
};

function detectTypeFromNiche(niche: string): ProductType {
  const n = niche.toLowerCase();
  if (/tumbler/.test(n)) return "tumbler";
  if (/blanket/.test(n)) return "blanket";
  if (/sweatshirt/.test(n)) return "sweatshirt";
  if (/long sleeve|longsleeve/.test(n)) return "longsleeve";
  if (/travel mug|travelmug/.test(n)) return "travelmug";
  if (/\bmug\b|coffee mug/.test(n)) return "mug";
  if (/\bhoodie\b/.test(n)) return "hoodie";
  if (/\bsock\b/.test(n)) return "sock";
  if (/\bhat\b|\bcap\b/.test(n)) return "hat";
  if (/mousepad/.test(n)) return "mousepad";
  if (/onesie|bodysuit/.test(n)) return "onesie";
  return "tshirt";
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ETSY_API_KEY) {
    return new Response(JSON.stringify({ error: "ETSY_API_KEY not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const pricesByType: Record<string, number[]> = {};

  let totalFetched = 0;
  const errors: string[] = [];

  for (const [type, niches] of Object.entries(SAMPLE_NICHES)) {
    if (!pricesByType[type]) pricesByType[type] = [];

    for (const niche of niches) {
      try {
        const url = new URL("https://openapi.etsy.com/v3/application/listings/active");
        url.searchParams.set("keywords", niche);
        url.searchParams.set("sort_on", "score");
        url.searchParams.set("sort_order", "desc");
        url.searchParams.set("limit", "25");

        const res = await fetch(url.toString(), {
          headers: { "x-api-key": ETSY_API_KEY },
          signal: AbortSignal.timeout(12_000),
        });

        if (!res.ok) {
          errors.push(`Etsy ${res.status} for "${niche}"`);
          continue;
        }

        const data = await res.json();
        const listings: Array<{ price?: { amount: number; divisor: number } }> = data.results ?? [];

        for (const listing of listings) {
          if (listing.price) {
            const priceCents = Math.round((listing.price.amount / listing.price.divisor) * 100);
            if (priceCents > 100 && priceCents < 50000) {
              pricesByType[type].push(priceCents);
              totalFetched++;
            }
          }
        }

        await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        errors.push(`Fetch error for "${niche}": ${String(err).slice(0, 80)}`);
      }
    }
  }

  // Compute distributions and upsert
  const results: Array<{ type: string; median: number; p25: number; p75: number; samples: number }> = [];

  for (const [type, prices] of Object.entries(pricesByType)) {
    if (!prices.length) continue;
    const sorted = [...prices].sort((a, b) => a - b);
    const p25 = percentile(sorted, 25);
    const median = percentile(sorted, 50);
    const p75 = percentile(sorted, 75);

    await sb.from("pod_market_prices").upsert({
      product_type: type,
      p25_cents: p25,
      median_cents: median,
      p75_cents: p75,
      sample_size: sorted.length,
      recorded_at: new Date().toISOString(),
    }, { onConflict: "product_type" });

    results.push({ type, median, p25, p75, samples: sorted.length });
    log("Price distribution", { type, p25: `$${(p25/100).toFixed(2)}`, median: `$${(median/100).toFixed(2)}`, p75: `$${(p75/100).toFixed(2)}`, samples: sorted.length });
  }

  return new Response(JSON.stringify({
    success: true,
    totalListingsFetched: totalFetched,
    typesUpdated: results.length,
    distributions: results,
    errors: errors.slice(0, 10),
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
