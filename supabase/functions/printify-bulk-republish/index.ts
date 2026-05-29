// printify-bulk-republish
//
// Republishes every Printify product that has an active Etsy listing.
// Use this to flush "Unpublished changes" badges after any batch edit
// (price audit, tag update, image repair, etc.).
//
// API:
//   POST {}                        → sweep all pages, republish everything with Etsy listing
//   POST {"page": 2, "offset": 0}  → resume from a specific page/offset
//   POST {"dry_run": true}         → preview — shows what would be published, no changes
//   POST {"product_id": "xxx"}     → republish one specific product
//
// Self-chaining: fires itself with the next offset before returning.
// One trigger sweeps all products autonomously.
//
// Rate-limit safety: 4s gap between publishes, batch_size=8 per invocation.
// 8 × ~5s = 40s + API overhead = well under 150s edge function limit.

const PRINTIFY_KEY  = Deno.env.get("PRINTIFY_API_TOKEN") || "";
const SHOP          = Deno.env.get("PRINTIFY_SHOP_ID")   || "";
const SB_URL        = Deno.env.get("SUPABASE_URL")       || "";
const BASE          = "https://api.printify.com/v1";
const LIMIT         = 50;   // Printify max per page
const BATCH_SIZE    = 8;    // products per invocation
const PUBLISH_GAP   = 10000; // ms between publish calls (10s — avoids Printify 429)

// Full publish payload — pushes all Printify data to Etsy
const PUBLISH_PAYLOAD = {
  title: true,
  description: true,
  images: true,
  variants: true,
  tags: true,
  keyFeatures: true,
  shipping_template: true,
};

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function pGet(path: string) {
  const r = await fetch(BASE + path, {
    headers: { Authorization: "Bearer " + PRINTIFY_KEY },
    signal: AbortSignal.timeout(30_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Printify GET ${r.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

async function pPost(path: string, body: unknown) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + PRINTIFY_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Printify POST ${r.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun     = body.dry_run === true;
    const singleId   = body.product_id as string | undefined;
    const page       = typeof body.page   === "number" ? body.page   : 1;
    const offset     = typeof body.offset === "number" ? body.offset : 0;

    console.log(`[REPUBLISH] start — page=${page} offset=${offset} dry_run=${dryRun}`);

    // ── Single product mode ────────────────────────────────────────────────────
    if (singleId) {
      const p = await pGet(`/shops/${SHOP}/products/${singleId}.json`);
      if (!p.external?.id) {
        return new Response(JSON.stringify({ error: "Product has no Etsy listing" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      if (!dryRun) {
        await pPost(`/shops/${SHOP}/products/${singleId}/publish.json`, PUBLISH_PAYLOAD);
      }
      return new Response(JSON.stringify({
        dry_run: dryRun,
        published: [{ id: singleId, title: p.title }],
      }), { headers: { "Content-Type": "application/json" } });
    }

    // ── Page sweep mode ────────────────────────────────────────────────────────
    const listData = await pGet(`/shops/${SHOP}/products.json?page=${page}&limit=${LIMIT}`);
    const allOnPage: Array<{ id: string; title: string; external?: { id?: string } }> =
      listData.data ?? [];
    const total: number = listData.total ?? 0;
    const lastPage     = Math.ceil(total / LIMIT);

    // Slice the batch from the current offset on this page
    const batch = allOnPage.slice(offset, offset + BATCH_SIZE);

    const published:         Array<{ id: string; title: string }> = [];
    const skipped_no_etsy:   Array<{ id: string; title: string }> = [];
    const skipped_locked:    Array<{ id: string; title: string; error: string }> = [];
    const errors:            Array<{ id: string; title: string; error: string }> = [];

    for (const p of batch) {
      const label = p.title?.slice(0, 50) ?? p.id;

      if (dryRun) {
        console.log(`[REPUBLISH] dry_run would publish: ${label}`);
        published.push({ id: p.id, title: p.title });
        continue;
      }

      try {
        await sleep(PUBLISH_GAP);
        await pPost(`/shops/${SHOP}/products/${p.id}/publish.json`, PUBLISH_PAYLOAD);
        console.log(`[REPUBLISH] ✓ published: ${label}`);
        published.push({ id: p.id, title: p.title });
      } catch (e) {
        const msg = (e as Error).message;
        // 8252 = product locked OR no sales channel configured — skip gracefully
        if (msg.includes("8252")) {
          // "No sales channels are enabled" = draft product, not on Etsy
          if (msg.toLowerCase().includes("no sales channel") || msg.toLowerCase().includes("sales channels")) {
            console.log(`[REPUBLISH] skip no-channel (draft): ${label}`);
            skipped_no_etsy.push({ id: p.id, title: p.title });
          } else {
            console.warn(`[REPUBLISH] locked (8252) skip: ${label}`);
            skipped_locked.push({ id: p.id, title: p.title, error: msg.slice(0, 120) });
          }
        } else {
          console.error(`[REPUBLISH] error: ${label} — ${msg.slice(0, 120)}`);
          errors.push({ id: p.id, title: p.title, error: msg.slice(0, 120) });
        }
      }
    }

    // ── Determine next call ────────────────────────────────────────────────────
    const remaining_this_page = allOnPage.length - (offset + BATCH_SIZE);
    let next_page:   number | null = null;
    let next_offset: number | null = null;
    let next_hint:   string | null = null;

    if (remaining_this_page > 0) {
      next_page   = page;
      next_offset = offset + BATCH_SIZE;
      next_hint   = `POST {"page":${next_page},"offset":${next_offset}} — ${remaining_this_page} more on page ${page}`;
    } else if (page < lastPage) {
      next_page   = page + 1;
      next_offset = 0;
      next_hint   = `POST {"page":${next_page},"offset":0} — next page`;
    }

    // ── Self-chain ─────────────────────────────────────────────────────────────
    if (!dryRun && next_hint) {
      const selfUrl = `${SB_URL}/functions/v1/printify-bulk-republish`;
      fetch(selfUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: next_page, offset: next_offset }),
      }).catch(e => console.warn("[REPUBLISH] self-chain failed:", (e as Error).message));
      console.log(`[REPUBLISH] self-chained: ${next_hint}`);
    }

    const result = {
      dry_run: dryRun,
      page,
      last_page: lastPage,
      total_products: total,
      offset,
      batch_size: BATCH_SIZE,
      published_count:      published.length,
      skipped_no_etsy_count: skipped_no_etsy.length,
      skipped_locked_count: skipped_locked.length,
      error_count:          errors.length,
      next_hint,
      published,
      skipped_no_etsy,
      skipped_locked,
      errors,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[REPUBLISH] fatal:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
