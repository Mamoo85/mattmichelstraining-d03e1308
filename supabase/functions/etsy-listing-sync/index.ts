// etsy-listing-sync — syncs active Etsy shop listings into etsy_listings table.
// Run: POST {} — full sync (upserts all active listings)
// Run: POST {"dry_run": true} — returns count without writing
// Cron: daily 6am UTC on secondary project
//
// Auth: Etsy confidential app requires x-api-key = "keystring:secret" AND
//       Authorization: Bearer <oauth_token> for listings_r scope.
//       Shop ID is read from etsy_oauth_tokens DB row (most reliable).

import { createClient } from "npm:@supabase/supabase-js@2";

const ETSY_API_KEY = (Deno.env.get("ETSY_API_KEY") ?? "").trim();
const ETSY_SHARED_SECRET = (Deno.env.get("ETSY_SHARED_SECRET") ?? "").trim();
// x-api-key must be "keystring:secret" for confidential Etsy apps
const ETSY_HEADER_KEY = ETSY_SHARED_SECRET
  ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}`
  : ETSY_API_KEY;
const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[ETSY-SYNC] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

// Fetch OAuth token + shop_id from DB
async function getOAuthRecord(
  sb: ReturnType<typeof createClient>,
): Promise<{ token: string; shopId: string } | null> {
  try {
    const { data } = await sb
      .from("etsy_oauth_tokens")
      .select("access_token, shop_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!data?.access_token) return null;
    return { token: data.access_token, shopId: data.shop_id ?? "" };
  } catch {
    return null;
  }
}

// Etsy GET — requires combined x-api-key header AND OAuth Bearer for listings_r scope
async function etsyGet(path: string, bearerToken: string): Promise<Response> {
  return fetch(`https://openapi.etsy.com/v3/application${path}`, {
    headers: {
      "x-api-key": ETSY_HEADER_KEY,
      "Authorization": `Bearer ${bearerToken}`,
    },
    signal: AbortSignal.timeout(20_000),
  });
}

interface EtsyListing {
  listing_id: number;
  title: string;
  description: string;
  price?: { amount: number; divisor: number };
  url: string;
  images?: Array<{ url_570xN: string }>;
  tags: string[];
  num_favorers: number;
  state: string;
  creation_timestamp: number;
  ending_tsz: number;
}

async function fetchAllActiveListings(
  shopId: string,
  bearerToken: string,
): Promise<{ listings: EtsyListing[]; lastError: string | null }> {
  const all: EtsyListing[] = [];
  let offset = 0;
  const limit = 100;
  let lastError: string | null = null;

  while (true) {
    const res = await etsyGet(
      `/shops/${shopId}/listings?state=active&limit=${limit}&offset=${offset}&includes=images`,
      bearerToken,
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      lastError = `HTTP ${res.status}: ${errBody.slice(0, 300)}`;
      log(`Fetch failed at offset ${offset}`, { status: res.status, body: errBody.slice(0, 200) });
      break;
    }
    const data = await res.json() as { results: EtsyListing[]; count: number };
    const items = Array.isArray(data.results) ? data.results : [];
    all.push(...items);
    log(`Fetched page offset=${offset}`, { got: items.length, total: all.length });
    if (items.length < limit) break;
    offset += limit;
    await new Promise((r) => setTimeout(r, 500));
  }
  return { listings: all, lastError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!ETSY_API_KEY) {
    return Response.json({ error: "ETSY_API_KEY required" }, { status: 500, headers: CORS });
  }

  const body = await req.json().catch(() => ({})) as { dry_run?: boolean };
  const dryRun = body.dry_run === true;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Get OAuth token + shop_id from DB
  const oauthRecord = await getOAuthRecord(sb);
  if (!oauthRecord) {
    return Response.json(
      { error: "No Etsy OAuth token in etsy_oauth_tokens — run etsy-oauth-refresh first" },
      { status: 500, headers: CORS },
    );
  }

  // Shop ID: prefer DB value (from OAuth flow), fall back to env var
  const shopId = (oauthRecord.shopId && oauthRecord.shopId !== "")
    ? oauthRecord.shopId
    : ETSY_SHOP_ID;
  log("Auth ready", { shopId, hasSecret: !!ETSY_SHARED_SECRET });

  if (!shopId) {
    return Response.json(
      { error: "No ETSY_SHOP_ID available (not in DB or env)" },
      { status: 500, headers: CORS },
    );
  }

  try {
    log("Starting Etsy listing sync", { shopId, dryRun });
    const { listings, lastError } = await fetchAllActiveListings(shopId, oauthRecord.token);
    log("Fetched all active listings", { count: listings.length, lastError });

    if (dryRun) {
      return Response.json({
        dry_run: true,
        would_sync: listings.length,
        last_error: lastError,
        sample: listings.slice(0, 3).map((l) => ({ id: l.listing_id, title: l.title.slice(0, 60) })),
      }, { headers: CORS });
    }

    let synced = 0;
    let errors = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < listings.length; i += 50) {
      const batch = listings.slice(i, i + 50).map((l) => {
        const priceUsd = l.price ? l.price.amount / l.price.divisor : 0;
        const mainImage = l.images?.[0]?.url_570xN ?? null;
        return {
          listing_id: String(l.listing_id),
          title: l.title || "",
          description: (l.description || "").slice(0, 5000),
          price_usd: priceUsd,
          listing_url: l.url || "",
          main_image: mainImage,
          tags: Array.isArray(l.tags) ? l.tags : [],
          num_favorers: l.num_favorers || 0,
          status: "active",  // We only sync active listings; deactivation uses synced_at timestamp
          created_timestamp: l.creation_timestamp || null,
          ending_tsz: l.ending_tsz || null,
          synced_at: now,
          updated_at: now,
        };
      });

      const { error } = await sb.from("etsy_listings").upsert(batch, {
        onConflict: "listing_id",
        ignoreDuplicates: false,
      });

      if (error) {
        log("Upsert batch error", { error: error.message });
        errors++;
      } else {
        synced += batch.length;
      }
    }

    // Mark any previously-active listings that were NOT in this sync as inactive.
    // We use synced_at timestamp instead of a huge NOT IN list (avoids PostgREST URL length limits).
    try {
      await sb
        .from("etsy_listings")
        .update({ status: "inactive", updated_at: now })
        .eq("status", "active")
        .lt("synced_at", now);  // rows not touched by this sync run
    } catch (e) {
      log("Deactivate old listings error", { err: String(e) });
    }

    try {
      await sb.from("agent_heartbeats").upsert({
        agent_name: "etsy-listing-sync",
        last_run_at: now,
        last_status: errors === 0 ? "ok" : "partial",
        last_result: JSON.stringify({ synced, errors, total: listings.length }),
      }, { onConflict: "agent_name" });
    } catch { /* non-fatal */ }

    log("Sync complete", { synced, errors, total: listings.length });
    return Response.json(
      { status: "ok", synced, errors, total: listings.length, last_error: lastError },
      { headers: CORS },
    );
  } catch (err) {
    log("Fatal error", { err: String(err) });
    return Response.json({ error: String(err) }, { status: 500, headers: CORS });
  }
});
