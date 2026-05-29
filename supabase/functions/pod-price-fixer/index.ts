/**
 * pod-price-fixer v4 — Etsy fee structure
 *
 * Modes:
 *   POST {"mode":"audit"}                                — dry run, shows what WOULD change
 *   POST {"mode":"reprice_floor","limit":20,"offset":0} — raise below-cost products only
 *   POST {"mode":"reprice_all",  "limit":20,"offset":0} — set ALL products to Etsy-optimal price
 *
 * Fee model: Etsy
 *   6.5% transaction + 3.0% payment processing + $0.20 listing + $0.25 payment flat
 *   = 9.5% of retail + $0.45 flat per sale
 *
 * Price target (10% net margin + 10% headroom):
 *   floor  = (cost + shipping + $0.45) / 0.805
 *   target = psychPrice(floor × 1.10)   (≈ 18-21% gross margin on Etsy)
 *
 * reprice_all reprices a product if |current − target| > $0.50 (avoids noise).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRINTIFY_KEY       = Deno.env.get("PRINTIFY_API_TOKEN") ?? Deno.env.get("PRINTIFY_API_KEY") ?? "";
const PRINTIFY_API_BASE  = "https://api.printify.com/v1";
const PRINTIFY_SHOP_ID   = Deno.env.get("PRINTIFY_SHOP_ID") ?? "2890106";
const ETSY_API_KEY       = (Deno.env.get("ETSY_API_KEY") ?? "").trim();
const ETSY_SHARED_SECRET = (Deno.env.get("ETSY_SHARED_SECRET") ?? "").trim();
const ETSY_HEADER_KEY    = ETSY_SHARED_SECRET ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}` : ETSY_API_KEY;
const ETSY_SHOP_ID       = Deno.env.get("ETSY_SHOP_ID") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const log = (s: string, d?: unknown) =>
  console.log(`[PRICE-FIXER] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

const SHIPPING: Record<string, number> = {
  mug: 499, tshirt: 499, hoodie: 499, sweatshirt: 499, longsleeve: 499,
  sock: 499, hat: 499, truckercap: 499, onesie: 499,
  tumbler: 599, tumbler40: 699, travelmug: 599,
  pintglass: 599, shotglass: 499, wineglass: 599,
  coaster: 499, candle: 599, poster_v: 399, poster_h: 399,
  sticker: 299, blanket: 799, pillow: 599, mousepad: 499,
  laptopsleeve: 499, puzzle: 599, phonecase_slim: 399, phonecase_tough: 399,
  petbandana: 399, ornament: 499, journal: 499, greetingcard: 299,
  default: 499,
};

// Etsy fee constants
const ETSY_FEE_PCT  = 0.095;  // 9.5%
const ETSY_FEE_FLAT = 45;     // $0.45 in cents
const MARGIN_FLOOR  = 0.10;   // minimum 10% net margin
const MARGIN_BUFFER = 1.10;   // target = floor × 1.10
const REPRICE_THRESHOLD = 50; // only reprice if diff > $0.50 (cents)

// ── Printify helpers ──────────────────────────────────────────────────────────

async function getPrintifyProduct(printifyId: string): Promise<Record<string, unknown> | null> {
  if (!printifyId || !PRINTIFY_KEY) return null;
  try {
    const res = await fetch(
      `${PRINTIFY_API_BASE}/shops/${PRINTIFY_SHOP_ID}/products/${printifyId}.json`,
      { headers: { Authorization: `Bearer ${PRINTIFY_KEY}` }, signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function cheapestCost(product: Record<string, unknown>): number | null {
  const variants = (product.variants as Array<{ cost: number; is_enabled: boolean }>) ?? [];
  const enabled  = variants.filter(v => v.is_enabled);
  if (!enabled.length) return null;
  return Math.min(...enabled.map(v => v.cost));
}

async function updatePrintifyPrices(
  printifyId: string,
  product: Record<string, unknown>,
  newPriceCents: number
): Promise<boolean> {
  try {
    const variants = product.variants as Array<Record<string, unknown>>;
    if (!variants?.length) return false;
    const updated = variants.map(v => ({
      id: v.id, price: newPriceCents, is_enabled: v.is_enabled,
      is_default: v.is_default ?? false, sku: v.sku ?? "",
      grams: v.grams ?? 0, quantity: v.quantity ?? 999,
    }));
    const res = await fetch(
      `${PRINTIFY_API_BASE}/shops/${PRINTIFY_SHOP_ID}/products/${printifyId}.json`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${PRINTIFY_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ variants: updated }),
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) log("Printify update failed", { printifyId, status: res.status, body: await res.text() });
    return res.ok;
  } catch (e) { log("Printify update error", String(e)); return false; }
}

// ── Etsy OAuth helpers ────────────────────────────────────────────────────────

async function getEtsyToken(): Promise<string | null> {
  try {
    const { data: tokenRow } = await supabase
      .from("etsy_oauth_tokens").select("*")
      .order("id", { ascending: false }).limit(1).maybeSingle();
    if (!tokenRow) return null;
    const row = tokenRow as Record<string, unknown>;
    let accessToken = row.access_token as string;
    if (row.expires_at && new Date(row.expires_at as string).getTime() - Date.now() < 300_000) {
      const clientId = ETSY_API_KEY.split(":")[0];
      const refreshRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token", client_id: clientId,
          refresh_token: row.refresh_token as string,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (refreshRes.ok) {
        const rd = await refreshRes.json() as Record<string, unknown>;
        accessToken = rd.access_token as string;
        await supabase.from("etsy_oauth_tokens").update({
          access_token:  accessToken,
          refresh_token: (rd.refresh_token as string) ?? (row.refresh_token as string),
          expires_at:    new Date(Date.now() + ((rd.expires_in as number) ?? 3600) * 1000).toISOString(),
          updated_at:    new Date().toISOString(),
        }).eq("id", row.id as number);
      }
    }
    return accessToken;
  } catch (e) { log("Etsy token error", String(e)); return null; }
}

async function updateEtsyPrice(listingId: number, newPriceUsd: number, token: string): Promise<boolean> {
  try {
    const hdrs: Record<string, string> = { "x-api-key": ETSY_HEADER_KEY, "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = `Bearer ${token}`;
    const res = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}`,
      { method: "PATCH", headers: hdrs, body: JSON.stringify({ price: newPriceUsd.toFixed(2) }), signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) log("Etsy price update failed", { listingId, status: res.status, body: await res.text() });
    return res.ok;
  } catch (e) { log("Etsy price update error", { listingId, err: String(e) }); return false; }
}

// ── Price math ────────────────────────────────────────────────────────────────

function psychPrice(cents: number): number {
  return Math.ceil(cents / 100) * 100 - 1;
}

function calcMargin(retailCents: number, totalCostCents: number): number {
  const profit = retailCents - totalCostCents - Math.round(retailCents * ETSY_FEE_PCT) - ETSY_FEE_FLAT;
  return retailCents > 0 ? profit / retailCents : -99;
}

// floor = (cost + $0.45) / (0.905 − 0.10) = (cost + 45) / 0.805
function floorPrice(totalCostCents: number): number {
  return Math.ceil((totalCostCents + ETSY_FEE_FLAT) / (1 - ETSY_FEE_PCT - MARGIN_FLOOR));
}

function targetPrice(totalCostCents: number): number {
  return psychPrice(Math.ceil(floorPrice(totalCostCents) * MARGIN_BUFFER));
}

// ── Audit (dry run, shows both up and down moves) ─────────────────────────────

async function audit(): Promise<object> {
  const { data: products } = await supabase
    .from("pod_product_queue")
    .select("id, name, product_type, retail_price, printify_id, etsy_listing_id")
    .eq("status", "published")
    .not("product_type", "in", '("download","digital")')
    .not("printify_id", "is", null)
    .order("product_type");

  if (!products?.length) return { error: "No published products found" };

  const results = [];
  for (const p of products) {
    const product = await getPrintifyProduct(p.printify_id);
    await new Promise(r => setTimeout(r, 200));
    if (!product) { results.push({ id: p.id, name: p.name, status: "skip", reason: "Printify fetch failed" }); continue; }
    const prodCost = cheapestCost(product);
    if (prodCost === null) { results.push({ id: p.id, name: p.name, status: "skip", reason: "No enabled variants" }); continue; }

    const shipping  = SHIPPING[p.product_type] ?? SHIPPING.default;
    const totalCost = prodCost + shipping;
    const retail    = p.retail_price ?? 0;
    const margin    = calcMargin(retail, totalCost);
    const floor     = floorPrice(totalCost);
    const target    = targetPrice(totalCost);
    const diff      = Math.abs(retail - target);

    let action = "ok";
    if (diff > REPRICE_THRESHOLD) {
      const dir = retail < target ? "UP" : "DOWN";
      action = `REPRICE ${dir} → $${(target / 100).toFixed(2)}`;
    }

    results.push({
      id:            p.id,
      name:          p.name.slice(0, 50),
      product_type:  p.product_type,
      retail:        "$" + (retail / 100).toFixed(2),
      printify_cost: "$" + (prodCost / 100).toFixed(2),
      total_landed:  "$" + (totalCost / 100).toFixed(2),
      floor:         "$" + (floor / 100).toFixed(2),
      target:        "$" + (target / 100).toFixed(2),
      margin_now:    (margin * 100).toFixed(1) + "%",
      new_margin:    action !== "ok" ? "~" + (calcMargin(target, totalCost) * 100).toFixed(1) + "%" : undefined,
      action,
    });
  }

  const toChange = results.filter(r => r.action !== "ok").length;
  return { products_checked: results.length, need_repricing: toChange, fee_model: "etsy", results };
}

// ── Reprice worker (shared by reprice_floor and reprice_all) ──────────────────

async function repriceWorker(limit: number, offset: number, allProducts: boolean): Promise<object> {
  const { data: products } = await supabase
    .from("pod_product_queue")
    .select("id, name, product_type, retail_price, printify_id, etsy_listing_id")
    .eq("status", "published")
    .not("product_type", "in", '("download","digital")')
    .not("printify_id", "is", null)
    .order("product_type")
    .range(offset, offset + limit - 1);

  if (!products?.length) return { error: "No published products found in range", offset, limit };

  const etsyToken = await getEtsyToken();
  log("Etsy token", { hasToken: !!etsyToken });

  const results = [];
  for (const p of products) {
    const product = await getPrintifyProduct(p.printify_id);
    await new Promise(r => setTimeout(r, 200));
    if (!product) { results.push({ id: p.id, name: p.name, status: "skip", reason: "Printify fetch failed" }); continue; }
    const prodCost = cheapestCost(product);
    if (prodCost === null) { results.push({ id: p.id, name: p.name, status: "skip", reason: "No enabled variants" }); continue; }

    const shipping  = SHIPPING[p.product_type] ?? SHIPPING.default;
    const totalCost = prodCost + shipping;
    const retail    = p.retail_price ?? 0;
    const margin    = calcMargin(retail, totalCost);
    const target    = targetPrice(totalCost);
    const diff      = Math.abs(retail - target);

    // reprice_floor: only raise below-floor products
    // reprice_all:   reprice anything more than $0.50 from target (up or down)
    const needsReprice = allProducts ? diff > REPRICE_THRESHOLD : margin < MARGIN_FLOOR;

    if (!needsReprice) {
      results.push({
        id: p.id, name: p.name.slice(0, 45), status: "ok",
        retail: "$" + (retail / 100).toFixed(2),
        margin: (margin * 100).toFixed(1) + "%",
      });
      continue;
    }

    const newCents = target;
    const newUsd   = newCents / 100;
    const dir      = retail < newCents ? "↑" : "↓";
    log(`Repricing ${dir}`, { id: p.id, name: p.name, old: retail, new: newCents });

    // 1. Printify (reuse already-fetched product — no second GET)
    const printifyOk = await updatePrintifyPrices(p.printify_id, product, newCents);
    await new Promise(r => setTimeout(r, 400));

    // 2. Etsy
    let etsyOk = false, etsySkipped = false;
    if (etsyToken && p.etsy_listing_id) {
      etsyOk = await updateEtsyPrice(Number(p.etsy_listing_id), newUsd, etsyToken);
      await new Promise(r => setTimeout(r, 300));
    } else { etsySkipped = !p.etsy_listing_id; }

    // 3. DB
    await supabase.from("pod_product_queue").update({ retail_price: newCents }).eq("id", p.id);

    results.push({
      id:               p.id,
      name:             p.name.slice(0, 45),
      product_type:     p.product_type,
      direction:        dir,
      old_retail:       "$" + (retail / 100).toFixed(2),
      new_retail:       "$" + newUsd.toFixed(2),
      printify_cost:    "$" + (prodCost / 100).toFixed(2),
      total_landed:     "$" + (totalCost / 100).toFixed(2),
      old_margin:       (margin * 100).toFixed(1) + "%",
      new_margin:       "~" + (calcMargin(newCents, totalCost) * 100).toFixed(1) + "%",
      printify_updated: printifyOk,
      etsy_updated:     etsyOk,
      etsy_skipped:     etsySkipped,
      etsy_listing_id:  p.etsy_listing_id,
      status:           "repriced",
    });
  }

  const repriced = results.filter(r => r.status === "repriced").length;
  const ok       = results.filter(r => r.status === "ok").length;
  const skipped  = results.filter(r => r.status === "skip").length;

  return {
    repriced, at_target: ok, skipped,
    batch_size: products.length, offset, limit,
    next_offset: offset + products.length,
    has_more: products.length === limit,
    fee_model: "etsy", etsy_token_available: !!etsyToken,
    results,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const body   = await req.json().catch(() => ({}));
  const mode   = (body.mode   ?? "audit") as string;
  const limit  = Number(body.limit  ?? 20);
  const offset = Number(body.offset ?? 0);

  try {
    let result: object;
    if      (mode === "audit")         result = await audit();
    else if (mode === "reprice_floor") result = await repriceWorker(limit, offset, false);
    else if (mode === "reprice_all")   result = await repriceWorker(limit, offset, true);
    else result = { error: `Unknown mode: ${mode}. Use "audit", "reprice_floor", or "reprice_all"` };

    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
