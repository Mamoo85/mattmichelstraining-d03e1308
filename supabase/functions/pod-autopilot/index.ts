// pod-autopilot — daily Etsy/Printify business agent
// Cron: daily at 12pm UTC via pg_cron (see migration 20260519130000_pod_agent_crons.sql)
// Actions:
//   1. Reset any stale "processing" rows in pod_product_queue back to "pending"
//   2. Publish all unpublished Printify products to Etsy + deduplicate
//   3. Weekly shop announcement update (Mondays, or if last update >6 days ago)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-AUTOPILOT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    // Step 1: Reset stale "processing" rows (stuck >10 min) back to "pending"
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: resetCount } = await sb
      .from("pod_product_queue")
      .update({ status: "pending" })
      .eq("status", "processing")
      .lt("updated_at", staleThreshold)
      .select("*", { count: "exact", head: true });
    if (resetCount) log("Reset stale processing rows", { resetCount });

    // Step 2: Publish all unpublished Printify products to Etsy + deduplicate
    log("Running publishAll");
    const publishRes = await fetch(`${SUPABASE_URL}/functions/v1/printify-product-creator`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ publishAll: true }),
      signal: AbortSignal.timeout(110_000),
    });
    const publishData = await publishRes.json().catch(() => ({}));
    log("publishAll complete", publishData);

    // Step 3: Quick queue health check
    const { data: queueStats } = await sb
      .from("pod_product_queue")
      .select("status")
      .order("status");
    const counts = (queueStats ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    log("Queue status summary", counts);

    // Step 4: Weekly shop announcement update (Monday or >6 days since last update)
    let announcementResult: Record<string, unknown> = { skipped: true, reason: "not_due" };
    try {
      announcementResult = await maybeUpdateShopAnnouncement(sb, SUPABASE_URL, SERVICE_KEY, ETSY_API_KEY);
    } catch (annErr) {
      log("Shop announcement update failed (non-fatal)", { error: String(annErr) });
      announcementResult = { skipped: true, reason: "error", error: String(annErr) };
    }

    return new Response(JSON.stringify({
      success: true,
      staleReset: resetCount ?? 0,
      publishAll: publishData,
      queueCounts: counts,
      announcement: announcementResult,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[POD-AUTOPILOT] Fatal error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// ── Weekly shop announcement helper ───────────────────────────────────────────
async function maybeUpdateShopAnnouncement(
  sb: ReturnType<typeof createClient>,
  supabaseUrl: string,
  _serviceKey: string,
  etsyApiKey: string,
): Promise<Record<string, unknown>> {
  // Check if announcement update is due (Monday OR >6 days since last update)
  const today = new Date();
  const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon

  const { data: stateRow } = await sb
    .from("pod_agent_state")
    .select("value")
    .eq("key", "last_announcement_update")
    .maybeSingle();

  const lastUpdate = stateRow?.value ? new Date(stateRow.value) : null;
  const daysSinceUpdate = lastUpdate
    ? (today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  const isDue = dayOfWeek === 1 || daysSinceUpdate > 6;

  if (!isDue) {
    log("Shop announcement not due", { dayOfWeek, daysSinceUpdate: Math.floor(daysSinceUpdate) });
    return { skipped: true, reason: "not_due", dayOfWeek, daysSinceLast: Math.floor(daysSinceUpdate) };
  }

  log("Shop announcement due — updating", { dayOfWeek, daysSinceUpdate: Math.floor(daysSinceUpdate) });

  if (!etsyApiKey) {
    log("ETSY_API_KEY not set — skipping announcement");
    return { skipped: true, reason: "no_etsy_api_key" };
  }

  const clientId = etsyApiKey.split(":")[0];

  // Load Etsy OAuth tokens
  const { data: tokenRow, error: tokenErr } = await sb
    .from("etsy_oauth_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    log("No Etsy OAuth tokens — skipping announcement");
    return { skipped: true, reason: "no_oauth_tokens" };
  }

  // Refresh token if expiring within 5 min
  let accessToken: string = tokenRow.access_token;
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const needsRefresh = Date.now() >= expiresAt - 5 * 60 * 1000;

  if (needsRefresh) {
    log("Announcement: refreshing Etsy token");
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
      log("Token refresh failed for announcement", { status: refreshRes.status, body: errBody.slice(0, 200) });
      return { skipped: true, reason: "token_refresh_failed" };
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
  }

  const etsyHeaders = {
    "x-api-key": etsyApiKey,
    Authorization: `Bearer ${accessToken}`,
  };

  // Resolve shop_id if missing
  let shopId: string = tokenRow.shop_id ?? "";
  if (!shopId) {
    try {
      const meRes = await fetch("https://openapi.etsy.com/v3/application/users/me", {
        headers: etsyHeaders, signal: AbortSignal.timeout(10_000),
      });
      const me = await meRes.json();
      const meUserId = String(me.user_id ?? "");
      if (meUserId) {
        const shopRes = await fetch(
          `https://openapi.etsy.com/v3/application/users/${meUserId}/shops`,
          { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
        );
        const shopData = await shopRes.json();
        shopId = String(shopData?.shop_id ?? shopData?.results?.[0]?.shop_id ?? "");
        if (shopId) {
          await sb.from("etsy_oauth_tokens").update({ shop_id: shopId, updated_at: new Date().toISOString() }).eq("id", tokenRow.id);
        }
      }
    } catch (e) {
      log("shop_id resolution failed for announcement", { error: String(e) });
    }
  }

  if (!shopId) {
    log("Could not resolve shop_id for announcement");
    return { skipped: true, reason: "no_shop_id" };
  }

  // Fetch top 3 active listings by score (Etsy's bestseller ranking)
  const listingsUrl = new URL(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active`);
  listingsUrl.searchParams.set("sort_on", "score");
  listingsUrl.searchParams.set("sort_order", "desc");
  listingsUrl.searchParams.set("limit", "3");
  listingsUrl.searchParams.set("fields", "title");

  const listingsRes = await fetch(listingsUrl.toString(), {
    headers: etsyHeaders,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!listingsRes?.ok) {
    const errBody = await listingsRes?.text().catch(() => "");
    log("Listings fetch failed for announcement", { status: listingsRes?.status, body: errBody?.slice(0, 200) });
    return { skipped: true, reason: "listings_fetch_failed" };
  }

  const listingsData = await listingsRes.json();
  const listings: Array<{ title: string }> = listingsData?.results ?? [];

  if (listings.length === 0) {
    log("No active listings found for announcement");
    return { skipped: true, reason: "no_active_listings" };
  }

  // Build the announcement text
  const titles = listings.slice(0, 3).map((l) => `"${l.title}"`);
  const announcement =
    `🔥 Bestsellers this week: ${titles.join(" · ")} — All ship FREE! New designs added daily.`;

  log("Updating shop announcement", { shopId, announcement: announcement.slice(0, 80) });

  // PATCH /v3/application/shops/{shop_id}
  const patchRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}`, {
    method: "PATCH",
    headers: { ...etsyHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ announcement }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!patchRes?.ok) {
    const errBody = await patchRes?.text().catch(() => "");
    log("Shop PATCH failed", { status: patchRes?.status, body: errBody?.slice(0, 200) });
    return { skipped: false, updated: false, reason: "patch_failed", status: patchRes?.status };
  }

  // Persist last update timestamp
  await sb.from("pod_agent_state").upsert(
    { key: "last_announcement_update", value: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  log("Shop announcement updated successfully");
  return { skipped: false, updated: true, titles: listings.slice(0, 3).map((l) => l.title) };
}
