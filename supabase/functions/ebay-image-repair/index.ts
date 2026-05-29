/**
 * ebay-image-repair
 * Fixes the image problem on all live eBay listings.
 *
 * Root cause: All listings were created with i.etsystatic.com image URLs.
 * Etsy CDN blocks hotlinking — eBay's image crawler cannot fetch those URLs,
 * so every listing shows "no image".
 *
 * Fix: For each listing with a printify_id, fetch the Printify product to get
 * its CDN image URL (printifycdn.com — publicly accessible), then call
 * eBay ReviseItem to set PictureDetails on each listing.
 *
 * Note: ReviseItem with ONLY PictureDetails does NOT touch shipping/payment/return
 * fields, so it avoids the "business policies" error.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID      = Deno.env.get("EBAY_APP_ID")!;
const DEV_ID      = Deno.env.get("EBAY_DEV_ID")!;
const CERT_ID     = Deno.env.get("EBAY_CERT_ID")!;
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? Deno.env.get("PRINTIFY_API_KEY") ?? "";
const SHOP_ID     = Deno.env.get("PRINTIFY_SHOP_ID") ?? "2890106";
const TRADING_API = "https://api.ebay.com/ws/api.dll";
const PRINTIFY_API = "https://api.printify.com/v1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getEbayToken(): Promise<string> {
  const { data } = await supabase
    .from("ebay_oauth_tokens")
    .select("access_token")
    .eq("account_id", "gngstore")
    .single();
  return data?.access_token ?? "";
}

async function getPrintifyImages(printifyId: string): Promise<{ urls: string[]; debug?: string }> {
  const url = `${PRINTIFY_API}/shops/${SHOP_ID}/products/${printifyId}.json`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${PRINTIFY_KEY}` },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { urls: [], debug: `HTTP ${res.status} from Printify: ${errText.slice(0, 200)}` };
  }

  const data = await res.json();
  // Prefer images with position "front" or is_default, fall back to first available
  const images: Array<{ src: string; position?: string; is_default?: boolean }> = data.images ?? [];
  if (!images.length) {
    return { urls: [], debug: `Printify product has no images. Keys: ${Object.keys(data).join(",")}` };
  }

  // Sort: default first, then front, then anything
  const sorted = [...images].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    if (a.position === "front" && b.position !== "front") return -1;
    if (a.position !== "front" && b.position === "front") return 1;
    return 0;
  });

  // Return up to 3 image URLs (eBay allows up to 12)
  const urls = sorted.slice(0, 3).map(img => img.src).filter(Boolean);
  return { urls };
}

async function reviseItemImages(itemId: string, imageUrls: string[], token: string): Promise<{ success: boolean; error?: string }> {
  const picXml = imageUrls.map(url => `<PictureURL>${url}</PictureURL>`).join("");
  const body = `<?xml version="1.0" encoding="utf-8"?><ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials><Item><ItemID>${itemId}</ItemID><PictureDetails>${picXml}</PictureDetails></Item></ReviseItemRequest>`;

  const res = await fetch(TRADING_API, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME":  "ReviseItem",
      "X-EBAY-API-APP-NAME":   APP_ID,
      "X-EBAY-API-DEV-NAME":   DEV_ID,
      "X-EBAY-API-CERT-NAME":  CERT_ID,
      "X-EBAY-API-SITEID":     "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1113",
    },
    body,
  });

  const text = await res.text();
  const ack  = text.match(/<Ack>(.*?)<\/Ack>/s)?.[1]?.trim() ?? "";

  // eBay Ack "Warning" = operation succeeded with non-fatal warnings
  // (e.g. business policies format note). Treat Warning as success.
  if (ack === "Success" || ack === "Warning") {
    return { success: true };
  }

  const err = text.match(/<LongMessage>(.*?)<\/LongMessage>/s)?.[1]?.trim()
           || text.match(/<ShortMessage>(.*?)<\/ShortMessage>/s)?.[1]?.trim()
           || text.slice(0, 300);
  return { success: false, error: err };
}

Deno.serve(async (_req: Request) => {
  const token = await getEbayToken();

  // Get all eBay-listed products that have a printify_id
  const { data: products, error: dbErr } = await supabase
    .from("pod_product_queue")
    .select("id, ebay_item_id, name, printify_id, product_type")
    .not("ebay_item_id", "is", null)
    .not("printify_id", "is", null);

  if (dbErr) {
    return new Response(JSON.stringify({ error: dbErr.message }), { status: 500 });
  }

  if (!products?.length) {
    return new Response(JSON.stringify({ message: "No eBay listings with printify_id found" }), { status: 200 });
  }

  const results = [];
  let fixed = 0, noImages = 0, failed = 0;

  for (const p of products) {
    // 1. Fetch Printify product images
    const { urls: imageUrls, debug: imgDebug } = await getPrintifyImages(p.printify_id);

    if (!imageUrls.length) {
      noImages++;
      results.push({
        id: p.id,
        item: p.name,
        itemId: p.ebay_item_id,
        status: "no_printify_images",
        printifyId: p.printify_id,
        shopId: SHOP_ID,
        debug: imgDebug,
      });
      await new Promise(r => setTimeout(r, 200));
      continue;
    }

    // 2. Push images to eBay listing
    const revResult = await reviseItemImages(p.ebay_item_id, imageUrls, token);

    if (revResult.success) {
      fixed++;
      results.push({
        id: p.id,
        item: p.name,
        itemId: p.ebay_item_id,
        status: "images_fixed",
        imageCount: imageUrls.length,
        firstImage: imageUrls[0],
      });
    } else {
      failed++;
      results.push({
        id: p.id,
        item: p.name,
        itemId: p.ebay_item_id,
        status: "revise_failed",
        error: revResult.error,
      });
    }

    // Respect eBay rate limits
    await new Promise(r => setTimeout(r, 400));
  }

  return new Response(JSON.stringify({
    total: products.length,
    images_fixed: fixed,
    no_printify_images: noImages,
    revise_failed: failed,
    results,
  }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
});
