// pod-onesie-journal-repair v1
// POST { repairProductIds: string[] } — repair onesie (bp=568) or journal (bp=75) by Printify ID
// POST { patchTitles: [{id, title}] } — rename product + re-publish
// Note: deployed with verify_jwt:false (uses PRINTIFY_API_TOKEN + OPENAI_API_KEY from function env)
// 20s mockup wait (vs 60s in main function) to fit within Supabase 150s CPU wall clock

const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";

async function pFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${PRINTIFY_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${PRINTIFY_KEY}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
}

async function getShopId(): Promise<string> {
  if (SHOP_ID) return SHOP_ID;
  const res = await pFetch("/shops.json");
  const shops = await res.json();
  if (!shops?.length) throw new Error("No shops");
  return String(shops[0].id);
}

const BRAND = "Bold graphic design. High contrast with one accent color pop. Professional print-on-demand aesthetic. ";
const THUMB = "Design must read clearly at 200px thumbnail size — bold, high-contrast, no fine detail. Use a 2-3 color palette maximum. ";

function buildPrompt(prompt: string, bp: number): string {
  const branded = BRAND + prompt;
  if (bp === 568) {
    return `${branded}. Pure white #FFFFFF background only. BABY ONESIE CHEST PRINT DESIGN: Small centered chest design. CRITICAL: render ONLY the exact words in the prompt — no extra text. Cute chest print — keep the entire design within the center 75% of the canvas width and center 70% of the canvas height. Minimum 12% white margin on all 4 sides. Bold cute illustration or cheerful typography. ${THUMB}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  return `${branded}. Pure white #FFFFFF or solid color background. JOURNAL / NOTEBOOK COVER DESIGN — FRONT COVER ONLY: Bold, clean front cover design. Keep ALL content within the center 90% of the canvas width and center 80% of the canvas height. CRITICAL — NO SPINE BLEED: Do NOT bleed artwork into the left 10% of the canvas. No full-bleed edge-to-edge; maintain clear margins. CRITICAL TEXT RULE: render ONLY those exact words — no additional text. Text must be large, clean, and fully legible. ${THUMB}High contrast, no watermarks, print-on-demand ready.`;
}

async function generateImage(prompt: string, bp: number): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt: buildPrompt(prompt, bp), n: 1, size: "1024x1024", quality: "medium", background: "opaque" }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) { const e = await res.text().catch(() => ""); throw new Error(`Image gen ${res.status}: ${e.slice(0, 200)}`); }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned");
    return b64;
  }
  throw new Error("Image gen failed after 3 attempts");
}

