// pod-coupon-sender v2
// Cron: 0 15 * * * (daily 3pm UTC)
//
// Sends a review ask + 15%-off coupon to buyers whose orders completed 11–13 days ago.
// Timing: item has almost certainly arrived (Printify US ships in 7–10 days).
// Review ask and coupon are intentionally separate — coupon is NOT conditional on a review
// (incentivized reviews violate Etsy ToS and FTC rules).
// Tracks sends in pod_coupon_sends to prevent duplicates.
// Max 10 messages per run.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[COUPON-SENDER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

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

  // ── 4. Fetch receipts completed in the 11–13 day window ───────────────────
  // min_created = 13 days ago, max_created = 11 days ago (epoch seconds)
  const now = Date.now();
  const minCreated = Math.floor((now - 13 * 24 * 60 * 60 * 1000) / 1000);
  const maxCreated = Math.floor((now - 11 * 24 * 60 * 60 * 1000) / 1000);

  const receiptsUrl = new URL(`https://openapi.etsy.com/v3/application/shops/${shopId}/receipts`);
  receiptsUrl.searchParams.set("min_created", String(minCreated));
  receiptsUrl.searchParams.set("max_created", String(maxCreated));
  receiptsUrl.searchParams.set("status", "completed");
  receiptsUrl.searchParams.set("limit", "25");

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
  const receipts: Array<{
    receipt_id: number;
    name: string;
    buyer_user_id?: number | string;
    status: string;
  }> = receiptsData?.results ?? [];

  log("Receipts fetched", { count: receipts.length });

  if (receipts.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: "No receipts in the 12-day window", sent: 0, skipped: 0 }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // ── 5. Filter out buyers who already received a coupon ────────────────────
  const receiptIds = receipts.map(r => String(r.receipt_id));
  const { data: alreadySent } = await sb
    .from("pod_coupon_sends")
    .select("receipt_id")
    .in("receipt_id", receiptIds);

  const sentSet = new Set((alreadySent ?? []).map((r: { receipt_id: string }) => r.receipt_id));
  const pending = receipts.filter(r => !sentSet.has(String(r.receipt_id)));

  log("Pending coupon sends", { total: receipts.length, alreadySent: sentSet.size, pending: pending.length });

  // ── 6. Send coupon message (max 10 per run) ────────────────────────────────
  let sent = 0;
  let skipped = sentSet.size;
  const errors: string[] = [];

  for (const receipt of pending) {
    if (sent >= 10) break;

    const buyerName = (receipt.name ?? "").split(" ")[0] || "there";
    // Review ask and coupon are separate paragraphs — coupon is NOT conditional
    // on leaving a review. Linking them would be an incentivized review (Etsy ToS violation).
    const message =
      `Hi ${buyerName}! Hope your order arrived and you love it! 😊 ` +
      `If you have a spare 30 seconds, an honest review helps our small shop more than you know — ` +
      `you can leave one directly on your order page.\n\n` +
      `Separately, as a thank-you: use code THANKYOU15 for 15% off your next order (valid 30 days). 🎁`;

    try {
      const msgRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/receipts/${receipt.receipt_id}/messages`,
        {
          method: "POST",
          headers: { ...etsyHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ message_text: message }),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (msgRes.ok || msgRes.status === 409) {
        // 409 = already messaged — still record it to prevent future attempts
        await sb.from("pod_coupon_sends").insert({
          receipt_id: String(receipt.receipt_id),
          buyer_user_id: receipt.buyer_user_id ? String(receipt.buyer_user_id) : null,
          sent_at: new Date().toISOString(),
        }).then(null, () => {}); // ignore duplicate key errors

        sent++;
        log("Coupon sent", { receiptId: receipt.receipt_id, buyer: buyerName });
      } else {
        const errBody = await msgRes.text().catch(() => "");
        errors.push(`receipt ${receipt.receipt_id}: ${msgRes.status} ${errBody.slice(0, 100)}`);
        log("Message failed", { receiptId: receipt.receipt_id, status: msgRes.status });
      }
    } catch (e) {
      errors.push(`receipt ${receipt.receipt_id}: ${String(e).slice(0, 100)}`);
    }

    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  log("Done", { sent, skipped, errors: errors.length });

  return new Response(
    JSON.stringify({ success: true, sent, skipped, errors }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
