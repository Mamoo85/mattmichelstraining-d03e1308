// product-image-repair — fixes image/scale problems across three product categories
//
// APPAREL (tshirt=12, hoodie=77, sweatshirt=49, longsleeve=41):
//   Regenerates design with transparent background to eliminate the white-box-on-dark-fabric bug.
//
// DRINKWARE (tumbler=353, travelmug=70, tumbler40=1509):
//   Fixes scale-only (1.0 → 0.30) without regenerating the image.
//
// JOURNAL (bp=75):
//   Regenerates design with solid color background + front-cover-only constraint.
//
// All modes: deletes stale Etsy images after republish (natural gap algorithm),
//            audits prices, syncs tags from etsy_listings DB.
//
// API:
//   POST {"page": 1}                              → repair all categories on Printify page 1
//   POST {"page": 1, "dry_run": true}             → preview — no changes
//   POST {"product_id": "xxx"}                    → repair one specific product
//   POST {"category": "apparel",  "page": 1}      → apparel only
//   POST {"category": "drinkware","page": 1}      → drinkware only
//   POST {"category": "journal",  "page": 1}      → journals only

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Env ────────────────────────────────────────────────────────────────────────
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") || "";
const SHOP         = Deno.env.get("PRINTIFY_SHOP_ID")   || "";
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY")     || "";
const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY")       || "";
const ETSY_SECRET  = Deno.env.get("ETSY_SHARED_SECRET") || "";
const ETSY_SHOP_ID = "6311589";
const SB_URL       = Deno.env.get("SUPABASE_URL")       || "";
const SB_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PRINTIFY_BASE = "https://api.printify.com/v1";
const LIMIT = 50;

// ── Blueprint → category + correct scale ─────────────────────────────────────
const APPAREL_BPS   = new Set([12, 77, 49, 41]);
// DRINKWARE: 20oz tumblers (353) and travel mugs (70) are already correct — DO NOT TOUCH.
// Only 40oz tall tumblers (1509) need wrap-around image regen.
const DRINKWARE_BPS = new Set([1509]);
const JOURNAL_BP    = 75;
// GLASS: shot glasses need colored (non-white) background regen.
const GLASS_BPS     = new Set([787]);  // shotglass only for now

const APPAREL_SCALE: Record<number, number> = {
  12: 1.0,   // tshirt
  77: 0.75,  // hoodie
  49: 0.75,  // sweatshirt
  41: 1.0,   // longsleeve
};
// 40oz tumbler: full-wrap panoramic — scale 1.0 fills entire print area = wraps 360°
const DRINKWARE_SCALE = 1.0;
const JOURNAL_SCALE   = 1.0;
const GLASS_SCALE: Record<number, number> = {
  787: 0.12, // shot glass — small label-style design
};

const BP_TYPE: Record<number, string> = {
  12:"tshirt", 77:"hoodie", 49:"sweatshirt", 41:"longsleeve",
  353:"tumbler", 70:"travelmug", 1509:"tumbler40", 75:"journal",
  787:"shotglass", 633:"pintglass", 1250:"wineglass",
};

