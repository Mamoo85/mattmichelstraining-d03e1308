// pod-price-audit v3
// GET or POST /functions/v1/pod-price-audit
// Fetches REAL base costs from existing shop product variant.cost fields
// (the only place Printify exposes manufacturing cost), then calculates
// true margins and flags pricing issues.
//
// Per product type:
//   - Printify base cost (from variant.cost on live shop products)
//   - Estimated shipping cost (US economy, baked into free-shipping retail)
//   - Etsy fees: 6.5% transaction + $0.20 listing + 3% + $0.25 processing
//   - Our current retail price
//   - Gross profit & margin %
//   - Status: healthy (>=40%) | tight (25–40%) | critical (<25%)
//   - Suggested price for 45% target margin
//
// autoAdjust mode (POST body: { "autoAdjust": true }):
//   - Fetches Etsy receipts from the past 45 days
//   - Counts sales per listing in the last 30 days
//   - Bumps prices 10% for listings with 3+ sales in 30 days (cap 1.5x)
//   - Drops prices 10% for listings with 0 sales and age >45 days (floor: cost + 30%)
//   - Tracks adjustments in pod_agent_state (no repeat within 14 days)
//   - After patching Printify variants, publishes to sync Etsy
import { createClient } from "npm:@supabase/supabase-js@2";

const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-PRICE-AUDIT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

type ProductType = "mug" | "tshirt" | "hoodie" | "sock" | "hat" | "mousepad" | "onesie" | "tumbler" | "blanket" | "sweatshirt" | "longsleeve" | "travelmug";

const FINAL_PRICES: Record<ProductType, number> = {
  mug: 1899, tshirt: 2299, hoodie: 3899, sock: 1499, hat: 2799, mousepad: 1999, onesie: 1899,
  tumbler: 3499, blanket: 5499, sweatshirt: 3999, longsleeve: 2799, travelmug: 2999,
};

const BLUEPRINT_IDS: Record<ProductType, number> = {
  mug: 68, tshirt: 12, hoodie: 77, sock: 365, hat: 1447, mousepad: 608, onesie: 568,
  tumbler: 353, blanket: 238, sweatshirt: 49, longsleeve: 41, travelmug: 70,
};

// Estimated US economy shipping (absorbed by us for "free shipping")
const ESTIMATED_SHIPPING: Record<ProductType, number> = {
  mug: 599, tshirt: 450, hoodie: 550, sock: 350, hat: 450, mousepad: 450, onesie: 450,
  tumbler: 599, blanket: 899, sweatshirt: 550, longsleeve: 450, travelmug: 599,
};

// Etsy market medians (researched from sold listings, May 2026)
const ETSY_MARKET_MEDIAN: Record<ProductType, number> = {
  mug: 2200, tshirt: 2500, hoodie: 4500, sock: 1600, hat: 2800, mousepad: 2000, onesie: 2200,
  tumbler: 3500, blanket: 6000, sweatshirt: 4200, longsleeve: 3000, travelmug: 3200,
};

function pFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${PRINTIFY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PRINTIFY_KEY}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    signal: options?.signal ?? AbortSignal.timeout(25_000),
  });
}

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function etsyFees(retailCents: number): number {
  // 6.5% transaction + $0.20 listing + 3% + $0.25 payment processing
  return Math.round(retailCents * 0.065) + 20 + Math.round(retailCents * 0.03) + 25;
}

