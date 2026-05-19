// Regenerate one POD product's artwork with the correct print-area spec, validate
// dimensions, upload to Printify, swap into product's print_areas, and re-publish to Etsy.
//
// Body: { printify_id?: string, listing_id?: string }
// Returns: { ok, new_image_id?, dims?, error?, stage }
//
// Used for both:
//   1) one-off recovery of historical products generated with wrong bg/dims
//   2) ad-hoc re-bakes when art looks off

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Image, decode } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import {
  getPrintSpec,
  bgPromptFragment,
  validateImageDimensions,
  placeholderPlacement,
  type PrintSpec,
} from "../_shared/pod-print-spec.ts";

// Resize/recanvas generated PNG to the exact print-area pixel dimensions.
// - opaque_fullbleed / die_cut: cover-fit (scale-up + center-crop) → fills edge-to-edge
// - transparent: contain-fit on transparent canvas (no stretch, no bg)
// - white_centered: contain-fit centered on solid white at 33% width (mug center band)
async function normalizeToSpec(base64: string, spec: PrintSpec): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const src = await decode(bytes) as Image;
  const tw = spec.width, th = spec.height;
  let out: Image;

  if (spec.bgMode === "opaque_fullbleed" || spec.bgMode === "die_cut") {
    // cover: scale so smaller ratio fills, then crop center
    const scale = Math.max(tw / src.width, th / src.height);
    const nw = Math.round(src.width * scale);
    const nh = Math.round(src.height * scale);
    const scaled = src.clone().resize(nw, nh);
    out = new Image(tw, th);
    if (spec.bgMode === "opaque_fullbleed") {
      // sample top-left edge color to fill any sub-pixel gaps (rare with cover)
      const edge = scaled.getPixelAt(1, 1);
      out.fill(edge);
    }
    out.composite(scaled, Math.round((tw - nw) / 2), Math.round((th - nh) / 2));
  } else if (spec.bgMode === "white_centered") {
    // contain into center 33% of width, vertically centered, white bg
    const innerW = Math.round(tw * 0.33);
    const scale = Math.min(innerW / src.width, th / src.height);
    const nw = Math.round(src.width * scale);
    const nh = Math.round(src.height * scale);
    const scaled = src.clone().resize(nw, nh);
    out = new Image(tw, th);
    out.fill(0xffffffff);
    out.composite(scaled, Math.round((tw - nw) / 2), Math.round((th - nh) / 2));
  } else {
    // transparent: contain-fit, no background
    const scale = Math.min(tw / src.width, th / src.height);
    const nw = Math.round(src.width * scale);
    const nh = Math.round(src.height * scale);
    const scaled = src.clone().resize(nw, nh);
    out = new Image(tw, th); // alpha=0 by default
    out.composite(scaled, Math.round((tw - nw) / 2), Math.round((th - nh) / 2));
  }

  const png = await out.encode();
  // base64 encode
  let bin = "";
  for (let i = 0; i < png.length; i++) bin += String.fromCharCode(png[i]);
  return btoa(bin);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRINTIFY_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN")!;
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") || "2890106";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const UA = "Lovable-POD-Rebake/1.0";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

