// etsy-listing-video-uploader — generate and upload product videos to Etsy listing video slot
//
// Etsy shows a banner: "Listings with video get 2× as many orders as listings with just photos."
// This function:
//   1. Finds all published Etsy listings that have ≥1 view (or all published if stats unavailable)
//   2. For each listing, generates a 10-second lifestyle product video using gpt-image-1
//   3. Uploads the video to the Etsy listing via POST /v3/application/shops/{shop_id}/listings/{listing_id}/videos
//   4. Tracks uploaded listings in pod_listing_videos to prevent duplicates
//
// POST body: { offset?: number, limit?: number, dryRun?: boolean, forceAll?: boolean }
//   - dryRun: true → log eligible listings but don't generate or upload
//   - forceAll: true → process ALL published listings even if views = 0
//   - limit: max listings to process per call (default 5, keep under 150s CPU budget)
//   - offset: skip first N eligible listings (for chaining calls)
//
// Rate limit: Etsy daily API rate limit is shared. On 429, function stops early and
// returns nextOffset so caller can retry the following day.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[ETSY-VIDEO] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Image generation (gpt-image-1, JPEG output) ──────────────────────────────

async function generateImage(prompt: string, openaiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "low",
      n: 1,
      output_format: "jpeg",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Image gen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data from OpenAI");
  return b64; // base64 JPEG
}

// ── Hallucination check (text detection via vision model) ────────────────────

async function checkHallucination(b64Jpeg: string, openrouterKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zmyczlfuufhngzovkjdh.supabase.co",
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64Jpeg}` } },
            { type: "text", text: "Does this image contain any visible text, letters, words, numbers, characters, signs, labels, captions, watermarks, or garbled/glitchy characters? Answer only YES or NO." },
          ],
        }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const answer = ((await res.json())?.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
    return answer.startsWith("YES");
  } catch {
    return false; // fail open — don't block on infra failure
  }
}

// ── AVI/MJPEG container builder (1024×1024 at 1fps) ─────────────────────────
// Each frame is repeated secsPerFrame times so it shows for secsPerFrame seconds.
// e.g. 2 frames × 5 secsPerFrame = 10 seconds total — fits Etsy's 5-15s window.

function buildAvi(frames: Uint8Array[], secsPerFrame = 5): Uint8Array {
  const W = 1024, H = 1024;
  const FPS = 1;

  const expanded: Uint8Array[] = [];
  for (const f of frames) {
    for (let i = 0; i < secsPerFrame; i++) expanded.push(f);
  }
  const frameCount = expanded.length;

  const u32 = (n: number) => { const b = new Uint8Array(4); b[0]=n&0xff; b[1]=(n>>8)&0xff; b[2]=(n>>16)&0xff; b[3]=(n>>24)&0xff; return b; };
  const u16 = (n: number) => { const b = new Uint8Array(2); b[0]=n&0xff; b[1]=(n>>8)&0xff; return b; };
  const cc  = (s: string) => new TextEncoder().encode(s.slice(0, 4).padEnd(4, " "));
  const cat = (...a: Uint8Array[]) => { const out = new Uint8Array(a.reduce((n,x)=>n+x.length,0)); let i=0; for(const x of a){out.set(x,i);i+=x.length;} return out; };

  const chunk = (id: string, data: Uint8Array): Uint8Array => {
    const pad = data.length % 2;
    const buf = new Uint8Array(8 + data.length + pad);
    buf.set(cc(id), 0); buf.set(u32(data.length), 4); buf.set(data, 8);
    return buf;
  };
  const list = (type: string, data: Uint8Array) => chunk("LIST", cat(cc(type), data));

  const avih = cat(
    u32(1_000_000 / FPS),
    u32(0), u32(0),
    u32(0x10),
    u32(frameCount), u32(0), u32(1), u32(0),
    u32(W), u32(H),
    u32(0), u32(0), u32(0), u32(0),
  );

  const strh = cat(
    cc("vids"), cc("MJPG"),
    u32(0), u16(0), u16(0), u32(0),
    u32(1), u32(FPS),
    u32(0), u32(frameCount),
    u32(0), u32(0xffffffff), u32(0),
    u16(0), u16(0), u16(W), u16(H),
  );

  const strf = cat(
    u32(40), u32(W), u32(H),
    u16(1), u16(24),
    cc("MJPG"),
    u32(W * H * 3),
    u32(0), u32(0), u32(0), u32(0),
  );

  const strl   = list("strl", cat(chunk("strh", strh), chunk("strf", strf)));
  const hdrl   = list("hdrl", cat(chunk("avih", avih), strl));
  const moviFrames = expanded.map(f => chunk("00dc", f));
  const moviList   = chunk("LIST", cat(cc("movi"), ...moviFrames));

  let off = 4;
  const idxEntries = expanded.map(f => {
    const e = cat(cc("00dc"), u32(0x10), u32(off), u32(f.length));
    off += 8 + f.length + (f.length % 2);
    return e;
  });
  const idx1 = chunk("idx1", cat(...idxEntries));

  return chunk("RIFF", cat(cc("AVI "), hdrl, moviList, idx1));
}

// ── Generate image prompt for a product listing using GPT-4o-mini ────────────

async function buildImagePrompt(title: string, openaiKey: string): Promise<string> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 120,
        messages: [{
          role: "user",
          content: `Write a short visual image prompt (under 60 words) for a lifestyle product photo of this item: "${title}".
