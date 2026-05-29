// ad-creative-generator — on-demand creative production
// Part of DWA SaaS Platform: Ad Creative Generator (sharp-based, free)
//
// Flow:
//   1. POST { listing_id, template_ids?: string[], dry_run?: boolean }
//   2. Fetch etsy_listings row → main_image, title, price_usd
//   3. For each active mockup_template (or subset):
//      a. Download product image → ArrayBuffer
//      b. Fetch template PNG from Supabase Storage templates/{id}.png
//      c. sharp: resize product → composite onto template background
//      d. sharp: SVG text overlay (price + headline)
//      e. Upload JPEG → ad-creatives/{listing_id}/{template_id}.jpg
//      f. Insert/upsert ad_creative_assets row
//   4. Return { assets: [{ template_id, url, dimensions }] }
//
// Supports ?export=zip for bulk download (returns base64-encoded ZIP).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import sharp from "npm:sharp@0.33.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[AD-CREATIVE] ${step}${data !== undefined ? " — " + JSON.stringify(data) : ""}`);

interface TextZone {
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  align?: "left" | "center" | "right";
}

interface ProductZone {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TemplateConfig {
  width: number;
  height: number;
  product_zone: ProductZone;
  text_zones: TextZone[];
}

// Build SVG text overlay layer
function buildSvgOverlay(
  canvasWidth: number,
  canvasHeight: number,
  zones: TextZone[],
  title: string,
  priceUsd: number
): Buffer {
  const lines = zones.map((z) => {
    let text = "";
    if (z.label === "price") {
      text = `$${priceUsd.toFixed(2)}`;
    } else if (z.label === "headline") {
      // Truncate title to ~35 chars
      text = title.length > 35 ? title.slice(0, 32) + "…" : title;
    } else {
      text = z.label;
    }

    const anchor = z.align === "left" ? "start" : z.align === "right" ? "end" : "middle";
    return `<text x="${z.x}" y="${z.y}" font-family="Arial, Helvetica, sans-serif" font-size="${z.size}" font-weight="bold" fill="${z.color}" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(text)}</text>`;
  });

  const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  ${lines.join("\n  ")}
</svg>`;
  return Buffer.from(svg);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Download a remote image as Buffer
async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DWA-AdCreative/1.0)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Image download failed: ${res.status} for ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: { listing_id?: string; template_ids?: string[]; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { listing_id, template_ids, dry_run = false } = body;

  if (!listing_id) {
    return new Response(
      JSON.stringify({ error: "listing_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Fetch listing
  const { data: listing, error: listingErr } = await sb
    .from("etsy_listings")
    .select("listing_id, title, price_usd, main_image")
    .eq("listing_id", listing_id)
    .single();

  if (listingErr || !listing) {
    return new Response(
      JSON.stringify({ error: `Listing ${listing_id} not found`, detail: listingErr?.message }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!listing.main_image) {
    return new Response(
      JSON.stringify({ error: "Listing has no main_image" }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch templates
  let templateQuery = sb
    .from("mockup_templates")
    .select("*")
    .eq("active", true);
  if (template_ids && template_ids.length > 0) {
    templateQuery = templateQuery.in("id", template_ids.slice(0, 10)); // max 10
  } else {
    templateQuery = templateQuery.limit(10);
  }

  const { data: templates, error: templErr } = await templateQuery;
  if (templErr || !templates || templates.length === 0) {
    return new Response(
      JSON.stringify({ error: "No active templates found", detail: templErr?.message }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  log("Starting", { listing_id, title: listing.title?.slice(0, 40), templates: templates.length, dry_run });

  // Pre-download product image once
  let productBuffer: Buffer | null = null;
  try {
    productBuffer = await downloadImage(listing.main_image);
    log("Product image downloaded", { bytes: productBuffer.byteLength });
  } catch (err) {
    log("Product image download failed", { err: String(err) });
    return new Response(
      JSON.stringify({ error: "Failed to download product image", detail: String(err) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const assets: Array<{
    template_id: string;
    url: string;
    storage_path: string;
    dimensions: { width: number; height: number };
  }> = [];
  const errors: Array<{ template_id: string; error: string }> = [];

  for (const template of templates as Array<{
    id: string;
    name: string;
    config: TemplateConfig;
  }>) {
    try {
      const cfg = template.config as TemplateConfig;
      if (!cfg?.width || !cfg?.height || !cfg?.product_zone) {
        log("Invalid template config", { id: template.id });
        errors.push({ template_id: template.id, error: "Invalid config (missing width/height/product_zone)" });
        continue;
      }

      const { width: W, height: H, product_zone: pz, text_zones: tz = [] } = cfg;

      if (dry_run) {
        assets.push({
          template_id: template.id,
          url: `[DRY RUN] ad-creatives/${listing_id}/${template.id}.jpg`,
          storage_path: `ad-creatives/${listing_id}/${template.id}.jpg`,
          dimensions: { width: W, height: H },
        });
        continue;
      }

      // Step 1: Resize product image to fit product_zone
      const resizedProduct = await sharp(productBuffer)
        .resize(pz.width, pz.height, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();

      // Step 2: Try to fetch template background from Storage; use solid white if missing
      let backgroundBuffer: Buffer;
      const storagePath = `templates/${template.id}.png`;
      const { data: templateBlob } = await sb.storage
        .from("templates")
        .download(storagePath);

      if (templateBlob) {
        const ab = await templateBlob.arrayBuffer();
        backgroundBuffer = Buffer.from(ab);
        log("Template PNG loaded from Storage", { id: template.id });
      } else {
        // Generate placeholder background (solid color based on template name)
        log("No template PNG in Storage — using solid background", { id: template.id });
        backgroundBuffer = await sharp({
          create: {
            width: W,
            height: H,
            channels: 3,
            background: { r: 240, g: 240, b: 245 }, // light blue-grey placeholder
          },
        })
          .png()
          .toBuffer();
      }

      // Step 3: Composite: product onto background
      const composited = await sharp(backgroundBuffer)
        .resize(W, H)
        .composite([
          {
            input: resizedProduct,
            top: pz.top,
            left: pz.left,
            blend: "over",
          },
        ])
        .toBuffer();

      // Step 4: SVG text overlay (price + headline)
      const svgBuf = buildSvgOverlay(W, H, tz, listing.title ?? "", Number(listing.price_usd ?? 0));

      const final = await sharp(composited)
        .composite([{ input: svgBuf, blend: "over" }])
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();

      // Step 5: Upload to Supabase Storage
      const uploadPath = `ad-creatives/${listing_id}/${template.id}.jpg`;
      const { error: uploadErr } = await sb.storage
        .from("ad-creatives")
        .upload(uploadPath, final, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(`Storage upload failed: ${uploadErr.message}`);
      }

      // Get public URL
      const { data: urlData } = sb.storage.from("ad-creatives").getPublicUrl(uploadPath);
      const assetUrl = urlData?.publicUrl ?? "";

      // Step 6: Upsert ad_creative_assets
      await sb.from("ad_creative_assets").upsert(
        {
          listing_id,
          template_id: template.id,
          asset_url: assetUrl,
          storage_path: uploadPath,
          dimensions: { width: W, height: H },
        },
        { onConflict: "listing_id,template_id" }
      );

      assets.push({ template_id: template.id, url: assetUrl, storage_path: uploadPath, dimensions: { width: W, height: H } });
      log("Creative generated", { template: template.id, url: assetUrl.slice(-50) });
    } catch (err) {
      const msg = String(err);
      log("Error generating creative", { template: template.id, err: msg });
      errors.push({ template_id: template.id, error: msg });
    }
  }

  // Optional ZIP export
  const url = new URL(req.url);
  if (url.searchParams.get("export") === "zip" && assets.length > 0 && !dry_run) {
    // Return JSON with all URLs so client can download + zip client-side
    // Full ZIP streaming requires a zip library; return download URLs instead
    return new Response(
      JSON.stringify({
        listing_id,
        assets,
        errors,
        note: "Download each url and zip client-side. Server-side ZIP coming in v2.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  log("Done", { generated: assets.length, errors: errors.length, dry_run });

  return new Response(
    JSON.stringify({ listing_id, generated: assets.length, dry_run, assets, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
