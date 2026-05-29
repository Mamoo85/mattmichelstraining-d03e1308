// tumbler-batch-creator — processes pod_product_queue tumbler items with scale=3.5 (full-wrap)
// blueprint 353, provider 1, variant 44519
const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "2890106";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TUMBLER_BLUEPRINT_ID = 353;
const TUMBLER_PROVIDER_ID = 1;
const TUMBLER_VARIANT_IDS = [44519];
const TUMBLER_SCALE = 3.5;  // full-wrap: canvas is ~3.5x taller than wide
const TUMBLER_PRICE = 3999; // $39.99

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[TUMBLER-BATCH] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

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

async function buildTumblerPrompt(title: string, imagePrompt: string): Promise<string> {
  let concretePrompt = imagePrompt;
  try {
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Create a concise image generation prompt for a FULL-WRAP tumbler design based on: "${imagePrompt || title}".
Return ONLY the prompt (under 60 words). Describe colorful background, main text/slogan, and supporting graphic elements.
The design wraps fully around a cylindrical tumbler — describe vivid colors and bold typography. Do NOT mention the tumbler itself.`,
        }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (gptRes.ok) {
      const pd = await gptRes.json();
      concretePrompt = pd.choices?.[0]?.message?.content?.trim() ?? imagePrompt;
    }
  } catch { /* fallback */ }

  return `FULL-WRAP TUMBLER DESIGN — this image wraps completely around a cylindrical 20oz tumbler. ` +
    `Vibrant colorful background fills every pixel (no white, no margins). ` +
    `CRITICAL: The canvas is TALL and NARROW (full-height wrap). ` +
    `Main text/slogan centered vertically in the image. Background pattern extends to all edges. ` +
    `Design theme: ${concretePrompt}. ` +
    `Bold high-contrast colors, large readable text, print-on-demand ready.`;
}

async function processOneTumbler(item: {
  id: number; name: string; image_prompt: string; description: string;
}): Promise<{ success: boolean; printifyId?: string }> {
  log("Processing tumbler", { id: item.id, name: item.name.slice(0, 50) });

  await fetch(`${SUPABASE_URL}/rest/v1/pod_product_queue?id=eq.${item.id}`, {
    method: "PATCH",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "processing" }),
  });

  const fullPrompt = await buildTumblerPrompt(item.name, item.image_prompt);
  log("Generating image");

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
  const b64 = (await imgRes.json())?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No b64_json in image response");

  const uploadRes = await pFetch("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: `tumbler_${item.id}.png`, contents: b64 }),
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
  const imageId = (await uploadRes.json() as { id: string }).id;
  log("Uploaded image", { imageId });

  let seoTitle = item.name.slice(0, 140);
  let seoTags: string[] = [];
  try {
    const seoRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Write Etsy listing title (max 140 chars) and 13 search tags for this 20oz tumbler: "${item.name}". Return JSON: {"title":"...","tags":["..."]}. Tags max 20 chars.` }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (seoRes.ok) {
      const p = JSON.parse((await seoRes.json()).choices?.[0]?.message?.content ?? "{}");
      seoTitle = (p.title ?? item.name).slice(0, 140);
      seoTags = (p.tags ?? []).slice(0, 13).map((t: string) => t.slice(0, 20));
    }
  } catch { /* fallback */ }

  const createRes = await pFetch(`/shops/${SHOP_ID}/products.json`, {
    method: "POST",
    body: JSON.stringify({
      title: seoTitle,
      description: item.description || `${item.name} — 20oz insulated tumbler, perfect gift.`,
      blueprint_id: TUMBLER_BLUEPRINT_ID,
      print_provider_id: TUMBLER_PROVIDER_ID,
      variants: TUMBLER_VARIANT_IDS.map(id => ({ id, price: TUMBLER_PRICE, is_enabled: true })),
      print_areas: [{
        variant_ids: TUMBLER_VARIANT_IDS,
        placeholders: [{ position: "front", images: [{ id: imageId, x: 0.5, y: 0.5, scale: TUMBLER_SCALE, angle: 0 }] }],
      }],
      tags: seoTags,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Create failed: ${createRes.status} ${err.slice(0, 200)}`);
  }
  const printifyId = (await createRes.json() as { id: string }).id;
  log("Created", { printifyId });

  await new Promise(r => setTimeout(r, 60_000));
  await pFetch(`/shops/${SHOP_ID}/products/${printifyId}/publish.json`, {
    method: "POST",
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  });
  log("Published");

  await fetch(`${SUPABASE_URL}/rest/v1/pod_product_queue?id=eq.${item.id}`, {
    method: "PATCH",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "published" }),
  });

  return { success: true, printifyId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!PRINTIFY_KEY) return Response.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });

  const nextRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pod_product_queue?select=id,name,image_prompt,description&product_type=eq.tumbler&status=eq.error&source=eq.top20_replica&id=gte.261&id=lte.280&order=id.asc&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const items = await nextRes.json() as Array<{ id: number; name: string; image_prompt: string; description: string }>;

  if (!items.length) {
    return Response.json({ done: true, message: "All tumblers processed" });
  }

  const item = items[0];
  const remaining = await fetch(
    `${SUPABASE_URL}/rest/v1/pod_product_queue?select=id&product_type=eq.tumbler&status=eq.error&source=eq.top20_replica&id=gte.261&id=lte.280`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  ).then(r => r.json()).then((d: unknown[]) => d.length);

  try {
    const result = await processOneTumbler(item);
    return Response.json({ ...result, processed: item.name.slice(0, 60), queueId: item.id, remainingAfterThis: remaining - 1 });
  } catch (err) {
    const msg = (err as Error).message;
    log("Error", { id: item.id, error: msg });
    await fetch(`${SUPABASE_URL}/rest/v1/pod_product_queue?id=eq.${item.id}`, {
      method: "PATCH",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "error" }),
    });
    return Response.json({ error: msg, queueId: item.id }, { status: 500 });
  }
});