async function uploadImage(b64: string, filename: string): Promise<string> {
  const res = await pFetch("/uploads/images.json", { method: "POST", body: JSON.stringify({ file_name: filename, contents: b64 }) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload error: ${JSON.stringify(data)}`);
  return data.id as string;
}

Deno.serve(async (req) => {
  if (!PRINTIFY_KEY) return Response.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });
  if (req.method !== "POST") return new Response("POST required", { status: 405 });

  const body = await req.json().catch(() => ({}));
  const shopId = await getShopId();

  // patchTitles mode
  if (Array.isArray(body.patchTitles)) {
    const results = [];
    for (const item of body.patchTitles as Array<{id: string; title: string}>) {
      try {
        const detRes = await pFetch(`/shops/${shopId}/products/${item.id}.json`);
        if (!detRes.ok) throw new Error(`Fetch ${detRes.status}`);
        const det = await detRes.json() as Record<string, unknown>;
        const patchRes = await pFetch(`/shops/${shopId}/products/${item.id}.json`, { method: "PUT", body: JSON.stringify({ title: item.title }) });
        if (!patchRes.ok) throw new Error(`PUT ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);
        const ext = det.external as Record<string, unknown> | null;
        if (ext?.id) {
          await new Promise(r => setTimeout(r, 2_000));
          const pubRes = await pFetch(`/shops/${shopId}/products/${item.id}/publish.json`, { method: "POST", body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }) });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}`);
        }
        results.push({ id: item.id, oldTitle: det.title, newTitle: item.title, status: "updated" });
      } catch (e) {
        results.push({ id: item.id, newTitle: item.title, status: "error", error: (e as Error).message });
      }
    }
    return Response.json({ count: results.filter(r => r.status === "updated").length, results });
  }

  // repairProductIds mode — onesie (bp=568) and journal (bp=75) only
  if (Array.isArray(body.repairProductIds)) {
    const SUPPORTED = new Set([568, 75]);
    const SCALES: Record<number, number> = { 568: 0.75, 75: 1.0 };
    const results = [];
    const repaired: Array<{id: string; title: string}> = [];

    for (const productId of body.repairProductIds as string[]) {
      try {
        const detRes = await pFetch(`/shops/${shopId}/products/${productId}.json`);
        if (!detRes.ok) throw new Error(`Fetch ${detRes.status}`);
        const product = await detRes.json() as Record<string, unknown>;
        const bp = product.blueprint_id as number;

        if (!SUPPORTED.has(bp)) {
          results.push({ id: productId, title: product.title, status: "skipped", error: `blueprint ${bp} not supported here` });
          continue;
        }

        const typeLabel = bp === 568 ? "onesie" : "journal";
        const promptInstruction = bp === 568
          ? `Create a concise image generation prompt for FLAT GRAPHIC DESIGN artwork for a baby onesie/bodysuit chest print based on this product title: "${product.title}". Return ONLY the image prompt, no other text. Keep it under 80 words. Describe ONLY the cute illustration and typography — do NOT mention the onesie, baby, or product itself.`
          : `Create a concise image generation prompt for a JOURNAL FRONT COVER design based on this product title: "${product.title}". Return ONLY the image prompt, no other text. Keep it under 80 words. Describe ONLY the front cover design elements. Do NOT mention the journal or product. Front cover only — NOT the spine.`;

        const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: promptInstruction }], temperature: 0.7, max_tokens: 150 }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!promptRes.ok) throw new Error(`Prompt gen ${promptRes.status}`);
        const promptData = await promptRes.json();
        const imagePrompt = promptData.choices?.[0]?.message?.content?.trim() ?? String(product.title);

        const b64 = await generateImage(imagePrompt, bp);
        const imageId = await uploadImage(b64, `${typeLabel}-repair-${Date.now()}.png`);

        const variants = (product.variants as Array<Record<string, unknown>> ?? []).map(v => v.id as number);
        const patchRes = await pFetch(`/shops/${shopId}/products/${productId}.json`, {
          method: "PUT",
          body: JSON.stringify({ print_areas: [{ variant_ids: variants, placeholders: [{ position: "front", images: [{ id: imageId, x: 0.5, y: 0.5, scale: SCALES[bp], angle: 0 }] }] }] }),
        });
        if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);
        repaired.push({ id: productId, title: String(product.title) });
        console.log(`Patched ${typeLabel}: ${product.title}`);
      } catch (e) {
        results.push({ id: productId, title: "", status: "error", error: (e as Error).message });
      }
    }

    // 20s wait (vs 60s in main function) — keeps total runtime under 150s CPU wall clock
    if (repaired.length > 0) await new Promise(r => setTimeout(r, 20_000));

    for (const p of repaired) {
      try {
        const detRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`);
        const det = await detRes.json() as Record<string, unknown>;
        const ext = det.external as Record<string, unknown> | null;
        if (ext?.id) {
          const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, { method: "POST", body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }) });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}`);
          await new Promise(r => setTimeout(r, 3_000));
        }
        results.push({ id: p.id, title: p.title, status: "repaired" });
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
      }
    }

    return Response.json({ repaired: results.filter(r => r.status === "repaired").length, skipped: results.filter(r => r.status === "skipped").length, errors: results.filter(r => r.status === "error").length, results });
  }

  return Response.json({ error: "Send {repairProductIds:[...]} or {patchTitles:[...]}" }, { status: 400 });
});
