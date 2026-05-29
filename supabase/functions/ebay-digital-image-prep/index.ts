/**
 * ebay-digital-image-prep
 * Downloads Etsy listing images and re-hosts them to Supabase Storage (gng-media bucket).
 * Saves the public Supabase URL to etsy_digital_listings.preview_image_url.
 *
 * eBay's image crawler cannot fetch i.etsystatic.com URLs (Etsy blocks hotlinking),
 * but our edge function CAN download them. Re-hosting to Supabase Storage gives
 * eBay a URL it can actually crawl.
 *
 * Image source priority:
 *   1. etsy_listings.main_image (local DB JOIN — no API needed, already have URLs)
 *   2. Etsy v3 API fallback (only if not found in etsy_listings table)
 *
 * Run once to prep all digital listings, then ebay-lister digital mode uses preview_image_url.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ETSY_KEY     = Deno.env.get("ETSY_API_KEY") ?? Deno.env.get("ETSY_CLIENT_ID") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Fetch main_image from our local etsy_listings table (no external API call)
async function getImageFromDb(listingId: string): Promise<string> {
  const { data } = await supabase
    .from("etsy_listings")
    .select("main_image")
    .eq("listing_id", listingId)
    .not("main_image", "is", null)
    .single();
  return data?.main_image ?? "";
}

// Fallback: Fetch the main image URL from Etsy API (requires ETSY_API_KEY)
async function getEtsyListingImage(listingId: string): Promise<string> {
  if (!ETSY_KEY) return "";
  try {
    const res = await fetch(
      `https://openapi.etsy.com/v3/application/listings/${listingId}/images?limit=1`,
      { headers: { "x-api-key": ETSY_KEY } }
    );
    if (res.ok) {
      const data = await res.json();
      const img = data?.results?.[0];
      return img?.url_570xN ?? img?.url_fullxfull ?? "";
    }
  } catch { /* fall through */ }
  return "";
}

// Download image bytes from Etsy CDN (our server can do this; eBay's crawler cannot)
async function downloadImage(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; image-mirror/1.0)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buf = await res.arrayBuffer();
    return { bytes: new Uint8Array(buf), contentType };
  } catch {
    return null;
  }
}

// Upload to Supabase Storage gng-media bucket, return public URL
async function uploadToStorage(bytes: Uint8Array, contentType: string, fileName: string): Promise<string> {
  const path = `ebay-digital/${fileName}`;
  const { error } = await supabase.storage
    .from("gng-media")
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from("gng-media").getPublicUrl(path);
  return data.publicUrl;
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const limit: number = body.limit ?? 20;

  // Get digital listings that need images
  const { data: listings } = await supabase
    .from("etsy_digital_listings")
    .select("id, title, etsy_listing_id")
    .is("preview_image_url", null)
    .not("etsy_listing_id", "is", null)
    .limit(limit);

  if (!listings?.length) {
    return new Response(JSON.stringify({ message: "All digital listings already have preview images" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const results = [];
  let prepped = 0, failed = 0;

  for (const l of listings) {
    try {
      // 1. Get image URL — try DB first (no API needed), fall back to Etsy API
      let etsyUrl = await getImageFromDb(l.etsy_listing_id);
      if (!etsyUrl) {
        etsyUrl = await getEtsyListingImage(l.etsy_listing_id);
      }

      if (!etsyUrl) {
        results.push({ id: l.id, title: l.title.slice(0, 50), status: "no_image_found" });
        failed++;
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      // 2. Download from Etsy CDN
      const img = await downloadImage(etsyUrl);
      if (!img) {
        results.push({ id: l.id, title: l.title.slice(0, 50), status: "download_failed", url: etsyUrl });
        failed++;
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      // 3. Upload to Supabase Storage
      const ext = img.contentType.includes("png") ? "png" : "jpg";
      const fileName = `${l.etsy_listing_id}.${ext}`;
      const publicUrl = await uploadToStorage(img.bytes, img.contentType, fileName);

      // 4. Save to DB
      await supabase
        .from("etsy_digital_listings")
        .update({ preview_image_url: publicUrl })
        .eq("id", l.id);

      prepped++;
      results.push({ id: l.id, title: l.title.slice(0, 50), status: "prepped", preview_image_url: publicUrl });
    } catch (err) {
      failed++;
      results.push({ id: l.id, title: l.title.slice(0, 50), status: "error", error: String(err) });
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return new Response(JSON.stringify({ total: listings.length, prepped, failed, results }, null, 2), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
