// pod-stats-collector — Etsy listing stats attribution (#9)
// Cron: daily 7am UTC (before pod-seo-agent at 2pm)
//
// Fetches real views/favorites/sales data from Etsy Stats API for all live listings.
// Stores in pod_listing_stats. pod-seo-agent reads this table to prioritize:
//   - underperformers (high views, low conversion) → aggressive SEO rework
//   - strong converters (>3% conversion) → price escalation instead of SEO
//   - dead listings (<10 views in 14 days) → full title/tag regeneration
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-STATS-COLLECTOR] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (!ETSY_API_KEY) {
    return new Response(JSON.stringify({ error: "ETSY_API_KEY not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Load OAuth token for authenticated requests (stats API requires OAuth)
  const { data: tokenRow } = await sb
    .from("etsy_oauth_tokens")
    .select("access_token, refresh_token, expires_at, shop_id, user_id, id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRow?.access_token) {
    return new Response(JSON.stringify({
      error: "No Etsy OAuth tokens — complete OAuth flow first",
      note: "pod-stats-collector requires OAuth for listing stats API",
    }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Auto-refresh token if expired
  let accessToken = tokenRow.access_token;
  const clientId = ETSY_API_KEY.split(":")[0];
  const needsRefresh = Date.now() >= new Date(tokenRow.expires_at).getTime() - 5 * 60 * 1000;

  if (needsRefresh) {
    const refreshRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: tokenRow.refresh_token,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (refreshRes.ok) {
      const rd = await refreshRes.json();
      accessToken = rd.access_token;
      await sb.from("etsy_oauth_tokens").update({
        access_token: accessToken,
        refresh_token: rd.refresh_token ?? tokenRow.refresh_token,
        expires_at: new Date(Date.now() + (rd.expires_in ?? 3600) * 1000).toISOString(),
      }).eq("id", tokenRow.id);
    }
  }

  const etsyHeaders = { "x-api-key": ETSY_API_KEY, Authorization: `Bearer ${accessToken}` };

  // Get shop ID
  let shopId = tokenRow.shop_id ?? "";
  if (!shopId) {
    const shopRes = await fetch(
      `https://openapi.etsy.com/v3/application/users/${tokenRow.user_id}/shops`,
      { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
    ).catch(() => null);
    if (shopRes?.ok) {
      const sd = await shopRes.json();
      shopId = String(sd?.shop_id ?? sd?.results?.[0]?.shop_id ?? "");
    }
    if (!shopId) {
      return new Response(JSON.stringify({ error: "Could not resolve shop_id" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  // Fetch all published pod_listings
  const { data: listings } = await sb
    .from("pod_listings")
    .select("id, etsy_listing_id, title")
    .eq("status", "published")
    .not("etsy_listing_id", "is", null)
    .limit(200);

  if (!listings || listings.length === 0) {
    return new Response(JSON.stringify({ success: true, message: "No published listings found", updated: 0 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log("Collecting stats", { count: listings.length });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  let updated = 0;
  const errors: string[] = [];

  // Process in batches of 10 to avoid rate limits
  for (let i = 0; i < Math.min(listings.length, 50); i++) {
    const listing = listings[i];
    try {
      // Fetch listing stats
      const statsUrl = new URL(`https://openapi.etsy.com/v3/application/listings/${listing.etsy_listing_id}/stats`);
      statsUrl.searchParams.set("unit", "day");
      statsUrl.searchParams.set("start_date", sevenDaysAgo);
      statsUrl.searchParams.set("end_date", today);

      const statsRes = await fetch(statsUrl.toString(), {
        headers: etsyHeaders,
        signal: AbortSignal.timeout(10_000),
      });

      if (!statsRes.ok) {
        if (statsRes.status !== 404) {
          errors.push(`Stats ${statsRes.status} for ${listing.etsy_listing_id}`);
        }
        continue;
      }

      const statsData = await statsRes.json();
      const views = statsData.data?.views ?? 0;
      const favorites = statsData.data?.favorites ?? 0;

      // Fetch listing detail for num_sold
      const detailRes = await fetch(
        `https://openapi.etsy.com/v3/application/listings/${listing.etsy_listing_id}`,
        { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
      );
      let numSold = 0;
      let currentPriceCents = 0;
      if (detailRes.ok) {
        const detail = await detailRes.json();
        numSold = detail.num_sold ?? 0;
        currentPriceCents = detail.price
          ? Math.round((detail.price.amount / detail.price.divisor) * 100)
          : 0;
      }

      const conversionRate = views > 0 ? (numSold / views) * 100 : 0;

      await sb.from("pod_listing_stats").insert({
        etsy_listing_id: listing.etsy_listing_id,
        views,
        favorites,
        conversion_rate: conversionRate,
        num_sold: numSold,
        revenue_cents: currentPriceCents * numSold,
        recorded_at: new Date().toISOString(),
      });

      updated++;
      if (i % 10 === 0) log("Progress", { processed: i + 1, total: Math.min(listings.length, 50) });
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      errors.push(`Error for ${listing.etsy_listing_id}: ${String(err).slice(0, 80)}`);
    }
  }

  log("Done", { updated, errors: errors.length });
  return new Response(JSON.stringify({
    success: true,
    updated,
    totalListings: listings.length,
    errors: errors.slice(0, 5),
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
