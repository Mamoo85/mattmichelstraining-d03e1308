// pod-publisher — daily 11am UTC
// Reads approved pod_designs with Printify image IDs, creates mug products on Printify,
// publishes them to the connected Etsy shop, and records listings in pod_listings.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[POD-PUBLISHER] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const PRODUCTS = {
  mug: {
    blueprintId: 68,          // White Glossy Mug 11oz
    retailPriceCents: 1899,   // $18.99 (free shipping baked in)
    providerEnv: "PRINTIFY_MUG_PRINT_PROVIDER_ID",
    variantEnv: "PRINTIFY_MUG_VARIANT_IDS",
  },
  shirt: {
    blueprintId: 12,          // Bella+Canvas 3001 Unisex Tee
    retailPriceCents: 2299,   // $22.99 (free shipping baked in)
    providerEnv: "PRINTIFY_SHIRT_PRINT_PROVIDER_ID",
    variantEnv: "PRINTIFY_SHIRT_VARIANT_IDS",
  },
  tote: {
    blueprintId: 9,           // Tote Bag
    retailPriceCents: 2099,   // $20.99 (free shipping baked in)
    providerEnv: "PRINTIFY_TOTE_PRINT_PROVIDER_ID",
    variantEnv: "PRINTIFY_TOTE_VARIANT_IDS",
  },
  hoodie: {
    blueprintId: 77,          // Unisex Heavy Blend Hoodie (Gildan 18500)
    retailPriceCents: 3899,   // $38.99 (free shipping baked in)
    providerEnv: "PRINTIFY_HOODIE_PRINT_PROVIDER_ID",
    variantEnv: "PRINTIFY_HOODIE_VARIANT_IDS",
  },
} as const;

async function printifyPost(path: string, body: unknown, token: string): Promise<unknown> {
  const res = await fetch(`https://api.printify.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Printify POST ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const batchMode = url.searchParams.get("batch") === "true";
  const publishLimit = batchMode ? 10 : 3;

  const PRINTIFY_API_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN");
  const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const missing = [
    !PRINTIFY_API_TOKEN && "PRINTIFY_API_TOKEN",
    !PRINTIFY_SHOP_ID && "PRINTIFY_SHOP_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    return new Response(JSON.stringify({ error: `Missing env: ${missing.join(", ")}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  function getProductConfig(productType: string) {
    const spec = PRODUCTS[productType as keyof typeof PRODUCTS] ?? PRODUCTS.mug;
    const providerStr = Deno.env.get(spec.providerEnv) ?? Deno.env.get("PRINTIFY_PRINT_PROVIDER_ID");
    const variantStr = Deno.env.get(spec.variantEnv) ?? Deno.env.get("PRINTIFY_VARIANT_IDS");
    if (!providerStr || !variantStr) {
      throw new Error(`Missing Printify config for product type "${productType}" (${spec.providerEnv}, ${spec.variantEnv})`);
    }
    return {
      blueprintId: spec.blueprintId,
      retailPriceCents: spec.retailPriceCents,
      printProviderId: parseInt(providerStr, 10),
      variantIds: variantStr.split(",").map(v => parseInt(v.trim(), 10)),
    };
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Get already-published design IDs
  const { data: existingListings } = await sb
    .from("pod_listings")
    .select("design_id");
  const publishedIds = (existingListings ?? []).map((r: { design_id: number }) => r.design_id);

  // Find approved designs not yet published
  let designQuery = sb
    .from("pod_designs")
    .select(`
      id, niche, dalle_prompt, image_url, printify_image_id, product_type,
      trend:etsy_pod_trends(title, tags)
    `)
    .eq("status", "approved")
    .not("printify_image_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(publishLimit);

  if (publishedIds.length > 0) {
    designQuery = designQuery.not("id", "in", `(${publishedIds.join(",")})`);
  }

  const { data: designs, error: fetchErr } = await designQuery;

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!designs || designs.length === 0) {
    log("No approved designs ready to publish");
    return new Response(
      JSON.stringify({ published: 0, message: "No designs ready" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  log("Publishing designs", { count: designs.length });
  const published: string[] = [];

  for (const design of designs as any[]) {
    const trendTitle: string = design.trend?.title ?? design.niche ?? "Funny Gift";
    const trendTags: string[] = design.trend?.tags ?? [];
    const productType: string = design.product_type ?? "mug";
    const productLabel = productType === "shirt" ? "unisex t-shirt" : "11oz white coffee mug";

    try {
      const cfg = getProductConfig(productType);

      // 1. Generate a fresh product title + description via AI
      const titlePrompt = `Write a short, catchy Etsy product title (max 60 chars) for a funny ${productLabel} inspired by: "${trendTitle}". Be original, no brand names. Return the title only.`;
      const descPrompt = `Write a 2-sentence Etsy product description for a funny ${productLabel} inspired by: "${trendTitle}". Mention it's a great gift. Keep it friendly and concise.`;

      const [productTitle, productDesc] = await Promise.all([
        generateText(titlePrompt, 80).then(t => t || trendTitle.slice(0, 60)),
        generateText(descPrompt, 150).then(t => t || `A unique ${productLabel} for ${design.niche} fans. Makes a perfect gift!`),
      ]);

      // Pick top 13 tags (Etsy max) from trend tags + niche words
      const nicheWords = (design.niche ?? "").split(" ").filter(Boolean);
      const allTags = [...new Set([...trendTags, ...nicheWords])].slice(0, 13);

      log("Creating product", { title: productTitle.slice(0, 50), productType });

      // 2. Create product on Printify
      const product = await printifyPost(
        `/shops/${PRINTIFY_SHOP_ID}/products.json`,
        {
          title: productTitle,
          description: productDesc,
          blueprint_id: cfg.blueprintId,
          print_provider_id: cfg.printProviderId,
          variants: cfg.variantIds.map(id => ({
            id,
            price: cfg.retailPriceCents,
            is_enabled: true,
          })),
          print_areas: [{
            variant_ids: cfg.variantIds,
            placeholders: [{
              position: "front",
              images: [{
                id: design.printify_image_id,
                x: 0.5,
                y: 0.5,
                scale: productType === "mug" ? 0.30 : 1.0,
                angle: 0,
              }],
            }],
          }],
          tags: allTags,
        },
        PRINTIFY_API_TOKEN!
      ) as { id: string };

      log("Product created", { printifyId: product.id });

      // 3. Publish to Etsy
      await printifyPost(
        `/shops/${PRINTIFY_SHOP_ID}/products/${product.id}/publish.json`,
        {
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
          keyFeatures: true,
          shipping_template: true,
        },
        PRINTIFY_API_TOKEN!
      );

      log("Published to Etsy", { printifyId: product.id });

      // 4. Record listing
      await sb.from("pod_listings").insert({
        design_id: design.id,
        printify_product_id: product.id,
        title: productTitle,
        retail_price_cents: cfg.retailPriceCents,
        status: "published",
      });

      published.push(productTitle.slice(0, 50));

      // Rate limit between Printify calls
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      log("Error publishing design", { designId: design.id, error: String(err) });
    }
  }

  log("Done", { published: published.length });
  return new Response(
    JSON.stringify({ published: published.length, titles: published }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