// ── Auto-refresh Etsy OAuth token ─────────────────────────────────────────────
async function getEtsyTokens(sb: ReturnType<typeof createClient>): Promise<{
  accessToken: string;
  shopId: string;
  etsyHeaders: Record<string, string>;
} | null> {
  const clientId = ETSY_API_KEY.split(":")[0];
  if (!clientId) { log("ETSY_API_KEY not set"); return null; }

  const { data: tokenRow, error: tokenErr } = await sb
    .from("etsy_oauth_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenErr || !tokenRow) { log("No Etsy OAuth tokens found"); return null; }

  let accessToken: string = tokenRow.access_token;
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const needsRefresh = Date.now() >= expiresAt - 5 * 60 * 1000;

  if (needsRefresh) {
    log("Token expiring — refreshing");
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

    if (!refreshRes.ok) {
      log("Token refresh failed", { status: refreshRes.status });
      return null;
    }

    const refreshData = await refreshRes.json();
    accessToken = refreshData.access_token;
    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString();

    await sb.from("etsy_oauth_tokens").update({
      access_token: accessToken,
      refresh_token: refreshData.refresh_token ?? tokenRow.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);

    log("Token refreshed", { expiresAt: newExpiresAt });
  }

  const etsyHeaders: Record<string, string> = {
    "x-api-key": ETSY_API_KEY,
    Authorization: `Bearer ${accessToken}`,
  };

  // Resolve shop_id if missing
  let shopId: string = tokenRow.shop_id ?? "";
  if (!shopId) {
    try {
      const meRes = await fetch("https://openapi.etsy.com/v3/application/users/me", {
        headers: etsyHeaders, signal: AbortSignal.timeout(10_000),
      });
      const me = await meRes.json();
      const meUserId = String(me.user_id ?? "");
      if (meUserId) {
        const shopRes = await fetch(
          `https://openapi.etsy.com/v3/application/users/${meUserId}/shops`,
          { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
        );
        const shopData = await shopRes.json();
        shopId = String(shopData?.shop_id ?? shopData?.results?.[0]?.shop_id ?? "");
        if (shopId) {
          await sb.from("etsy_oauth_tokens").update({ shop_id: shopId, updated_at: new Date().toISOString() }).eq("id", tokenRow.id);
        }
      }
    } catch (e) {
      log("shop_id resolution failed", { error: String(e) });
    }
  }

  if (!shopId) { log("Could not resolve shop_id"); return null; }

  return { accessToken, shopId, etsyHeaders };
}

// ── Auto-adjust mode ───────────────────────────────────────────────────────────
async function runAutoAdjust(
  sb: ReturnType<typeof createClient>,
  auditResults: Array<{ type: ProductType; sampleProductId: string | null; avgBaseCost: number | null; minBaseCost: number | null; shippingEst: number }>,
  shopId: string,
  printifyShopId: string,
): Promise<{ bumped: number; dropped: number; skipped: number }> {
  let bumped = 0;
  let dropped = 0;
  let skipped = 0;

  // Load pod_agent_state to track 14-day cooldown
  const { data: agentStateRows } = await sb.from("pod_agent_state").select("key, value");
  const agentState = new Map<string, string>(
    (agentStateRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
  );

  // Get Etsy tokens
  const etsy = await getEtsyTokens(sb);
  if (!etsy) {
    log("autoAdjust: cannot get Etsy tokens — skipping");
    return { bumped, dropped, skipped };
  }

  // Fetch all active listings to know creation timestamps
  log("autoAdjust: fetching active Etsy listings");
  type EtsyListing = {
    listing_id: number;
    title: string;
    created_timestamp: number;
    price: { amount: number; divisor: number };
  };

  const activeListings: EtsyListing[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${etsy.shopId}/listings/active?limit=100&offset=${offset}`,
      { headers: etsy.etsyHeaders, signal: AbortSignal.timeout(15_000) },
    ).catch(() => null);
    if (!res?.ok) break;
    const data = await res.json();
    const results: EtsyListing[] = data?.results ?? [];
    if (results.length === 0) break;
    activeListings.push(...results);
    if (results.length < 100) break;
    offset += 100;
    await new Promise((r) => setTimeout(r, 300));
  }

  log("autoAdjust: active listings fetched", { count: activeListings.length });

  // Build listing_id → created_timestamp map
  const listingAgeMap = new Map<number, number>(
    activeListings.map((l) => [l.listing_id, l.created_timestamp]),
  );
  const listingPriceMap = new Map<number, number>(
    activeListings.map((l) => [l.listing_id, Math.round((l.price.amount / l.price.divisor) * 100)]),
  );

  // Fetch receipts for the past 45 days
  const now = Date.now();
  const fortyFiveDaysAgo = Math.floor((now - 45 * 24 * 60 * 60 * 1000) / 1000);
  const thirtyDaysAgo = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);

  log("autoAdjust: fetching receipts for past 45 days");

  type ReceiptListing = { listing_id: number; price: { amount: number; divisor: number } };
  type Receipt = { created_timestamp: number; status: string; listings_purchased: ReceiptListing[] };

  const allReceipts: Receipt[] = [];
  let receiptOffset = 0;
  while (true) {
    const url = new URL(`https://openapi.etsy.com/v3/application/shops/${etsy.shopId}/receipts`);
    url.searchParams.set("min_created", String(fortyFiveDaysAgo));
    url.searchParams.set("status", "completed");
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(receiptOffset));

    const res = await fetch(url.toString(), {
      headers: etsy.etsyHeaders,
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);

    if (!res?.ok) {
      log("autoAdjust: receipts fetch failed", { status: res?.status, offset: receiptOffset });
      break;
    }

    const data = await res.json();
    const results: Receipt[] = data?.results ?? [];
    if (results.length === 0) break;
    allReceipts.push(...results);
    if (results.length < 100) break;
    receiptOffset += 100;
    await new Promise((r) => setTimeout(r, 300));
  }

  log("autoAdjust: receipts fetched", { count: allReceipts.length });

  // Build sale_count_30d per listing_id (only receipts within last 30 days)
  const saleCount30d = new Map<number, number>();
  for (const receipt of allReceipts) {
    if (receipt.created_timestamp < thirtyDaysAgo) continue;
    for (const item of (receipt.listings_purchased ?? [])) {
      const lid = item.listing_id;
      saleCount30d.set(lid, (saleCount30d.get(lid) ?? 0) + 1);
    }
  }

  log("autoAdjust: listings with 30d sales", { uniqueListings: saleCount30d.size });

  // Build map of Etsy listing_id → Printify product_id
  // We need to scan Printify products to find the external_id (Etsy listing_id)
  log("autoAdjust: building Etsy→Printify product map");
  const etsyToProductId = new Map<number, string>(); // etsy listing_id → printify product_id
  let pPage = 1;
  while (pPage <= 10) {
    const res = await pFetch(`/shops/${printifyShopId}/products.json?page=${pPage}&limit=50`);
    if (!res.ok) break;
    const data = await res.json() as Record<string, unknown>;
    const items = Array.isArray(data.data) ? data.data as Array<Record<string, unknown>> : [];
    if (items.length === 0) break;

    for (const p of items) {
      // external_id on Printify is the Etsy listing_id (set when published)
      const extId = p.external_id as number | string | null;
      if (extId) {
        etsyToProductId.set(Number(extId), p.id as string);
      }
    }

    const lastPage = typeof data.last_page === "number" ? data.last_page : 1;
    if (pPage >= lastPage) break;
    pPage++;
    await new Promise((r) => setTimeout(r, 150));
  }

  log("autoAdjust: Printify product map built", { mappedListings: etsyToProductId.size });

  // Build cost floor map per product type
  // cost floor = base_cost + 30% margin target
  const costFloorByProductId = new Map<string, number>();
  for (const r of auditResults) {
    if (r.sampleProductId && (r.avgBaseCost ?? r.minBaseCost) !== null) {
      const baseCost = (r.avgBaseCost ?? r.minBaseCost)!;
      const shipping = r.shippingEst;
      // floor = cost + shipping + etsy fees at floor price, targeting 30% margin
      // Solve: floor = (baseCost + shipping + fees_fixed) / (1 - 0.095 - 0.30)
      const floorCents = Math.round((baseCost + shipping + 45) / 0.605);
      costFloorByProductId.set(r.sampleProductId, floorCents);
    }
  }

  // Now process each active listing
  const nowSec = Math.floor(now / 1000);
  const day45sec = 45 * 24 * 60 * 60;
  const cooldownMs = 14 * 24 * 60 * 60 * 1000;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  for (const listing of activeListings) {
    const listingId = listing.listing_id;
    const adjKey = `price_adj_${listingId}`;
    const lastAdj = agentState.get(adjKey);

    // 14-day cooldown check
    if (lastAdj && (now - new Date(lastAdj).getTime()) < cooldownMs) {
      skipped++;
      continue;
    }

    const sales30d = saleCount30d.get(listingId) ?? 0;
    const createdTs = listingAgeMap.get(listingId) ?? 0;
    const ageSec = nowSec - createdTs;
    const currentPriceCents = listingPriceMap.get(listingId) ?? 0;

    const printifyProductId = etsyToProductId.get(listingId);

    let shouldBump = false;
    let shouldDrop = false;

    if (sales30d >= 3) {
      shouldBump = true;
    } else if (sales30d === 0 && ageSec > day45sec) {
      shouldDrop = true;
    }

    if (!shouldBump && !shouldDrop) {
      skipped++;
      continue;
    }

    if (!printifyProductId) {
      log("autoAdjust: no Printify product for listing — skipping", { listingId });
      skipped++;
      continue;
    }

    // Fetch Printify product variants
    const detailRes = await pFetch(`/shops/${printifyShopId}/products/${printifyProductId}.json`).catch(() => null);
    if (!detailRes?.ok) {
      log("autoAdjust: Printify product fetch failed", { listingId, printifyProductId });
      skipped++;
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }

    const detail = await detailRes.json() as Record<string, unknown>;
    const variants = Array.isArray(detail.variants) ? detail.variants as Array<Record<string, unknown>> : [];

    if (variants.length === 0) {
      skipped++;
      continue;
    }

    // Calculate floor for drop (use first variant's cost if available, else $5 minimum)
    const floorCents = costFloorByProductId.get(printifyProductId) ?? 500;
    const capMultiplier = 1.5;

    const updatedVariants = variants.map((v) => {
      const currentCents = v.price as number; // Printify stores price in cents
      let newCents = currentCents;

      if (shouldBump) {
        const cap = Math.round(currentCents * capMultiplier);
        newCents = Math.min(Math.round(currentCents * 1.10), cap);
      } else if (shouldDrop) {
        newCents = Math.max(Math.round(currentCents * 0.90), floorCents);
      }

      return { ...v, price: newCents };
    });

    // PATCH Printify product variants
    const patchRes = await pFetch(`/shops/${printifyShopId}/products/${printifyProductId}.json`, {
      method: "PUT",
      body: JSON.stringify({ variants: updatedVariants }),
    }).catch(() => null);

    if (!patchRes?.ok) {
      const body = await patchRes?.text().catch(() => "");
      log("autoAdjust: Printify PATCH failed", { listingId, status: patchRes?.status, body: body?.slice(0, 200) });
      skipped++;
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    log("autoAdjust: variants updated", {
      listingId,
      action: shouldBump ? "bump" : "drop",
      variantCount: variants.length,
    });

    // Publish to sync to Etsy
    const publishRes = await fetch(`${SUPABASE_URL}/functions/v1/printify-product-creator`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ publishProductId: printifyProductId }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);

    if (publishRes?.ok) {
      log("autoAdjust: published to Etsy", { listingId });
    } else {
      log("autoAdjust: publish failed (non-fatal)", { listingId, status: publishRes?.status });
    }

    // Record adjustment in pod_agent_state
    const nowIso = new Date().toISOString();
    await sb.from("pod_agent_state").upsert(
      { key: adjKey, value: nowIso, updated_at: nowIso },
      { onConflict: "key" },
    );
    agentState.set(adjKey, nowIso);

    if (shouldBump) bumped++;
    else dropped++;

    await new Promise((r) => setTimeout(r, 500));
  }

  return { bumped, dropped, skipped };
}

// ── enforceFloor: hard-floors any Etsy listing priced below cost×2.4+$4.50 ─────
// Unlike autoAdjust (±10% based on sales velocity), enforceFloor patches
// any listing that is genuinely below break-even regardless of sales performance.
async function runEnforceFloor(
  etsyShopId: string,
  printifyShopId: string,
  auditResults: Array<{
    type: ProductType;
    avgBaseCost: number | null;
    minBaseCost: number | null;
    shippingEst: number;
    retailPrice: number;
    sampleProductId: string | null;
  }>,
  dryRun: boolean,
): Promise<{ floored: number; skipped: number; errors: number; dryRun: boolean; changes: Array<Record<string, unknown>> }> {
  let floored = 0; let skipped = 0; let errors = 0;
  const changes: Array<Record<string, unknown>> = [];

  // Build floor map: type → floor price (cents)
  const floorMap = new Map<string, number>();
  for (const r of auditResults) {
    const effectiveCost = r.avgBaseCost ?? r.minBaseCost;
    if (!effectiveCost) continue;
    // Floor = max(cost×2.4 + $4.50, FINAL_PRICES[type])
    const costFloor = Math.ceil(effectiveCost * 2.4 + 450);
    const configFloor = FINAL_PRICES[r.type];
    floorMap.set(r.type, Math.max(costFloor, configFloor));
  }

  if (floorMap.size === 0) return { floored, skipped, errors, dryRun, changes };

  // Fetch active Etsy listings
  const etsyListings: Array<Record<string, unknown>> = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings?state=active&limit=100&offset=${offset}`,
      { headers: { "x-api-key": ETSY_API_KEY ?? "" }, signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) break;
    const data = await res.json() as Record<string, unknown>;
    const items = Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : [];
    etsyListings.push(...items);
    if (items.length < 100) break;
    offset += 100;
    await new Promise((r) => setTimeout(r, 400));
  }

  log(`enforceFloor: fetched ${etsyListings.length} active Etsy listings`);

  for (const listing of etsyListings) {
    const listingId = String(listing.listing_id ?? "");
    const title = String(listing.title ?? "").toLowerCase();
    const priceObj = listing.price as Record<string, number> | undefined;
    if (!priceObj || !listingId) { skipped++; continue; }
    const currentPriceCents = Math.round((priceObj.amount / priceObj.divisor) * 100);

    // Detect product type from title
    let matchedType: ProductType | null = null;
    for (const type of Object.keys(BLUEPRINT_IDS) as ProductType[]) {
      if (title.includes(type) || (type === "tshirt" && (title.includes("shirt") || title.includes("tee")))) {
        matchedType = type;
        break;
      }
    }
    if (!matchedType) { skipped++; continue; }

    const floor = floorMap.get(matchedType);
    if (!floor) { skipped++; continue; }

    if (currentPriceCents >= floor) { skipped++; continue; }

    changes.push({
      listing_id: listingId,
      title: String(listing.title ?? "").slice(0, 60),
      type: matchedType,
      current_price: fmtCents(currentPriceCents),
      floor_price: fmtCents(floor),
      diff: fmtCents(floor - currentPriceCents),
    });

    if (dryRun) continue;

    // Find Printify product for this listing to patch price
    try {
      const patchRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${etsyShopId}/listings/${listingId}`,
        {
          method: "PATCH",
          headers: { "x-api-key": ETSY_API_KEY ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({ price: (floor / 100).toFixed(2) }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (patchRes.ok) { floored++; log(`enforceFloor: raised ${listingId} ${fmtCents(currentPriceCents)}→${fmtCents(floor)}`); }
      else { errors++; log(`enforceFloor: patch failed`, { listingId, status: patchRes.status }); }
    } catch (e) {
      errors++;
      log(`enforceFloor: exception`, { listingId, err: String(e).slice(0, 80) });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (dryRun) floored = changes.length;
  return { floored, skipped, errors, dryRun, changes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!PRINTIFY_KEY) return new Response(JSON.stringify({ error: "PRINTIFY_API_TOKEN not set" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

  // Parse body to check for autoAdjust / enforceFloor flags
  let autoAdjust = false;
  let enforceFloor = false;
  let dryRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      autoAdjust = body?.autoAdjust === true;
      enforceFloor = body?.enforceFloor === true;
      dryRun = body?.dry_run === true;
    } catch {
      // ignore parse errors — treat as audit-only
    }
  }

  try {
    const printifyShopId = SHOP_ID || (() => { throw new Error("PRINTIFY_SHOP_ID not set"); })();

    // Step 1: Scan all shop products and index ONE product id per blueprint_id
    // The shop product variant.cost field contains the real Printify manufacturing cost
    log("Scanning shop products for blueprint/cost data...");
    const productIdByBlueprint = new Map<number, string>(); // blueprint_id → product_id (first found)

    let page = 1;
    while (page <= 8) {
      const res = await pFetch(`/shops/${printifyShopId}/products.json?page=${page}&limit=50`);
      if (!res.ok) { log(`Page ${page} failed: ${res.status}`); break; }
      const data = await res.json() as Record<string, unknown>;
      const items = Array.isArray(data.data) ? data.data as Array<Record<string, unknown>> : [];
      if (items.length === 0) break;

      for (const p of items) {
        const bp = p.blueprint_id as number;
        if (bp && !productIdByBlueprint.has(bp)) {
          productIdByBlueprint.set(bp, p.id as string);
        }
      }

      const lastPage = typeof data.last_page === "number" ? data.last_page : 1;
      if (page >= lastPage) break;
      page++;
      await new Promise((r) => setTimeout(r, 150));
    }

    log(`Found products for ${productIdByBlueprint.size} unique blueprint IDs`);

    // Step 2: For each product type, fetch full product detail → extract variant.cost
    const auditResults: Array<{
      type: ProductType;
      blueprintId: number;
      sampleProductId: string | null;
      avgBaseCost: number | null;
      minBaseCost: number | null;
      maxBaseCost: number | null;
      shippingEst: number;
      etsyFees: number;
      retailPrice: number;
      totalCogs: number | null;
      grossProfit: number | null;
      marginPct: number | null;
      status: string;
      suggestedPrice: number | null;
      vsMarketMedian: string;
      marketMedian: number;
      variantCount: number;
      dataSource: string;
    }> = [];

    const productTypes = Object.keys(BLUEPRINT_IDS) as ProductType[];

    for (const type of productTypes) {
      const blueprintId = BLUEPRINT_IDS[type];
      const sampleProductId = productIdByBlueprint.get(blueprintId) ?? null;
      const retail = FINAL_PRICES[type];
      const shipping = ESTIMATED_SHIPPING[type];
      const fees = etsyFees(retail);
      const marketMedian = ETSY_MARKET_MEDIAN[type];

      let avgBaseCost: number | null = null;
      let minBaseCost: number | null = null;
      let maxBaseCost: number | null = null;
      let variantCount = 0;
      let dataSource = "no shop product found for this blueprint";

      if (sampleProductId) {
        try {
          const detailRes = await pFetch(`/shops/${printifyShopId}/products/${sampleProductId}.json`);
          if (detailRes.ok) {
            const detail = await detailRes.json() as Record<string, unknown>;
            const variants = Array.isArray(detail.variants) ? detail.variants as Array<Record<string, unknown>> : [];
            const costs = variants
              .filter((v) => v.is_enabled !== false)
              .map((v) => v.cost as number)
              .filter((c) => typeof c === "number" && c > 0);

            if (costs.length > 0) {
              variantCount = costs.length;
              minBaseCost = Math.min(...costs);
              maxBaseCost = Math.max(...costs);
              avgBaseCost = Math.round(costs.reduce((a, b) => a + b, 0) / costs.length);
              dataSource = `live shop product ${sampleProductId} (${costs.length} variants)`;
            } else {
              dataSource = `product ${sampleProductId} found but no cost data in variants`;
            }
          } else {
            dataSource = `detail fetch failed: HTTP ${detailRes.status}`;
          }
        } catch (e) {
          dataSource = `error: ${(e as Error).message.slice(0, 80)}`;
          log(`Cost fetch failed for ${type}: ${(e as Error).message}`);
        }
      }

      await new Promise((r) => setTimeout(r, 200));

      const effectiveCost = avgBaseCost ?? minBaseCost;
      const totalCogs = effectiveCost !== null ? effectiveCost + shipping + fees : null;
      const grossProfit = totalCogs !== null ? retail - totalCogs : null;
      const marginPct = grossProfit !== null ? Math.round((grossProfit / retail) * 100) : null;

      let status = "unknown";
      if (marginPct !== null) {
        if (marginPct >= 40) status = "healthy";
        else if (marginPct >= 25) status = "tight";
        else status = "critical";
      }

      // Solve for 45% margin: retail = (fixedCosts) / (1 - 0.45 - 0.095) = fixedCosts / 0.455
      let suggestedPrice: number | null = null;
      if (effectiveCost !== null) {
        const fixedCosts = effectiveCost + shipping + 70; // 70 = listing + processing fixed
        suggestedPrice = Math.ceil(fixedCosts / 0.455 / 100) * 100; // round to nearest dollar
      }

      const vsMarket = retail < marketMedian
        ? `below market by ${fmtCents(marketMedian - retail)}`
        : retail > marketMedian * 1.2
          ? `above market by ${fmtCents(retail - marketMedian)}`
          : "at market";

      log(`${type}: base=${effectiveCost ? fmtCents(effectiveCost) : "unknown"} margin=${marginPct ?? "?"}%`);

      auditResults.push({
        type, blueprintId, sampleProductId,
        avgBaseCost, minBaseCost, maxBaseCost,
        shippingEst: shipping, etsyFees: fees, retailPrice: retail,
        totalCogs, grossProfit, marginPct, status, suggestedPrice,
        vsMarketMedian: vsMarket, marketMedian, variantCount, dataSource,
      });
    }

    // Step 3: Summary
    const withData = auditResults.filter((r) => r.marginPct !== null);
    const healthy  = withData.filter((r) => r.status === "healthy");
    const tight    = withData.filter((r) => r.status === "tight");
    const critical = withData.filter((r) => r.status === "critical");
    const noData   = auditResults.filter((r) => r.marginPct === null);
    const avgMargin = withData.length > 0
      ? Math.round(withData.reduce((a, r) => a + (r.marginPct ?? 0), 0) / withData.length)
      : null;

    const tableRows = auditResults.map((r) => ({
      type:           r.type,
      retail:         fmtCents(r.retailPrice),
      baseCost:       r.avgBaseCost   ? fmtCents(r.avgBaseCost)   : "unknown",
      baseCostRange:  (r.minBaseCost && r.maxBaseCost && r.minBaseCost !== r.maxBaseCost)
                        ? `${fmtCents(r.minBaseCost)}–${fmtCents(r.maxBaseCost)}` : null,
      shipping:       fmtCents(r.shippingEst),
      etsyFees:       fmtCents(r.etsyFees),
      totalCogs:      r.totalCogs     ? fmtCents(r.totalCogs)     : "unknown",
      grossProfit:    r.grossProfit   ? fmtCents(r.grossProfit)   : "unknown",
      margin:         r.marginPct     !== null ? `${r.marginPct}%` : "unknown",
      status:         r.status,
      suggestedPrice: r.suggestedPrice ? fmtCents(r.suggestedPrice) : "unknown",
      marketMedian:   fmtCents(r.marketMedian),
      vsMarket:       r.vsMarketMedian,
      variants:       r.variantCount,
      dataSource:     r.dataSource,
    }));

    const recommendations = [
      ...critical.map((r) => ({
        priority: "HIGH", type: r.type,
        issue: `${r.marginPct}% margin — unsustainable after Etsy fees`,
        action: `Raise retail to ${r.suggestedPrice ? fmtCents(r.suggestedPrice) : "?"} for 45% margin`,
      })),
      ...tight.map((r) => ({
        priority: "MEDIUM", type: r.type,
        issue: `${r.marginPct}% margin is tight (target is 40–50%)`,
        action: `Consider raising to ${r.suggestedPrice ? fmtCents(r.suggestedPrice) : "?"} for 45% margin`,
      })),
      ...noData.map((r) => ({
        priority: "INFO", type: r.type,
        issue: r.dataSource,
        action: "Run once after creating a product of this type to enable cost tracking",
      })),
    ];

    const auditResponse = {
      generatedAt: new Date().toISOString(),
      mode: autoAdjust ? "autoAdjust" : "audit",
      summary: {
        totalTypes: auditResults.length,
        withRealCostData: withData.length,
        healthy: healthy.length,
        tight: tight.length,
        critical: critical.length,
        noData: noData.length,
        avgMargin: avgMargin !== null ? `${avgMargin}%` : "insufficient data",
        blueprintsInShop: productIdByBlueprint.size,
      },
      recommendations,
      breakdown: tableRows,
      notes: {
        costSource: "variant.cost from live Printify shop products (the only accurate source — catalog API does not expose manufacturing cost)",
        shippingNote: "US economy shipping estimates baked into our free-shipping retail price",
        etsyFeeNote: "6.5% transaction + $0.20 listing + 3% + $0.25 payment processing = ~9.5% + $0.45 fixed",
        targetMargin: "Industry standard: 40–50% gross margin for POD on Etsy. Below 25% = unsustainable.",
        suggestedPriceNote: "Suggested price solves for 45% margin: price = (baseCost + shipping + $0.70) / 0.455, rounded up to nearest dollar",
      },
    };

    // ── Auto-adjust mode ───────────────────────────────────────────────────────
    if (autoAdjust) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

      // Get Etsy tokens for shop_id
      const etsyCtx = await getEtsyTokens(sb);
      if (!etsyCtx) {
        return new Response(JSON.stringify({
          ...auditResponse,
          autoAdjust: { error: "Could not get Etsy tokens — skipped price adjustments", bumped: 0, dropped: 0, skipped: 0 },
        }, null, 2), { headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const adjustSummary = await runAutoAdjust(
        sb,
        auditResults.map((r) => ({
          type: r.type,
          sampleProductId: r.sampleProductId,
          avgBaseCost: r.avgBaseCost,
          minBaseCost: r.minBaseCost,
          shippingEst: r.shippingEst,
        })),
        etsyCtx.shopId,
        printifyShopId,
      );

      log("autoAdjust complete", adjustSummary);

      if (!enforceFloor) {
        return new Response(JSON.stringify({
          ...auditResponse,
          autoAdjust: adjustSummary,
        }, null, 2), { headers: { ...CORS, "Content-Type": "application/json" } });
      }

      // Fall through to enforceFloor if both flags set
      const floorSummary = await runEnforceFloor(etsyCtx.shopId, printifyShopId, auditResults, dryRun);
      log("enforceFloor complete", floorSummary);
      return new Response(JSON.stringify({
        ...auditResponse,
        autoAdjust: adjustSummary,
        enforceFloor: floorSummary,
      }, null, 2), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (enforceFloor) {
      const SUPABASE_URL2 = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb2 = createClient(SUPABASE_URL2, SERVICE_KEY2, { auth: { persistSession: false } });
      const etsyCtx2 = await getEtsyTokens(sb2);
      if (!etsyCtx2) {
        return new Response(JSON.stringify({
          ...auditResponse,
          enforceFloor: { error: "Could not get Etsy tokens — skipped floor enforcement" },
        }, null, 2), { headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const floorSummary = await runEnforceFloor(etsyCtx2.shopId, printifyShopId, auditResults, dryRun);
      log("enforceFloor complete", floorSummary);
      return new Response(JSON.stringify({
        ...auditResponse,
        enforceFloor: floorSummary,
      }, null, 2), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(auditResponse, null, 2), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    log("Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
