// pod-revenue-digest v1
// Cron: 0 7 * * * (daily 7am UTC — before all other POD crons)
//
// Aggregates yesterday's completed Etsy orders and sends a daily SMS digest to Matt.
// Tokens loaded from etsy_oauth_tokens, auto-refreshed if expiring within 5 min.
// If 0 orders, reports total live listing count instead.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-REVENUE-DIGEST] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY = (Deno.env.get("ETSY_API_KEY") ?? "").trim();
  const ETSY_SHARED_SECRET = (Deno.env.get("ETSY_SHARED_SECRET") ?? "").trim();
  // Confidential Etsy apps require x-api-key = "keystring:sharedsecret"
  const ETSY_HEADER_KEY = ETSY_SHARED_SECRET
    ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}`
    : ETSY_API_KEY;
  const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
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
    "x-api-key": ETSY_HEADER_KEY,
    Authorization: `Bearer ${accessToken}`,
  };

  // ── 3. Resolve shop_id if missing ─────────────────────────────────────────
  let shopId: string = tokenRow.shop_id ?? "";
  let shopName = "";

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
        shopName = String(shopData?.shop_name ?? shopData?.results?.[0]?.shop_name ?? "");
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
          shopName = String(shopData2?.shop_name ?? shopData2?.results?.[0]?.shop_name ?? "");
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

  // If we don't yet have shopName, fetch it from the shop endpoint
  if (!shopName) {
    try {
      const shopRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}`,
        { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
      );
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        shopName = String(shopData?.shop_name ?? "");
      }
    } catch (e) {
      log("shop_name fetch failed", { error: String(e) });
    }
  }

  // ── 4. Build yesterday's epoch range (UTC) ────────────────────────────────
  const now = new Date();
  const todayMidnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayMidnightUtc = new Date(todayMidnightUtc.getTime() - 24 * 60 * 60 * 1000);
  const minCreated = Math.floor(yesterdayMidnightUtc.getTime() / 1000);
  const maxCreated = Math.floor(todayMidnightUtc.getTime() / 1000);

  log("Fetching receipts", { minCreated, maxCreated, shopId });

  // ── 5. Fetch completed receipts for yesterday ─────────────────────────────
  const receiptsUrl = new URL(`https://openapi.etsy.com/v3/application/shops/${shopId}/receipts`);
  receiptsUrl.searchParams.set("min_created", String(minCreated));
  receiptsUrl.searchParams.set("max_created", String(maxCreated));
  receiptsUrl.searchParams.set("was_paid", "true");
  receiptsUrl.searchParams.set("limit", "100");

  const receiptsRes = await fetch(receiptsUrl.toString(), {
    headers: etsyHeaders,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!receiptsRes?.ok) {
    const body = await receiptsRes?.text().catch(() => "");
    log("Receipts fetch failed", { status: receiptsRes?.status, body: body?.slice(0, 200) });
    return new Response(JSON.stringify({ error: "Failed to fetch receipts", detail: body?.slice(0, 200) }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const receiptsData = await receiptsRes.json();
  type ReceiptTransaction = { listing_id: number; title: string; quantity: number; price: { amount: number; divisor: number; currency_code: string } };
  type Receipt = { receipt_id: number; grandtotal: { amount: number; divisor: number }; transactions: ReceiptTransaction[] };
  const receipts: Receipt[] = receiptsData?.results ?? [];

  log("Receipts fetched", { count: receipts.length });

  // ── 6. Handle zero-order day ──────────────────────────────────────────────
  if (receipts.length === 0) {
    // Fetch total live listing count for the 0-order message
    let liveCount = 0;
    try {
      const listingsUrl = new URL(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active`);
      listingsUrl.searchParams.set("limit", "1");
      const listRes = await fetch(listingsUrl.toString(), {
        headers: etsyHeaders,
        signal: AbortSignal.timeout(10_000),
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        liveCount = listData?.count ?? 0;
      }
    } catch (e) {
      log("Live listing count fetch failed", { error: String(e) });
    }

    const smsBody = `POD Daily: $0 revenue yesterday. Store has ${liveCount} live listings.`;
    log("Sending zero-order SMS", { smsBody });

    await sendSMS(ADMIN_PHONE, TWILIO_PHONE, smsBody, "pod_revenue_digest", false, {
      bypassQuietHours: true,
    });

    return new Response(JSON.stringify({ success: true, orders: 0, liveListings: liveCount, smsSent: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 7. Aggregate revenue, units, unique listings, top seller ──────────────
  let totalRevenueCents = 0;
  let totalUnits = 0;
  const listingTitleCounts: Map<string, number> = new Map();

  for (const receipt of receipts) {
    // grandtotal is the authoritative revenue figure (includes shipping, discounts, etc.)
    const divisor = receipt.grandtotal?.divisor ?? 100;
    totalRevenueCents += Math.round(((receipt.grandtotal?.amount ?? 0) / divisor) * 100);

    const txns: ReceiptTransaction[] = receipt.transactions ?? [];
    for (const txn of txns) {
      const qty = txn.quantity ?? 1;
      totalUnits += qty;
      const title = txn.title ?? "";
      if (title) {
        listingTitleCounts.set(title, (listingTitleCounts.get(title) ?? 0) + qty);
      }
    }
  }

  const uniqueListings = listingTitleCounts.size;

  // Find top-selling listing title by units sold
  let topTitle = "";
  let topUnits = 0;
  for (const [title, units] of listingTitleCounts.entries()) {
    if (units > topUnits) {
      topUnits = units;
      topTitle = title;
    }
  }

  const revenueStr = `$${(totalRevenueCents / 100).toFixed(2)}`;
  const topTitleTruncated = topTitle.length > 30 ? topTitle.slice(0, 30) : topTitle;
  const shopLink = shopName ? `etsy.com/shop/${shopName}` : `etsy.com`;

  const smsBody = `POD Daily: ${revenueStr} revenue, ${receipts.length} orders, ${totalUnits} items sold. Top: "${topTitleTruncated}". Shop: ${shopLink}`;

  log("Sending digest SMS", { smsBody, orders: receipts.length, units: totalUnits, uniqueListings });

  await sendSMS(ADMIN_PHONE, TWILIO_PHONE, smsBody, "pod_revenue_digest", false, {
    bypassQuietHours: true,
  });

  return new Response(JSON.stringify({
    success: true,
    orders: receipts.length,
    totalRevenue: totalRevenueCents / 100,
    totalUnits,
    uniqueListings,
    topListing: topTitle,
    smsSent: true,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
