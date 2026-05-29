/**
 * route-global-printify-order
 *
 * Handles checkout webhook payloads and routes Printify fulfillment orders
 * between domestic (US) and international print provider nodes.
 *
 * Key features:
 *  • generateUniqueMarketplacePrompts — 3 semantically distinct Midjourney-style
 *    design prompts per niche topic, each ending with the required MJ parameter suffix
 *  • Domestic US path — dispatches directly with default blueprint configuration
 *  • International path — queries printify_global_routing_matrix for regional
 *    provider/variant override, applies 30% net-margin guardrail before dispatch
 *  • Margin guardrail — orders below 30% margin halt automation, switch to
 *    "Pending Review" status, and write an audit event to pod_order_audit
 *  • Printify Order API dispatch — clean POST with updated provider mapping
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PRINTIFY_API_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "2890106";

const PRINTIFY_BASE = "https://api.printify.com/v1";
const MARGIN_FLOOR = 0.30; // 30% net-margin minimum before dispatch

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface LineItem {
  productId: number;       // Printify blueprint ID
  variantId?: string;      // Default variant; overridden for international orders
  quantity: number;
  retailPriceCents: number;
}

interface ShippingAddress {
  countryCode: string;     // ISO-3166-1 alpha-2 (e.g. "US", "DE", "CA")
  name?: string;
  address1?: string;
  city?: string;
  zip?: string;
}

interface CheckoutWebhookPayload {
  orderId: string;
  lineItems: LineItem[];
  shippingAddress: ShippingAddress;
  customerEmail?: string;
}

interface RoutingMatrixRow {
  print_provider_id: number;
  blueprint_variant_id: string;
  localized_base_cost_usd: number;
}

interface DispatchResult {
  status: "dispatched" | "pending_review" | "no_route" | "error";
  orderId: string;
  providerId?: number;
  variantId?: string;
  margin?: number;
  reason?: string;
  printifyOrderId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateUniqueMarketplacePrompts
//
// Maps a niche topic ID to 3 semantically distinct Midjourney-style design
// prompts. Each string enforces anti-clashing via unique stylistic descriptors
// and appends the canonical MJ parameter suffix.
//
// The suffix " --style raw --v 6.1 --tile --ar 1:1" is appended literally to
// each output string exactly as specified — this is the Midjourney Discord bot
// parameter space format for tileable, raw-rendered, 1:1 ratio outputs.
// ─────────────────────────────────────────────────────────────────────────────
const MJ_SUFFIX = " --style raw --v 6.1 --tile --ar 1:1";

const TOPIC_PROMPTS: Record<string, [string, string, string]> = {
  wildflower_family_blanket: [
    "Art Nouveau linocut wildflower meadow with bold hand-carved botanical stems, arching petals and deep relief shadows, warm ivory parchment ground, family name elegantly woven into the composition in serif letterpress type, premium textile surface design" + MJ_SUFFIX,
    "Intricate block-print wildflower field in Japonisme ink style, organic curved stems and stippled petal clusters on cream linen texture, negative space balanced for name personalization, heirloom blanket wrap-around repeat" + MJ_SUFFIX,
    "Flat mid-century botanical illustration of meadow wildflowers with muted sage and ochre palette, geometric stem arrangements and stylized blossom geometry, heraldic family crest placeholder centered, wide-format sherpa throw layout" + MJ_SUFFIX,
  ],
  dark_cottagecore_mushroom: [
    "Bioluminescent forest floor fungi ecosystem with phosphorescent mycelium networks, glowing amanita caps in teal and violet, dense moss frameworks and fern shadows, dark emerald background, seamless surface repeat for textile" + MJ_SUFFIX,
    "Dark cottagecore ink illustration of woodland mushroom clusters with fine crosshatch shading, luminescent spore clouds and tangled root systems, black ground with acid-green and gold highlights, gothic botanical aesthetic" + MJ_SUFFIX,
    "Macro photography-inspired vector art of bioluminescent fungi colonies, concentric glow halos, mycelium thread lattice overlay, deep indigo forest atmosphere with warm amber mushroom caps, large-format sherpa blanket print" + MJ_SUFFIX,
  ],
  bibliophile_library: [
    "Deep sepia oil-painted antique library volumes stacked in ornate carved shelves, trailing ivy tendrils, brass bookplates and leather spine lettering, warm candlelight chiaroscuro, old-world academic atmosphere, sherpa throw seamless wrap" + MJ_SUFFIX,
    "Vintage engraving-style bookshelf illustration with cross-hatched volumes, ribbon bookmarks, quill and inkwell accents, library ladder silhouette, warm amber tones on aged parchment ground, bibliophile gift textile print" + MJ_SUFFIX,
    "Painterly impressionist library interior with towering bookshelves fading into soft blur, stacked leather tomes in the foreground, warm reading lamp glow, dust motes in amber light, cozy intellectual atmosphere blanket design" + MJ_SUFFIX,
  ],
  vaporwave_gaming: [
    "Isometric neon vector wireframe city grid with floating geometric architecture, retrowave horizon sunset in purple-pink gradient, cyan grid floor receding to infinity, vaporwave typography fragments, seamless gaming blanket tile" + MJ_SUFFIX,
    "Low-poly cyberpunk cityscape with extruded neon building outlines, holographic advertisement panels in magenta and electric blue, rain-slicked isometric streets, dark atmospheric haze, retro gaming console elements scattered" + MJ_SUFFIX,
    "Retrowave synthwave abstract geometry: floating icosahedrons, grid planes with glitch displacement, VHS scan-line texture overlay, ultra-violet and hot pink gradient sky, isometric arcade cabinet silhouettes, wide textile layout" + MJ_SUFFIX,
  ],
  celestial_constellation: [
    "Medieval astrological star chart with ornate constellation lines connecting named stars in Gothic calligraphy, compass roses in four corners, detailed sea dragon illustrations filling chart margins, aged vellum parchment tone, illuminated manuscript style" + MJ_SUFFIX,
    "14th-century cartographic celestial sphere map with armillary rings, zodiac band figures in hand-painted miniature style, Latin star name annotations in red ink, elaborate decorative border with navigational instruments" + MJ_SUFFIX,
    "Antique planisphere celestial atlas page with copper engraving-style constellations, mythological figure overlays, graduated star magnitude symbols, border of alchemical symbols and maritime cartouche, vintage astronomy gift blanket" + MJ_SUFFIX,
  ],
  outdoor_adventure_tumbler: [
    "Overlapping vintage national park merit badge patches in cohesive burnt-amber and forest-green palette, retro embroidered lettering, mountain peak and pine tree silhouettes, campfire and trail icons, seamless wrap for cylindrical tumbler print" + MJ_SUFFIX,
    "Sticker collage of retro 1960s hiking and camping patches: hand-drawn park logos, winding trail maps, altitude markers, wool-felt texture simulation, warm ochre and terracotta tones on matte surface, adventure tumbler art" + MJ_SUFFIX,
    "Vintage travel poster-inspired outdoor adventure patches arranged in vertical tumbler wrap layout, bold woodblock typography, national forest emblems, bear and elk silhouettes, American heritage colour palette of rust burgundy and tan" + MJ_SUFFIX,
  ],
  desert_rodeo_tumbler: [
    "Geometric southwestern filigree pattern inspired by hand-tooled leather saddle work, Aztec diamond lattice and cactus flower medallions, turquoise and burnt sienna accent geometry, matte sand base, seamless cylindrical repeat" + MJ_SUFFIX,
    "Traditional Western tooled leather rosette and scrollwork pattern with interlocking Navajo geometric bands, punched leather hole detail simulation, warm tan and chocolate brown tones, rodeo trophy aesthetic tumbler wrap" + MJ_SUFFIX,
    "Southwest desert filigree surface design: interlocked triangles, stepped pyramid motifs and stylized zia sun symbols in terracotta red and sandy beige, concentric border frames, hand-stamp tooled leather texture simulation" + MJ_SUFFIX,
  ],
  sarcastic_raven_tumbler: [
    "Minimalist mid-century modern flat vector art of a perpetually unimpressed raven sitting at a corporate desk, deadpan expression, coffee cup, passive-aggressive sticky note, clean geometric color blocks in black cream and burnt orange" + MJ_SUFFIX,
    "Flat illustration grumpy raven in office environment: standing at a whiteboard with pointless pie chart, forced smile colleagues, sarcastic motivational poster on wall reading 'hang in there', mid-century color palette sans-serif text" + MJ_SUFFIX,
    "Vector art series of disgruntled raven Monday-morning scenarios: alarm clock, empty coffee pot, pointless meeting agenda, in a clean 6-panel comic grid layout, retro advertising illustration style, muted earth tones with red accent" + MJ_SUFFIX,
  ],
  gothic_tarot_tumbler: [
    "Obsidian black backdrop with delicate fine-line gold monoline tarot card symbolic motifs: the moon, the star, the wheel, sacred geometry pentagram, constellation star maps with hairline gold meridian threads, maximalist detail" + MJ_SUFFIX,
    "Intricate monoline gothic illustration on deep black: tarot major arcana symbols intertwined with star constellation lines, fibonacci spiral geometry, alchemical sigils in gold ink outline, cylindrical tumbler wrap" + MJ_SUFFIX,
    "Fine-line gold geometry celestial tumbler: esoteric sacred geometry overlaid with astronomical constellation maps, ornate occult iconography, crescent moon and all-seeing eye motifs, obsidian field, ultra-fine single-weight line art" + MJ_SUFFIX,
  ],
  aeronautical_blueprint_tumbler: [
    "Technical cross-section schematic of a turbofan jet engine with chalk-white draft lines on dark engineering-blueprint navy ground, dimension annotation callouts, component labels in engineering font, cutaway view revealing internal turbine stages" + MJ_SUFFIX,
    "Chalk-line aeronautical engineering drawing style: full exploded view of axial compressor assembly with leader line annotations, orthographic projection views, title block in lower corner, blueprint cyan-navy background" + MJ_SUFFIX,
    "Aviation technical illustration: jet engine nacelle cross-section with isometric axonometric projection, fine-weight white dimension lines, numbered component legend, schematic grid overlay, dark aerospace blueprint atmosphere" + MJ_SUFFIX,
  ],
};

export function generateUniqueMarketplacePrompts(topicId: string): string[] {
  const prompts = TOPIC_PROMPTS[topicId];
  if (prompts) return [...prompts];

  // Fallback for unknown topic IDs: generate 3 semantically distinct prompts
  // using the topicId as the seed descriptor, each with unique visual language
  return [
    `${topicId} premium surface pattern design, intricate repeating motif, professional textile illustration, high detail` + MJ_SUFFIX,
    `${topicId} bold graphic design for merchandise, strong composition, vibrant color palette, commercial print-ready` + MJ_SUFFIX,
    `${topicId} vintage-inspired decorative art, hand-crafted aesthetic, warm tones, artisan quality surface design` + MJ_SUFFIX,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Printify Order API helpers
// ─────────────────────────────────────────────────────────────────────────────
async function dispatchToPrintify(
  orderId: string,
  lineItems: LineItem[],
  shippingAddress: ShippingAddress,
  providerOverride?: { providerId: number; variantId: string },
): Promise<{ printifyOrderId: string }> {
  const printifyItems = lineItems.map((item) => ({
    print_provider_id: providerOverride?.providerId ?? undefined,
    blueprint_id: item.productId,
    variant_id: providerOverride?.variantId ?? item.variantId ?? "",
    quantity: item.quantity,
  }));

  const payload = {
    external_id: orderId,
    line_items: printifyItems,
    shipping_method: 1,
    send_shipping_notification: false,
    address_to: {
      first_name: shippingAddress.name?.split(" ")[0] ?? "Customer",
      last_name: shippingAddress.name?.split(" ").slice(1).join(" ") ?? "",
      address1: shippingAddress.address1 ?? "",
      city: shippingAddress.city ?? "",
      zip: shippingAddress.zip ?? "",
      country: shippingAddress.countryCode,
    },
  };

  const res = await fetch(
    `${PRINTIFY_BASE}/shops/${PRINTIFY_SHOP_ID}/orders.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRINTIFY_API_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "m2training-route-global/1.0",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Printify API ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json() as { id: string };
  return { printifyOrderId: data.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log helper
// ─────────────────────────────────────────────────────────────────────────────
async function writeAuditEvent(
  supabase: ReturnType<typeof createClient>,
  event: {
    orderId: string;
    eventType: string;
    productId?: number;
    countryCode?: string;
    retailCents?: number;
    baseCostUsd?: number;
    marginPct?: number;
    providerId?: number;
    variantId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("pod_order_audit").insert({
    order_id: event.orderId,
    event_type: event.eventType,
    product_id: event.productId ?? null,
    country_code: event.countryCode ?? null,
    retail_cents: event.retailCents ?? null,
    base_cost_usd: event.baseCostUsd ?? null,
    margin_pct: event.marginPct != null ? Math.round(event.marginPct * 10000) / 100 : null,
    provider_id: event.providerId ?? null,
    variant_id: event.variantId ?? null,
    payload: event.payload ?? null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core routing logic
// ─────────────────────────────────────────────────────────────────────────────
async function routeOrder(
  supabase: ReturnType<typeof createClient>,
  body: CheckoutWebhookPayload,
): Promise<DispatchResult> {
  const { orderId, lineItems, shippingAddress } = body;
  const countryCode = (shippingAddress.countryCode ?? "US").toUpperCase();

  // ── Domestic path ──────────────────────────────────────────────────────────
  if (countryCode === "US") {
    try {
      const { printifyOrderId } = await dispatchToPrintify(orderId, lineItems, shippingAddress);
      await writeAuditEvent(supabase, {
        orderId,
        eventType: "dispatched",
        countryCode,
        payload: { path: "domestic", printifyOrderId },
      });
      return { status: "dispatched", orderId, printifyOrderId };
    } catch (err) {
      const msg = (err as Error).message;
      await writeAuditEvent(supabase, {
        orderId,
        eventType: "error",
        countryCode,
        payload: { path: "domestic", error: msg },
      });
      return { status: "error", orderId, reason: msg };
    }
  }

  // ── International path — process each line item ────────────────────────────
  // For simplicity, route based on the first line item's blueprint ID.
  // Multi-item orders with different blueprints going to separate providers
  // would require split-order logic (future enhancement).
  const primaryItem = lineItems[0];
  if (!primaryItem) {
    return { status: "error", orderId, reason: "no_line_items" };
  }

  // Query routing matrix
  const { data: matrixRow, error: matrixErr } = await supabase
    .from("printify_global_routing_matrix")
    .select("print_provider_id, blueprint_variant_id, localized_base_cost_usd")
    .eq("base_product_id", primaryItem.productId)
    .eq("target_country_code", countryCode)
    .maybeSingle<RoutingMatrixRow>();

  if (matrixErr) {
    return { status: "error", orderId, reason: `matrix_query_error: ${matrixErr.message}` };
  }

  if (!matrixRow) {
    await writeAuditEvent(supabase, {
      orderId,
      eventType: "no_route",
      productId: primaryItem.productId,
      countryCode,
      payload: { reason: "no_matrix_row" },
    });
    return { status: "no_route", orderId, reason: `no_route for product ${primaryItem.productId} → ${countryCode}` };
  }

  // ── 30% margin guardrail ───────────────────────────────────────────────────
  const retailUsd = primaryItem.retailPriceCents / 100;
  const baseCostUsd = Number(matrixRow.localized_base_cost_usd);
  const margin = (retailUsd - baseCostUsd) / retailUsd;

  if (margin < MARGIN_FLOOR) {
    await writeAuditEvent(supabase, {
      orderId,
      eventType: "margin_below_30pct",
      productId: primaryItem.productId,
      countryCode,
      retailCents: primaryItem.retailPriceCents,
      baseCostUsd,
      marginPct: margin,
      providerId: matrixRow.print_provider_id,
      variantId: matrixRow.blueprint_variant_id,
      payload: {
        margin: Math.round(margin * 10000) / 100,
        retailUsd,
        baseCostUsd,
        threshold: MARGIN_FLOOR * 100,
        action: "halted_pending_review",
      },
    });

    return {
      status: "pending_review",
      orderId,
      providerId: matrixRow.print_provider_id,
      variantId: matrixRow.blueprint_variant_id,
      margin,
      reason: `margin_below_30pct: ${(margin * 100).toFixed(2)}% < ${MARGIN_FLOOR * 100}%`,
    };
  }

  // ── Dispatch international order ───────────────────────────────────────────
  try {
    const { printifyOrderId } = await dispatchToPrintify(
      orderId,
      lineItems,
      shippingAddress,
      {
        providerId: matrixRow.print_provider_id,
        variantId: matrixRow.blueprint_variant_id,
      },
    );

    await writeAuditEvent(supabase, {
      orderId,
      eventType: "dispatched",
      productId: primaryItem.productId,
      countryCode,
      retailCents: primaryItem.retailPriceCents,
      baseCostUsd,
      marginPct: margin,
      providerId: matrixRow.print_provider_id,
      variantId: matrixRow.blueprint_variant_id,
      payload: { path: "international", printifyOrderId },
    });

    return {
      status: "dispatched",
      orderId,
      providerId: matrixRow.print_provider_id,
      variantId: matrixRow.blueprint_variant_id,
      margin,
      printifyOrderId,
    };
  } catch (err) {
    const msg = (err as Error).message;
    await writeAuditEvent(supabase, {
      orderId,
      eventType: "error",
      productId: primaryItem.productId,
      countryCode,
      payload: { path: "international", error: msg },
    });
    return { status: "error", orderId, reason: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge Function entrypoint
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // GET — returns the MJ prompts for a given topicId (useful for manual inspection)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const topicId = url.searchParams.get("topicId") ?? "";
    const prompts = generateUniqueMarketplacePrompts(topicId);
    return Response.json(
      { topicId, prompts },
      { headers: CORS_HEADERS },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: CheckoutWebhookPayload;
  try {
    body = (await req.json()) as CheckoutWebhookPayload;
  } catch {
    return Response.json(
      { error: "invalid_json" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (!body.orderId || !Array.isArray(body.lineItems) || !body.shippingAddress?.countryCode) {
    return Response.json(
      { error: "missing_required_fields", required: ["orderId", "lineItems", "shippingAddress.countryCode"] },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const result = await routeOrder(supabase, body);

  const httpStatus =
    result.status === "dispatched"   ? 200 :
    result.status === "pending_review" ? 202 :
    result.status === "no_route"     ? 422 :
    500;

  return Response.json(result, { status: httpStatus, headers: CORS_HEADERS });
});
