// printify-fixer v3
// Fixes under-priced variants and missing Printify tags
//
// MODE: prices
//   POST {"mode":"prices"}             → fix all under-priced variants (all pages)
//   POST {"mode":"prices","dry_run":true} → preview only
//
// MODE: tags — processes ONE PAGE of Printify products at a time (50 products)
//   POST {"mode":"tags","page":1}      → process page 1
//   POST {"mode":"tags","page":2}      → process page 2  (repeat up to last_page)
//   POST {"mode":"tags","dry_run":true,"page":1} → preview page 1

const KEY    = Deno.env.get("PRINTIFY_API_TOKEN") || "";
const SHOP   = Deno.env.get("PRINTIFY_SHOP_ID")   || "";
const SB_URL = Deno.env.get("SUPABASE_URL")        || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BASE   = "https://api.printify.com/v1";
const LIMIT  = 50;

// ── Minimum retail prices (cents) ──────────────────────────────────────────────
const MIN_PRICE = {
  mug:1899, tumbler:2999, travelmug:2999, tshirt:2299, hoodie:3899,
  sweatshirt:3999, longsleeve:2699, hat:2499, truckercap:2499,
  sock:1899, onesie:2499, candle:2699, coaster:1999, petbandana:2499,
  ornament:1999, poster_v:2499, wineglass:1999, pintglass:1999,
  puzzle:2999, pillow:2999, journal:1999, mousepad:1799,
};

const BP_TYPE = {
  384:"mug",493:"mug",145:"tshirt",77:"hoodie",278:"sock",
  517:"tumbler",358:"tumbler",366:"hat",619:"candle",
  457:"coaster",587:"onesie",488:"longsleeve",172:"sweatshirt",
};