async function pf(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.printify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PRINTIFY_TOKEN}`,
      "User-Agent": UA,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`pf ${path} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function generateImage(prompt: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`image_gen_${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url?.startsWith("data:image/")) throw new Error("image_gen_no_data");
  return url.slice(url.indexOf(",") + 1);
}

function buildPrompt(originalPrompt: string, productType: string): string {
  const spec = getPrintSpec(productType);
  if (!spec) return originalPrompt;
  // Strip any old size/background instructions, keep the creative core.
  const core = originalPrompt
    .replace(/Sized for[^.]*\./gi, "")
    .replace(/on a transparent background[^.]*\./gi, "")
    .replace(/full bleed[^.]*\./gi, "")
    .replace(/No watermarks[^.]*\./gi, "")
    .trim();
  return `${core}\n\n${bgPromptFragment(spec, productType)} High-contrast bold flat vector style. No watermarks, no extra text, no mockup garments — just the print graphic itself.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: { printify_id?: string; listing_id?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: corsHeaders });
  }

  let stage = "lookup";
  try {
    const q = sb.from("pod_listings").select("id, printify_id, product_type, product_name, image_prompt").limit(1);
    const { data: rows, error } = body.printify_id
      ? await q.eq("printify_id", body.printify_id)
      : await q.eq("id", body.listing_id!);
    if (error) throw new Error(`db_${error.message}`);
    const listing = rows?.[0];
    if (!listing) throw new Error("listing_not_found");

    const spec = getPrintSpec(listing.product_type);
    if (!spec) throw new Error(`no_spec_for_${listing.product_type}`);

    stage = "image_gen";
    const prompt = buildPrompt(listing.image_prompt || listing.product_name, listing.product_type);
    const rawBase64 = await generateImage(prompt);

    stage = "normalize";
    const base64 = await normalizeToSpec(rawBase64, spec);

    stage = "validate";
    const v = await validateImageDimensions(base64, spec);
    // After normalize this should always pass; log either way.
    const dimsNote = v.ok ? `ok_${v.width}x${v.height}` : (v.reason ?? "unknown");

    stage = "upload";
    const fileName = `rebake-${listing.product_type}-${Date.now()}.png`;
    const up = await pf(`/uploads/images.json`, {
      method: "POST",
      body: JSON.stringify({ file_name: fileName, contents: base64 }),
    });
    if (!up?.id) throw new Error("upload_no_id");
    const newImageId: string = up.id;

    stage = "fetch_product";
    const product = await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${listing.printify_id}.json`);

    stage = "unlock_product";
    // Printify locks products after publish to Etsy. Must mark publish as
    // succeeded (or unpublish) to re-enable editing.
    try {
      await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${listing.printify_id}/publishing_succeeded.json`, {
        method: "POST",
        body: JSON.stringify({ external: { id: listing.printify_id, handle: `https://printify.com/app/products/${listing.printify_id}` } }),
      });
    } catch (_) { /* idempotent */ }
    try {
      await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${listing.printify_id}/unpublish.json`, { method: "POST" });
    } catch (_) { /* may already be unpublished */ }

    stage = "update_product";
    // Reset every placeholder to the new image with spec-driven placement so
    // full-bleed types fill edge-to-edge and mug art stays in the center 30%.
    const placement = placeholderPlacement(spec, newImageId);
    const updatedPrintAreas = (product.print_areas || []).map((pa: any) => ({
      ...pa,
      placeholders: (pa.placeholders || []).map((ph: any) => ({
        ...ph,
        images: [placement],
      })),
    }));
    await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${listing.printify_id}.json`, {
      method: "PUT",
      body: JSON.stringify({ print_areas: updatedPrintAreas }),
    });

    stage = "publish";
    await pf(`/shops/${PRINTIFY_SHOP_ID}/products/${listing.printify_id}/publish.json`, {
      method: "POST",
      body: JSON.stringify({
        title: true, description: true, images: true,
        variants: true, tags: true, keyFeatures: true, shipping_template: true,
      }),
    });

    stage = "log";
    await sb.from("pod_publish_logs").insert({
      listing_id: listing.id,
      product_name: listing.product_name,
      niche: "rebake",
      stage: "rebake_complete",
      attempt: 1,
      ok: true,
      duration_ms: 0,
      meta: { new_image_id: newImageId, dims: dimsNote, spec_w: spec.width, spec_h: spec.height, bg: spec.bgMode },
    }).then(() => {}, () => {});

    await sb.from("pod_listings").update({
      image_prompt: prompt,
      status: "publishing",
    }).eq("id", listing.id);

    return new Response(JSON.stringify({
      ok: true, printify_id: listing.printify_id, new_image_id: newImageId,
      dims: dimsNote, bg: spec.bgMode, spec: `${spec.width}x${spec.height}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ ok: false, stage, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
