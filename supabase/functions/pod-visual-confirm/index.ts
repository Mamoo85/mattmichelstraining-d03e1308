// pod-visual-confirm v2
// Called fire-and-forget by pod-new-products immediately after a product is published to Etsy.
// Waits 90s for Etsy to process and render the listing, then fetches the primary listing image
// and runs GPT Vision to confirm the design looks correct.
//
// If score ≤ 2 → marks queue row as 'visual_failed' + sends SMS alert.
// If score ≥ 3 → stores score + marks queue row 'visual_confirmed' (status stays 'published').
//
// Modes:
//   Normal:     { queueId, etsyListingId, productName, productType }
//   Debug:      { queueId, etsyListingId, debug: true }  — skips 90s, returns raw Etsy response
//   ScanVisual: { scanVisual: true, offset: 0 }  — scans all published products oldest-first,
//               stops on first failure and returns details + Etsy link for human review

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY       = Deno.env.get("OPENAI_API_KEY") ?? "";
const ETSY_API_KEY     = Deno.env.get("ETSY_API_KEY") ?? "";
const ETSY_SECRET      = Deno.env.get("ETSY_SHARED_SECRET") ?? "";
// Etsy requires "keystring:shared_secret" format in x-api-key header
const ETSY_HEADER_KEY  = ETSY_SECRET ? `${ETSY_API_KEY}:${ETSY_SECRET}` : ETSY_API_KEY;
const PRINTIFY_API_KEY = Deno.env.get("PRINTIFY_API_KEY") ?? "";
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";

// ── Resolve Printify shop ID (env var or auto-detect via /shops.json) ────────
let _resolvedShopId: string | null = null;
async function getPrintifyShopId(): Promise<string> {
  if (_resolvedShopId) return _resolvedShopId;
  if (PRINTIFY_SHOP_ID) { _resolvedShopId = PRINTIFY_SHOP_ID; return PRINTIFY_SHOP_ID; }
  const res = await fetch("https://api.printify.com/v1/shops.json", {
    headers: { Authorization: `Bearer ${PRINTIFY_API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Printify /shops.json ${res.status}`);
  const shops = await res.json();
  if (!shops?.length) throw new Error("No Printify shops found");
  _resolvedShopId = String(shops[0].id);
  log("Auto-resolved Printify shop ID", { shopId: _resolvedShopId });
  return _resolvedShopId!;
}
const TWILIO_SID       = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_TOKEN     = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM      = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";
const ADMIN_PHONE      = Deno.env.get("ADMIN_PHONE") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-VISUAL-CONFIRM] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

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

// ── Download image URL as base64 ────────────────────────────────────────────
async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Image fetch ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── GPT Vision score of the Etsy listing mockup ────────────────────────────
async function scoreEtsyMockup(
  imageUrl: string,
  productName: string,
  productType: string,
): Promise<{ score: number; reason: string }> {
  const b64 = await urlToBase64(imageUrl);
  const prompt = `You are auditing an Etsy print-on-demand listing image for quality.

Product: "${productName}" (type: ${productType})

Score this image 1–5 using STRICT criteria:

Score 1 (FAIL) if ANY of these are true:
- The design is tiny — occupies less than 20% of the visible print area on the product
- The design is incorrectly placed (e.g., stomach area on a shirt instead of chest)
- A white rectangle/box is floating on a dark or colored garment (transparent-bg failure)
- The design is cut off at any edge of the product
- The product mockup shows a blank/placeholder design or no design at all
- The design looks like a mistake or clearly wrong template was used
- Two completely different designs appear on the product (e.g., left vs right side)

Score 3 if the design is visible and roughly in the right place but too small or slightly off-center.

Score 5 if the design:
- Fills the intended print area well (chest area for shirts, full surface for mugs/socks etc.)
- Is centered and properly positioned
- Looks intentional and polished

Reply ONLY with JSON: {"score":N,"reason":"one sentence describing what you see"}`;

  const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64.slice(0, 500_000)}` } },
          { type: "text", text: prompt },
        ],
      }],
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!visionRes.ok) throw new Error(`Vision API ${visionRes.status}`);
  const vData = await visionRes.json();
  const raw = vData.choices?.[0]?.message?.content ?? "{}";
  const match = raw.match(/\{.*\}/s);
  if (!match) throw new Error(`Vision response parse failed: ${raw.slice(0, 100)}`);
  const parsed = JSON.parse(match[0]);
  return { score: Number(parsed.score) || 3, reason: String(parsed.reason ?? "unknown") };
}

// ── Fetch Etsy listing images (sorted by rank ascending) ─────────────────────
async function fetchEtsyImages(etsyId: string, etsyHeaders: Record<string, string>): Promise<{ urls: string[]; status: number }> {
  const imagesRes = await fetch(
    `https://openapi.etsy.com/v3/application/listings/${etsyId}/images`,
    { headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
  );
  if (!imagesRes.ok) {
    const body = await imagesRes.text().catch(() => "");
    log("Etsy images API failed", { status: imagesRes.status, body: body.slice(0, 200) });
    return { urls: [], status: imagesRes.status };
  }
  const imagesData = await imagesRes.json();
  const images = Array.isArray(imagesData.results) ? imagesData.results : [];
  const sorted = images.sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank);
  const urls = sorted
    .map((i: { url_fullxfull?: string; url_1588xN?: string; url_570xN?: string }) =>
      i.url_fullxfull ?? i.url_1588xN ?? i.url_570xN ?? "")
    .filter((u: string) => u.length > 0);
  return { urls, status: 200 };
}

