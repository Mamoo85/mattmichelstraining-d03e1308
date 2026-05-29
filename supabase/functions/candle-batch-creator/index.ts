// candle-batch-creator — processes pod_product_queue candle items with correct scale=0.45
// Pulls items where product_type='candle' AND status='error' AND source='top20_replica' (our parked batch)
// Restores and processes one at a time; call repeatedly or pass { all: true } to loop internally.
// POST {} — process next pending candle from IDs 241-260
// POST { all: true } — process all remaining (loops with 30s delay between each)

const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Blueprint 755 = Sensory Decisions scented candle 9oz
const CANDLE_BLUEPRINT_ID = parseInt(Deno.env.get("PRINTIFY_CANDLE_BLUEPRINT_ID") ?? "755");
const CANDLE_PROVIDER_ID = parseInt(Deno.env.get("PRINTIFY_CANDLE_PRINT_PROVIDER_ID") ?? "0");
const CANDLE_VARIANT_IDS = (Deno.env.get("PRINTIFY_CANDLE_VARIANT_IDS") ?? "")
  .split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
const CANDLE_SCALE = 0.45;
const CANDLE_PRICE = 2699; // $26.99

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[CANDLE-BATCH] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

async function pFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${PRINTIFY_BASE}${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${PRINTIFY_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
    signal: opts.signal ?? AbortSignal.timeout(30_000),
  });
}

function sb() {
  return {
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, val: unknown) => ({
          in: (col2: string, vals: unknown[]) => fetch(
            `${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&${col2}=in.(${vals.join(",")})`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
          ).then(r => r.json()),
          limit: (n: number) => fetch(
            `${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&limit=${n}&order=id.asc`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
          ).then(r => r.json()),
          single: () => fetch(
            `${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&limit=1`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
          ).then(r => r.json()).then((d: unknown[]) => d[0]),
        }),
        and: (filter: string) => fetch(
          `${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${filter}&limit=1&order=id.asc`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        ).then(r => r.json()).then((d: unknown[]) => d[0]),
      }),
      update: (data: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => fetch(
          `${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`,
          {
            method: "PATCH",
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        ).then(r => r.ok ? null : r.text().then(t => { throw new Error(t); })),
      }),
    }),
  };
}

