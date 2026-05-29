// pod-visual-repair v3
// Five modes:
//   POST {"repairHats": true, "offset": 0}          — vision-scan hat at offset, repair if bad (1 per call)
//   POST {"findDuplicates": true}                    — list all products, delete duplicate titles
//   POST {"auditVisual": true, "offset": 0}          — vision-check 5 products at offset, return issues
//   POST {"deleteProductIds": ["id1","id2",...]}     — delete specific Printify products by ID
//   POST {"repairSocks": true, "offset": 0}          — regenerate sock images at 1024×1536 tall portrait, scale=2.5 (2 per call)
//   POST {"repairSocks": true, "offset": 0, "limit": 1} — repair 1 sock (for first-run verification)

const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-VISUAL-REPAIR] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

async function pFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.printify.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${PRINTIFY_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
    signal: opts.signal ?? AbortSignal.timeout(30_000),
  });
}

// Fetch all products across all pages
async function fetchAllProducts(shopId: string): Promise<PrintifyProduct[]> {
  const all: PrintifyProduct[] = [];
  let page = 1;
  while (true) {
    const res = await pFetch(`/shops/${shopId}/products.json?page=${page}&limit=50`);
    if (!res.ok) break;
    const data = await res.json() as { data: PrintifyProduct[]; total: number; last_page: number };
    if (!data.data?.length) break;
    all.push(...data.data);
    if (page >= (data.last_page ?? 1)) break;
    page++;
  }
  return all;
}

type PrintifyProduct = {
  id: string;
  title: string;
  blueprint_id: number;
  variants?: Array<{ id: number; price: number }>;
  images?: Array<{ src: string; position?: string }>;
  print_areas?: Array<{
    variant_ids: number[];
    placeholders: Array<{ position: string; images: Array<{ id: string; x: number; y: number; scale: number; angle: number }> }>;
  }>;
  external?: { id?: string };
};

// Download an image URL and return base64
async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Image download ${res.status}: ${url}`);
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Vision check: is this a hat design (flat graphic) or a hat photo (3D render of a hat)?
async function checkHatImage(imgUrl: string, title: string): Promise<{ isHatPhoto: boolean; reason: string; unknown?: boolean }> {
  if (!OPENAI_KEY) return { isHatPhoto: false, reason: "no key" };
  try {
    // Download image as base64 — Printify CDN blocks direct OpenAI access
    let b64: string;
    try {
      b64 = await urlToBase64(imgUrl);
    } catch (e) {
      return { isHatPhoto: false, unknown: true, reason: `img download failed: ${(e as Error).message}` };
    }
    const mimeType = b64.slice(0, 10).includes("JVBERi") ? "application/pdf" : imgUrl.includes(".png") ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${b64.slice(0, 500_000)}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: `This is a listing image for a custom hat from a print-on-demand store. The hat's front panel should display a FLAT 2D GRAPHIC DESIGN (text, icons, illustration — NOT a photo of a hat).

QUESTION: What is printed on the front panel of this hat?
A) A flat 2D graphic design, logo, text, or illustration (CORRECT)
B) A photorealistic render/photo of an actual hat — i.e. the design is a hat image (WRONG — "hat on a hat")
C) Blank / no design visible / unclear

Reply ONLY with JSON: {"type":"flat_design"|"hat_photo"|"blank_unclear","reason":"one sentence about what you see on the front panel"}`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { isHatPhoto: false, unknown: true, reason: `vision API ${res.status}: ${errText.slice(0, 100)}` };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.match(/\{.*\}/s)?.[0] ?? "{}");
    return {
      isHatPhoto: parsed.type === "hat_photo" || parsed.type === "blank_unclear",
      reason: parsed.reason ?? content,
    };
  } catch (e) {
    return { isHatPhoto: false, unknown: true, reason: `vision failed: ${(e as Error).message}` };
  }
}

// General vision check for any product type
async function auditProductImage(imgUrl: string, title: string, blueprintId: number): Promise<{ score: number; issue: string }> {
  if (!OPENAI_KEY) return { score: 5, issue: "" };
  try {
    const typeHint = blueprintId === 1447 ? "hat" : blueprintId === 68 ? "mug" : blueprintId === 12 ? "t-shirt" : blueprintId === 77 ? "hoodie" : blueprintId === 365 ? "sock" : "product";

    let b64: string;
    try {
      b64 = await urlToBase64(imgUrl);
    } catch (e) {
      return { score: 5, issue: `img download failed: ${(e as Error).message}` };
    }
    const mimeType = imgUrl.includes(".png") ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${b64.slice(0, 500_000)}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 120,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: `This is a listing image for a custom ${typeHint}. Assess the print design quality.

