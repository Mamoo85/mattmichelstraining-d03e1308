// pod-republish-wrong-dims v1
// Memory-safe image repair — never loads image pixels into memory.
// Instead of imagescript resize, regenerates fresh 1024x1024 images via gpt-image-1.
//
// Call sequence:
//   POST {"seedAudit": true}   — one-time: scans all Printify products → inserts into pod_dimension_audit
//   POST {}                    — repairs next pending product (1 per call, ~110s each)
//   POST {"dryRun": true}      — shows pending count without repairing

import { createClient } from "npm:@supabase/supabase-js@2";

const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_KEY  = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") ?? "";
const SHOP_ID       = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Blueprint → product type + correct scale
const BLUEPRINT_SPEC: Record<number, { type: string; scale: number; placeholders: string[] }> = {
  68:   { type: "mug",      scale: 0.45, placeholders: ["front"] },
  12:   { type: "tshirt",   scale: 1.0,  placeholders: ["front"] },
  77:   { type: "hoodie",   scale: 1.0,  placeholders: ["front"] },
  365:  { type: "sock",     scale: 3.5,  placeholders: ["front_left_leg", "front_right_leg", "back_left_leg", "back_right_leg"] },
  1447: { type: "hat",      scale: 0.5,  placeholders: ["front"] },
  608:  { type: "mousepad", scale: 0.85, placeholders: ["front"] },
  568:  { type: "onesie",   scale: 0.6,  placeholders: ["front"] },
  353:  { type: "tumbler",  scale: 3.5,  placeholders: ["front"] },
  70:   { type: "travelmug",scale: 3.5,  placeholders: ["front"] },
};

function buildImagePrompt(prompt: string, type: string): string {
  if (type === "mug") {
    return `${prompt}. Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `COFFEE MUG FRONT PANEL DESIGN: bold, eye-catching graphic centered on canvas. ` +
      `ALL elements within center 70% of canvas width and center 70% of canvas height — ` +
      `minimum 15% white margin on every edge. Typography large, bold, and fully legible. ` +
      `Nothing cropped or touching frame borders. High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "hat") {
    return `${prompt}. Pure white #FFFFFF background only. ` +
      `EMBROIDERY-STYLE HAT FRONT PANEL: compact, bold design within center 50% of canvas, large white margins all sides. ` +
      `Simple icon + text, no fine detail — must read clearly when printed small. High contrast, no watermarks, print-on-demand ready.`;
  }
  if (type === "sock") {
    return `${prompt}. Vibrant colorful background — NOT white, use saturated colors that match the theme. ` +
      `ALL-OVER PRINT CREW SOCK PATTERN — dense repeating tile pattern that fills every pixel of the square canvas. ` +
      `Pack the ENTIRE canvas edge-to-edge with repeating icons, motifs, and text related to the theme. ` +
      `NO white space, NO margins, NO borders — the pattern must bleed to every edge. ` +
      `Imagine this will be printed on fabric and wrapped around a sock — every inch must be covered. ` +
      `Bold, high-contrast, vibrant colors. At least 6-8 repeating elements visible. Print-on-demand ready.`;
  }
  if (type === "tumbler" || type === "travelmug") {
    return `${prompt}. Vibrant colorful background — NOT white. Fills every pixel of the square canvas. ` +
      `FULL-WRAP TUMBLER DESIGN: the image wraps around the entire circumference of a cylinder. ` +
      `MAIN TEXT AND ICON must be centered in the MIDDLE THIRD of the canvas width — this is the visible front face. ` +
      `Background color and pattern must extend edge-to-edge in all directions — NO white space, NO margins, NO borders. ` +
      `Bold, high-contrast, vibrant colors. Large readable text prominently centered. ` +
      `At least 6-8 design elements filling the space. Print-on-demand ready, 300 DPI quality.`;
  }
  return `${prompt}. Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
    `Entire subject fully visible, centered, with at least 15% white padding on every edge — ` +
    `nothing cropped or touching frame borders. High contrast, clean edges, no watermarks, print-on-demand ready.`;
}

function pFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${PRINTIFY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PRINTIFY_KEY}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
}

async function getShopId(): Promise<string> {
  if (SHOP_ID) return SHOP_ID;
  const res = await pFetch("/shops.json");
  const shops = await res.json();
  if (!shops?.length) throw new Error("No Printify shops found");
  return String(shops[0].id);
}

// Returns all products across all pages
async function fetchAllProducts(shopId: string): Promise<Array<{ id: string; title: string; blueprint_id: number; external: { id?: string } | null }>> {
  const all: Array<{ id: string; title: string; blueprint_id: number; external: { id?: string } | null }> = [];
  let page = 1;
  while (true) {
    const res = await pFetch(`/shops/${shopId}/products.json?page=${page}&limit=50`);
    if (!res.ok) break;
    const data = await res.json() as Record<string, unknown>;
    const items = Array.isArray(data.data) ? data.data as typeof all : [];
    all.push(...items);
    if (page >= (data.last_page as number || 1) || items.length === 0) break;
    page++;
  }
  return all;
}

async function generateRepairPrompt(productTitle: string, productType: string, openaiKey: string): Promise<string> {
  const typeLabel: Record<string, string> = {
    mug: "coffee mug",
    tshirt: "t-shirt",
    hoodie: "pullover hoodie",
    sock: "crew socks",
    hat: "dad hat / baseball cap",
    mousepad: "desk mouse pad",
    onesie: "baby onesie bodysuit",
    generic: "print-on-demand product",
  };
  const label = typeLabel[productType] ?? "print-on-demand product";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Create a concise image generation prompt for a print-on-demand ${label} design based on this product title: "${productTitle}". ` +
          `Requirements: completely original art, no brand names or copyrighted text, bold readable design, print-on-demand ready, high contrast. ` +
          `Return ONLY the image prompt, no explanation, max 120 words.`,
      }],
      temperature: 0.7,
      max_tokens: 150,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return productTitle;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? productTitle;
}

