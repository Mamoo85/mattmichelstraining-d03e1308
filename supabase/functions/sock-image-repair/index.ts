// sock-image-repair — regenerate broken sock designs with correct tall-portrait prompt
// Targets blueprint_id=365 (ArtsAdd crew socks). Processes 2 per call, paginated.
// POST {} → repair next 2 socks starting at offset 0
// POST {"offset": N} → continue from offset N
// POST {"limit": 1} → repair only 1 sock (for first-run verification)
// POST {"fixSockFirstImage": true} → delete rank=1 Etsy image from all repaired sock listings
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
// Supabase + Etsy (for fixSockFirstImage mode)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";
const ETSY_SECRET = Deno.env.get("ETSY_SHARED_SECRET") ?? "";
const ETSY_HEADER_KEY = ETSY_SECRET ? `${ETSY_API_KEY}:${ETSY_SECRET}` : ETSY_API_KEY;
const ETSY_SHOP_ID = "6311589";

// ─── IMAGE SPEC ────────────────────────────────────────────────────────────────
// ArtsAdd bp 365 sock leg print area is very tall (~1:3 aspect ratio).
// 1024×1536 (2:3 portrait) at scale=2.5 fills the full leg height with slight
// width overflow — the correct and tested replacement for the old 1024×1024 / scale=3.5.
// Math: scale=2.5 × (1536/1024) = 3.75 × print_area_width ≥ print_area_height for bp365.
const SOCK_IMAGE_SIZE = "1024x1536";
const SOCK_SCALE = 2.5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[SOCK-REPAIR] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Etsy OAuth token refresh ────────────────────────────────────────────────
async function getEtsyAccessToken(sb: ReturnType<typeof createClient>): Promise<{ token: string; headers: Record<string, string> }> {
  const { data: tokenRow } = await sb
    .from("etsy_oauth_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRow) throw new Error("No Etsy OAuth tokens — complete OAuth flow first");

  let accessToken: string = tokenRow.access_token;
  const needsRefresh = Date.now() >= new Date(tokenRow.expires_at).getTime() - 5 * 60 * 1000;

  if (needsRefresh) {
    log("Refreshing Etsy token");
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

  return {
    token: accessToken,
    headers: { "x-api-key": ETSY_HEADER_KEY, Authorization: `Bearer ${accessToken}` },
  };
}

// Extract MongoDB ObjectID creation timestamp from a Printify mockup src URL.
// Printify src URLs contain 24-hex-char ObjectIDs whose first 8 chars = Unix seconds.
// Using the LAST ObjectID in the URL (image/mockup ID) gives the most accurate timestamp.
// Returns 0 if no ObjectID found (falls back to stable sort order).
function extractSrcTimestamp(src: string): number {
  const matches = src.match(/[0-9a-f]{24}/g);
  if (!matches || matches.length === 0) return 0;
  const ts = parseInt(matches[matches.length - 1].slice(0, 8), 16);
  return isNaN(ts) ? 0 : ts;
}

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

// Two-step prompt: GPT-4o-mini generates a concrete image description from the title,
// then that description feeds into the full sock-specific generation prompt.
function buildSockPrompt(title: string, aiPrompt: string): string {
  return `SOCK ALL-OVER PRINT DESIGN — TALL PORTRAIT CANVAS (1024×1536, taller than wide). ` +
    `CRITICAL — FILL THE FULL HEIGHT: Spread all pattern elements uniformly from the TOP to the BOTTOM of the canvas. ` +
    `Do NOT concentrate elements in the middle. Do NOT leave blank space at the top or bottom. ` +
    `CRITICAL: Use a VIBRANT SATURATED COLORED background that fills the entire canvas — bold red, navy, forest green, hot pink, bright orange, etc. ` +
    `DO NOT use white or light backgrounds — they would be invisible against the white sock body. ` +
    `CRITICAL — ONE UNIFIED PATTERN ONLY: This SAME image tiles identically across BOTH sock legs. ` +
    `DO NOT put different designs on the left half vs. right half. DO NOT create two separate sock designs side by side. ` +
    `Create ONE cohesive repeating pattern with the same themed elements distributed uniformly across the ENTIRE canvas — left, right, top, bottom equally. ` +
    `DO NOT render any style-instruction words as visible text (do not write "bold", "aesthetic", "high contrast" — these are invisible instructions, NOT design content). ` +
    `Design theme: ${aiPrompt || title}. ` +
    `Render the ACTUAL themed artwork: illustrated characters, icons, symbols scattered uniformly corner-to-corner. ` +
    `Bold, high-contrast cartoon illustration style. No watermarks, print-on-demand ready.`;
}

async function repairOneSock(shopId: string, sock: {
  id: string; title: string; blueprint_id: number;
  images?: Array<{ src: string; position: string }>;
  external?: { id?: string };
}, printAreas: Array<{
  variant_ids: number[];
  placeholders: Array<{ position: string; images: Array<{ id: string; x: number; y: number; scale: number; angle: number }> }>;
}>): Promise<{ success: boolean; error?: string; imageId?: string }> {
  // Step 1: AI generates a concrete themed image prompt from the title
  let imagePrompt = sock.title;
  try {
    const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Create a concise image generation prompt for a flat 2D sock all-over-print design based on this product title: "${sock.title}". ` +
            `Return ONLY the prompt (under 60 words). Describe SPECIFIC illustrated elements (characters, objects, symbols) ` +
            `that should appear scattered uniformly across a TALL PORTRAIT canvas from top to bottom. ` +
            `Include the exact funny/themed text phrase to show if relevant. ` +
            `Do NOT use abstract style words like "bold", "aesthetic", "high contrast" — describe actual visual content only.`,
        }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (promptRes.ok) {
      const pd = await promptRes.json();
      imagePrompt = pd.choices?.[0]?.message?.content?.trim() ?? sock.title;
    }
  } catch { /* use title fallback */ }

  // Step 2: Generate new tall portrait image
  const fullPrompt = buildSockPrompt(sock.title, imagePrompt);
  log("Generating 1024×1536 image", { title: sock.title, prompt: fullPrompt.slice(0, 80) });

  const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: fullPrompt,
      n: 1,
      size: SOCK_IMAGE_SIZE,
      quality: "medium",
      background: "opaque",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!imgRes.ok) {
    const err = await imgRes.text();
    return { success: false, error: `Image gen failed: ${imgRes.status} ${err.slice(0, 200)}` };
  }
  const imgData = await imgRes.json();
  const b64 = imgData?.data?.[0]?.b64_json;
  if (!b64) return { success: false, error: "No image data returned" };

  // Step 3: Upload to Printify
  const uploadRes = await pFetch("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: `sock_repair_${sock.id}.png`, contents: b64 }),
  });
  if (!uploadRes.ok) return { success: false, error: `Upload failed: ${uploadRes.status}` };
  const uploadData = await uploadRes.json() as { id: string };
  const imageId = uploadData.id;
  log("Uploaded image", { imageId, sockId: sock.id });

  // Step 4: PATCH all 4 print areas with new image at SOCK_SCALE (fills full leg height)
  const newPrintAreas = printAreas.map((area) => ({
    ...area,
    placeholders: area.placeholders.map((ph) => ({
      ...ph,
      images: [{ id: imageId, x: 0.5, y: 0.5, scale: SOCK_SCALE, angle: 0 }],
    })),
  }));

  const patchRes = await pFetch(`/shops/${shopId}/products/${sock.id}.json`, {
    method: "PUT",
    body: JSON.stringify({ print_areas: newPrintAreas }),
  });
  if (!patchRes.ok) {
    const patchErr = await patchRes.text();
    return { success: false, error: `PATCH failed: ${patchRes.status} ${patchErr.slice(0, 200)}` };
  }
  log("PATCHed product", { id: sock.id, scale: SOCK_SCALE, size: SOCK_IMAGE_SIZE });

  // Step 5: Wait for mockup generation, sort images newest-first via PUT, then re-publish.
  // NOTE: Printify's /images/sort.json returns 404 — it doesn't exist. Use PUT instead.
  // extractSrcTimestamp() uses MongoDB ObjectID timestamps from src URLs — post-repair
  // mockups have higher timestamps and will sort to index 0 → become rank=1 on Etsy.
  await new Promise((r) => setTimeout(r, 60_000));
  try {
    const freshDetail = await pFetch(`/shops/${shopId}/products/${sock.id}.json`);
    if (freshDetail.ok) {
      const freshProd = await freshDetail.json() as Record<string, unknown>;
      const allImages = Array.isArray(freshProd.images)
        ? freshProd.images as Array<{ src: string }>
        : [];
      if (allImages.length > 1) {
        const sorted = [...allImages]
          .sort((a, b) => extractSrcTimestamp(b.src) - extractSrcTimestamp(a.src));
        const imagesForPut = sorted.map((img, idx) => ({
          ...(img as Record<string, unknown>),
          is_default: idx === 0,
        }));
        const putSortRes = await pFetch(`/shops/${shopId}/products/${sock.id}.json`, {
          method: "PUT",
          body: JSON.stringify({ images: imagesForPut }),
        });
        const firstTs = extractSrcTimestamp(sorted[0]?.src ?? "");
        const lastTs = extractSrcTimestamp(sorted[sorted.length - 1]?.src ?? "");
        log("Sorted images newest-first via PUT before publish", {
          sockId: sock.id, count: allImages.length,
          putStatus: putSortRes.status, sortWorked: firstTs > lastTs,
        });
      }
    }
  } catch (e) {
    log("Image sort warning (non-fatal)", { sockId: sock.id, error: (e as Error).message });
  }

  if (sock.external?.id) {
    const pubRes = await pFetch(`/shops/${shopId}/products/${sock.id}/publish.json`, {
      method: "POST",
      body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    });
    log("Re-published to Etsy", { status: pubRes.status, sockId: sock.id });
  }

  return { success: true, imageId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!PRINTIFY_KEY) return Response.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const offset: number = typeof body.offset === "number" ? body.offset : 0;
  const batchLimit: number = typeof body.limit === "number" ? body.limit : 2; // default 2 per call

  // ── SORT SOCKS VIA PRINTIFY — zero Etsy API calls ──────────────────────────
  // For each bp-365 sock on Printify:
  //   1. Sort product images newest-first using MongoDB ObjectID timestamp from src URL
  //   2. Call publish.json → Printify relays to Etsy via THEIR OAuth relay (no OUR rate limit)
  // Etsy listing images are replaced/updated by the fresh publish.
  // This is the preferred approach over fixSockFirstImage (no Etsy rate limit risk).
  // POST {"sortSocksViaPrintify": true, "offset": 0}
  if (body.sortSocksViaPrintify === true) {
    const spOffset: number = typeof body.offset === "number" ? body.offset : 0;
    log("sortSocksViaPrintify mode — sorting + republishing all bp-365 socks via Printify");

    const shopId = SHOP_ID || await (async () => {
      const r = await pFetch("/shops.json");
      const d = await r.json() as Array<{ id: string }> | { id: string };
      return String(Array.isArray(d) ? d[0]?.id : d.id);
    })();

    const printifyPage = Math.floor(spOffset / 50) + 1;
    const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
    if (!pageRes.ok) {
      return Response.json({ error: `Printify page fetch failed: ${pageRes.status}` }, { status: 500, headers: CORS });
    }
    const pageData = await pageRes.json() as { data?: Array<{ id: string; title: string; blueprint_id: number; external?: Array<{ id?: string }> | { id?: string } }>; total?: number };
    const items = Array.isArray(pageData.data) ? pageData.data : [];
    const totalProducts = typeof pageData.total === "number" ? pageData.total : items.length;
    const nextPageStart = printifyPage * 50;
    const hasMorePages = nextPageStart < totalProducts;

    // Filter to bp-365 socks with Etsy IDs
    const socks = items.filter((item) => {
      if (item.blueprint_id !== 365) return false;
      const ext = Array.isArray(item.external) ? item.external[0] : item.external;
      return !!ext?.id;
    });

    log(`Page ${printifyPage}: found ${socks.length} bp-365 socks (of ${items.length} products, ${totalProducts} total)`);

    if (socks.length === 0) {
      if (hasMorePages) {
        return Response.json({
          skipped: "No bp-365 socks on this page",
          callNext: `POST {"sortSocksViaPrintify":true,"offset":${nextPageStart}}`,
          total: totalProducts,
        }, { headers: CORS });
      }
      return Response.json({ done: true, message: "No more bp-365 socks in Printify", total: totalProducts }, { headers: CORS });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const item of socks) {
      try {
        // Get full product detail for image list
        const detailRes = await pFetch(`/shops/${shopId}/products/${item.id}.json`);
        if (!detailRes.ok) {
          results.push({ id: item.id, title: item.title, status: "error", reason: `detail fetch ${detailRes.status}` });
          continue;
        }
        const detail = await detailRes.json() as { images?: Array<{ id: unknown; src: string }>; external?: Array<{ id?: string }> | { id?: string } };
        const images = Array.isArray(detail.images) ? detail.images as Array<{ id: unknown; src: string }> : [];

        if (images.length <= 1) {
          results.push({ id: item.id, title: item.title, status: "skipped", reason: `only ${images.length} image(s)` });
          continue;
        }

        // Sort images newest-first using MongoDB ObjectID timestamp from src URL.
        // extractSrcTimestamp() is defined at module scope above.
        // Post-repair mockups have higher timestamps → sorted to index 0 → becomes rank=1 on Etsy.
        const sortedImages = [...images]
          .sort((a, b) => extractSrcTimestamp(b.src) - extractSrcTimestamp(a.src));

        // Mark the newest image as is_default = true so Printify sends it as rank=1 to Etsy
        const imagesForPut = sortedImages.map((img, idx) => ({
          ...(img as Record<string, unknown>),
          is_default: idx === 0,
        }));

        // Log src timestamps so we can verify the sort is working
        const firstTs = extractSrcTimestamp(sortedImages[0]?.src ?? "");
        const lastTs = extractSrcTimestamp(sortedImages[sortedImages.length - 1]?.src ?? "");
        const sortWorked = firstTs > lastTs;
        const newestSrc = (sortedImages[0]?.src ?? "?").slice(-30); // last 30 chars for logging
        log("Reordering images via PUT (newest as is_default)", {
          id: item.id, title: item.title, count: images.length,
          firstTs, lastTs, sortWorked, newestSrc,
        });

        // PUT to reorder images in Printify product
        const putRes = await pFetch(`/shops/${shopId}/products/${item.id}.json`, {
          method: "PUT",
          body: JSON.stringify({ images: imagesForPut }),
        });
        if (!putRes.ok) {
          const errText = await putRes.text().catch(() => "");
          results.push({ id: item.id, title: item.title, status: "put_failed", reason: `${putRes.status} ${errText.slice(0, 80)}` });
          continue;
        }

        // Re-publish to Etsy via Printify (Printify → Etsy OAuth relay, doesn't use our Etsy rate limit)
        const ext = Array.isArray(detail.external) ? detail.external[0] : detail.external;
        const etsyListingId = ext?.id;

        const pubRes = await pFetch(`/shops/${shopId}/products/${item.id}/publish.json`, {
          method: "POST",
          body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
        });
        if (!pubRes.ok) {
          const errText = await pubRes.text().catch(() => "");
          results.push({ id: item.id, title: item.title, status: "publish_failed", reason: `${pubRes.status} ${errText.slice(0, 80)}` });
          continue;
        }

        results.push({
          id: item.id,
          title: item.title,
          status: "republished",
          imageCount: images.length,
          etsyListingId: etsyListingId ?? "unknown",
          sortWorked,
          newFirstSrc: newestSrc,
        });
        log("Sorted + republished", { id: item.id, title: item.title, etsyId: etsyListingId, sortWorked });

        // Pace between products — Printify shop API is lenient but be polite
        await new Promise((r) => setTimeout(r, 2_000));
      } catch (e) {
        results.push({ id: item.id, title: item.title, status: "error", reason: `exception: ${(e as Error).message}` });
        log("sortSocksViaPrintify sock error (non-fatal, continuing)", { id: item.id, error: (e as Error).message });
      }
    }

    return Response.json({
      sortSocksViaPrintify: true,
      page: printifyPage,
      processed: results.length,
      republished: results.filter((r) => r["status"] === "republished").length,
      results,
      callNext: hasMorePages ? `POST {"sortSocksViaPrintify":true,"offset":${nextPageStart}}` : null,
      done: !hasMorePages,
    }, { headers: CORS });
  }

  // ── DEBUG LISTING — inspect Etsy image IDs and ranks for a listing (read-only) ──────
  // POST {"debugListing": "listingId"} → returns all images with listing_image_id, rank, url
  if (typeof body.debugListing === "string") {
    const listingId = body.debugListing;
    if (!SUPABASE_URL || !SERVICE_KEY || !ETSY_API_KEY) {
      return Response.json({ error: "Missing env vars" }, { status: 500, headers: CORS });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { headers: etsyHdrs } = await getEtsyAccessToken(sb);
    const res = await fetch(`https://openapi.etsy.com/v3/application/listings/${listingId}/images`, {
      headers: etsyHdrs, signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return Response.json({ error: `Etsy ${res.status}`, listingId }, { headers: CORS });
    const data = await res.json();
    const imgs = (Array.isArray(data.results) ? data.results : []) as Array<{
      listing_image_id: string; rank: number; url_570xN?: string;
    }>;
    // Sort two ways to compare
    const byRank = [...imgs].sort((a, b) => a.rank - b.rank).map(i => ({ id: i.listing_image_id, rank: i.rank, url: (i.url_570xN ?? "").slice(-60) }));
    const byId = [...imgs].sort((a, b) => parseInt(String(a.listing_image_id)) - parseInt(String(b.listing_image_id))).map(i => ({ id: i.listing_image_id, rank: i.rank }));
    return Response.json({ listingId, count: imgs.length, byRank, byId }, { headers: CORS });
  }

  // ── CLEAN LISTING IMAGES — delete ALL old/stale images, keep only the newest N ──────
  // ROOT CAUSE: Printify publish is ADDITIVE — each repair cycle appends new mockup images
  // without removing old ones. Etsy listing ends up with both old (wrong design) AND new
  // (correct design) images. Lower listing_image_id = older (added first). Higher = newer.
  // This mode keeps the newest `maxKeep` images and deletes everything older.
  //
  // SOURCE MODES:
  // POST {"cleanListingImages": true}                                     — pod_product_queue (56 published)
  // POST {"cleanListingImages": true, "source": "etsy"}                  — ALL active etsy_listings (627 listings, paginated)
  // POST {"cleanListingImages": true, "listingIds": ["id1","id2",...]}    — specific listing IDs only (one-shot)
  //
  // OPTIONS:
  // POST {"cleanListingImages": true, "productType": "sock"}             — filter by product type (queue mode) or title keyword (etsy mode)
  // POST {"cleanListingImages": true, "maxKeep": 10}                     — keep newest N images (default 8)
  // POST {"cleanListingImages": true, "source": "etsy", "offset": 10}   — paginated for etsy/queue modes
  if (body.cleanListingImages === true) {
    log("cleanListingImages mode — deleting old stale images from Etsy listings");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return Response.json({ error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500, headers: CORS });
    }
    if (!ETSY_API_KEY) {
      return Response.json({ error: "ETSY_API_KEY not set" }, { status: 500, headers: CORS });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const clOffset: number = typeof body.offset === "number" ? body.offset : 0;
    const clLimit: number = typeof body.limit === "number" ? body.limit : 5;
    const maxKeep: number = typeof body.maxKeep === "number" ? body.maxKeep : 8;
    const productTypeFilter: string | null = typeof body.productType === "string" ? body.productType : null;
    // source: "queue" (default) = pod_product_queue; "etsy" = all active etsy_listings; "ids" = listingIds array
    const sourceMode: string = Array.isArray(body.listingIds) && body.listingIds.length > 0
      ? "ids"
      : (typeof body.source === "string" ? body.source : "queue");
    // Pre-build clauses for callNext strings (avoids nested template literals)
    const typeClause = productTypeFilter ? ',"productType":"' + productTypeFilter + '"' : "";
    const sourceClause = sourceMode !== "queue" ? ',"source":"' + sourceMode + '"' : "";

    let etsyHeaders: Record<string, string>;
    try {
      const auth = await getEtsyAccessToken(sb);
      etsyHeaders = auth.headers;
    } catch (e) {
      return Response.json({ error: `Etsy auth failed: ${(e as Error).message}` }, { status: 500, headers: CORS });
    }

    // Query listings from the appropriate source
    type ListingEntry = { id: number; name: string; etsy_listing_id: string; product_type: string };
    let listings: ListingEntry[] = [];

    if (sourceMode === "ids") {
      // ── MODE: specific listing IDs supplied directly ──
      const rawIds = (body.listingIds as string[]).map((id) => String(id));
      const { data: etsyRows } = await sb
        .from("etsy_listings")
        .select("listing_id, title")
        .in("listing_id", rawIds);
      const titleMap: Record<string, string> = {};
      for (const r of (etsyRows ?? [])) titleMap[String(r.listing_id)] = r.title ?? "unknown";
      listings = rawIds.map((id, i) => ({
        id: i,
        name: titleMap[id] ?? id,
        etsy_listing_id: id,
        product_type: "unknown",
      }));

    } else if (sourceMode === "etsy") {
      // ── MODE: scan all active Etsy listings (any not in pod_product_queue) ──
      let etsyQuery = sb
        .from("etsy_listings")
        .select("listing_id, title")
        .eq("status", "active")
        .order("listing_id", { ascending: true })
        .range(clOffset, clOffset + clLimit - 1);
      if (productTypeFilter) {
        // Filter by keyword in title (etsy_listings has no product_type column)
        etsyQuery = etsyQuery.ilike("title", "%" + productTypeFilter + "%");
      }
      const { data: etsyRows, error: etsyErr } = await etsyQuery;
      if (etsyErr) return Response.json({ error: etsyErr.message }, { status: 500, headers: CORS });
      listings = ((etsyRows ?? []) as Array<{ listing_id: string; title: string }>).map((r, i) => ({
        id: i + clOffset,
        name: r.title ?? r.listing_id,
        etsy_listing_id: String(r.listing_id),
        product_type: productTypeFilter ?? "unknown",
      }));

    } else {
      // ── MODE: pod_product_queue (original behaviour) ──
      let query = sb
        .from("pod_product_queue")
        .select("id, name, etsy_listing_id, product_type")
        .eq("status", "published")
        .not("etsy_listing_id", "is", null)
        .order("id", { ascending: true })
        .range(clOffset, clOffset + clLimit - 1);
      if (productTypeFilter) query = query.eq("product_type", productTypeFilter);
      const { data: rows, error: dbErr } = await query;
      if (dbErr) return Response.json({ error: dbErr.message }, { status: 500, headers: CORS });
      listings = (rows ?? []) as ListingEntry[];
    }

    log(`Processing ${listings.length} listings (source=${sourceMode}) at offset=${clOffset}, maxKeep=${maxKeep}`, { productType: productTypeFilter ?? "all" });

    const results: Array<Record<string, unknown>> = [];

    for (const row of listings) {
      const listingId = row.etsy_listing_id;
      if (!listingId) continue;

      // Pace Etsy API calls
      if (results.length > 0) await new Promise((r) => setTimeout(r, 1_500));

      try {
        // Fetch all listing images
        const imagesRes = await fetch(
          `https://openapi.etsy.com/v3/application/listings/${listingId}/images`,
          { headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
        );

        if (!imagesRes.ok) {
          if (imagesRes.status === 429) {
            const resumeCmd = `POST {"cleanListingImages":true,"offset":${clOffset + results.filter((r) => r["status"] !== "error").length},"limit":${clLimit},"maxKeep":${maxKeep}${typeClause}${sourceClause}}`;
            return Response.json({
              partial: true,
              reason: "Etsy 429 — retry after rate limit resets (midnight UTC)",
              cleaned: results.filter((r) => r["status"] === "cleaned").length,
              results,
              callNext: resumeCmd,
            }, { headers: CORS });
          }
          results.push({ id: row.id, listingId, name: row.name, type: row.product_type, status: "error", reason: `GET images ${imagesRes.status}` });
          continue;
        }

        const imagesData = await imagesRes.json();
        const images = (Array.isArray(imagesData.results) ? imagesData.results : []) as Array<{
          listing_image_id: string; rank: number; url_570xN?: string;
        }>;

        // Sort by listing_image_id ASCENDING — lower ID = added earlier (older batch)
        const sorted = [...images].sort((a, b) => {
          const aId = parseInt(String(a.listing_image_id), 10);
          const bId = parseInt(String(b.listing_image_id), 10);
          return aId - bId;
        });
        const sortedIds = sorted.map((img) => parseInt(String(img.listing_image_id), 10));

        // NATURAL GAP ALGORITHM: Printify publishes create NEW Etsy listing_image_ids
        // in batches. Within a batch, IDs are sequential (differ by <2000). Between
        // repair batches (days apart), IDs differ by millions (Etsy counter advances with
        // ALL listings on the platform). Find the LAST gap >50K → split there.
        // Delete everything BEFORE the split (old repair batch) → keep newest batch only.
        const BATCH_GAP_THRESHOLD = 50_000;
        let naturalSplitIdx = -1; // index where the last batch gap occurs
        for (let gi = 1; gi < sortedIds.length; gi++) {
          if (sortedIds[gi] - sortedIds[gi - 1] > BATCH_GAP_THRESHOLD) {
            naturalSplitIdx = gi; // keep updating → gets the LAST (most recent) split
          }
        }

        let toDelete: typeof sorted;
        let toKeep: typeof sorted;
        let deleteReason: string;

        if (naturalSplitIdx > 0) {
          // Natural split detected — delete the old batch, keep the new batch
          toDelete = sorted.slice(0, naturalSplitIdx);
          toKeep = sorted.slice(naturalSplitIdx);
          const gapSize = sortedIds[naturalSplitIdx] - sortedIds[naturalSplitIdx - 1];
          deleteReason = "natural batch gap: " + gapSize.toLocaleString() + " ID gap — old batch = different design";
        } else if (images.length > maxKeep) {
          // Fallback: no natural gap but too many images — keep newest maxKeep
          toDelete = sorted.slice(0, sorted.length - maxKeep);
          toKeep = sorted.slice(sorted.length - maxKeep);
          deleteReason = "maxKeep fallback (" + images.length + " > " + maxKeep + ")";
        } else {
          // No action needed: single batch, count within limit
          results.push({ id: row.id, listingId, name: row.name, type: row.product_type, status: "ok", imageCount: images.length, note: "single batch, no old images to delete" });
          continue;
        }

        log(`Listing ${listingId}: ${images.length} images → deleting ${toDelete.length}, keeping ${toKeep.length} (${deleteReason})`, { name: row.name });

        const deleted: string[] = [];
        const deleteFailed: string[] = [];

        for (const img of toDelete) {
          await new Promise((r) => setTimeout(r, 600)); // pace deletes
          const deleteRes = await fetch(
            `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}/images/${img.listing_image_id}`,
            { method: "DELETE", headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
          );
          if (deleteRes.ok || deleteRes.status === 404) {
            deleted.push(img.listing_image_id);
          } else if (deleteRes.status === 429) {
            // Rate limited mid-delete: stop and return partial with resume hint
            log("Etsy 429 mid-delete — stopping", { listingId, deletedSoFar: deleted.length });
            results.push({
              id: row.id, listingId, name: row.name, type: row.product_type,
              status: "partial_rate_limit",
              imagesTotal: images.length,
              deleted: deleted.length,
              failedToDelete: toDelete.length - deleted.length,
            });
            const resumeCmd = `POST {"cleanListingImages":true,"offset":${clOffset + results.filter((r) => r["status"] !== "error").length - 1},"limit":${clLimit},"maxKeep":${maxKeep}${typeClause}${sourceClause}}`;
            return Response.json({
              partial: true,
              reason: "Etsy 429 mid-delete — retry after rate limit resets (midnight UTC)",
              cleaned: results.filter((r) => r["status"] === "cleaned").length,
              results,
              callNext: resumeCmd,
            }, { headers: CORS });
          } else {
            deleteFailed.push(img.listing_image_id);
          }
        }

        results.push({
          id: row.id,
          listingId,
          name: row.name,
          type: row.product_type,
          status: deleteFailed.length === 0 ? "cleaned" : "partial",
          imagesWas: images.length,
          imagesNow: images.length - deleted.length,
          deleted: deleted.length,
          deleteFailed: deleteFailed.length,
          keptNewestId: toKeep[0]?.listing_image_id,
          deleteReason,
        });

        log(`Cleaned ${row.name}: deleted ${deleted.length} old images, kept ${toKeep.length} newest`, { listingId });

      } catch (e) {
        results.push({ id: row.id, listingId, name: row.name, type: row.product_type, status: "error", reason: (e as Error).message });
      }
    }

    const cleaned = results.filter((r) => r["status"] === "cleaned").length;
    // "ids" mode is one-shot — no pagination; other modes paginate
    const hasMore = sourceMode !== "ids" && listings.length === clLimit;
    const nextOffset = clOffset + clLimit;
    const callNextStr = hasMore
      ? `POST {"cleanListingImages":true,"offset":${nextOffset},"limit":${clLimit},"maxKeep":${maxKeep}${typeClause}${sourceClause}}`
      : null;

    return Response.json({
      cleanListingImages: true,
      source: sourceMode,
      offset: clOffset,
      limit: clLimit,
      maxKeep,
      productType: productTypeFilter ?? "all",
      processed: listings.length,
      cleaned,
      ok: results.filter((r) => r["status"] === "ok").length,
      errors: results.filter((r) => r["status"] === "error").length,
      results,
      callNext: callNextStr,
      done: !hasMore,
    }, { headers: CORS });
  }

  // ── FIX SOCK FIRST IMAGE MODE — delete rank=1 Etsy image from all repaired socks ──
  // Each repaired sock had its new mockup added at rank=2+; old pre-repair mockup stayed
  // at rank=1. This mode deletes rank=1 so the new repaired design becomes the thumbnail.
  if (body.fixSockFirstImage === true) {
    log("fixSockFirstImage mode — removing old rank=1 images from repaired sock listings");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return Response.json({ error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500, headers: CORS });
    }
    if (!ETSY_API_KEY) {
      return Response.json({ error: "ETSY_API_KEY not set" }, { status: 500, headers: CORS });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const fixOffset: number = typeof body.offset === "number" ? body.offset : 0;
    const fixLimit: number = typeof body.limit === "number" ? body.limit : 10;

    let etsyHeaders: Record<string, string>;
    try {
      const auth = await getEtsyAccessToken(sb);
      etsyHeaders = auth.headers;
    } catch (e) {
      return Response.json({ error: `Etsy auth failed: ${(e as Error).message}` }, { status: 500, headers: CORS });
    }

    // Build list of {name, etsy_listing_id} to fix
    // fromPrintify:true → scan Printify pages for all bp-365 socks (catches pre-queue socks)
    // default → query pod_product_queue DB (only tracks socks added via queue system)
    type SockEntry = { name: string; etsy_listing_id: string };
    let sockEntries: SockEntry[] = [];

    if (body.fromPrintify === true) {
      log("fromPrintify mode — scanning Printify pages for all bp-365 socks");
      const shopId = SHOP_ID || await (async () => {
        const r = await pFetch("/shops.json");
        const d = await r.json() as Array<{ id: string }> | { id: string };
        return String(Array.isArray(d) ? d[0]?.id : d.id);
      })();
      // Scan Printify pages (50 per page) starting from fixOffset page
      const printifyPage = Math.floor(fixOffset / 50) + 1;
      const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
      if (!pageRes.ok) {
        return Response.json({ error: `Printify page fetch failed: ${pageRes.status}` }, { status: 500, headers: CORS });
      }
      const pageData = await pageRes.json() as { data?: Array<{ id: string; title: string; blueprint_id: number; external?: Array<{ id?: string }> | { id?: string } }>; total?: number };
      const items = Array.isArray(pageData.data) ? pageData.data : [];
      const totalProducts = typeof pageData.total === "number" ? pageData.total : items.length;
      // Extract bp-365 socks with Etsy IDs
      for (const item of items) {
        if (item.blueprint_id !== 365) continue;
        const ext = Array.isArray(item.external) ? item.external[0] : item.external;
        const etsyId = ext?.id;
        if (!etsyId) continue;
        sockEntries.push({ name: item.title, etsy_listing_id: String(etsyId) });
      }
      log(`Found ${sockEntries.length} bp-365 socks with Etsy IDs on Printify page ${printifyPage}`, { total: totalProducts });
      // Determine if more pages exist
      const nextPageStart = printifyPage * 50; // next page always starts at page*50
      const hasMorePages = nextPageStart < totalProducts;
      if (sockEntries.length === 0 && hasMorePages) {
        return Response.json({
          skipped: "No bp-365 socks on this page",
          callNext: `POST {"fixSockFirstImage":true,"fromPrintify":true,"offset":${nextPageStart}}`,
          total: totalProducts,
        }, { headers: CORS });
      }
      if (sockEntries.length === 0 && !hasMorePages) {
        return Response.json({ done: true, fixed: 0, message: "No more bp-365 socks found", total: totalProducts }, { headers: CORS });
      }
      // Don't slice — process all socks found on this page; callNext will advance to next page
      // (Etsy rate limit will stop us early if needed)
      // Store page metadata for callNext calculation below
      (body as Record<string, unknown>)._nextPageStart = nextPageStart;
      (body as Record<string, unknown>)._hasMorePages = hasMorePages;
    } else {
      // Default: query DB
      const { data: sockRows, error: dbErr } = await sb
        .from("pod_product_queue")
        .select("id, name, etsy_listing_id")
        .eq("status", "published")
        .eq("product_type", "sock")
        .not("etsy_listing_id", "is", null)
        .order("id", { ascending: true })
        .range(fixOffset, fixOffset + fixLimit - 1);

      if (dbErr) return Response.json({ error: dbErr.message }, { status: 500, headers: CORS });
      sockEntries = (sockRows ?? []).map((r: { name: string; etsy_listing_id: string }) => ({ name: r.name, etsy_listing_id: r.etsy_listing_id }));
    }

    const results: Array<Record<string, unknown>> = [];

    for (const row of sockEntries) {
      const listingId = row.etsy_listing_id;
      log("Checking images", { listingId, name: row.name });

      // Pace Etsy API calls
      if (results.length > 0) await new Promise((r) => setTimeout(r, 1_500));

      try {
        // Fetch all listing images sorted by rank
        const imagesRes = await fetch(
          `https://openapi.etsy.com/v3/application/listings/${listingId}/images`,
          { headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
        );

        if (!imagesRes.ok) {
          if (imagesRes.status === 429) {
            results.push({ listingId, name: row.name, status: "rate_limited" });
            // fromPrintify: resume at current page start so the remaining socks on this page are re-tried
            // DB mode: resume at the row offset of the rate-limited sock
            const resumeOffset = body.fromPrintify === true
              ? fixOffset // same page — re-scan it, already-fixed socks will be skipped
              : fixOffset + results.filter((r) => r["status"] === "fixed" || r["status"] === "skipped").length;
            const resumeCmd = body.fromPrintify === true
              ? `POST {"fixSockFirstImage":true,"fromPrintify":true,"offset":${resumeOffset}}`
              : `POST {"fixSockFirstImage":true,"offset":${resumeOffset}}`;
            return Response.json({
              partial: true,
              reason: "Etsy 429 — retry after midnight UTC",
              fixed: results.filter((r) => r["status"] === "fixed").length,
              results,
              callNext: resumeCmd,
            }, { headers: CORS });
          }
          results.push({ listingId, name: row.name, status: "error", reason: `GET images ${imagesRes.status}` });
          continue;
        }

        const imagesData = await imagesRes.json();
        const images = (Array.isArray(imagesData.results) ? imagesData.results : []) as Array<{
          listing_image_id: string; rank: number; url_570xN?: string;
        }>;
        images.sort((a, b) => a.rank - b.rank);

        if (images.length < 2) {
          results.push({ listingId, name: row.name, status: "skipped", reason: `only ${images.length} image(s) — nothing to delete` });
          continue;
        }

        // Idempotency guard: repaired socks have 9 Etsy images (4 old + 4 new + 1 hero).
        // After fixSockFirstImage deletes rank=1, they have 8. Skip if ≤8 = already fixed.
        // Unrepaired socks (4 images) are also safely skipped.
        if (images.length <= 8) {
          results.push({ listingId, name: row.name, status: "skipped", reason: `${images.length} images — already fixed or not repaired` });
          continue;
        }

        // Delete rank=1 image (the old pre-repair mockup)
        const rank1 = images[0];
        log("Deleting rank=1 image", { listingId, imageId: rank1.listing_image_id, rank: rank1.rank });
        await new Promise((r) => setTimeout(r, 500)); // brief pause before delete

        const deleteRes = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}/images/${rank1.listing_image_id}`,
          { method: "DELETE", headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
        );

        if (!deleteRes.ok) {
          const errBody = await deleteRes.text().catch(() => "");
          results.push({ listingId, name: row.name, status: "delete_failed", reason: `${deleteRes.status} ${errBody.slice(0, 100)}` });
          continue;
        }

        results.push({
          listingId,
          name: row.name,
          status: "fixed",
          deletedImageId: rank1.listing_image_id,
          newFirstImageUrl: images[1]?.url_570xN ?? "promoted",
          totalImages: images.length,
        });
        log("Deleted rank=1 image — new design now first", { listingId, imageId: rank1.listing_image_id });

      } catch (e) {
        results.push({ listingId, name: row.name, status: "error", reason: (e as Error).message });
      }
    }

    const fixed = results.filter((r) => r["status"] === "fixed").length;
    const fromPrintify = body.fromPrintify === true;

    let callNextStr: string | null = null;
    let isDone = true;

    if (fromPrintify) {
      // Advance to next Printify page after processing current page
      const nextPageStart = (body as Record<string, unknown>)._nextPageStart as number ?? (Math.floor(fixOffset / 50) + 1) * 50;
      const hasMorePages = (body as Record<string, unknown>)._hasMorePages as boolean ?? false;
      if (hasMorePages) {
        callNextStr = `POST {"fixSockFirstImage":true,"fromPrintify":true,"offset":${nextPageStart}}`;
        isDone = false;
      }
    } else {
      // DB mode: hasMore = we returned a full page of fixLimit rows
      const hasMore = sockEntries.length === fixLimit;
      if (hasMore) {
        callNextStr = `POST {"fixSockFirstImage":true,"offset":${fixOffset + fixLimit}}`;
        isDone = false;
      }
    }

    return Response.json({
      fixSockFirstImage: true,
      source: fromPrintify ? "printify" : "db",
      fixed,
      skipped: results.filter((r) => r["status"] === "skipped").length,
      errors: results.filter((r) => r["status"] === "error" || r["status"] === "delete_failed").length,
      results,
      callNext: callNextStr,
      done: isDone,
    }, { headers: CORS });
  }

  const shopId = SHOP_ID || await (async () => {
    const r = await pFetch("/shops.json");
    const d = await r.json();
    return String(Array.isArray(d) ? d[0]?.id : d.id);
  })();

  // Fetch page containing offset
  const printifyPage = Math.floor(offset / 50) + 1;
  const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
  if (!pageRes.ok) return Response.json({ error: `Page fetch failed: ${pageRes.status}` }, { status: 500 });

  const pageData = await pageRes.json() as Record<string, unknown>;
  const pageItems = Array.isArray(pageData.data) ? pageData.data as Array<{
    id: string; title: string; blueprint_id: number;
    images?: Array<{ src: string; position: string }>;
    external?: { id?: string };
  }> : [];
  const totalProducts = typeof pageData.total === "number" ? pageData.total : pageItems.length;
  const pageOffset = offset % 50;

  // Collect up to batchLimit socks starting at pageOffset
  const socksToRepair: Array<{ item: typeof pageItems[0]; absoluteOffset: number }> = [];
  for (let i = pageOffset; i < pageItems.length && socksToRepair.length < batchLimit; i++) {
    if (pageItems[i].blueprint_id === 365) {
      socksToRepair.push({ item: pageItems[i], absoluteOffset: Math.floor(offset / 50) * 50 + i });
    }
  }

  if (socksToRepair.length === 0) {
    // No socks on this page — skip to next page
    const nextPageOffset = Math.floor(offset / 50) * 50 + 50;
    if (nextPageOffset < totalProducts) {
      return Response.json({
        skipped: "No socks on this page",
        callNext: `POST {"offset":${nextPageOffset}}`,
        total: totalProducts,
      });
    }
    return Response.json({ done: true, message: "All socks processed", total: totalProducts });
  }

  const results = [];
  let lastAbsoluteOffset = offset;

  for (const { item: sock, absoluteOffset } of socksToRepair) {
    lastAbsoluteOffset = absoluteOffset;
    log("Repairing sock", { title: sock.title, id: sock.id, offset: absoluteOffset });

    // Get full product detail for print areas
    const detailRes = await pFetch(`/shops/${shopId}/products/${sock.id}.json`);
    if (!detailRes.ok) {
      results.push({ id: sock.id, title: sock.title, error: `Detail fetch failed: ${detailRes.status}` });
      continue;
    }
    const detail = await detailRes.json() as Record<string, unknown>;
    const printAreas = Array.isArray(detail.print_areas) ? detail.print_areas as Array<{
      variant_ids: number[];
      placeholders: Array<{ position: string; images: Array<{ id: string; x: number; y: number; scale: number; angle: number }> }>;
    }> : [];

    const result = await repairOneSock(shopId, sock, printAreas);
    results.push({ id: sock.id, title: sock.title, offset: absoluteOffset, ...result });
  }

  const nextOffset = lastAbsoluteOffset + 1;
  const hasMore = nextOffset < totalProducts;

  return Response.json({
    repaired: results,
    imageSpec: { size: SOCK_IMAGE_SIZE, scale: SOCK_SCALE },
    callNext: hasMore ? `POST {"offset":${nextOffset}}` : null,
    total: totalProducts,
    done: !hasMore,
  });
});