function guessType(bp, title) {
  if (BP_TYPE[bp]) return BP_TYPE[bp];
  const t = (title || "").toLowerCase();
  if (t.includes("mug")) return "mug";
  if (t.includes("hoodie") && !t.includes("youth")) return "hoodie";
  if (t.includes("sweatshirt") || t.includes("crewneck")) return "sweatshirt";
  if (t.includes("tumbler") || t.includes("travel mug")) return "tumbler";
  if (t.includes("tee") || t.includes("t-shirt") || t.includes("shirt")) return "tshirt";
  if (t.includes("sock")) return "sock";
  if (t.includes("hat") || t.includes("cap")) return "hat";
  if (t.includes("candle")) return "candle";
  if (t.includes("coaster")) return "coaster";
  if (t.includes("ornament")) return "ornament";
  if (t.includes("pillow")) return "pillow";
  if (t.includes("puzzle")) return "puzzle";
  if (t.includes("mouse pad") || t.includes("mousepad") || t.includes("desk mat")) return "mousepad";
  return "unknown";
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function printifyGet(path) {
  const r = await fetch(BASE + path, {
    headers: { Authorization: "Bearer " + KEY },
    signal: AbortSignal.timeout(20_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Printify " + r.status + ": " + txt.slice(0, 300));
  return JSON.parse(txt);
}

async function printifyPut(path, body) {
  const r = await fetch(BASE + path, {
    method: "PUT",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Printify PUT " + r.status + ": " + txt.slice(0, 300));
  return JSON.parse(txt);
}

// Load ONE page of products
async function getProductPage(page) {
  const data = await printifyGet(`/shops/${SHOP}/products.json?page=${page}&limit=${LIMIT}`);
  return {
    products: data.data || [],
    last_page: data.last_page || Math.ceil((data.total || 0) / LIMIT),
    total: data.total || 0,
  };
}

// Load ALL products across all pages (for prices mode — manageable since we only need variant prices)
async function getAllProductsMini() {
  let page = 1, lastPage = 1, all = [];
  do {
    const data = await printifyGet(`/shops/${SHOP}/products.json?page=${page}&limit=${LIMIT}`);
    // Only keep what we need for price checking — minimize memory
    for (const p of (data.data || [])) {
      all.push({
        id: p.id,
        title: p.title,
        blueprint_id: p.blueprint_id,
        variants: (p.variants || []).map(v => ({ id: v.id, price: v.price, is_enabled: v.is_enabled })),
      });
    }
    lastPage = data.last_page || Math.ceil((data.total || 0) / LIMIT);
    page++;
    if (page <= lastPage) await sleep(400);
  } while (page <= lastPage);
  console.log("[FIXER] loaded", all.length, "products (mini)");
  return all;
}

// Fetch Etsy tags from our DB for given etsy listing ids
async function fetchEtsyTagsMap(etsyIds) {
  if (!etsyIds.length) return {};
  const ids = etsyIds.join(",");
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/etsy_listings?select=listing_id,tags&listing_id=in.(${ids})&limit=500`,
      { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, signal: AbortSignal.timeout(10_000) }
    );
    const rows = await r.json();
    const map = {};
    if (Array.isArray(rows)) rows.forEach(row => {
      if (row.listing_id && Array.isArray(row.tags) && row.tags.length > 0) {
        map[String(row.listing_id)] = row.tags;
      }
    });
    return map;
  } catch (_) { return {}; }
}

// ── MODE: prices ───────────────────────────────────────────────────────────────
async function fixPrices(dryRun) {
  const products = await getAllProductsMini();
  const results = { fixed: [], skipped: [], errors: [] };

  for (const p of products) {
    const pt = guessType(p.blueprint_id, p.title);
    const minAllowed = MIN_PRICE[pt];
    if (!minAllowed) continue;

    const enabled = p.variants.filter(v => v.is_enabled);
    const prices = enabled.map(v => Number(v.price)).filter(x => x > 0);
    if (!prices.length) continue;

    const minPrice = Math.min(...prices);
    if (minPrice >= minAllowed) continue;

    const diff = ((minAllowed - minPrice) / 100).toFixed(2);
    console.log(`[PRICES] ${p.title.slice(0,50)} | ${pt} | $${(minPrice/100).toFixed(2)} → $${(minAllowed/100).toFixed(2)} (+$${diff})`);

    if (dryRun) {
      results.skipped.push({
        id: p.id, title: p.title.slice(0, 60), type: pt,
        current: +(minPrice/100).toFixed(2), target: +(minAllowed/100).toFixed(2), diff: +diff,
      });
      continue;
    }

    try {
      const full = await printifyGet(`/shops/${SHOP}/products/${p.id}.json`);
      const allVars = (full.variants || []).map(v => ({
        id: v.id,
        price: v.is_enabled ? Math.max(Number(v.price), minAllowed) : Number(v.price),
        is_enabled: v.is_enabled,
      }));
      await printifyPut(`/shops/${SHOP}/products/${p.id}.json`, { variants: allVars });
      results.fixed.push({
        id: p.id, title: p.title.slice(0, 60), type: pt,
        was: +(minPrice/100).toFixed(2), now: +(minAllowed/100).toFixed(2), diff: +diff,
      });
      await sleep(1500);
    } catch (e) {
      results.errors.push({ id: p.id, title: p.title.slice(0, 50), error: String(e).slice(0, 150) });
      await sleep(2000);
    }
  }
  return results;
}

// ── MODE: tags — ONE PAGE at a time ───────────────────────────────────────────
async function fixTagsPage(dryRun, page) {
  const { products, last_page, total } = await getProductPage(page);
  console.log(`[TAGS] page ${page}/${last_page}, ${products.length} products on this page`);

  // Filter to products on this page that need tags and are on Etsy
  const needsTags = products.filter(p => {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    return tags.length < 5 && p.external && p.external.id;
  });
  console.log(`[TAGS] ${needsTags.length} products on page ${page} need tags`);

  const results = {
    page, last_page, total_products: total,
    fixed: [], skipped_no_etsy_tags: [], errors: [],
  };

  if (needsTags.length === 0) return results;

  // Batch-fetch Etsy tags from DB for just this page's products
  const etsyIds = needsTags.map(p => p.external.id).filter(Boolean);
  const tagsMap = await fetchEtsyTagsMap(etsyIds);
  console.log(`[TAGS] got Etsy tags for ${Object.keys(tagsMap).length}/${needsTags.length} products`);

  for (const p of needsTags) {
    const etsyId = p.external?.id;
    const etsyTags = tagsMap[String(etsyId)];

    if (!etsyTags || etsyTags.length === 0) {
      results.skipped_no_etsy_tags.push({ id: p.id, title: p.title.slice(0, 50) });
      continue;
    }

    const printifyTags = etsyTags
      .map(t => t.trim().slice(0, 40))
      .filter(t => t.length > 0)
      .slice(0, 10);

    console.log(`[TAGS] ${p.title.slice(0,40)} → [${printifyTags.join(", ").slice(0,80)}]`);

    if (dryRun) {
      results.fixed.push({ id: p.id, title: p.title.slice(0, 50), would_set: printifyTags });
      continue;
    }

    try {
      await printifyPut(`/shops/${SHOP}/products/${p.id}.json`, { tags: printifyTags });
      results.fixed.push({ id: p.id, title: p.title.slice(0, 60), tags_set: printifyTags.length });
      await sleep(800);
    } catch (e) {
      results.errors.push({ id: p.id, title: p.title.slice(0, 50), error: String(e).slice(0, 150) });
      await sleep(2000);
    }
  }
  return results;
}

// ── MAIN ───────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!KEY) return Response.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });

  let body = {};
  try { body = await req.json(); } catch (_) {}

  const mode   = body.mode || "";
  const dryRun = !!body.dry_run;
  const page   = Math.max(1, Number(body.page || 1));
  console.log(`[FIXER] mode=${mode} dry_run=${dryRun} page=${page}`);

  if (mode === "prices") {
    const results = await fixPrices(dryRun);
    return Response.json({
      mode: "prices", dry_run: dryRun,
      fixed_count: results.fixed.length,
      skipped_count: results.skipped.length,
      error_count: results.errors.length,
      fixed: results.fixed, skipped: results.skipped, errors: results.errors,
    });
  }

  if (mode === "tags") {
    const results = await fixTagsPage(dryRun, page);
    return Response.json({
      mode: "tags", dry_run: dryRun,
      page: results.page,
      last_page: results.last_page,
      total_products: results.total_products,
      fixed_count: results.fixed.length,
      no_etsy_tags_count: results.skipped_no_etsy_tags.length,
      error_count: results.errors.length,
      next_page: results.page < results.last_page ? results.page + 1 : null,
      fixed: results.fixed,
      no_etsy_tags: results.skipped_no_etsy_tags,
      errors: results.errors,
    });
  }

  return Response.json({
    error: "Missing mode",
    usage: {
      prices: 'POST {"mode":"prices"} or {"mode":"prices","dry_run":true}',
      tags: 'POST {"mode":"tags","page":1} — run pages 1..N (check next_page in response)',
    },
  }, { status: 400 });
});