HARD FAIL (score 1) if ANY of:
- The design is a photo/3D-render of the same product type (e.g. a photo of a hat on a hat, a mug on a mug)
- Colored background (non-white) that will print as a garish rectangle
- Text is clipped, wrapped, or illegible
- Design shows DALL-E artifacts, watermarks, or is clearly wrong for this product

Score 2-3: acceptable but flawed (off-center, faint, not niche-matched)
Score 4-5: good clean design

Reply ONLY with JSON: {"score":1-5,"issue":"one sentence about the worst problem, or empty if good"}`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return { score: 5, issue: `vision API ${res.status}` };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.match(/\{.*\}/s)?.[0] ?? "{}");
    return { score: Number(parsed.score) || 5, issue: parsed.issue ?? "" };
  } catch (e) {
    return { score: 5, issue: `vision failed: ${(e as Error).message}` };
  }
}

// Build an improved hat design prompt explicitly forbidding hat renders
function buildHatRepairPrompt(productTitle: string, aiPrompt: string): string {
  const base = aiPrompt || productTitle;
  return `FLAT 2D GRAPHIC DESIGN FILE for hat front panel printing. ` +
    `CRITICAL — THIS IS NOT A PHOTO OF A HAT: ` +
    `DO NOT render any hat, cap, brim, visor, crown, strap, or hat shape. ` +
    `DO NOT show any 3D object, product, or physical item. ` +
    `This is a FLAT ARTWORK FILE — think of it as a sticker or patch to be printed on fabric. ` +
    `The image must be: compact bold text/icon design on a pure white background, ` +
    `centered in the middle 50% of the canvas with large white margins on all sides. ` +
    `Design theme: ${base}. ` +
    `Simple icon + short bold text layout (1–4 words max). Large clear fonts only, no fine detail. ` +
    `Pure white #FFFFFF background. High contrast. Clean edges. No watermarks. No hat shape. No 3D.`;
}

// Generate image with gpt-image-1
async function generateHatImage(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
      background: "opaque",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Image gen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned");
  return b64;
}