Show the product in a realistic, warm, appealing setting — someone using it, gifting it, or enjoying it.
Do NOT include any text, words, labels, or writing in the scene.
Return ONLY the image prompt, nothing else.`,
        }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`GPT ${res.status}`);
    const content = (await res.json())?.choices?.[0]?.message?.content?.trim() ?? "";
    return content || `Lifestyle product photo — ${title} — warm natural lighting, clean background, no text`;
  } catch {
    return `Beautiful product photo of ${title.slice(0, 80)}, lifestyle setting, warm natural lighting, no text`;
  }
}

// ── Etsy OAuth token loader (same pattern as pod-coupon-sender) ───────────────

async function loadEtsyToken(
  sb: ReturnType<typeof createClient>,
  clientId: string,
  etsyApiKey: string,
): Promise<{ accessToken: string; shopId: string; etsyHeaders: Record<string, string> }> {
  const { data: tokenRow, error } = await sb
    .from("etsy_oauth_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !tokenRow) throw new Error("No Etsy OAuth tokens found — complete OAuth flow first");

  let accessToken: string = tokenRow.access_token;
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const needsRefresh = Date.now() >= expiresAt - 5 * 60 * 1000;

  if (needsRefresh) {
    log("Refreshing Etsy token");
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
    if (!refreshRes.ok) throw new Error(`Token refresh failed: ${refreshRes.status}`);
    const rd = await refreshRes.json();
    accessToken = rd.access_token;
    await sb.from("etsy_oauth_tokens").update({
      access_token: accessToken,
      refresh_token: rd.refresh_token ?? tokenRow.refresh_token,
      expires_at: new Date(Date.now() + (rd.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);
    log("Token refreshed");
  }

  const etsyHeaders = {
    "x-api-key": etsyApiKey,
    Authorization: `Bearer ${accessToken}`,
  };

  // Resolve shop_id
  let shopId: string = tokenRow.shop_id ?? "";
  if (!shopId) {
    const userId = tokenRow.user_id;
    if (userId) {
      const shopRes = await fetch(
        `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
        { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
      ).catch(() => null);
      if (shopRes?.ok) {
        const sd = await shopRes.json();
        shopId = String(sd?.shop_id ?? sd?.results?.[0]?.shop_id ?? "");
      }
    }
    if (!shopId) {
      const meRes = await fetch("https://openapi.etsy.com/v3/application/users/me", {
        headers: etsyHeaders, signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      if (meRes?.ok) {
        const me = await meRes.json();
        const userId2 = me?.user_id ?? me?.results?.[0]?.user_id;
        if (userId2) {
          const shopRes2 = await fetch(
            `https://openapi.etsy.com/v3/application/users/${userId2}/shops`,
            { headers: etsyHeaders, signal: AbortSignal.timeout(10_000) },
          ).catch(() => null);
          if (shopRes2?.ok) {
            const sd2 = await shopRes2.json();
            shopId = String(sd2?.shop_id ?? sd2?.results?.[0]?.shop_id ?? "");
          }
        }
      }
    }
    if (shopId) {
      await sb.from("etsy_oauth_tokens").update({ shop_id: shopId, updated_at: new Date().toISOString() }).eq("id", tokenRow.id);
    }
  }

  if (!shopId) throw new Error("Could not resolve Etsy shop_id");
  return { accessToken, shopId, etsyHeaders };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY          = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY         = Deno.env.get("ETSY_API_KEY") ?? "";
  const PRINTIFY_API_TOKEN   = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
  const PRINTIFY_SHOP_ID     = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
  const ETSY_SHARED_SECRET = Deno.env.get("ETSY_SHARED_SECRET") ?? "";
  const OPENAI_API_KEY    = Deno.env.get("OPENAI_API_KEY") ?? "";
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

  if (!ETSY_API_KEY) {
    return new Response(JSON.stringify({ error: "ETSY_API_KEY not set" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Etsy requires "keystring:shared_secret" format in x-api-key for write operations (video upload etc.)
  const ETSY_HEADER_KEY = ETSY_SHARED_SECRET ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}` : ETSY_API_KEY;
  const clientId = ETSY_API_KEY.split(":")[0];
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const offset    = typeof body.offset   === "number" ? body.offset   : 0;
  const limit     = typeof body.limit    === "number" ? body.limit    : 5;
  const dryRun    = body.dryRun === true;
  const forceAll  = body.forceAll === true;
  const seedEtsyIds = body.seedEtsyIds === true;

  log("Starting", { offset, limit, dryRun, forceAll, seedEtsyIds });

  // ── seedEtsyIds mode: use Printify API to back-populate etsy_listing_id ──────
  // Etsy API has a 10k/day rate limit; Printify API is separate and not rate-limited.
  // Each Printify product has product.external[] = [{id: "4505678901", channel: "etsy"}]
  // Run this when Etsy API is rate-limited to prepare DB for next run.
  if (seedEtsyIds) {
    if (!PRINTIFY_API_TOKEN || !PRINTIFY_SHOP_ID) {
      return new Response(JSON.stringify({ error: "PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID not set" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Get published products from pod_product_queue that are missing etsy_listing_id
    const { data: queueRows } = await sb
      .from("pod_product_queue")
      .select("id, name, printify_id, etsy_listing_id")
      .eq("status", "published")
      .not("printify_id", "is", null)
      .is("etsy_listing_id", null)
      .limit(50); // batch of 50

    const toSeed = queueRows ?? [];
    log("seedEtsyIds: products to seed", { count: toSeed.length });

    let seeded = 0;
    let failed = 0;
    const seedResults: Array<{ id: number; name: string; printifyId: string; etsyId?: string; error?: string }> = [];

    for (const row of toSeed) {
      try {
        const productRes = await fetch(
          `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${row.printify_id}.json`,
          {
            headers: { Authorization: `Bearer ${PRINTIFY_API_TOKEN}` },
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!productRes.ok) {
          log("Printify product fetch failed", { id: row.id, status: productRes.status });
          seedResults.push({ id: row.id, name: row.name, printifyId: row.printify_id, error: `Printify ${productRes.status}` });
          failed++;
          continue;
        }

        const product = await productRes.json();
        // external can be array or object depending on Printify version
        const externals: Array<{ id: string | number; channel?: string }> = Array.isArray(product.external)
          ? product.external
          : (product.external ? [product.external] : []);

        // Find Etsy channel ID (or just take first external ID if single channel)
        const etsyExternal = externals.find(e => !e.channel || String(e.channel).toLowerCase().includes("etsy")) ?? externals[0];
        const etsyId = etsyExternal?.id ? String(etsyExternal.id) : null;

        if (etsyId) {
          await sb.from("pod_product_queue").update({ etsy_listing_id: etsyId }).eq("id", row.id);
          log("Seeded", { queueId: row.id, etsyId });
          seedResults.push({ id: row.id, name: row.name, printifyId: row.printify_id, etsyId });
          seeded++;
        } else {
          log("No external Etsy ID found", { queueId: row.id, printifyId: row.printify_id });
          seedResults.push({ id: row.id, name: row.name, printifyId: row.printify_id, error: "no_external_id" });
          failed++;
        }

        await new Promise(r => setTimeout(r, 200)); // brief pause
      } catch (err) {
        log("Seed error", { id: row.id, error: String(err).slice(0, 80) });
        seedResults.push({ id: row.id, name: row.name, printifyId: row.printify_id, error: String(err).slice(0, 80) });
        failed++;
      }
    }

    // Also seed pod_listings table (different structure)
    const { data: listingRows } = await sb
      .from("pod_listings")
      .select("id, title, printify_product_id, etsy_listing_id")
      .eq("status", "published")
      .not("printify_product_id", "is", null)
      .is("etsy_listing_id", null)
      .limit(20);

    for (const row of listingRows ?? []) {
      try {
        const productRes = await fetch(
          `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${row.printify_product_id}.json`,
          {
            headers: { Authorization: `Bearer ${PRINTIFY_API_TOKEN}` },
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!productRes.ok) continue;

        const product = await productRes.json();
        const externals: Array<{ id: string | number; channel?: string }> = Array.isArray(product.external)
          ? product.external
          : (product.external ? [product.external] : []);
        const etsyExternal = externals.find(e => !e.channel || String(e.channel).toLowerCase().includes("etsy")) ?? externals[0];
        const etsyId = etsyExternal?.id ? String(etsyExternal.id) : null;

        if (etsyId) {
          await sb.from("pod_listings").update({ etsy_listing_id: etsyId }).eq("id", row.id);
          seeded++;
          log("Seeded pod_listings", { listingId: row.id, etsyId });
        }
        await new Promise(r => setTimeout(r, 200));
      } catch {
        failed++;
      }
    }

    log("seedEtsyIds done", { seeded, failed });
    return new Response(JSON.stringify({
      success: true,
      mode: "seedEtsyIds",
      seeded,
      failed,
      results: seedResults,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ── Load Etsy OAuth ─────────────────────────────────────────────────────────
  let etsyAuth: Awaited<ReturnType<typeof loadEtsyToken>>;
  try {
    etsyAuth = await loadEtsyToken(sb, clientId, ETSY_HEADER_KEY);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { shopId, etsyHeaders } = etsyAuth;
  log("Etsy auth loaded", { shopId });

  // ── Find listings to process ────────────────────────────────────────────────
  // Priority 1: listings with ≥1 view from pod_listing_stats (ranked by interest)
  // Priority 2: UNION of pod_listings + pod_product_queue (all published with etsy_listing_id)
  // Fallback: fetch all active listings directly from Etsy API (cold-start / forceAll)
  // NOTE: we always union both DB tables so no seeded IDs are missed.

  let candidateIds: string[] = [];
  const titleMapFallback = new Map<string, string>(); // titles from queue/Etsy API fallbacks

  if (!forceAll) {
    // Try stats-based selection (views >= 1) — highest-value listings first
    const { data: statsRows } = await sb
      .from("pod_listing_stats")
      .select("etsy_listing_id")
      .gte("views", 1)
      .order("views", { ascending: false });

    const uniqueIds = [...new Set((statsRows ?? []).map((r: { etsy_listing_id: string }) => r.etsy_listing_id))];
    if (uniqueIds.length > 0) {
      log("Using stats-based selection", { withViews: uniqueIds.length });
      candidateIds = uniqueIds;
    }

    // DB union: always combine pod_listings AND pod_product_queue (don't stop at first hit)
    if (candidateIds.length === 0) {
      log("No stats data — querying pod_listings + pod_product_queue");
      const idSet = new Set<string>();

      // pod_listings table
      const { data: allRows } = await sb
        .from("pod_listings")
        .select("etsy_listing_id, title")
        .eq("status", "published")
        .not("etsy_listing_id", "is", null)
        .order("id", { ascending: true });
      for (const row of allRows ?? []) {
        if (row.etsy_listing_id) idSet.add(row.etsy_listing_id);
      }
      log("pod_listings candidates", { count: idSet.size });

      // pod_product_queue table (always queried, merged with above)
      {
        const { data: queueRows } = await sb
          .from("pod_product_queue")
          .select("etsy_listing_id, name")
          .eq("status", "published")
          .not("etsy_listing_id", "is", null)
          .order("id", { ascending: true });
        for (const row of queueRows ?? []) {
          if (row.etsy_listing_id) {
            idSet.add(row.etsy_listing_id);
            titleMapFallback.set(row.etsy_listing_id, row.name ?? "");
          }
        }
        log("pod_product_queue candidates", { count: (queueRows ?? []).length });
      }

      candidateIds = [...idSet];
      log("Total DB candidates (union)", { count: candidateIds.length });

      // Keep original fallback shape so the rest of the code still compiles:
      // (the old "for (const row of queueRows ?? [])" block is replaced above)
      if (false) {
        // dead code block — kept so TypeScript doesn't complain about missing variable refs
        const row = { etsy_listing_id: "", name: "" };
        if (row.etsy_listing_id) titleMapFallback.set(row.etsy_listing_id, row.name ?? "");
      }
    }
  }

  // Fallback 3 (or forceAll): fetch all active listings directly from Etsy API
  // Used when: etsy_listing_id not populated in DB (cold-start), OR forceAll=true to process entire shop
  if (candidateIds.length === 0 || forceAll) {
    log("No etsy_listing_id in DB — fetching active listings from Etsy API");
    try {
      let offset = 0;
      const pageSize = 100;
      const etsyListings: Array<{ listing_id: number; title: string }> = [];

      while (true) {
        const listUrl = new URL(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings`,
        );
        listUrl.searchParams.set("state", "active");
        listUrl.searchParams.set("limit", String(pageSize));
        listUrl.searchParams.set("offset", String(offset));

        const listRes = await fetch(listUrl.toString(), {
          headers: etsyHeaders,
          signal: AbortSignal.timeout(15_000),
        });

        if (listRes.status === 429) {
          log("Etsy API 429 when fetching listings — daily rate limit hit");
          return new Response(JSON.stringify({
            error: "Etsy API daily rate limit exceeded — try again after midnight UTC",
            rateLimited: true,
          }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
        }

        if (!listRes.ok) {
          log("Etsy listing fetch failed", { status: listRes.status });
          break;
        }

        const listData = await listRes.json();
        const results = listData?.results ?? [];
        for (const item of results) {
          etsyListings.push({ listing_id: item.listing_id, title: item.title ?? "" });
        }

        if (results.length < pageSize) break; // no more pages
        offset += pageSize;
        if (etsyListings.length >= 500) break; // safety cap
      }

      log("Fetched from Etsy API", { count: etsyListings.length });
      for (const item of etsyListings) {
        const idStr = String(item.listing_id);
        candidateIds.push(idStr);
        titleMapFallback.set(idStr, item.title);
      }
    } catch (err) {
      log("Etsy API fetch error", { error: String(err).slice(0, 100) });
    }
  }

  if (candidateIds.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      message: "No published listings found — check Etsy API connectivity and rate limits",
      uploaded: 0, skipped: 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ── Filter out already-uploaded ─────────────────────────────────────────────
  const { data: alreadyDone } = await sb
    .from("pod_listing_videos")
    .select("etsy_listing_id")
    .in("etsy_listing_id", candidateIds);

  const doneSet = new Set((alreadyDone ?? []).map((r: { etsy_listing_id: string }) => r.etsy_listing_id));
  const remaining = candidateIds.filter(id => !doneSet.has(id));

  log("Filtered candidates", { total: candidateIds.length, alreadyDone: doneSet.size, remaining: remaining.length });

  // Apply pagination
  const page = remaining.slice(offset, offset + limit);
  const hasMore = remaining.length > offset + limit;
  const nextOffset = hasMore ? offset + limit : null;

  if (page.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      message: "All eligible listings already have videos",
      uploaded: 0, skipped: remaining.length, nextOffset: null,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Fetch titles for the page (DB-first, then fallback from Etsy API data)
  const { data: titleRows } = await sb
    .from("pod_listings")
    .select("etsy_listing_id, title")
    .in("etsy_listing_id", page);

  const titleMap = new Map<string, string>(titleMapFallback); // seed with Etsy API titles
  for (const row of titleRows ?? []) {
    titleMap.set(row.etsy_listing_id, row.title ?? "");
  }

  // Also try pod_product_queue for any still-missing titles
  const missingTitles = page.filter(id => !titleMap.has(id));
  if (missingTitles.length > 0) {
    const { data: queueRows } = await sb
      .from("pod_product_queue")
      .select("etsy_listing_id, name")
      .in("etsy_listing_id", missingTitles);
    for (const row of queueRows ?? []) {
      if (row.etsy_listing_id) titleMap.set(row.etsy_listing_id, row.name ?? "");
    }
  }

  if (dryRun) {
    const dryResults = page.map(id => ({
      etsy_listing_id: id,
      title: titleMap.get(id) ?? "(unknown)",
      action: "would_upload",
    }));
    return new Response(JSON.stringify({
      dryRun: true,
      eligible: remaining.length,
      wouldProcess: page.length,
      nextOffset,
      results: dryResults,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ── Process each listing ────────────────────────────────────────────────────

  const results: Array<{ id: string; status: string; reason?: string; videoId?: string }> = [];
  let uploadedCount = 0;
  let rateLimited = false;

  const ANTITEXT = ", absolutely no text no letters no words no numbers no characters no symbols anywhere — purely visual colors shapes and composition";

  for (const listingId of page) {
    if (rateLimited) {
      results.push({ id: listingId, status: "skipped", reason: "rate_limited_earlier" });
      continue;
    }

    const title = titleMap.get(listingId) ?? `Etsy listing ${listingId}`;
    log("Processing", { listingId, title: title.slice(0, 60) });

    try {
      // Generate image prompt for this product
      const basePrompt = await buildImagePrompt(title, OPENAI_API_KEY);
      log("Prompt", { listingId, prompt: basePrompt.slice(0, 80) });

      // Generate frame 1 (lifestyle shot)
      let frame1b64 = await generateImage(basePrompt + ANTITEXT, OPENAI_API_KEY);
      if (OPENROUTER_API_KEY && await checkHallucination(frame1b64, OPENROUTER_API_KEY)) {
        log("Frame 1 had text — retrying", { listingId });
        frame1b64 = await generateImage(basePrompt + ANTITEXT + ", FINAL ATTEMPT: zero text zero letters", OPENAI_API_KEY);
      }

      // Generate frame 2 (complementary angle)
      const prompt2 = basePrompt + ", close-up detail shot, slightly different angle" + ANTITEXT;
      let frame2b64 = await generateImage(prompt2, OPENAI_API_KEY);
      if (OPENROUTER_API_KEY && await checkHallucination(frame2b64, OPENROUTER_API_KEY)) {
        log("Frame 2 had text — retrying", { listingId });
        frame2b64 = await generateImage(prompt2 + ", FINAL ATTEMPT: zero text zero letters", OPENAI_API_KEY);
      }

      // Convert base64 to Uint8Array
      const frame1Bytes = Uint8Array.from(atob(frame1b64), c => c.charCodeAt(0));
      const frame2Bytes = Uint8Array.from(atob(frame2b64), c => c.charCodeAt(0));

      // Build 10-second AVI (2 frames × 5 seconds each)
      const videoBytes = buildAvi([frame1Bytes, frame2Bytes], 5);
      log("Video built", { listingId, sizeKB: Math.round(videoBytes.length / 1024) });

      // Upload to Etsy listing video slot
      const formData = new FormData();
      formData.append(
        "video",
        new Blob([videoBytes], { type: "video/avi" }),
        `product-${listingId}.avi`,
      );
      formData.append("name", title.slice(0, 100));

      const uploadRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/videos`,
        {
          method: "POST",
          headers: etsyHeaders, // NOTE: no Content-Type — Deno sets multipart boundary automatically
          body: formData,
          signal: AbortSignal.timeout(60_000),
        },
      );

      if (uploadRes.status === 429) {
        log("ETSY_VIDEO_RATE_LIMIT — stopping early", { listingId });
        rateLimited = true;
        results.push({ id: listingId, status: "rate_limited" });
        continue;
      }

      if (!uploadRes.ok) {
        const errBody = await uploadRes.text().catch(() => "");
        log("Upload failed", { listingId, status: uploadRes.status, body: errBody.slice(0, 200) });
        results.push({ id: listingId, status: "error", reason: `${uploadRes.status}: ${errBody.slice(0, 100)}` });
        continue;
      }

      const uploadData = await uploadRes.json().catch(() => ({}));
      const videoId = uploadData?.video_id ?? uploadData?.listing_video_id ?? null;
      log("Uploaded", { listingId, videoId });

      // Track in DB
      await sb.from("pod_listing_videos").upsert({
        etsy_listing_id: listingId,
        etsy_video_id: videoId ? String(videoId) : null,
        title: title.slice(0, 255),
        uploaded_at: new Date().toISOString(),
      }, { onConflict: "etsy_listing_id" });

      results.push({ id: listingId, status: "uploaded", videoId: videoId ? String(videoId) : undefined });
      uploadedCount++;

      // Brief pause between listings to respect rate limits
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("Error", { listingId, error: msg.slice(0, 150) });
      results.push({ id: listingId, status: "error", reason: msg.slice(0, 150) });
    }
  }

  const callNext = nextOffset !== null && !rateLimited
    ? `POST {"offset":${nextOffset},"limit":${limit}}`
    : null;

  log("Done", { uploaded: uploadedCount, total: page.length, rateLimited, nextOffset });

  return new Response(JSON.stringify({
    success: true,
    uploaded: uploadedCount,
    processed: page.length,
    skipped: doneSet.size,
    remaining: remaining.length - page.length,
    rateLimited,
    nextOffset: rateLimited ? offset : nextOffset, // resume from same offset if rate limited
    callNext,
    results,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