// ── Price floors (cents) ──────────────────────────────────────────────────────
const MIN_PRICE: Record<string, number> = {
  tshirt:2299, hoodie:3899, sweatshirt:3999, longsleeve:2699,
  tumbler:3499, tumbler40:4999, travelmug:2999, journal:2399,
  shotglass:1499, pintglass:1899, wineglass:2199,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function pGet(path: string) {
  const r = await fetch(PRINTIFY_BASE + path, {
    headers: { Authorization: "Bearer " + PRINTIFY_KEY },
    signal: AbortSignal.timeout(30_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Printify GET " + r.status + ": " + txt.slice(0, 300));
  return JSON.parse(txt);
}

async function pPut(path: string, body: unknown) {
  const r = await fetch(PRINTIFY_BASE + path, {
    method: "PUT",
    headers: { Authorization: "Bearer " + PRINTIFY_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Printify PUT " + r.status + ": " + txt.slice(0, 300));
  return JSON.parse(txt);
}

async function pPost(path: string, body: unknown) {
  const r = await fetch(PRINTIFY_BASE + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + PRINTIFY_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Printify POST " + r.status + ": " + txt.slice(0, 300));
  return JSON.parse(txt);
}

// ── Etsy OAuth ────────────────────────────────────────────────────────────────
const ETSY_HEADER_KEY = ETSY_SECRET ? `${ETSY_API_KEY}:${ETSY_SECRET}` : ETSY_API_KEY;

async function getEtsyHeaders(sb: ReturnType<typeof createClient>): Promise<Record<string, string>> {
  const { data: tokenRow } = await sb
    .from("etsy_oauth_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!tokenRow) throw new Error("No Etsy OAuth tokens in DB");

  let accessToken: string = tokenRow.access_token;
  const needsRefresh = Date.now() >= new Date(tokenRow.expires_at).getTime() - 5 * 60 * 1000;
  if (needsRefresh) {
    const clientId = ETSY_API_KEY.split(":")[0];
    const refreshRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: tokenRow.refresh_token,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!refreshRes.ok) throw new Error("Etsy token refresh failed");
    const refreshData = await refreshRes.json();
    accessToken = refreshData.access_token;
    await sb.from("etsy_oauth_tokens").update({
      access_token: accessToken,
      refresh_token: refreshData.refresh_token ?? tokenRow.refresh_token,
      expires_at: new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);
  }
  return { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` };
}

// ── Etsy stale-image cleanup (natural gap algorithm) ─────────────────────────
// Printify publish is ADDITIVE — old mockup images stay in Etsy listing.
// New publish batch has much higher listing_image_ids (Etsy counter advances globally).
// Find the last gap >50K → delete everything before that gap (old batch).
async function cleanStaleEtsyImages(
  listingId: string,
  etsyHeaders: Record<string, string>,
  label: string,
) {
  const BATCH_GAP = 50_000;
  try {
    const listRes = await fetch(
      `https://openapi.etsy.com/v3/application/listings/${listingId}/images?limit=25`,
      { headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
    );
    if (!listRes.ok) {
      console.warn(`[REPAIR] cleanStale ${label}: listing images ${listRes.status}`);
      return;
    }
    const data = await listRes.json();
    const images: Array<{ listing_image_id: string | number }> = data.results ?? [];
    if (images.length <= 1) return; // nothing to clean

    const sorted = [...images].sort((a, b) =>
      parseInt(String(a.listing_image_id), 10) - parseInt(String(b.listing_image_id), 10)
    );
    const ids = sorted.map(img => parseInt(String(img.listing_image_id), 10));

    // Find the last gap >50K → everything before it is the old batch
    let splitIdx = -1;
    for (let i = 1; i < ids.length; i++) {
      if (ids[i] - ids[i - 1] > BATCH_GAP) splitIdx = i;
    }
    if (splitIdx <= 0) {
      console.log(`[REPAIR] cleanStale ${label}: single batch (no gap found), ${images.length} images — nothing to delete`);
      return;
    }

    const toDelete = sorted.slice(0, splitIdx);
    console.log(`[REPAIR] cleanStale ${label}: deleting ${toDelete.length} old-batch images, keeping ${images.length - toDelete.length}`);
    for (const img of toDelete) {
      await sleep(600);
      const delRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}/images/${img.listing_image_id}`,
        { method: "DELETE", headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
      );
      if (!delRes.ok && delRes.status !== 404) {
        console.warn(`[REPAIR] delete image ${img.listing_image_id} failed: ${delRes.status}`);
      }
    }
  } catch (e) {
    console.warn(`[REPAIR] cleanStale ${label} error: ${(e as Error).message.slice(0, 100)}`);
  }
}

// ── Etsy tag lookup from DB ───────────────────────────────────────────────────
async function fetchEtsyTags(etsyListingId: string): Promise<string[] | null> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/etsy_listings?select=tags&listing_id=eq.${etsyListingId}&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, signal: AbortSignal.timeout(10_000) },
    );
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows[0]?.tags?.length) return null;
    return rows[0].tags;
  } catch { return null; }
}

// ── GPT image generation helpers ─────────────────────────────────────────────
async function buildApparelPrompt(title: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Create a concise DALL-E image generation prompt for flat graphic artwork to be printed on a garment. Base it on this product title: "${title}".

CRITICAL REQUIREMENTS:
1. The design MUST have a completely TRANSPARENT background — no white fill, no background color, no white box behind the artwork. Only the ink/design itself should be visible. The garment color shows through wherever there is no ink.
2. Describe ONLY typography, illustration elements, colors of the design itself — do NOT mention the garment, shirt, hoodie, or product.
3. Design must stay within the center 80% of the canvas — no elements touching the edges.
4. Keep it under 80 words.

Return ONLY the image prompt, no other text.`,
      }],
      temperature: 0.7,
      max_tokens: 120,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Prompt gen failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? title;
}

async function buildJournalPrompt(title: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Create a concise DALL-E image generation prompt for a JOURNAL/NOTEBOOK FRONT COVER design. Base it on this product title: "${title}".

CRITICAL REQUIREMENTS:
1. The design MUST have a SOLID COLORED BACKGROUND — not white. Choose a rich, vibrant background color that fits the theme (deep navy, forest green, burgundy, teal, etc.).
2. All text and graphics must stay within center 90% of width and center 80% of height. Do NOT extend to the left edge (spine area).
3. Design is for the FRONT COVER ONLY — not full-bleed, not wrapping.
4. Bold, graphic design style. Clear readable fonts at thumbnail size.
5. Keep it under 80 words.

Return ONLY the image prompt, no other text.`,
      }],
      temperature: 0.7,
      max_tokens: 120,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Journal prompt gen failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? title;
}

// Prompt builder for 40oz tumbler — panoramic wrap-around design
async function buildTumbler40Prompt(title: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Create a concise DALL-E image generation prompt for a panoramic WRAP-AROUND design to be printed on a 40oz tall tumbler/travel cup. Base it on this product title: "${title}".

CRITICAL REQUIREMENTS:
1. PANORAMIC HORIZONTAL FORMAT — wide continuous design that wraps 360° around a tall cylinder.
2. VIBRANT COLORED BACKGROUND that fills the entire width — never white or near-white.
3. DO NOT render the physical tumbler or cup. DO NOT draw any 3D product. FLAT ARTWORK ONLY.
4. Bold typography and graphics sized to fill the full wrap area — large and readable.
5. Keep it under 80 words.

Return ONLY the image prompt, no other text.`,
      }],
      temperature: 0.7,
      max_tokens: 120,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Tumbler40 prompt gen failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? title;
}

// Prompt builder for glass products (shot glass, pint glass, wine glass)
async function buildGlassPrompt(title: string, type: string): Promise<string> {
  const glassDesc = type === "shotglass" ? "shot glass (tiny 1.5oz)" : type === "pintglass" ? "pint glass (16oz)" : "wine glass";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Create a concise DALL-E image generation prompt for a label/decal design printed on a ${glassDesc}. Base it on this product title: "${title}".

CRITICAL REQUIREMENTS:
1. NEVER use white or near-white backgrounds — must use a DARK or VIBRANT COLORED background (black, navy, crimson, deep green, etc.).
2. Compact, bold typography and simple graphics — must read clearly at small thumbnail size.
3. DO NOT render the physical glass. DO NOT show the glass itself. FLAT ARTWORK ONLY.
4. The design is a small label printed on glass — keep it tight, high-contrast, bold.
5. Keep it under 80 words.

Return ONLY the image prompt, no other text.`,
      }],
      temperature: 0.7,
      max_tokens: 120,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Glass prompt gen failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? title;
}

// Score image quality (all product types)
async function scoreImage(
  b64: string,
  prompt: string,
  type: string,
): Promise<{ score: number; reason: string }> {
  if (!OPENAI_KEY) return { score: 5, reason: "no key" };
  try {
    const isApparel  = ["tshirt","hoodie","sweatshirt","longsleeve"].includes(type);
    const isJournal  = type === "journal";
    const isTumbler  = type === "tumbler40";
    const isGlass    = ["shotglass","pintglass","wineglass"].includes(type);

    let hardFail: string;
    if (isApparel) {
      hardFail = "- Background is any solid color (apparel needs completely transparent bg — no white box, no colored background)";
    } else if (isJournal) {
      hardFail = "- Background is white or near-white (journals need rich solid color background)\n- Design content extends into left 10% of canvas (spine area must be clear)";
    } else if (isTumbler) {
      hardFail = "- Background is white or near-white (tumblers need vibrant colored background to wrap beautifully)\n- Shows a 3D render or photo of the physical tumbler/cup (must be FLAT ARTWORK ONLY, no product renders)";
    } else if (isGlass) {
      hardFail = "- Background is white or near-white (glass designs must have dark/vibrant colored backgrounds — white looks like an ugly rectangle on clear glass)\n- Shows a 3D render or photo of the physical glass (must be FLAT ARTWORK ONLY, no product renders)";
    } else {
      hardFail = "- Background is white or near-white\n- Shows a 3D render of the physical product";
    }
    const extraCheck = isApparel
      ? "\nALSO CHECK: Is any text or graphic element touching or within 5% of any image edge? If yes, score MUST be 1."
      : "";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/png;base64,${b64.slice(0, 500000)}` } },
            {
              type: "text",
              text: `Score this print-on-demand ${type} design for "${prompt}" on a scale of 1-5.\n\nHARD FAIL (score MUST be 1):\n${hardFail}\n- Text clipped or unreadable\n- Hallucinated text not matching theme\n\nIf no hard fails, score 1-5 on quality, niche match, print readiness.\nReply ONLY with JSON: {"score":N,"reason":"one sentence"}${extraCheck}`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { score: 5, reason: `vision ${res.status}` };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.match(/\{.*\}/s)?.[0] ?? "{}");
    return { score: Number(parsed.score) || 5, reason: parsed.reason ?? "" };
  } catch {
    return { score: 5, reason: "score failed" };
  }
}

// Generate transparent-background image (apparel)
async function generateTransparentImage(prompt: string, type: string): Promise<string> {
  let bestB64 = "";
  let bestScore = -1;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
        background: "transparent",
        output_format: "png",
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Image gen ${res.status}: ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 returned no b64_json");
    const { score, reason } = await scoreImage(b64, prompt, type);
    console.log(`[REPAIR] ${type} attempt ${attempt}: score ${score}/5 — ${reason}`);
    if (score > bestScore) { bestScore = score; bestB64 = b64; }
    if (score >= 4) break;
    console.warn(`[REPAIR] ${type} attempt ${attempt}: score ${score} < 4 — retrying`);
  }
  if (!bestB64) throw new Error("No image generated after 5 attempts");
  if (bestScore <= 2) throw new Error(`Image quality too low (best ${bestScore}/5) for "${prompt.slice(0, 50)}"`);
  return bestB64;
}

// Generate opaque image (journals — needs solid color background)
async function generateOpaqueImage(prompt: string, type: string): Promise<string> {
  let bestB64 = "";
  let bestScore = -1;
  for (let attempt = 1; attempt <= 5; attempt++) {
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
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Image gen ${res.status}: ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 returned no b64_json");
    const { score, reason } = await scoreImage(b64, prompt, type);
    console.log(`[REPAIR] ${type} attempt ${attempt}: score ${score}/5 — ${reason}`);
    if (score > bestScore) { bestScore = score; bestB64 = b64; }
    if (score >= 4) break;
    console.warn(`[REPAIR] ${type} attempt ${attempt}: score ${score} < 4 — retrying`);
  }
  if (!bestB64) throw new Error("No image generated after 5 attempts");
  if (bestScore <= 2) throw new Error(`Image quality too low (best ${bestScore}/5) for "${prompt.slice(0, 50)}"`);
  return bestB64;
}

// Upload image to Printify
async function uploadImage(b64: string, filename: string): Promise<string> {
  const r = await fetch(`${PRINTIFY_BASE}/uploads/images.json`, {
    method: "POST",
    headers: { Authorization: "Bearer " + PRINTIFY_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: filename, contents: b64 }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error("Upload error: " + JSON.stringify(data).slice(0, 200));
  return data.id as string;
}

// ── Repair one product ────────────────────────────────────────────────────────
interface RepairResult {
  id: string;
  title: string;
  category: string;
  fix: string;
  price_fixed: boolean;
  tags_fixed: boolean;
  error?: string;
}

async function repairProduct(
  productId: string,
  dryRun: boolean,
  sb: ReturnType<typeof createClient>,
  etsyHeaders: Record<string, string>,
): Promise<RepairResult | null> {
  // Fetch full product
  const p = await pGet(`/shops/${SHOP}/products/${productId}.json`);
  const bp: number = p.blueprint_id;
  const etsyId: string | undefined = p.external?.id;
  const type = BP_TYPE[bp] ?? "unknown";

  const isApparel   = APPAREL_BPS.has(bp);
  const isDrinkware = DRINKWARE_BPS.has(bp);  // only 40oz tumbler (1509)
  const isJournal   = bp === JOURNAL_BP;
  const isGlass     = GLASS_BPS.has(bp);       // shot glass (787) etc.

  if (!isApparel && !isDrinkware && !isJournal && !isGlass) return null;
  if (!etsyId) {
    console.log(`[REPAIR] ${p.title.slice(0,50)}: no Etsy listing — skipping`);
    return null;
  }

  const category = isApparel ? "apparel" : isDrinkware ? "drinkware" : isGlass ? "glass" : "journal";
  const result: RepairResult = {
    id: p.id, title: p.title.slice(0, 60), category, fix: "",
    price_fixed: false, tags_fixed: false,
  };

  // ── Skip-if-already-done checks (live mode only) ───────────────────────────
  if (!dryRun) {
    // All categories: skip if already in status table (image gen costs ~$0.04/image)
    const { data: alreadyFixed } = await sb
      .from("pod_image_repair_status")
      .select("product_id")
      .eq("product_id", p.id)
      .maybeSingle();
    if (alreadyFixed) {
      console.log(`[REPAIR] ${p.title.slice(0,40)}: already in repair_status — skipping`);
      return null;
    }
  }

  if (dryRun) {
    // Audit only — check what WOULD be fixed
    const pt = BP_TYPE[bp];
    const minAllowed = MIN_PRICE[pt];
    const variants = (p.variants || []).filter((v: { is_enabled: boolean }) => v.is_enabled);
    const prices = variants.map((v: { price: number }) => Number(v.price)).filter((x: number) => x > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const needsPricefix = minAllowed && minPrice > 0 && minPrice < minAllowed;
    const needsTagfix = (Array.isArray(p.tags) ? p.tags.length : 0) < 5;
    result.fix = isApparel ? "regen_transparent_bg" : isDrinkware ? "regen_wrap_panoramic" : isGlass ? "regen_colored_bg_label" : "regen_solid_color_bg";
    result.price_fixed = !!needsPricefix;
    result.tags_fixed = needsTagfix;
    console.log(`[REPAIR][DRY] ${category} ${p.title.slice(0,40)}: would ${result.fix}, price_fix=${needsPricefix}, tags_fix=${needsTagfix}`);
    return result;
  }

  // ── LIVE REPAIR ────────────────────────────────────────────────────────────
  try {
    if (isApparel) {
      // 1. Generate new transparent-bg image
      console.log(`[REPAIR] Apparel: generating transparent image for "${p.title.slice(0,40)}"`);
      const imagePrompt = await buildApparelPrompt(p.title);
      const b64 = await generateTransparentImage(imagePrompt, type);
      const imageId = await uploadImage(b64, `${type}-repair-${Date.now()}.png`);

      // 2. PATCH print_areas with new image + correct scale
      const scale = APPAREL_SCALE[bp] ?? 1.0;
      const variantIds = (p.variants || []).map((v: { id: number }) => v.id);
      // Get existing placeholders to preserve positioning structure
      const existingPrintAreas = p.print_areas || [];
      let placeholders = ["front"]; // default
      if (existingPrintAreas[0]?.placeholders) {
        placeholders = existingPrintAreas[0].placeholders.map((ph: { position: string }) => ph.position);
      }
      await pPut(`/shops/${SHOP}/products/${p.id}.json`, {
        print_areas: [{
          variant_ids: variantIds,
          placeholders: placeholders.map((pos: string) => ({
            position: pos,
            images: [{ id: imageId, x: 0.5, y: 0.5, scale, angle: 0 }],
          })),
        }],
      });
      result.fix = "regen_transparent_bg";
      console.log(`[REPAIR] Apparel PATCHED: ${p.title.slice(0,40)} (scale=${scale})`);

    } else if (isDrinkware) {
      // 40oz tall tumbler: full-wrap panoramic image regen at scale 1.0
      console.log(`[REPAIR] Tumbler40: generating panoramic wrap image for "${p.title.slice(0,40)}"`);
      const imagePrompt = await buildTumbler40Prompt(p.title);
      const b64 = await generateOpaqueImage(imagePrompt, "tumbler40");
      const imageId = await uploadImage(b64, `tumbler40-repair-${Date.now()}.png`);

      const variantIds = (p.variants || []).map((v: { id: number }) => v.id);
      const existingPrintAreas = p.print_areas || [];
      let placeholders = ["front"]; // default
      if (existingPrintAreas[0]?.placeholders) {
        placeholders = existingPrintAreas[0].placeholders.map((ph: { position: string }) => ph.position);
      }
      await pPut(`/shops/${SHOP}/products/${p.id}.json`, {
        print_areas: [{
          variant_ids: variantIds,
          placeholders: placeholders.map((pos: string) => ({
            position: pos,
            images: [{ id: imageId, x: 0.5, y: 0.5, scale: DRINKWARE_SCALE, angle: 0 }],
          })),
        }],
      });
      result.fix = "regen_wrap_panoramic";
      console.log(`[REPAIR] Tumbler40 PATCHED: ${p.title.slice(0,40)} (scale=1.0 full wrap)`);

    } else if (isGlass) {
      // Shot glass / pint glass / wine glass: colored background label design
      console.log(`[REPAIR] Glass (${type}): generating colored-bg label for "${p.title.slice(0,40)}"`);
      const imagePrompt = await buildGlassPrompt(p.title, type);
      const b64 = await generateOpaqueImage(imagePrompt, type);
      const imageId = await uploadImage(b64, `${type}-repair-${Date.now()}.png`);

      const scale = GLASS_SCALE[bp] ?? 0.15;
      const variantIds = (p.variants || []).map((v: { id: number }) => v.id);
      const existingPrintAreas = p.print_areas || [];
      let placeholders = ["front"];
      if (existingPrintAreas[0]?.placeholders) {
        placeholders = existingPrintAreas[0].placeholders.map((ph: { position: string }) => ph.position);
      }
      await pPut(`/shops/${SHOP}/products/${p.id}.json`, {
        print_areas: [{
          variant_ids: variantIds,
          placeholders: placeholders.map((pos: string) => ({
            position: pos,
            images: [{ id: imageId, x: 0.5, y: 0.5, scale, angle: 0 }],
          })),
        }],
      });
      result.fix = "regen_colored_bg_label";
      console.log(`[REPAIR] Glass (${type}) PATCHED: ${p.title.slice(0,40)} (scale=${scale})`);

    } else if (isJournal) {
      // Regenerate with solid color background + front-cover prompt
      console.log(`[REPAIR] Journal: generating solid-color image for "${p.title.slice(0,40)}"`);
      const imagePrompt = await buildJournalPrompt(p.title);
      const b64 = await generateOpaqueImage(imagePrompt, "journal");
      const imageId = await uploadImage(b64, `journal-repair-${Date.now()}.png`);

      const variantIds = (p.variants || []).map((v: { id: number }) => v.id);
      await pPut(`/shops/${SHOP}/products/${p.id}.json`, {
        print_areas: [{
          variant_ids: variantIds,
          placeholders: [{ position: "front", images: [{ id: imageId, x: 0.5, y: 0.5, scale: JOURNAL_SCALE, angle: 0 }] }],
        }],
      });
      result.fix = "regen_solid_color_bg";
      console.log(`[REPAIR] Journal PATCHED: ${p.title.slice(0,40)}`);
    }

    // ── Wait for Printify mockup regeneration ──────────────────────────────
    // All categories now do image regen — use 30s wait.
    console.log(`[REPAIR] Waiting 30s for Printify mockup regen...`);
    await sleep(30_000);

    // ── Republish to Etsy ──────────────────────────────────────────────────
    try {
      await pPost(`/shops/${SHOP}/products/${p.id}/publish.json`, {
        title: true, description: true, images: true,
        variants: true, tags: true, keyFeatures: true, shipping_template: true,
      });
      console.log(`[REPAIR] Published to Etsy: ${p.title.slice(0,40)}`);
    } catch (pubErr) {
      console.warn(`[REPAIR] Publish failed (continuing): ${(pubErr as Error).message.slice(0, 100)}`);
    }

    // ── Wait for Etsy propagation ──────────────────────────────────────────
    await sleep(15_000);

    // ── Clean stale Etsy images ────────────────────────────────────────────
    try {
      await cleanStaleEtsyImages(etsyId, etsyHeaders, p.title.slice(0, 40));
    } catch (e) {
      console.warn(`[REPAIR] cleanStale failed: ${(e as Error).message.slice(0, 80)}`);
    }

    // ── Price audit ────────────────────────────────────────────────────────
    const pt = BP_TYPE[bp];
    const minAllowed = MIN_PRICE[pt];
    if (minAllowed) {
      // Re-fetch product after publish to get fresh variant prices
      const fresh = await pGet(`/shops/${SHOP}/products/${p.id}.json`);
      const allVars: Array<{ id: number; price: number; is_enabled: boolean }> = fresh.variants || [];
      const enabledPrices = allVars.filter(v => v.is_enabled).map(v => Number(v.price)).filter(x => x > 0);
      const minPrice = enabledPrices.length ? Math.min(...enabledPrices) : 0;
      if (minPrice > 0 && minPrice < minAllowed) {
        const patchedVars = allVars.map(v => ({
          id: v.id,
          price: v.is_enabled ? Math.max(Number(v.price), minAllowed) : Number(v.price),
          is_enabled: v.is_enabled,
        }));
        await pPut(`/shops/${SHOP}/products/${p.id}.json`, { variants: patchedVars });
        result.price_fixed = true;
        console.log(`[REPAIR] Price fixed: ${p.title.slice(0,40)} (was $${(minPrice/100).toFixed(2)} → $${(minAllowed/100).toFixed(2)})`);
      }
    }

    // ── Tag audit ──────────────────────────────────────────────────────────
    const freshTags = await pGet(`/shops/${SHOP}/products/${p.id}.json`)
      .then(fp => Array.isArray(fp.tags) ? fp.tags : [])
      .catch(() => []);
    if (freshTags.length < 5) {
      const etsyTags = await fetchEtsyTags(etsyId);
      if (etsyTags && etsyTags.length > 0) {
        const printifyTags = etsyTags
          .map((t: string) => t.trim().slice(0, 40))
          .filter((t: string) => t.length > 0)
          .slice(0, 10);
        await pPut(`/shops/${SHOP}/products/${p.id}.json`, { tags: printifyTags });
        result.tags_fixed = true;
        console.log(`[REPAIR] Tags fixed: ${p.title.slice(0,40)} → ${printifyTags.length} tags`);
      }
    }

    // ── Record repair in status table (prevents re-running on future sweeps) ──
    await sb.from("pod_image_repair_status").upsert(
      { product_id: p.id, category, fix_applied: result.fix },
      { onConflict: "product_id" },
    ).catch(upsertErr => console.warn("[REPAIR] status table upsert failed:", (upsertErr as Error).message));

    return result;
  } catch (e) {
    result.error = (e as Error).message.slice(0, 200);
    console.error(`[REPAIR] ERROR ${p.title.slice(0,40)}: ${result.error}`);
    return result;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!PRINTIFY_KEY) return Response.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });
  if (!OPENAI_KEY)   return Response.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}

  const dryRun     = !!body.dry_run;
  const productId  = body.product_id as string | undefined;
  const page       = Math.max(1, Number(body.page || 1));
  const offset     = Math.max(0, Number(body.offset || 0)); // skip first N candidates on this page
  const category   = (body.category as string || "all").toLowerCase(); // "apparel"|"drinkware"|"journal"|"all"

  console.log(`[REPAIR] dry_run=${dryRun} page=${page} offset=${offset} category=${category} product_id=${productId || "none"}`);

  const sb = createClient(SB_URL, SB_KEY);

  // Get Etsy headers once
  let etsyHeaders: Record<string, string> = {};
  try {
    etsyHeaders = await getEtsyHeaders(sb);
  } catch (e) {
    console.warn("[REPAIR] Etsy OAuth unavailable — image cleanup will be skipped:", (e as Error).message);
  }

  // ── Single product mode ────────────────────────────────────────────────────
  if (productId) {
    const result = await repairProduct(productId, dryRun, sb, etsyHeaders);
    if (!result) return Response.json({ error: "Product not in repair scope (wrong blueprint or no Etsy listing)" }, { status: 400 });
    return Response.json({ dry_run: dryRun, result });
  }

  // ── Page-based batch mode ──────────────────────────────────────────────────
  const data = await pGet(`/shops/${SHOP}/products.json?page=${page}&limit=${LIMIT}`);
  const products: Array<{
    id: string; title: string; blueprint_id: number;
    external: { id?: string } | null; tags: string[]; variants: Array<{ is_enabled: boolean; price: number }>;
    print_areas: unknown[];
  }> = data.data || [];
  const last_page: number = data.last_page || Math.ceil((data.total || 0) / LIMIT);
  const total: number = data.total || 0;

  // Filter by category
  const matchingBps = new Set<number>();
  if (category === "all" || category === "apparel")   APPAREL_BPS.forEach(bp => matchingBps.add(bp));
  if (category === "all" || category === "drinkware") DRINKWARE_BPS.forEach(bp => matchingBps.add(bp));
  if (category === "all" || category === "journal")   matchingBps.add(JOURNAL_BP);
  if (category === "all" || category === "glass")     GLASS_BPS.forEach(bp => matchingBps.add(bp));

  const allCandidates = products.filter(p => matchingBps.has(p.blueprint_id) && p.external?.id);
  const skipped_no_etsy = products.filter(p => matchingBps.has(p.blueprint_id) && !p.external?.id);

  // Apply offset — skip already-processed candidates from previous calls on this page
  const candidates = allCandidates.slice(offset);

  console.log(`[REPAIR] Page ${page}/${last_page}: ${products.length} total, ${allCandidates.length} in scope, offset=${offset}, remaining=${candidates.length}`);

  // Batch size: all categories now do gpt-image-1 regen (~90s per product).
  // Only 1 product per call to stay within 150s Supabase edge function limit.
  // Self-chaining handles sweeping all products across calls.
  const batch = candidates.slice(0, 1);

  const fixed: RepairResult[]  = [];
  const errors: RepairResult[] = [];

  for (const p of batch) {
    try {
      const result = await repairProduct(p.id, dryRun, sb, etsyHeaders);
      if (result) {
        if (result.error) errors.push(result);
        else fixed.push(result);
      }
    } catch (e) {
      errors.push({ id: p.id, title: p.title.slice(0, 50), category: "unknown", fix: "", price_fixed: false, tags_fixed: false, error: (e as Error).message.slice(0, 200) });
    }
    await sleep(1500);
  }

  const apparel_count   = fixed.filter(r => r.category === "apparel").length   + errors.filter(r => r.category === "apparel").length;
  const drinkware_count = fixed.filter(r => r.category === "drinkware").length + errors.filter(r => r.category === "drinkware").length;
  const journal_count   = fixed.filter(r => r.category === "journal").length   + errors.filter(r => r.category === "journal").length;
  const glass_count     = fixed.filter(r => r.category === "glass").length     + errors.filter(r => r.category === "glass").length;

  // Advance offset: after processing batch, next call should skip offset + batch.length
  const newOffset = offset + batch.length;
  const remaining_this_page = allCandidates.length - newOffset;
  // next_page: advance only if no remaining on this page
  const next_page = remaining_this_page > 0
    ? page  // re-run same page with updated offset
    : (page < last_page ? page + 1 : null);
  const next_offset = remaining_this_page > 0 ? newOffset : 0;
  const catStr = category !== "all" ? `,"category":"${category}"` : "";
  const dryStr = dryRun ? ',"dry_run":true' : "";
  const next_hint = remaining_this_page > 0
    ? `POST {"page":${page},"offset":${newOffset}${catStr}${dryStr}} — ${remaining_this_page} more on this page`
    : next_page
      ? `POST {"page":${next_page},"offset":0${catStr}${dryStr}}`
      : null;

  // ── Self-chain: fire next batch as fire-and-forget so cron sweeps all pages ─
  // Only chains in live mode (not dry_run) and when there's more work to do.
  if (!dryRun && next_hint) {
    const nextBody: Record<string, unknown> = { page: next_page ?? page, offset: next_offset };
    if (category !== "all") nextBody.category = category;
    const selfUrl = `${SB_URL}/functions/v1/product-image-repair`;
    fetch(selfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextBody),
    }).catch(e => console.warn("[REPAIR] self-chain fire failed:", (e as Error).message));
    console.log(`[REPAIR] Self-chained next call: ${JSON.stringify(nextBody)}`);
  }

  return Response.json({
    dry_run: dryRun,
    page, last_page, total_products: total,
    candidates_on_page: candidates.length,
    batch_size: batch.length,
    remaining_this_page,
    apparel_processed: apparel_count,
    drinkware_processed: drinkware_count,
    journal_processed: journal_count,
    glass_processed: glass_count,
    fixed_count: fixed.length,
    error_count: errors.length,
    skipped_no_etsy_count: skipped_no_etsy.length,
    next_page,
    next_offset,
    call_next: next_hint,
    fixed,
    errors,
    skipped_no_etsy_listing: skipped_no_etsy.map(p => ({ id: p.id, title: p.title.slice(0, 50) })),
  });
});