// ── Fetch primary Etsy listing image URL ─────────────────────────────────────
async function fetchEtsyPrimaryImage(etsyId: string, etsyHeaders: Record<string, string>): Promise<{ url: string | null; status: number }> {
  const { urls, status } = await fetchEtsyImages(etsyId, etsyHeaders);
  return { url: urls[0] ?? null, status };
}

// ── Compare two Etsy listing images via GPT Vision ──────────────────────────
// Returns {same: true} if both images show the same design pattern.
// Used for socks to detect when rank=1 is old pre-repair image vs rank=2 is repaired design.
async function compareTwoImages(url1: string, url2: string): Promise<{ same: boolean; reason: string }> {
  const [b64a, b64b] = await Promise.all([urlToBase64(url1), urlToBase64(url2)]);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 80,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64a.slice(0, 500_000)}` } },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64b.slice(0, 500_000)}` } },
          {
            type: "text",
            text: "These are two images from the same Etsy sock listing. Image 1 is the current first/thumbnail. Image 2 is the second image. " +
              "Do they show the SAME sock design pattern (same colors, same artwork theme and style)? " +
              "Answer YES only if the overall design looks identical. Answer NO if the patterns, colors, or artwork are clearly different. " +
              'Reply ONLY with JSON: {"same":true,"reason":"brief reason"} or {"same":false,"reason":"brief reason"}',
          },
        ],
      }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return { same: true, reason: `comparison API ${res.status} — assuming same` };
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const match = raw.match(/\{.*\}/s);
  if (!match) return { same: true, reason: "parse error — assuming same" };
  try {
    const parsed = JSON.parse(match[0]);
    return { same: Boolean(parsed.same), reason: String(parsed.reason ?? "unknown") };
  } catch {
    return { same: true, reason: "JSON parse error — assuming same" };
  }
}