// Upload image to Printify, return image ID
async function uploadImageToPrintify(b64: string, filename: string): Promise<string> {
  const res = await pFetch("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: filename, contents: b64 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { id: string };
  return data.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const shopId = SHOP_ID || await (async () => {
      const r = await pFetch("/shops.json");
      const d = await r.json();
      return String(Array.isArray(d) ? d[0]?.id : d.id);
    })();

    // ——— MODE 1: repairHats — scan hat at offset, vision-check, repair if bad ———
    if (body.repairHats) {
      const offset: number = typeof body.offset === "number" ? body.offset : 0;
      const printifyPage = Math.floor(offset / 50) + 1;
      const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
      if (!pageRes.ok) throw new Error(`Page fetch ${pageRes.status}`);
      const pageData = await pageRes.json() as { data: PrintifyProduct[]; total: number; last_page: number };
      const pageItems = pageData.data ?? [];
      const totalProducts = pageData.total ?? pageItems.length;
      const lastPage = pageData.last_page ?? 1;
      const pageOffset = offset % 50;

      // Find next hat at or after pageOffset
      let hatIndex = -1;
      for (let i = pageOffset; i < pageItems.length; i++) {
        if (pageItems[i].blueprint_id === 1447) { hatIndex = i; break; }
      }
      if (hatIndex === -1) {
        const nextOffset = (printifyPage < lastPage) ? printifyPage * 50 : null;
        return Response.json({ checked: 0, status: "no_hat_on_page", nextOffset, total: totalProducts });
      }

      const hat = pageItems[hatIndex];
      const absoluteOffset = (printifyPage - 1) * 50 + hatIndex;
      const nextOffset = absoluteOffset + 1 < totalProducts ? absoluteOffset + 1 : null;

      // Fetch full product detail for print areas
      const detailRes = await pFetch(`/shops/${shopId}/products/${hat.id}.json`);
      if (!detailRes.ok) throw new Error(`Detail fetch ${detailRes.status}`);
      const detail = await detailRes.json() as PrintifyProduct;

      // Get mockup image for vision check (prefer non-side views)
      const mockupImg = detail.images?.find(i => i.position === "front") ?? detail.images?.[0];
      if (!mockupImg?.src) {
        return Response.json({ checked: 1, id: hat.id, title: hat.title, status: "skipped_no_image", nextOffset });
      }

      log("Checking hat", { title: hat.title, id: hat.id, offset: absoluteOffset });
      const { isHatPhoto, reason, unknown } = await checkHatImage(mockupImg.src, hat.title);

      if (unknown) {
        log("Vision check inconclusive — skipping", { title: hat.title, reason });
        return Response.json({ checked: 1, id: hat.id, title: hat.title, status: "vision_failed", reason, nextOffset });
      }
      if (!isHatPhoto) {
        log("Hat looks OK", { title: hat.title, reason });
        return Response.json({ checked: 1, id: hat.id, title: hat.title, status: "ok", reason, nextOffset });
      }

      // Bad hat — regenerate design
      log("Hat image is a hat photo — repairing", { title: hat.title, reason });

      // Generate improved image prompt from title
      const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: `Create a concise print-on-demand hat design concept from this title: "${hat.title}". Return ONLY the design concept in 1–2 sentences. Focus on the key message/humor. Use simple bold text + 1 icon. No hat shapes or 3D objects.` }],
          temperature: 0.7,
          max_tokens: 80,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const promptData = promptRes.ok ? await promptRes.json() : {};
      const aiPrompt = promptData.choices?.[0]?.message?.content?.trim() ?? hat.title;

      const repairPrompt = buildHatRepairPrompt(hat.title, aiPrompt);
      const b64 = await generateHatImage(repairPrompt);
      const imageId = await uploadImageToPrintify(b64, `hat-repair-${hat.id}-${Date.now()}.png`);

      const variantIds = (detail.variants ?? []).map(v => v.id);
      const patchRes = await pFetch(`/shops/${shopId}/products/${hat.id}.json`, {
        method: "PUT",
        body: JSON.stringify({
          print_areas: [{
            variant_ids: variantIds,
            placeholders: [{ position: "front", images: [{ id: imageId, x: 0.5, y: 0.5, scale: 0.5, angle: 0 }] }],
          }],
        }),
      });
      if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);

      // Wait for mockups to regenerate
      await new Promise(r => setTimeout(r, 60_000));

      // Re-publish if already on Etsy
      if (detail.external?.id) {
        await pFetch(`/shops/${shopId}/products/${hat.id}/publish.json`, {
          method: "POST",
          body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true, shipping_template: false }),
        });
      }

      return Response.json({ checked: 1, id: hat.id, title: hat.title, status: "repaired", oldReason: reason, nextOffset });
    }

    // ——— MODE 2: findDuplicates — list all products, detect + delete duplicates ———
    if (body.findDuplicates) {
      log("Fetching all products for duplicate check...");
      const all = await fetchAllProducts(shopId);
      log(`Total products: ${all.length}`);

      // Normalize title for comparison
      const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

      // Group by normalized title
      const groups = new Map<string, PrintifyProduct[]>();
      for (const p of all) {
        const key = normalize(p.title);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
      }

      const duplicateGroups: Array<{ title: string; count: number; kept: string; deleted: string[] }> = [];
      let totalDeleted = 0;

      for (const [key, products] of groups) {
        if (products.length <= 1) continue;

        // Sort: prefer published (has external.id), then by id desc (most recent)
        products.sort((a, b) => {
          const aPublished = a.external?.id ? 1 : 0;
          const bPublished = b.external?.id ? 1 : 0;
          if (bPublished !== aPublished) return bPublished - aPublished;
          return b.id > a.id ? 1 : -1; // lexicographic — Printify IDs are chronological hex
        });

        const [keep, ...toDelete] = products;
        const deletedIds: string[] = [];

        for (const p of toDelete) {
          try {
            const delRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`, { method: "DELETE" });
            if (delRes.ok || delRes.status === 404) {
              deletedIds.push(p.id);
              totalDeleted++;
              log(`Deleted duplicate: ${p.title} (${p.id})`);
            } else {
              log(`Delete failed for ${p.id}: ${delRes.status}`);
            }
          } catch (e) {
            log(`Delete error for ${p.id}: ${(e as Error).message}`);
          }
          await new Promise(r => setTimeout(r, 500)); // rate limit
        }

        duplicateGroups.push({
          title: keep.title,
          count: products.length,
          kept: keep.id,
          deleted: deletedIds,
        });
      }

      return Response.json({
        totalProducts: all.length,
        duplicateGroups: duplicateGroups.length,
        totalDeleted,
        groups: duplicateGroups,
      });
    }

    // ——— MODE 3: auditVisual — vision-check 5 products at offset for any visual errors ———
    if (body.auditVisual) {
      const offset: number = typeof body.offset === "number" ? body.offset : 0;
      const limit = 5;
      const printifyPage = Math.floor(offset / 50) + 1;
      const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
      if (!pageRes.ok) throw new Error(`Page fetch ${pageRes.status}`);
      const pageData = await pageRes.json() as { data: PrintifyProduct[]; total: number; last_page: number };
      const totalProducts = pageData.total ?? 0;
      const lastPage = pageData.last_page ?? 1;
      const pageOffset = offset % 50;
      const batch = (pageData.data ?? []).slice(pageOffset, pageOffset + limit);

      const results: Array<{ id: string; title: string; blueprintId: number; score: number; issue: string }> = [];

      for (const p of batch) {
        const img = p.images?.find(i => i.position === "front") ?? p.images?.[0];
        if (!img?.src) { results.push({ id: p.id, title: p.title, blueprintId: p.blueprint_id, score: 5, issue: "no image" }); continue; }
        const { score, issue } = await auditProductImage(img.src, p.title, p.blueprint_id);
        results.push({ id: p.id, title: p.title, blueprintId: p.blueprint_id, score, issue });
        log(`Audited: ${p.title.slice(0, 50)} → score ${score}${issue ? ": " + issue : ""}`);
      }

      const nextOffset = offset + batch.length < totalProducts ? offset + batch.length : null;
      const badProducts = results.filter(r => r.score <= 2);

      return Response.json({
        offset,
        nextOffset,
        processed: batch.length,
        total: totalProducts,
        badProducts,
        allResults: results,
      });
    }

    // ——— MODE 4: deleteProductIds — delete specific products by ID ———
    if (Array.isArray(body.deleteProductIds)) {
      const ids: string[] = body.deleteProductIds;
      const results: Array<{ id: string; status: string }> = [];
      for (const id of ids) {
        try {
          const delRes = await pFetch(`/shops/${shopId}/products/${id}.json`, { method: "DELETE" });
          if (delRes.ok || delRes.status === 404) {
            results.push({ id, status: "deleted" });
            log(`Deleted product: ${id}`);
          } else {
            results.push({ id, status: `error_${delRes.status}` });
          }
        } catch (e) {
          results.push({ id, status: `exception: ${(e as Error).message.slice(0, 60)}` });
        }
        await new Promise(r => setTimeout(r, 300));
      }
      return Response.json({ deleted: results.filter(r => r.status === "deleted").length, results });
    }

    // ——— MODE 5: repairSocks — regenerate all bp 365 (ArtsAdd crew sock) images ———
    // Uses 1024×1536 TALL PORTRAIT (not square) at scale=2.5 to fill the full sock leg print area.
    // Math: scale=2.5 × (1536/1024) = 3.75 × pw ≥ ph for the ~1:3 sock leg print area.
    if (body.repairSocks) {
      const SOCK_IMAGE_SIZE = "1024x1536";
      const SOCK_SCALE = 2.5;
      const offset: number = typeof body.offset === "number" ? body.offset : 0;
      const batchLimit: number = typeof body.limit === "number" ? body.limit : 2;

      const printifyPage = Math.floor(offset / 50) + 1;
      const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
      if (!pageRes.ok) throw new Error(`Page fetch ${pageRes.status}`);
      const pageData = await pageRes.json() as { data: PrintifyProduct[]; total: number; last_page: number };
      const pageItems = pageData.data ?? [];
      const totalProducts = pageData.total ?? pageItems.length;
      const pageOffset = offset % 50;

      // Collect up to batchLimit socks starting at pageOffset
      const socksToRepair: Array<{ item: PrintifyProduct; absoluteOffset: number }> = [];
      for (let i = pageOffset; i < pageItems.length && socksToRepair.length < batchLimit; i++) {
        if (pageItems[i].blueprint_id === 365) {
          socksToRepair.push({ item: pageItems[i], absoluteOffset: Math.floor(offset / 50) * 50 + i });
        }
      }

      if (socksToRepair.length === 0) {
        const nextPageOffset = Math.floor(offset / 50) * 50 + 50;
        if (nextPageOffset < totalProducts) {
          return Response.json({ skipped: "No socks on this page", callNext: `POST {"repairSocks":true,"offset":${nextPageOffset}}`, total: totalProducts });
        }
        return Response.json({ done: true, message: "All socks processed", total: totalProducts });
      }

      const results: Array<Record<string, unknown>> = [];
      let lastAbsoluteOffset = offset;

      for (const { item: sock, absoluteOffset } of socksToRepair) {
        lastAbsoluteOffset = absoluteOffset;
        log("Repairing sock", { title: sock.title, id: sock.id, offset: absoluteOffset });

        // Step 1: Fetch full product detail for print areas
        const detailRes = await pFetch(`/shops/${shopId}/products/${sock.id}.json`);
        if (!detailRes.ok) {
          results.push({ id: sock.id, title: sock.title, error: `Detail fetch failed: ${detailRes.status}` });
          continue;
        }
        const detail = await detailRes.json() as PrintifyProduct;
        const printAreas = detail.print_areas ?? [];

        // Step 2: GPT-4o-mini generates concrete themed prompt from title
        let imagePrompt = sock.title;
        try {
          const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{
                role: "user",
                content: `Create a concise image generation prompt for a flat 2D sock all-over-print design based on this product title: "${sock.title}". ` +
                  `Return ONLY the prompt (under 60 words). Describe SPECIFIC illustrated elements (characters, objects, symbols) ` +
                  `that should appear scattered uniformly across a TALL PORTRAIT canvas from top to bottom. ` +
                  `Include the exact funny/themed text phrase to show if relevant. ` +
                  `Do NOT use abstract style words like "bold", "aesthetic", "high contrast" — describe actual visual content only.`,
              }],
            }),
            signal: AbortSignal.timeout(15_000),
          });
          if (promptRes.ok) {
            const pd = await promptRes.json();
            imagePrompt = pd.choices?.[0]?.message?.content?.trim() ?? sock.title;
          }
        } catch { /* use title fallback */ }

        // Step 3: Generate 1024×1536 tall portrait image
        const fullPrompt = `SOCK ALL-OVER PRINT DESIGN — TALL PORTRAIT CANVAS (1024×1536, taller than wide). ` +
          `CRITICAL — FILL THE FULL HEIGHT: Spread all pattern elements uniformly from the TOP to the BOTTOM of the canvas. ` +
          `Do NOT concentrate elements in the middle. Do NOT leave blank space at the top or bottom. ` +
          `CRITICAL: Use a VIBRANT SATURATED COLORED background that fills the entire canvas — bold red, navy, forest green, hot pink, bright orange, etc. ` +
          `DO NOT use white or light backgrounds — they would be invisible against the white sock body. ` +
          `CRITICAL — ONE UNIFIED PATTERN ONLY: This SAME image tiles identically across BOTH sock legs. ` +
          `DO NOT put different designs on the left half vs. right half. DO NOT create two separate sock designs side by side. ` +
          `Create ONE cohesive repeating pattern with the same themed elements distributed uniformly across the ENTIRE canvas — left, right, top, bottom equally. ` +
          `DO NOT render any style-instruction words as visible text. ` +
          `Design theme: ${imagePrompt || sock.title}. ` +
          `Render the ACTUAL themed artwork: illustrated characters, icons, symbols scattered uniformly corner-to-corner. ` +
          `Bold, high-contrast cartoon illustration style. No watermarks, print-on-demand ready.`;

        const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-image-1", prompt: fullPrompt, n: 1, size: SOCK_IMAGE_SIZE, quality: "medium", background: "opaque" }),
          signal: AbortSignal.timeout(90_000),
        });
        if (!imgRes.ok) {
          results.push({ id: sock.id, title: sock.title, error: `Image gen failed: ${imgRes.status}` });
          continue;
        }
        const imgData = await imgRes.json();
        const b64 = imgData?.data?.[0]?.b64_json;
        if (!b64) { results.push({ id: sock.id, title: sock.title, error: "No image data returned" }); continue; }

        // Step 4: Upload to Printify
        const uploadRes = await pFetch("/uploads/images.json", {
          method: "POST",
          body: JSON.stringify({ file_name: `sock_repair_${sock.id}.png`, contents: b64 }),
        });
        if (!uploadRes.ok) { results.push({ id: sock.id, title: sock.title, error: `Upload failed: ${uploadRes.status}` }); continue; }
        const uploadData = await uploadRes.json() as { id: string };
        const imageId = uploadData.id;

        // Step 5: PATCH all 4 print areas with new image at SOCK_SCALE
        const newPrintAreas = printAreas.map((area) => ({
          ...area,
          placeholders: area.placeholders.map((ph) => ({
            ...ph,
            images: [{ id: imageId, x: 0.5, y: 0.5, scale: SOCK_SCALE, angle: 0 }],
          })),
        }));
        const patchRes = await pFetch(`/shops/${shopId}/products/${sock.id}.json`, {
          method: "PUT",
          body: JSON.stringify({ print_areas: newPrintAreas }),
        });
        if (!patchRes.ok) {
          results.push({ id: sock.id, title: sock.title, error: `PATCH failed: ${patchRes.status}` });
          continue;
        }
        log("PATCHed sock", { id: sock.id, scale: SOCK_SCALE, size: SOCK_IMAGE_SIZE });

        // No 60s wait needed — external.id is always null on this pipeline (publishes via
        // Etsy API directly, not Printify channel). Mockups regenerate in background automatically.
        // Skipping wait keeps each sock under 80s so 2/batch fits in 150s wall clock.
        results.push({ id: sock.id, title: sock.title, offset: absoluteOffset, success: true, imageId });
      }

      const nextOffset = lastAbsoluteOffset + 1;
      const hasMore = nextOffset < totalProducts;
      return Response.json({
        repaired: results,
        imageSpec: { size: SOCK_IMAGE_SIZE, scale: SOCK_SCALE },
        callNext: hasMore ? `POST {"repairSocks":true,"offset":${nextOffset}}` : null,
        total: totalProducts,
        done: !hasMore,
      });
    }

    return Response.json({ error: "Specify repairHats, findDuplicates, auditVisual, deleteProductIds, or repairSocks" }, { status: 400 });

  } catch (e) {
    const msg = (e as Error).message;
    log("Error", msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});
