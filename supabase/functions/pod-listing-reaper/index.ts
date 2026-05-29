// pod-listing-reaper v1
// Cron: 0 6 1 * * (monthly on the 1st at 6am UTC)
//
// Auto-retires dead Etsy listings:
//   60–89 days old + 0 sales → drop price 15% (once), record in pod_agent_state
//   90+ days old + 0 sales + price already dropped → deactivate listing (DELETE)
//
// Processes max 20 listings per run to stay under 150s timeout.
// Uses Etsy receipts endpoint to detect sales (most reliable approach).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[LISTING-REAPER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

const MAX_PER_RUN = 20;

/** Round price in cents to the nearest $0.50 */
function roundToHalfDollar(cents: number): number {
  return Math.round(cents / 50) * 50;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const clientId = ETSY_API_KEY.split(":")[0];

  if (!clientId) {
    return new Response(JSON.stringify({ error: "ETSY_API_KEY not set" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 1. Load tokens from DB ─────────────────────────────────────────────────
  const { data: tokenRow, error: tokenErr } = await sb
    .from("etsy_oauth_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return new Response(JSON.stringify({ error: "No Etsy OAuth tokens found — complete OAuth flow first" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 2. Refresh token if expired (or expiring within 5 min) ────────────────
  let accessToken: string = tokenRow.access_token;
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const needsRefresh = Date.now() >= expiresAt - 5 * 60 * 1000;

  if (needsRefresh) {
    log("Token expired or expiring — refreshing");
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

    if (!refreshRes.ok) {
      const errBody = await refreshRes.text().catch(() => "");
      log("Token refresh failed", { status: refreshRes.status, body: errBody.slice(0, 200) });
      return new Response(JSON.stringify({ error: "Token refresh failed — re-run OAuth flow", detail: errBody.slice(0, 200) }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const refreshData = await refreshRes.json();
    accessToken = refreshData.access_token;
    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString();

    await sb.from("etsy_oauth_tokens").update({
      access_token: accessToken,
      refresh_token: refreshData.refresh_token ?? tokenRow.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);

    log("Token refreshed successfully", { expiresAt: newExpiresAt });
  }

  const etsyHeaders = {
    "x-api-key": ETSY_API_KEY,
    Authorization: `Bearer ${accessToken}`,
  };

  // ── 3. Resolve shop_id if missing ─────────────────────────────────────────
  let shopId: string = tokenRow.shop_id ?? "";

  if (!shopId) {
    log("shop_id missing — resolving from API");
    try {
      const userId = tokenRow.user_id;
      if (userId) {
        const shopRes = await fetch(
          `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
          { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
        );
        const shopData = await shopRes.json();
        shopId = String(shopData?.shop_id ?? shopData?.results?.[0]?.shop_id ?? "");
      }
      if (!shopId) {
        const meRes = await fetch("https://openapi.etsy.com/v3/application/users/me", {
          headers: etsyHeaders, signal: AbortSignal.timeout(10_000),
        });
        const me = await meRes.json();
        const meUserId = String(me.user_id ?? "");
        if (meUserId) {
          const shopRes2 = await fetch(
            `https://openapi.etsy.com/v3/application/users/${meUserId}/shops`,
            { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
          );
          const shopData2 = await shopRes2.json();
          shopId = String(shopData2?.shop_id ?? shopData2?.results?.[0]?.shop_id ?? "");
        }
      }
      if (shopId) {
        await sb.from("etsy_oauth_tokens").update({ shop_id: shopId, updated_at: new Date().toISOString() }).eq("id", tokenRow.id);
        log("shop_id resolved and stored", { shopId });
      }
    } catch (e) {
      log("shop_id resolution failed", { error: String(e) });
    }
  }

  if (!shopId) {
    return new Response(JSON.stringify({ error: "Could not resolve shop_id — set it manually in etsy_oauth_tokens" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 4. Load current pod_agent_state keys ──────────────────────────────────
  const { data: agentStateRows } = await sb
    .from("pod_agent_state")
    .select("key, value");

  const agentState = new Map<string, string>(
    (agentStateRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
  );

  // ── 5. Fetch active listings (paginated, collect up to MAX_PER_RUN) ────────
  log("Fetching active listings");

  type EtsyListing = {
    listing_id: number;
    title: string;
    created_timestamp: number; // Unix epoch seconds
    price: { amount: number; divisor: number; currency_code: string };
    quantity: number;
  };

  const listings: EtsyListing[] = [];
  let offset = 0;

  while (listings.length < MAX_PER_RUN) {
    const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active?limit=100&offset=${offset}`;
    const res = await fetch(url, { headers: etsyHeaders, signal: AbortSignal.timeout(15_000) }).catch(() => null);

    if (!res?.ok) {
      log("Listings fetch failed", { status: res?.status, offset });
      break;
    }

    const data = await res.json();
    const results: EtsyListing[] = data?.results ?? [];
    if (results.length === 0) break;

    listings.push(...results);
    if (results.length < 100) break; // last page
    offset += 100;
    await new Promise((r) => setTimeout(r, 300));
  }

  log("Active listings fetched", { total: listings.length });

  const nowSec = Math.floor(Date.now() / 1000);
  const day60 = 60 * 24 * 60 * 60;   // 60 days in seconds
  const day90 = 90 * 24 * 60 * 60;   // 90 days in seconds

  // Pick candidates: only listings 60+ days old (nothing younger)
  const candidates = listings
    .filter((l) => nowSec - l.created_timestamp >= day60)
    .slice(0, MAX_PER_RUN);

  log("Candidates (60+ days old)", { count: candidates.length });

  let priceDropped = 0;
  let deactivated = 0;
  let skipped = 0;
  let processed = 0;

  for (const listing of candidates) {
    processed++;
    const ageSec = nowSec - listing.created_timestamp;
    const listingId = listing.listing_id;
    const priceDropKey = `price_dropped_${listingId}`;
    const alreadyDropped = agentState.has(priceDropKey);

    // ── 5a. Check for sales via receipts API ─────────────────────────────────
    const receiptsUrl = `https://openapi.etsy.com/v3/application/shops/${shopId}/receipts?listing_id=${listingId}&limit=1`;
    const receiptsRes = await fetch(receiptsUrl, {
      headers: etsyHeaders,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    let hasSales = false;
    if (receiptsRes?.ok) {
      const receiptsData = await receiptsRes.json();
      hasSales = (receiptsData?.count ?? (receiptsData?.results?.length ?? 0)) > 0;
    } else {
      log("Receipts check failed — skipping listing", { listingId, status: receiptsRes?.status });
      skipped++;
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    if (hasSales) {
      log("Listing has sales — skipping", { listingId, title: listing.title });
      skipped++;
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }

    // ── 5b. 90+ days, 0 sales, price already dropped → deactivate ────────────
    if (ageSec >= day90 && alreadyDropped) {
      log("Deactivating listing (90+ days, 0 sales, price dropped)", { listingId, title: listing.title });

      const deleteRes = await fetch(
        `https://openapi.etsy.com/v3/application/listings/${listingId}`,
        {
          method: "DELETE",
          headers: etsyHeaders,
          signal: AbortSignal.timeout(10_000),
        },
      ).catch(() => null);

      if (deleteRes?.ok || deleteRes?.status === 404) {
        deactivated++;
        log("Listing deactivated", { listingId });
      } else {
        const errBody = await deleteRes?.text().catch(() => "");
        log("Deactivation failed", { listingId, status: deleteRes?.status, body: errBody?.slice(0, 200) });
        skipped++;
      }

      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    // ── 5c. 60–89 days, 0 sales, price not yet dropped → drop 15% ────────────
    if (ageSec >= day60 && ageSec < day90 && !alreadyDropped) {
      const currentPriceCents = Math.round((listing.price.amount / listing.price.divisor) * 100);
      const newPriceCents = roundToHalfDollar(Math.round(currentPriceCents * 0.85));

      log("Dropping price 15%", {
        listingId,
        title: listing.title,
        from: currentPriceCents,
        to: newPriceCents,
      });

      // PATCH Etsy listing price
      // Etsy price is in the listing currency's smallest unit (e.g. cents for USD)
      const patchRes = await fetch(
        `https://openapi.etsy.com/v3/application/listings/${listingId}`,
        {
          method: "PATCH",
          headers: { ...etsyHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ price: newPriceCents / 100 }), // Etsy PATCH expects float dollars
          signal: AbortSignal.timeout(10_000),
        },
      ).catch(() => null);

      if (patchRes?.ok) {
        // Record the price drop in pod_agent_state
        const now = new Date().toISOString();
        await sb.from("pod_agent_state").upsert(
          { key: priceDropKey, value: now, updated_at: now },
          { onConflict: "key" },
        );
        agentState.set(priceDropKey, now);
        priceDropped++;
        log("Price dropped and recorded", { listingId, newPriceCents });
      } else {
        const errBody = await patchRes?.text().catch(() => "");
        log("Price patch failed", { listingId, status: patchRes?.status, body: errBody?.slice(0, 200) });
        skipped++;
      }

      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    // ── 5d. 90+ days, 0 sales, price NOT dropped yet → drop price first ───────
    // (Edge case: listing was 90+ days old but price_drop key was never set,
    //  e.g. it skipped the 60-89 day window. Drop price now and wait for next run.)
    if (ageSec >= day90 && !alreadyDropped) {
      const currentPriceCents = Math.round((listing.price.amount / listing.price.divisor) * 100);
      const newPriceCents = roundToHalfDollar(Math.round(currentPriceCents * 0.85));

      log("90+ days with no prior drop — dropping price first", { listingId, title: listing.title });

      const patchRes = await fetch(
        `https://openapi.etsy.com/v3/application/listings/${listingId}`,
        {
          method: "PATCH",
          headers: { ...etsyHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ price: newPriceCents / 100 }),
          signal: AbortSignal.timeout(10_000),
        },
      ).catch(() => null);

      if (patchRes?.ok) {
        const now = new Date().toISOString();
        await sb.from("pod_agent_state").upsert(
          { key: priceDropKey, value: now, updated_at: now },
          { onConflict: "key" },
        );
        agentState.set(priceDropKey, now);
        priceDropped++;
        log("Price dropped (90+ day catch-up)", { listingId, newPriceCents });
      } else {
        const errBody = await patchRes?.text().catch(() => "");
        log("Price patch failed (90+ day)", { listingId, status: patchRes?.status, body: errBody?.slice(0, 200) });
        skipped++;
      }

      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    skipped++;
  }

  log("Run complete", { processed, priceDropped, deactivated, skipped });

  return new Response(
    JSON.stringify({ processed, priceDropped, deactivated, skipped }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