// ── Send SMS via Twilio ─────────────────────────────────────────────────────
async function sendSms(to: string, body: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !to) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
    signal: AbortSignal.timeout(10_000),
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: {
    queueId?: number;
    etsyListingId?: string;
    productName?: string;
    productType?: string;
    debug?: boolean;
    scanVisual?: boolean;
    offset?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
  }

  const { queueId, etsyListingId, productName, productType, debug } = body;
  const scanVisual = body.scanVisual === true;
  const seedEtsyIds = (body as Record<string, unknown>).seedEtsyIds === true;
  const scanOffset = typeof body.offset === "number" ? body.offset : 0;

  // ── SEED ETSY IDS MODE — fetch all active Etsy shop listings and match to DB ─
  if (seedEtsyIds) {
    log("seedEtsyIds mode — fetching all active Etsy listings");
    const { headers: etsyHeaders, token: etsyToken } = await getEtsyAccessToken(sb);

    // Fetch active listings from Etsy shop in two rounds (max 100 each)
    const ETSY_SHOP_ID = "6311589";
    const allListings: Array<{ listing_id: number; title: string }> = [];

    for (const offset of [0, 100]) {
      const res = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/active?limit=100&offset=${offset}`,
        { headers: etsyHeaders, signal: AbortSignal.timeout(20_000) },
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return Response.json({ error: `Etsy listings fetch failed: ${res.status} ${errText.slice(0, 200)}`, offset }, { status: 500, headers: CORS });
      }
      const data = await res.json();
      const listings = Array.isArray(data.results) ? data.results : [];
      allListings.push(...listings.map((l: { listing_id: number; title: string }) => ({ listing_id: l.listing_id, title: l.title })));
      if (listings.length < 100) break; // no more pages
      await new Promise((r) => setTimeout(r, 1000)); // pace between pages
    }

    log("Etsy listings fetched", { count: allListings.length });

    // Fetch all published physical queue rows missing etsy_listing_id
    const { data: queueRows } = await sb
      .from("pod_product_queue")
      .select("id, name")
      .eq("status", "published")
      .neq("product_type", "download")
      .is("etsy_listing_id", null);

    const matched: Array<{ queueId: number; name: string; etsyListingId: string; matchedTitle: string }> = [];
    const unmatched: Array<{ queueId: number; name: string }> = [];

    for (const row of queueRows ?? []) {
      // Try to match: normalize both to lowercase and check containment
      const qNorm = row.name.toLowerCase().replace(/[–—\-]/g, " ").replace(/\s+/g, " ").trim();
      const qWords = qNorm.split(" ").filter((w: string) => w.length > 3); // meaningful words

      let bestListing: { listing_id: number; title: string } | null = null;
      let bestScore = 0;

      for (const listing of allListings) {
        const lNorm = listing.title.toLowerCase().replace(/[–—\-]/g, " ").replace(/\s+/g, " ").trim();
        // Score = how many queue words appear in listing title
        const hits = qWords.filter((w: string) => lNorm.includes(w)).length;
        const score = hits / Math.max(qWords.length, 1);
        if (score > bestScore) {
          bestScore = score;
          bestListing = listing;
        }
      }

      if (bestListing && bestScore >= 0.5) {
        const etsyId = String(bestListing.listing_id);
        await sb.from("pod_product_queue").update({ etsy_listing_id: etsyId }).eq("id", row.id);
        matched.push({ queueId: row.id, name: row.name, etsyListingId: etsyId, matchedTitle: bestListing.title.slice(0, 60) });
      } else {
        unmatched.push({ queueId: row.id, name: row.name });
      }
    }

    return Response.json({
      seedEtsyIds: true,
      totalEtsyListings: allListings.length,
      matched: matched.length,
      unmatched: unmatched.length,
      matchedProducts: matched,
      unmatchedProducts: unmatched,
      next: "Call {scanVisual:true,offset:0} to start the visual scan",
    }, { headers: CORS });
  }

  // ── SCAN VISUAL MODE — walk all published products oldest-first ───────────
  if (scanVisual) {
    log("scanVisual mode", { offset: scanOffset });

    // Fetch 5 published physical products, oldest first
    const { data: rows, error: dbErr } = await sb
      .from("pod_product_queue")
      .select("id, name, product_type, printify_id, etsy_listing_id")
      .eq("status", "published")
      .neq("product_type", "download")
      .not("printify_id", "is", null)
      .order("created_at", { ascending: true })
      .range(scanOffset, scanOffset + 4);

    if (dbErr) return Response.json({ error: dbErr.message }, { status: 500, headers: CORS });
    if (!rows || rows.length === 0) {
      return Response.json({ done: true, message: "All published products scanned — none failed!", offset: scanOffset }, { headers: CORS });
    }

    const { headers: etsyHeaders } = await getEtsyAccessToken(sb);

    const results: Array<Record<string, unknown>> = [];
    let failedProduct: Record<string, unknown> | null = null;

    for (const row of rows) {
      log("Scanning", { queueId: row.id, name: row.name });

      // Step 1: resolve Etsy listing ID
      let etsyId: string | null = row.etsy_listing_id ?? null;

      if (!etsyId && row.printify_id && PRINTIFY_API_KEY) {
        try {
          const shopId = await getPrintifyShopId();
          const pRes = await fetch(
            `https://api.printify.com/v1/shops/${shopId}/products/${row.printify_id}.json`,
            { headers: { Authorization: `Bearer ${PRINTIFY_API_KEY}` }, signal: AbortSignal.timeout(12_000) },
          );
          if (pRes.ok) {
            const pData = await pRes.json();
            etsyId = pData.external?.id ?? null;
            if (etsyId) {
              await sb.from("pod_product_queue").update({ etsy_listing_id: etsyId }).eq("id", row.id);
              log("Resolved Etsy ID from Printify", { queueId: row.id, etsyId });
            }
          } else {
            log("Printify product fetch failed", { queueId: row.id, status: pRes.status });
          }
        } catch (e) {
          log("Printify fetch error", { queueId: row.id, error: (e as Error).message });
        }
      }

      if (!etsyId) {
        results.push({ queueId: row.id, name: row.name, status: "skipped", reason: "no Etsy listing ID" });
        continue;
      }

      // Step 2: pace — 1.5s between Etsy API calls to respect rate limits
      if (results.length > 0) await new Promise((r) => setTimeout(r, 1500));

      // Step 3: fetch Etsy listing images (all of them for cross-image check on socks)
      let primaryImageUrl: string | null = null;
      let allImageUrls: string[] = [];
      try {
        const { urls, status } = await fetchEtsyImages(etsyId, etsyHeaders);
        if (status === 429) {
          log("Etsy 429 during scan — stopping");
          return Response.json({
            scanStopped: true,
            reason: "Etsy rate limit (429) — retry after midnight UTC",
            checkedSoFar: results,
            resumeAt: scanOffset + results.length,
            callNext: `POST {"scanVisual":true,"offset":${scanOffset + results.length}} to pod-visual-confirm`,
          }, { headers: CORS });
        }
        allImageUrls = urls;
        primaryImageUrl = urls[0] ?? null;
      } catch (e) {
        results.push({ queueId: row.id, name: row.name, etsyId, status: "skipped", reason: "Etsy fetch error: " + (e as Error).message });
        continue;
      }

      if (!primaryImageUrl) {
        results.push({ queueId: row.id, name: row.name, etsyId, status: "skipped", reason: "no image URL from Etsy" });
        continue;
      }

      // Step 4: GPT Vision score
      try {
        let { score, reason } = await scoreEtsyMockup(primaryImageUrl, row.name, row.product_type);
        log("Vision score", { queueId: row.id, name: row.name, score, reason });

        // Step 4b: For socks — cross-image comparison to catch pre-repair rank=1 mismatch
        // If rank=1 and rank=2 show different designs, rank=1 is the old pre-repair mockup
        if (row.product_type === "sock" && allImageUrls.length >= 2 && score >= 3) {
          try {
            const { same, reason: compareReason } = await compareTwoImages(allImageUrls[0], allImageUrls[1]);
            if (!same) {
              log("Sock cross-image MISMATCH — rank=1 differs from rank=2", { queueId: row.id, reason: compareReason });
              score = 1;
              reason = `Sock rank=1 image differs from rank=2 (old pre-repair image still first): ${compareReason}. Fix: POST {"fixSockFirstImage":true} to sock-image-repair.`;
            } else {
              log("Sock cross-image OK — rank=1 and rank=2 match", { queueId: row.id });
            }
          } catch (e) {
            log("Sock image comparison error (non-fatal — skipping cross-check)", { error: (e as Error).message });
          }
        }

        const dbUpdate: Record<string, unknown> = {
          visual_score: score,
          visual_checked_at: new Date().toISOString(),
          etsy_listing_id: etsyId,
        };
        if (score <= 2) {
          dbUpdate.status = "visual_failed";
          dbUpdate.error_msg = `Visual scan FAILED (${score}/5): ${reason}`;
        }
        await sb.from("pod_product_queue").update(dbUpdate).eq("id", row.id);

        const resultEntry = {
          queueId: row.id,
          name: row.name,
          productType: row.product_type,
          etsyId,
          score,
          reason,
          status: score <= 2 ? "FAILED" : "passed",
          etsyUrl: `https://www.etsy.com/listing/${etsyId}`,
        };
        results.push(resultEntry);

        if (score <= 2) {
          failedProduct = {
            queueId: row.id,
            printifyId: row.printify_id,
            name: row.name,
            productType: row.product_type,
            etsyId,
            score,
            reason,
            etsyUrl: `https://www.etsy.com/listing/${etsyId}`,
          };
          break; // Stop on first failure
        }
      } catch (e) {
        log("Vision error", { queueId: row.id, error: (e as Error).message });
        results.push({ queueId: row.id, name: row.name, etsyId, status: "skipped", reason: "Vision error: " + (e as Error).message });
      }
    }

    if (failedProduct) {
      return Response.json({
        scanStopped: true,
        reason: "visual failure found — review and confirm before continuing",
        failedProduct,
        checkedBeforeFailure: results.filter((r) => r["status"] !== "FAILED"),
        fixWith: `POST {"repairProductIds":["${failedProduct.printifyId}"]} to printify-product-creator`,
        resumeScanAfterFix: `POST {"scanVisual":true,"offset":${scanOffset + results.findIndex((r) => r["status"] === "FAILED")}} to pod-visual-confirm`,
      }, { headers: CORS });
    }

    const nextOffset = scanOffset + rows.length;
    return Response.json({
      allPassedInBatch: true,
      checked: results.length,
      results,
      nextOffset,
      hasMore: rows.length === 5,
      callNext: rows.length === 5
        ? `POST {"scanVisual":true,"offset":${nextOffset}} to pod-visual-confirm`
        : null,
    }, { headers: CORS });
  }

  // ── DEBUG MODE — skip 90s wait, return raw Etsy API response ────────────
  if (debug) {
    if (!etsyListingId) return Response.json({ error: "etsyListingId required for debug mode" }, { status: 400, headers: CORS });
    try {
      const { headers: etsyHeaders } = await getEtsyAccessToken(sb);
      const imagesRes = await fetch(
        `https://openapi.etsy.com/v3/application/listings/${etsyListingId}/images`,
        { headers: etsyHeaders, signal: AbortSignal.timeout(15_000) },
      );
      const raw = await imagesRes.text();
      return Response.json({
        debug: true,
        status: imagesRes.status,
        ok: imagesRes.ok,
        rawBody: raw.slice(0, 1000),
        etsyHeaderKey: ETSY_HEADER_KEY ? ETSY_HEADER_KEY.slice(0, 15) + "..." : "EMPTY",
      }, { headers: CORS });
    } catch (e) {
      return Response.json({ debug: true, error: (e as Error).message }, { headers: CORS });
    }
  }

  // ── NORMAL MODE — post-publish check for a single newly published product ─
  if (!queueId || !etsyListingId) {
    return Response.json({ error: "queueId and etsyListingId required (or use scanVisual:true)" }, { status: 400, headers: CORS });
  }

  log("Starting post-publish visual check", { queueId, etsyListingId, productName });

  // Store the Etsy listing ID immediately (before wait)
  await sb.from("pod_product_queue")
    .update({ etsy_listing_id: etsyListingId })
    .eq("id", queueId);

  // ── Wait 90s for Etsy to render the listing images ──────────────────────
  log("Waiting 90s for Etsy image rendering...");
  await new Promise((r) => setTimeout(r, 90_000));

  if (!OPENAI_KEY || !ETSY_API_KEY) {
    log("Missing OPENAI_API_KEY or ETSY_API_KEY — skipping vision check");
    return Response.json({ skipped: true, reason: "missing keys" }, { headers: CORS });
  }

  // ── Fetch Etsy listing images ────────────────────────────────────────────
  let primaryImageUrl: string | null = null;
  try {
    const { headers: etsyHeaders } = await getEtsyAccessToken(sb);
    const { url, status } = await fetchEtsyPrimaryImage(etsyListingId, etsyHeaders);
    if (status === 429) {
      await sb.from("pod_product_queue").update({ visual_checked_at: new Date().toISOString() }).eq("id", queueId);
      return Response.json({ checked: false, reason: "Etsy rate limit (429)" }, { headers: CORS });
    }
    primaryImageUrl = url;
  } catch (e) {
    log("Etsy images fetch error", { error: (e as Error).message });
  }

  if (!primaryImageUrl) {
    await sb.from("pod_product_queue").update({
      visual_checked_at: new Date().toISOString(),
      visual_score: null,
    }).eq("id", queueId);
    log("No image URL available — check skipped");
    return Response.json({ checked: false, reason: "no image URL from Etsy" }, { headers: CORS });
  }

  // ── Run GPT Vision score ─────────────────────────────────────────────────
  let score = 5;
  let reason = "check skipped";
  try {
    const result = await scoreEtsyMockup(primaryImageUrl, productName ?? "", productType ?? "");
    score = result.score;
    reason = result.reason;
    log("Vision score", { score, reason, productName });
  } catch (e) {
    log("Vision check error", { error: (e as Error).message });
    await sb.from("pod_product_queue").update({
      visual_checked_at: new Date().toISOString(),
      visual_score: null,
    }).eq("id", queueId);
    return Response.json({ checked: false, reason: "vision error: " + (e as Error).message }, { headers: CORS });
  }

  // ── Update DB and alert ──────────────────────────────────────────────────
  const isFail = score <= 2;

  if (isFail) {
    await sb.from("pod_product_queue").update({
      status: "visual_failed",
      error_msg: `Visual check FAILED (${score}/5): ${reason}. Repair: POST {"repairProductIds":["<printify_id>"]} to printify-product-creator`,
      visual_score: score,
      visual_checked_at: new Date().toISOString(),
    }).eq("id", queueId);

    log("VISUAL FAIL — marking queue row + sending SMS", { queueId, score, reason });

    const smsBody = `🚨 POD Visual Fail (${score}/5)\n${productName} (${productType})\nReason: ${reason}\nEtsy: https://www.etsy.com/listing/${etsyListingId}\nFix: repairProductIds on printify-product-creator`;
    await sendSms(ADMIN_PHONE, smsBody).catch((e) => log("SMS error", { error: e.message }));

    return Response.json({
      checked: true,
      passed: false,
      score,
      reason,
      queueId,
      etsyListingId,
      etsyUrl: `https://www.etsy.com/listing/${etsyListingId}`,
      action: "status set to visual_failed — repair with repairProductIds",
    }, { headers: CORS });
  } else {
    await sb.from("pod_product_queue").update({
      visual_score: score,
      visual_checked_at: new Date().toISOString(),
    }).eq("id", queueId);

    log("Visual check PASSED", { queueId, score, reason });
    return Response.json({
      checked: true,
      passed: true,
      score,
      reason,
      queueId,
      etsyListingId,
    }, { headers: CORS });
  }
});
