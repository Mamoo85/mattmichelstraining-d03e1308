/**
 * ebay-apparel-square-fix
 *
 * Problem: Printify garment mockups are portrait (tall). eBay displays a
 * square thumbnail in search results — the top/bottom gets cropped, cutting
 * off the hood of hoodies and the hem of tshirts.
 *
 * Fix: Transform each Printify portrait image URL through images.weserv.nl,
 * which pads it to 1000×1000 square with a white background (fit=contain).
 * Then call eBay ReviseItem to update the listing with the squared URL.
 *
 * images.weserv.nl is a free, public CDN proxy that eBay's crawler can fetch.
 * Verified: returns exactly 1000×1000 JPEG at ~80KB per image.
 *
 * API:
 *   POST {}                         → fix all apparel eBay listings
 *   POST { dry_run: true }          → audit — show what would be changed, no ReviseItem
 *   POST { product_type: "hoodie" } → limit to one type
 *   POST { ebay_item_id: "123" }    → fix one specific listing
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID        = Deno.env.get("EBAY_APP_ID")!;
const DEV_ID        = Deno.env.get("EBAY_DEV_ID")!;
const CERT_ID       = Deno.env.get("EBAY_CERT_ID")!;
const PRINTIFY_KEY  = Deno.env.get("PRINTIFY_API_TOKEN") ?? Deno.env.get("PRINTIFY_API_KEY") ?? "";
const PRINTIFY_SHOP = Deno.env.get("PRINTIFY_SHOP_ID") ?? "2890106";
const PRINTIFY_API  = "https://api.printify.com/v1";
const TRADING_API   = "https://api.ebay.com/ws/api.dll";

const APPAREL_TYPES = ["tshirt", "hoodie", "sweatshirt", "longsleeve"];

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Square-pad URL via images.weserv.nl ────────────────────────────────────────
// Converts a portrait Printify CDN URL into a 1000×1000 JPEG with white
// letterbox padding on the sides. eBay can fetch from weserv.nl like any CDN.
//
// weserv.nl params used:
//   fit=contain  — shrink proportionally to fit within 1000×1000 (no crop)
//   bg=ffffff    — fill the remaining canvas with white
//   output=jpg   — force JPEG output for eBay compatibility
//   q=90         — high quality JPEG
function squarePadUrl(src: string): string {
  const stripped = src.replace(/^https?:\/\//, "");
  return (
    `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}` +
    `&w=1000&h=1000&fit=contain&bg=ffffff&output=jpg&q=90`
  );
}

// ── Printify: fetch product images ────────────────────────────────────────────
async function getPrintifyImages(
  printifyId: string,
): Promise<{ urls: string[]; debug?: string }> {
  if (!printifyId || !PRINTIFY_KEY) return { urls: [], debug: "no key" };
  try {
    const res = await fetch(
      `${PRINTIFY_API}/shops/${PRINTIFY_SHOP}/products/${printifyId}.json`,
      {
        headers: { Authorization: `Bearer ${PRINTIFY_KEY}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { urls: [], debug: `HTTP ${res.status}: ${txt.slice(0, 120)}` };
    }
    const data = await res.json();
    const images: Array<{ src: string; position?: string; is_default?: boolean }> =
      data.images ?? [];
    if (!images.length) return { urls: [], debug: "no images array" };

    // Sort: default first, then front, then rest
    const sorted = [...images].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      if (a.position === "front" && b.position !== "front") return -1;
      if (a.position !== "front" && b.position === "front") return 1;
      return 0;
    });

    // Up to 3 images — eBay shows up to 12 but 3 is enough for apparel
    return { urls: sorted.slice(0, 3).map((i) => i.src).filter(Boolean) };
  } catch (e) {
    return { urls: [], debug: (e as Error).message };
  }
}

// ── eBay: get (and auto-refresh) auth token ───────────────────────────────────
// eBay access tokens expire every 2 hours. Refresh automatically using the
// stored refresh token (valid 18 months) + EBAY_APP_ID + EBAY_CERT_ID.
async function getEbayToken(): Promise<string> {
  const { data: row } = await supabase
    .from("ebay_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("account_id", "gngstore")
    .single();

  if (!row) return "";

  // Check if token is still valid (with 60s buffer)
  const expiresAt = new Date(row.expires_at).getTime();
  const nowMs     = Date.now();
  if (expiresAt - nowMs > 60_000) {
    return row.access_token; // still fresh
  }

  // Access token expired — refresh it
  console.log("[EBAY] Access token expired, refreshing...");
  const credentials = btoa(`${APP_ID}:${CERT_ID}`);
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: row.refresh_token,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`[EBAY] Token refresh failed ${res.status}: ${txt.slice(0, 200)}`);
    return row.access_token; // use expired token, let eBay return the error
  }

  const json       = await res.json();
  const newToken   = json.access_token as string;
  const expiresIn  = (json.expires_in as number) ?? 7200; // seconds
  const newExpires = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Persist refreshed token to DB
  await supabase
    .from("ebay_oauth_tokens")
    .update({ access_token: newToken, expires_at: newExpires, updated_at: new Date().toISOString() })
    .eq("account_id", "gngstore");

  console.log(`[EBAY] Token refreshed — expires ${newExpires}`);
  return newToken;
}

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── eBay: ReviseItem with new square image URLs ───────────────────────────────
async function reviseImages(
  itemId: string,
  imageUrls: string[],
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const pics = imageUrls.map((u) => `<PictureURL>${xmlEsc(u)}</PictureURL>`).join("");
  const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${itemId}</ItemID>
    <PictureDetails>${pics}</PictureDetails>
  </Item>
</ReviseItemRequest>`;

  const res = await fetch(TRADING_API, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "ReviseItem",
      "X-EBAY-API-APP-NAME": APP_ID,
      "X-EBAY-API-DEV-NAME": DEV_ID,
      "X-EBAY-API-CERT-NAME": CERT_ID,
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1113",
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  const ack = text.match(/<Ack>(.*?)<\/Ack>/s)?.[1]?.trim() ?? "";
  // eBay "Warning" = succeeded with non-fatal notes (business policies, etc.)
  if (ack === "Success" || ack === "Warning") return { ok: true };
  const err =
    text.match(/<LongMessage>(.*?)<\/LongMessage>/s)?.[1]?.trim() ||
    text.match(/<ShortMessage>(.*?)<\/ShortMessage>/s)?.[1]?.trim() ||
    text.slice(0, 300);
  return { ok: false, error: err };
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const body       = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const dryRun     = body.dry_run === true;
  const typeFilter = typeof body.product_type === "string" ? body.product_type : null;
  const singleItem = typeof body.ebay_item_id === "string" ? body.ebay_item_id : null;

  let q = supabase
    .from("pod_product_queue")
    .select("id, name, product_type, printify_id, ebay_item_id")
    .not("ebay_item_id", "is", null)
    .not("printify_id", "is", null);

  if (singleItem) {
    q = q.eq("ebay_item_id", singleItem);
  } else {
    q = q.in("product_type", typeFilter ? [typeFilter] : APPAREL_TYPES);
  }

  const { data: products, error: dbErr } = await q;
  if (dbErr) {
    return new Response(JSON.stringify({ error: dbErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = dryRun ? "" : await getEbayToken();

  const results: unknown[] = [];
  let fixed = 0, skipped = 0, failed = 0;

  for (const p of products ?? []) {
    const { urls: rawUrls, debug } = await getPrintifyImages(p.printify_id);

    if (!rawUrls.length) {
      skipped++;
      results.push({
        id: p.id,
        name: p.name,
        type: p.product_type,
        ebay_item_id: p.ebay_item_id,
        status: "no_printify_images",
        debug,
      });
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }

    // Transform all URLs to square-padded versions
    const squaredUrls = rawUrls.map(squarePadUrl);

    if (dryRun) {
      results.push({
        id: p.id,
        name: p.name,
        type: p.product_type,
        ebay_item_id: p.ebay_item_id,
        status: "would_fix",
        original_url: rawUrls[0],
        squared_url: squaredUrls[0],
        image_count: squaredUrls.length,
      });
      continue;
    }

    const rev = await reviseImages(p.ebay_item_id!, squaredUrls, token);

    if (rev.ok) {
      fixed++;
      results.push({
        id: p.id,
        name: p.name,
        type: p.product_type,
        ebay_item_id: p.ebay_item_id,
        status: "fixed",
        images_updated: squaredUrls.length,
        squared_url: squaredUrls[0],
      });
    } else {
      failed++;
      results.push({
        id: p.id,
        name: p.name,
        type: p.product_type,
        ebay_item_id: p.ebay_item_id,
        status: "failed",
        error: rev.error,
      });
    }

    // eBay rate limit: ~1 call/s is safe
    await new Promise((r) => setTimeout(r, 500));
  }

  return new Response(
    JSON.stringify(
      {
        dry_run: dryRun,
        total: products?.length ?? 0,
        fixed,
        skipped_no_image: skipped,
        failed,
        results,
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/json" } },
  );
});