async function buildCandlePrompt(title: string, imagePrompt: string): Promise<string> {
  // Two-step: first get concrete visual description from GPT, then build final prompt
  let concretePrompt = imagePrompt;
  try {
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Create a concise image generation prompt for a FLAT 2D candle label design based on: "${imagePrompt || title}".
Return ONLY the prompt (under 60 words). Describe SPECIFIC visual elements: typography style, exact text phrase, colors, icons.
CRITICAL: Do NOT mention any 3D object, candle, jar, flame, or physical product. Describe ONLY the flat label artwork itself — colors, font styles, illustrated motifs, and text content.`,
        }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (gptRes.ok) {
      const pd = await gptRes.json();
      concretePrompt = pd.choices?.[0]?.message?.content?.trim() ?? imagePrompt;
    }
  } catch { /* fallback to imagePrompt */ }

  return `PRINT FILE ARTWORK — flat 2D rectangular label design for a scented candle jar. Pure white #FFFFFF background throughout the entire image. ` +
    `ABSOLUTE PROHIBITION: DO NOT draw a candle. DO NOT draw a jar. DO NOT draw a flame. DO NOT draw any 3D object or product. ` +
    `DO NOT show the candle sitting on a surface. DO NOT depict a physical product of any kind. ` +
    `This image IS the label artwork itself — a flat 2D graphic that will be printed on a rectangular sticker and applied to a candle jar. ` +
    `Design fills the full canvas from top to bottom and left to right. ` +
    `Label content: ${concretePrompt}. ` +
    `Bold readable typography, clean illustration style, print-on-demand ready.`;
}

async function processOneCandle(item: {
  id: number; name: string; image_prompt: string; description: string;
}): Promise<{ success: boolean; error?: string; printifyId?: string }> {
  log("Processing candle", { id: item.id, name: item.name.slice(0, 50) });

  // Mark as processing
  await fetch(`${SUPABASE_URL}/rest/v1/pod_product_queue?id=eq.${item.id}`, {
    method: "PATCH",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "processing" }),
  });

  // Get shop ID
  const shopId = SHOP_ID || await (async () => {
    const r = await pFetch("/shops.json");
    const d = await r.json();
    return String(Array.isArray(d) ? d[0]?.id : d.id);
  })();

  // Use env-configured provider + variants (same pattern as printify-product-creator)
  if (!CANDLE_PROVIDER_ID) throw new Error("PRINTIFY_CANDLE_PRINT_PROVIDER_ID env var not set");
  if (!CANDLE_VARIANT_IDS.length) throw new Error("PRINTIFY_CANDLE_VARIANT_IDS env var not set");
  const provider = { id: CANDLE_PROVIDER_ID };
  const variants = CANDLE_VARIANT_IDS.map(id => ({ id }));

  // Step 1: Generate image
  const fullPrompt = await buildCandlePrompt(item.name, item.image_prompt);
  log("Generating image", { prompt: fullPrompt.slice(0, 80) });

  const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
      background: "opaque",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!imgRes.ok) {
    const err = await imgRes.text();
    throw new Error(`Image gen failed: ${imgRes.status} ${err.slice(0, 150)}`);
  }
  const imgData = await imgRes.json();
  const b64 = imgData?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No b64_json in image response");

  // Step 2: Upload to Printify
  const uploadRes = await pFetch("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: `candle_${item.id}.png`, contents: b64 }),
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
  const uploadData = await uploadRes.json() as { id: string };
  const imageId = uploadData.id;
  log("Image uploaded", { imageId });

  // Step 3: SEO title & tags from GPT
  let seoTitle = item.name.slice(0, 140);
  let seoTags: string[] = [];
  try {
    const seoRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Write a concise Etsy listing title (max 140 chars) and 13 search tags for this scented candle: "${item.name}". Return JSON: {"title":"...","tags":["..."]}. Tags max 20 chars each.`,
        }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (seoRes.ok) {
      const sd = await seoRes.json();
      const parsed = JSON.parse(sd.choices?.[0]?.message?.content ?? "{}");
      seoTitle = (parsed.title ?? item.name).slice(0, 140);
      seoTags = (parsed.tags ?? []).slice(0, 13).map((t: string) => t.slice(0, 20));
    }
  } catch { /* fallback */ }

  // Step 4: Create Printify product
  const printAreas = [{
    variant_ids: variants.map(v => v.id),
    placeholders: [{
      position: "front",
      images: [{ id: imageId, x: 0.5, y: 0.5, scale: CANDLE_SCALE, angle: 0 }],
    }],
  }];

  const createRes = await pFetch(`/shops/${shopId}/products.json`, {
    method: "POST",
    body: JSON.stringify({
      title: seoTitle,
      description: item.description || `${item.name} — scented soy candle, perfect gift.`,
      blueprint_id: CANDLE_BLUEPRINT_ID,
      print_provider_id: provider.id,
      variants: variants.map(v => ({ id: v.id, price: CANDLE_PRICE, is_enabled: true })),
      print_areas: printAreas,
      tags: seoTags,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Create failed: ${createRes.status} ${err.slice(0, 200)}`);
  }
  const created = await createRes.json() as { id: string };
  log("Created Printify product", { printifyId: created.id });

  // Step 5: Wait for mockup, then publish
  await new Promise(r => setTimeout(r, 60_000));
  const pubRes = await pFetch(`/shops/${shopId}/products/${created.id}/publish.json`, {
    method: "POST",
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  });
  log("Published", { status: pubRes.status });

  // Step 6: Mark queue item as published
  await fetch(`${SUPABASE_URL}/rest/v1/pod_product_queue?id=eq.${item.id}`, {
    method: "PATCH",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "published" }),
  });

  return { success: true, printifyId: created.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!PRINTIFY_KEY) return Response.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });

  // Fetch next unprocessed candle from our parked batch (IDs 241-260, status=error, source=top20_replica)
  const nextRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pod_product_queue?select=id,name,image_prompt,description&product_type=eq.candle&status=eq.error&source=eq.top20_replica&id=gte.241&id=lte.260&order=id.asc&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const items = await nextRes.json() as Array<{ id: number; name: string; image_prompt: string; description: string }>;

  if (!items.length) {
    return Response.json({ done: true, message: "All candles processed (or none found in range 241-260)" });
  }

  const item = items[0];
  const remaining = await fetch(
    `${SUPABASE_URL}/rest/v1/pod_product_queue?select=id&product_type=eq.candle&status=eq.error&source=eq.top20_replica&id=gte.241&id=lte.260`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  ).then(r => r.json()).then((d: unknown[]) => d.length);

  try {
    const result = await processOneCandle(item);
    return Response.json({
      ...result,
      processed: item.name.slice(0, 60),
      queueId: item.id,
      remainingAfterThis: remaining - 1,
    });
  } catch (err) {
    const msg = (err as Error).message;
    log("Error processing candle", { id: item.id, error: msg });
    // Mark as error so it doesn't get retried in this run
    await fetch(`${SUPABASE_URL}/rest/v1/pod_product_queue?id=eq.${item.id}`, {
      method: "PATCH",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "error" }),
    });
    return Response.json({ error: msg, queueId: item.id }, { status: 500 });
  }
});
