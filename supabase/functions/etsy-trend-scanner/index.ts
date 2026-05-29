// etsy-trend-scanner v2 — full market coverage
// Runs daily at 9am UTC. Scans 15 niches per run (all product types),
// stores top 10 per niche in etsy_pod_trends, rotates through 250+ queries
// so the full library cycles every ~17 days.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[TREND-SCANNER-v2] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// Detect product type from a niche query string
function detectType(niche: string): string {
  const n = niche.toLowerCase();
  if (/\btumbler\b|stanley|travel cup|20oz|40oz/.test(n)) return "tumbler";
  if (/\bcandle\b/.test(n)) return "candle";
  if (/\bsock\b|\bsocks\b/.test(n)) return "sock";
  if (/\bhoodie\b|\bpullover\b/.test(n)) return "hoodie";
  if (/\bsweatshirt\b|\bcrewneck\b/.test(n)) return "sweatshirt";
  if (/\bhat\b|\bcap\b|\btrucker\b/.test(n)) return "hat";
  if (/\bpillow\b/.test(n)) return "pillow";
  if (/\bblanket\b|\bsherpa\b/.test(n)) return "blanket";
  if (/\bapron\b/.test(n)) return "apron";
  if (/\bornament\b/.test(n)) return "ornament";
  if (/\bjournal\b|\bnotebook\b/.test(n)) return "journal";
  if (/\bsticker\b/.test(n)) return "sticker";
  if (/poster|wall art|print|laundry sign/.test(n)) return "poster_v";
  if (/svg|printable|digital|download|cut file/.test(n)) return "digital";
  if (/\bshirt\b|\btee\b|\bt-shirt\b/.test(n)) return "tshirt";
  if (/\bmug\b|coffee cup/.test(n)) return "mug";
  return "other";
}

interface EtsyListing {
  listing_id: number;
  title: string;
  tags: string[];
  price?: { amount: number; divisor: number };
  num_favorers: number;
  images?: Array<{ url_570xN: string }>;
}

async function fetchTopListings(
  niche: string,
  apiKey: string,
): Promise<{ listings: EtsyListing[]; competitorCount: number }> {
  const url = new URL("https://openapi.etsy.com/v3/application/listings/active");
  url.searchParams.set("keywords", niche);
  url.searchParams.set("sort_on", "score");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "25");
  url.searchParams.set("includes", "Images");

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Etsy ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  const competitorCount: number = typeof data.count === "number" ? data.count : 0;
  const results: EtsyListing[] = data.results ?? [];
  return {
    listings: results
      .sort((a, b) => (b.num_favorers ?? 0) - (a.num_favorers ?? 0))
      .slice(0, 10), // top 10 per niche (was 5)
    competitorCount,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY");
  const ETSY_SHARED_SECRET = Deno.env.get("ETSY_SHARED_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ETSY_API_KEY) {
    return new Response(JSON.stringify({ error: "ETSY_API_KEY not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const ETSY_KEY = ETSY_SHARED_SECRET
    ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}`
    : ETSY_API_KEY;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Pull 15 niches: least-recently-scanned first → full 250-query cycle every ~17 days
  const { data: nicheRows, error: libErr } = await sb
    .from("pod_niche_library")
    .select("niche, product_type")
    .eq("active", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(15);

  if (libErr || !nicheRows?.length) {
    return new Response(JSON.stringify({ error: "Niche library empty", detail: libErr?.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log("Niches this run", nicheRows.map((r: { niche: string }) => r.niche));

  const inserted: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const nicheStats: Record<string, { stored: number; top_favs: number; type: string }> = {};

  for (const { niche, product_type } of nicheRows as { niche: string; product_type: string | null }[]) {
    const resolvedType = product_type ?? detectType(niche);
    try {
      const { listings, competitorCount } = await fetchTopListings(niche, ETSY_KEY);
      log(`"${niche}"`, { type: resolvedType, found: listings.length, competitors: competitorCount });

      let stored = 0;
      let totalFavorers = 0;

      for (const listing of listings) {
        totalFavorers += listing.num_favorers ?? 0;
        const { error } = await sb.from("etsy_pod_trends").insert({
          niche,
          product_type: resolvedType,
          listing_id: String(listing.listing_id),
          title: listing.title,
          tags: listing.tags ?? [],
          price_usd: listing.price
            ? listing.price.amount / listing.price.divisor
            : null,
          num_favorers: listing.num_favorers ?? 0,
          image_url: listing.images?.[0]?.url_570xN ?? null,
          competitor_count: competitorCount,
          source: "scanner_v2",
        });

        if (error) {
          if (error.code === "23505") {
            skipped.push(listing.title.slice(0, 40));
          } else {
            errors.push(`${niche}: ${error.message.slice(0, 60)}`);
          }
        } else {
          stored++;
          inserted.push(listing.title.slice(0, 40));
        }
      }

      nicheStats[niche] = {
        stored,
        top_favs: listings[0]?.num_favorers ?? 0,
        type: resolvedType,
      };

      // Update niche library: last_scanned_at + weighted score
      const avgFavorers = listings.length > 0 ? totalFavorers / listings.length : 0;
      const weightedScore = avgFavorers / Math.sqrt(Math.max(1, competitorCount));
      await sb.from("pod_niche_library").update({
        last_scanned_at: new Date().toISOString(),
        product_type: resolvedType,
        weighted_score_avg: weightedScore,
        total_scans: sb.rpc ? undefined : 1,
      }).eq("niche", niche);

    } catch (e) {
      const msg = (e as Error).message.slice(0, 100);
      log(`Error on "${niche}"`, msg);
      errors.push(`${niche}: ${msg}`);
    }

    // Polite pause between Etsy requests
    await new Promise((r) => setTimeout(r, 800));
  }

  log("Done", { inserted: inserted.length, skipped: skipped.length, errors: errors.length });

  return new Response(
    JSON.stringify({
      success: true,
      niches_scanned: nicheRows.length,
      listings_inserted: inserted.length,
      listings_skipped: skipped.length,
      errors: errors.length,
      niche_stats: nicheStats,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