async function generateImage(prompt: string, type: string): Promise<string> {
  const imageSize = "1024x1024";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: buildImagePrompt(prompt, type),
      n: 1,
      size: imageSize,
      quality: "medium",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Image gen ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");
  return b64 as string;
}

async function uploadToPrintify(b64Image: string, filename: string): Promise<string> {
  const res = await pFetch("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: filename, contents: b64Image }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  const id = data?.id;
  if (!id) throw new Error("Printify upload returned no image ID");
  return String(id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  if (!PRINTIFY_KEY || !OPENAI_KEY) {
    return Response.json({ error: "Missing PRINTIFY_API_TOKEN or OPENAI_API_KEY" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  const seedAudit = body.seedAudit === true;
  const dryRun    = body.dryRun === true;

  // ——— seedAudit: scan all Printify products → upsert into pod_dimension_audit ———
  if (seedAudit) {
    try {
      const shopId = await getShopId();
      const products = await fetchAllProducts(shopId);

      const rows = products.map((p) => ({
        printify_id:  p.id,
        title:        p.title,
        blueprint_id: p.blueprint_id,
        product_type: BLUEPRINT_SPEC[p.blueprint_id]?.type ?? "unknown",
        status:       "pending",
      }));

      const { error } = await sb.from("pod_dimension_audit").upsert(rows, { onConflict: "printify_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);

      const { count } = await sb.from("pod_dimension_audit").select("id", { count: "exact", head: true }).eq("status", "pending");

      return Response.json({
        message: "Audit seeded",
        totalProducts: products.length,
        pendingRepair: count ?? 0,
        knownTypes: products.filter((p) => BLUEPRINT_SPEC[p.blueprint_id]).length,
        unknownBlueprint: products.filter((p) => !BLUEPRINT_SPEC[p.blueprint_id]).length,
      });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  // ——— dryRun: show pending count without repairing ———
  if (dryRun) {
    const { count: pending } = await sb.from("pod_dimension_audit").select("id", { count: "exact", head: true }).eq("status", "pending");
    const { count: repaired } = await sb.from("pod_dimension_audit").select("id", { count: "exact", head: true }).eq("status", "repaired");
    const { count: errored } = await sb.from("pod_dimension_audit").select("id", { count: "exact", head: true }).eq("status", "error");
    return Response.json({ pending, repaired, errored });
  }

  // ——— repair: process next pending product (1 per call to stay within 150s timeout) ———
  const { data: candidates, error: fetchErr } = await sb
    .from("pod_dimension_audit")
    .select("printify_id, title, blueprint_id, product_type")
    .eq("status", "pending")
    .order("id")
    .limit(1);

  if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });

  if (!candidates || candidates.length === 0) {
    const { count: repaired } = await sb.from("pod_dimension_audit").select("id", { count: "exact", head: true }).eq("status", "repaired");
    return Response.json({ message: "All products repaired", totalRepaired: repaired });
  }

  const target = candidates[0] as { printify_id: string; title: string; blueprint_id: number; product_type: string };
  const spec = BLUEPRINT_SPEC[target.blueprint_id];

  // Mark as processing to avoid duplicate work on concurrent calls
  await sb.from("pod_dimension_audit").update({ status: "processing", updated_at: new Date().toISOString() }).eq("printify_id", target.printify_id);

  try {
    const shopId = await getShopId();

    // Step 1: Fetch full product detail (variant IDs + existing print_areas + external listing info)
    const detailRes = await pFetch(`/shops/${shopId}/products/${target.printify_id}.json`);
    if (!detailRes.ok) throw new Error(`Detail fetch ${detailRes.status}`);
    const detail = await detailRes.json() as {
      id: string;
      title: string;
      blueprint_id: number;
      variants: Array<{ id: number }>;
      external: { id?: string } | null;
      print_areas?: Array<Record<string, unknown>>;
    };

    const variantIds = (detail.variants ?? []).map((v) => v.id);
    if (!variantIds.length) throw new Error("Product has no variants");

    // For unknown blueprints: read existing print_areas to extract placeholder positions + scale.
    // We regenerate the image fresh but preserve the same layout/scale the product already had.
    let effectiveSpec = spec;
    if (!effectiveSpec) {
      const existingPrintAreas = detail.print_areas ?? [];
      const firstArea = existingPrintAreas[0] as Record<string, unknown> | undefined;
      const existingPlaceholders = Array.isArray(firstArea?.placeholders)
        ? (firstArea.placeholders as Array<Record<string, unknown>>)
        : [];

      if (!existingPlaceholders.length) {
        await sb.from("pod_dimension_audit").update({
          status: "skipped",
          error_msg: `No print_areas found for unknown blueprint ${target.blueprint_id}`,
          updated_at: new Date().toISOString(),
        }).eq("printify_id", target.printify_id);
        return Response.json({ skipped: target.printify_id, reason: `No print_areas for blueprint ${target.blueprint_id}` });
      }

      // Extract positions and scale from existing print_areas
      const positions = existingPlaceholders.map((pl) => pl.position as string);
      const firstImages = Array.isArray(existingPlaceholders[0]?.images)
        ? existingPlaceholders[0].images as Array<Record<string, unknown>>
        : [];
      const existingScale = typeof firstImages[0]?.scale === "number" ? firstImages[0].scale as number : 1.0;

      effectiveSpec = { type: "generic", scale: existingScale, placeholders: positions };
      console.log(`[repair] Unknown blueprint ${target.blueprint_id} — using existing positions=${positions.join(",")} scale=${existingScale}`);
    }

    // Step 2: Generate new image prompt from product title
    const imagePrompt = await generateRepairPrompt(target.title, effectiveSpec.type, OPENAI_KEY);
    console.log(`[repair] ${target.title} → prompt: ${imagePrompt.slice(0, 80)}`);

    // Step 3: Generate fresh 1024x1024 image (no imagescript — zero pixel-buffer allocation)
    const b64Image = await generateImage(imagePrompt, effectiveSpec.type);
    console.log(`[repair] Image generated for: ${target.title}`);

    // Step 4: Upload to Printify
    const imageId = await uploadToPrintify(b64Image, `repair-${target.blueprint_id}-${Date.now()}.png`);
    console.log(`[repair] Uploaded image ${imageId}`);

    // Step 5: Build print_areas with correct scale for this product type
    const printAreas = [{
      variant_ids: variantIds,
      placeholders: effectiveSpec.placeholders.map((position) => ({
        position,
        images: [{ id: imageId, x: 0.5, y: 0.5, scale: effectiveSpec!.scale, angle: 0 }],
      })),
    }];

    // Step 6: PATCH product with new image
    const patchRes = await pFetch(`/shops/${shopId}/products/${target.printify_id}.json`, {
      method: "PUT",
      body: JSON.stringify({ print_areas: printAreas }),
    });
    if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);
    console.log(`[repair] Patched product ${target.printify_id}`);

    // Step 7: Wait for Printify to regenerate mockups (critical — without this, Etsy gets stale images)
    await new Promise((r) => setTimeout(r, 60_000));

    // Step 8: Re-publish to Etsy (only if already live)
    if (detail.external?.id) {
      const pubRes = await pFetch(`/shops/${shopId}/products/${target.printify_id}/publish.json`, {
        method: "POST",
        body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
      });
      if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
      console.log(`[repair] Published to Etsy: ${target.title}`);
    }

    // Step 9: Mark repaired
    await sb.from("pod_dimension_audit").update({
      status: "repaired",
      repaired_at: new Date().toISOString(),
      error_msg: null,
      updated_at: new Date().toISOString(),
    }).eq("printify_id", target.printify_id);

    // Show remaining count
    const { count: remaining } = await sb.from("pod_dimension_audit").select("id", { count: "exact", head: true }).eq("status", "pending");

    return Response.json({
      repaired: target.printify_id,
      title: target.title,
      type: effectiveSpec.type,
      scale: effectiveSpec.scale,
      imageId,
      republishedToEtsy: !!detail.external?.id,
      pendingRemaining: remaining ?? 0,
      callNext: (remaining ?? 0) > 0 ? `POST {} to repair next product` : "All done!",
    });

  } catch (e) {
    const errMsg = (e as Error).message;
    console.error(`[repair] Failed ${target.printify_id}: ${errMsg}`);

    await sb.from("pod_dimension_audit").update({
      status: "error",
      error_msg: errMsg.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("printify_id", target.printify_id);

    return Response.json({ error: errMsg, printify_id: target.printify_id }, { status: 500 });
  }
});
