// etsy-listing-completor — AI-powered listing completion optimizer
//
// Etsy rewards listings with all 13 tags, descriptions >200 chars, and
// complete attributes. Incomplete listings rank lower in search.
//
// What it fixes:
//   - Listings with fewer than 13 tags → AI generates remaining tags
//   - Listings with description < 200 chars → AI expands description
//   - Patches listings via Etsy API
//
// Run: POST {} to audit + fix up to 30 listings per run. Idempotent.
// Run: POST {"rotateTags": true} to rotate 3 low-traffic tags on complete listings.
// Run: POST {"refreshTitles": true, "limit": 20} to rewrite weak titles with gift-intent SEO language.
// Cron: weekly Monday 9am UTC

import { createClient } from "npm:@supabase/supabase-js@2";

const ETSY_API_KEY = (Deno.env.get("ETSY_API_KEY") ?? "").trim();
const ETSY_SHARED_SECRET = (Deno.env.get("ETSY_SHARED_SECRET") ?? "").trim();
const ETSY_HEADER_KEY = ETSY_SHARED_SECRET ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}` : ETSY_API_KEY;
const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[LISTING-COMPLETOR] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

async function etsyGet(path: string): Promise<Response> {
  return fetch(`https://openapi.etsy.com/v3/application${path}`, {
    headers: { "x-api-key": ETSY_HEADER_KEY },
    signal: AbortSignal.timeout(15_000),
  });
}

async function etsyPatch(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`https://openapi.etsy.com/v3/application${path}`, {
    method: "PATCH",
    headers: { "x-api-key": ETSY_HEADER_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

async function fetchAllListings(shopId: string): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  let offset = 0;
  while (true) {
    const res = await etsyGet(`/shops/${shopId}/listings?state=active&limit=100&offset=${offset}`);
    if (!res.ok) break;
    const data = await res.json() as Record<string, unknown>;
    const items = Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : [];
    all.push(...items);
    if (items.length < 100) break;
    offset += 100;
    await new Promise(r => setTimeout(r, 400));
  }
  return all;
}

async function aiComplete(title: string, description: string, currentTags: string[]): Promise<{ tags: string[]; description: string } | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const prompt = `You are an Etsy SEO expert. Given this product listing, generate optimized content.

Title: "${title}"
Current description (may be short): "${description.slice(0, 500)}"
Current tags (${currentTags.length}/13): ${currentTags.join(", ")}

Return a JSON object with:
1. "tags": array of exactly 13 lowercase tags (include all current ones, add new ones that match Etsy search queries for gift buyers). Each tag max 20 chars. No brand names.
2. "description": full product description 300-500 chars. Highlight: who it's for, why it makes a great gift, material/quality, free US shipping. NO excessive punctuation.

Return ONLY valid JSON, no markdown.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Fetch top trending tags from etsy_pod_trends to use as replacement candidates
async function fetchTrendingTags(): Promise<string[]> {
  try {
    const { data } = await sb.from("etsy_pod_trends").select("tags").not("tags", "is", null).limit(200);
    if (!data) return [];
    const tagFreq = new Map<string, number>();
    for (const row of data) {
      const tags: string[] = Array.isArray(row.tags) ? row.tags : [];
      for (const t of tags) {
        if (t && t.length <= 20) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);
      }
    }
    return [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([t]) => t);
  } catch {
    return [];
  }
}

async function aiRotateTags(
  title: string,
  currentTags: string[],
  trendingTags: string[],
): Promise<string[] | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const prompt = `You are an Etsy SEO expert. This listing already has 13 tags but some may be low-traffic.
Title: "${title}"
Current 13 tags: ${currentTags.join(", ")}
Top trending tags (high search volume): ${trendingTags.slice(0, 30).join(", ")}

Identify the 3 LOWEST-traffic tags in the current list and replace them with 3 of the trending tags that fit this product.
Keep the other 10 tags unchanged.
Return ONLY a JSON array of exactly 13 strings (the full updated tag list), no markdown.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const text = (data.choices?.[0]?.message?.content ?? "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length !== 13) return null;
    return parsed.slice(0, 13).map((t: string) => String(t).slice(0, 20).toLowerCase());
  } catch { return null; }
}

const ROTATE_COOLDOWN_DAYS = 14;

// Gift-intent pattern — titles missing these words need a rewrite
const GIFT_INTENT_RE = /gift|present|funny|cute|love|mom|dad|nurse|teacher|dog|cat|birthday|christmas|graduation|for\s+\w+|lover|fan|humor|proud|squad|tribe|life|vibes/i;

async function aiRefreshTitle(currentTitle: string, tags: string[]): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const prompt = `You are an Etsy SEO expert specializing in gift products. Rewrite this product title to maximize gift buyer clicks.

Current title: "${currentTitle}"
Current tags: ${tags.slice(0, 8).join(", ")}

Rules:
- Lead with the niche/recipient (e.g., "Funny Nurse Gift -", "Dog Mom Birthday Present -", "Cat Lover Gift -")
- Include "Gift" or "Present" early in the title
- Include an occasion: "Birthday", "Christmas Gift", "Graduation"
- Include who it's for: "for Women", "for Men", "for Nurses", "for Cat Moms"
- Max 140 characters
- No "&" symbol — use "and" instead
- No ALL CAPS
- Be specific: use the actual product theme, never say "Graphic Shirt" or "Tee"
- Read the tags to understand what the product is actually about

Return ONLY the new title text, no quotes, nothing else.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const text = (data.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^["'""'']|["'""'']$/g, "")
      .replace(/&/g, "and")
      .slice(0, 140);
    return text.length > 20 ? text : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!ETSY_API_KEY || !ETSY_SHOP_ID) {
    return new Response(JSON.stringify({
      error: "ETSY_API_KEY and ETSY_SHOP_ID required",
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const body = await req.json().catch(() => ({})) as { rotateTags?: boolean; refreshTitles?: boolean; setPrices?: boolean; listingIds?: string[]; price?: number; limit?: number; offset?: number };
  const rotateTags = body.rotateTags === true;
  const refreshTitles = body.refreshTitles === true;
  const titleLimit = Math.min(typeof body.limit === "number" ? body.limit : 10, 100);
  const titleOffset = typeof body.offset === "number" ? body.offset : 0;

  // ── setPrices: batch price update via Etsy API ──
  if (body.setPrices === true && Array.isArray(body.listingIds) && typeof body.price === "number") {
    try {
      // Load OAuth token (required for PATCH on confidential app)
      let bearerToken = "";
      try {
        const { data: tokenRow } = await sb.from("etsy_oauth_tokens").select("*").order("id", { ascending: false }).limit(1).maybeSingle();
        if (tokenRow) {
          let accessToken: string = (tokenRow as any).access_token;
          const needsRefresh = Date.now() >= new Date((tokenRow as any).expires_at).getTime() - 5 * 60 * 1000;
          if (needsRefresh) {
            const clientId = ETSY_API_KEY.split(":")[0];
            const refreshRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: (tokenRow as any).refresh_token }),
              signal: AbortSignal.timeout(15_000),
            });
            if (refreshRes.ok) {
              const rd = await refreshRes.json() as any;
              accessToken = rd.access_token;
              await sb.from("etsy_oauth_tokens").update({ access_token: accessToken, refresh_token: rd.refresh_token ?? (tokenRow as any).refresh_token, expires_at: new Date(Date.now() + (rd.expires_in ?? 3600) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", (tokenRow as any).id);
            }
          }
          bearerToken = accessToken;
        }
      } catch (e) { log("OAuth error in setPrices", { err: String(e).slice(0, 80) }); }

      const priceStr = body.price.toFixed(2);
      const hdrs: Record<string, string> = { "x-api-key": ETSY_HEADER_KEY, "Content-Type": "application/json" };
      if (bearerToken) hdrs["Authorization"] = `Bearer ${bearerToken}`;

      const results: Array<{ listingId: string; status: string; httpStatus?: number; err?: string }> = [];
      for (const listingId of body.listingIds) {
        try {
          const res = await fetch(`https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}`, {
            method: "PATCH", headers: hdrs, body: JSON.stringify({ price: priceStr }), signal: AbortSignal.timeout(10_000),
          });
          const txt = await res.text().catch(() => "");
          if (res.ok) {
            await sb.from("etsy_listings").update({ price_usd: priceStr, updated_at: new Date().toISOString() }).eq("listing_id", listingId);
            results.push({ listingId, status: "updated" });
            log("Price updated", { listingId, price: priceStr });
          } else {
            results.push({ listingId, status: "failed", httpStatus: res.status, err: txt.slice(0, 120) });
            log("Price patch failed", { listingId, status: res.status, err: txt.slice(0, 80) });
          }
          await new Promise(r => setTimeout(r, 600));
        } catch (e) {
          results.push({ listingId, status: "error", err: String(e).slice(0, 80) });
        }
      }
      const updated = results.filter(r => r.status === "updated").length;
      return new Response(JSON.stringify({ status: "ok", updated, total: body.listingIds.length, price: body.price, hasBearerToken: !!bearerToken, results }), { headers: { ...CORS, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
  }

  // ── refreshTitles: early-return path (no fetchAllListings needed) ──
  if (refreshTitles) {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY required" }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    try {
      // Load + auto-refresh OAuth Bearer token (same pattern as sock-image-repair)
      let bearerToken = "";
      try {
        const { data: tokenRow } = await sb
          .from("etsy_oauth_tokens")
          .select("*")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!tokenRow) throw new Error("No Etsy OAuth tokens — complete OAuth flow first");

        let accessToken: string = (tokenRow as any).access_token;
        const needsRefresh = Date.now() >= new Date((tokenRow as any).expires_at).getTime() - 5 * 60 * 1000;

        if (needsRefresh) {
          log("Refreshing Etsy token for title refresh");
          const clientId = ETSY_API_KEY.split(":")[0];
          const refreshRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: clientId,
              refresh_token: (tokenRow as any).refresh_token,
            }),
            signal: AbortSignal.timeout(15_000),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json() as any;
            accessToken = refreshData.access_token;
            await sb.from("etsy_oauth_tokens").update({
              access_token: accessToken,
              refresh_token: refreshData.refresh_token ?? (tokenRow as any).refresh_token,
              expires_at: new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", (tokenRow as any).id);
            log("Etsy token refreshed successfully");
          } else {
            log("Etsy token refresh failed — using existing token", { status: refreshRes.status });
          }
        }
        bearerToken = accessToken;
      } catch (e) { log("OAuth load/refresh error", { err: String(e).slice(0, 80) }); }

      // Fetch all active listings from DB (already synced by etsy-listing-sync)
      const { data: allListings } = await sb.from("etsy_listings").select("listing_id, title, tags, num_favorers").eq("status", "active").order("num_favorers", { ascending: true });
      const allWeak = (allListings ?? []).filter((row: any) => {
        const t: string = row.title || "";
        return !GIFT_INTENT_RE.test(t) || t.length < 40;
      });
      const totalWeak = allWeak.length;
      const batch = allWeak.slice(titleOffset, titleOffset + titleLimit);
      log("refreshTitles batch", { total: totalWeak, batch: batch.length, offset: titleOffset, hasBearerToken: !!bearerToken });

      const etsyPatchAuth = async (listingId: string, patchBody: Record<string, unknown>): Promise<Response> => {
        const hdrs: Record<string, string> = { "x-api-key": ETSY_HEADER_KEY, "Content-Type": "application/json" };
        if (bearerToken) hdrs["Authorization"] = `Bearer ${bearerToken}`;
        return fetch(`https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}`, {
          method: "PATCH", headers: hdrs, body: JSON.stringify(patchBody), signal: AbortSignal.timeout(10_000),
        });
      };

      let titlesFixed = 0;
      let titleErrors = 0;
      const results: Array<{ id: string; old: string; new?: string; status: string }> = [];

      for (const row of batch) {
        const listingId = String((row as any).listing_id);
        const currentTitle: string = (row as any).title || "";
        const currentTags: string[] = Array.isArray((row as any).tags) ? (row as any).tags : [];
        try {
          const newTitle = await aiRefreshTitle(currentTitle, currentTags);
          if (!newTitle) { titleErrors++; results.push({ id: listingId, old: currentTitle.slice(0, 60), status: "gpt_fail" }); continue; }
          const res = await etsyPatchAuth(listingId, { title: newTitle });
          if (res.ok) {
            titlesFixed++;
            try { await sb.from("etsy_listings").update({ title: newTitle, updated_at: new Date().toISOString() }).eq("listing_id", listingId); } catch { /* ignore */ }
            results.push({ id: listingId, old: currentTitle.slice(0, 60), new: newTitle.slice(0, 60), status: "fixed" });
            log("Title fixed", { listingId, old: currentTitle.slice(0, 40), new: newTitle.slice(0, 40) });
          } else {
            const errText = await res.text().catch(() => "");
            titleErrors++;
            results.push({ id: listingId, old: currentTitle.slice(0, 60), status: "patch_fail_" + res.status });
            log("Patch failed", { listingId, status: res.status, err: errText.slice(0, 80) });
          }
          await new Promise(r => setTimeout(r, 800));
        } catch (e) {
          titleErrors++;
          results.push({ id: listingId, old: currentTitle.slice(0, 60), status: "error" });
        }
      }

      const nextOff = titleOffset + titleLimit;
      const nextOffset = nextOff < totalWeak ? nextOff : null;
      return new Response(JSON.stringify({
        status: "ok", titles_fixed: titlesFixed, title_errors: titleErrors, total_weak: totalWeak,
        batch_size: batch.length, offset: titleOffset, nextOffset,
        callNext: nextOffset !== null ? '{"refreshTitles":true,"limit":' + titleLimit + ',"offset":' + nextOffset + "}": null,
        results,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    } catch (err) {
      log("refreshTitles fatal", { err: String(err) });
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
  }

  let titlesFixed = 0; // declared here so it's in scope for the heartbeat upsert at the end
  log("Starting listing completion audit", { shopId: ETSY_SHOP_ID, rotateTags });

  try {
    // ── Load OAuth Bearer token (required for Etsy PATCH write operations) ──
    let bearerToken = "";
    try {
      const { data: tokenRow } = await sb
        .from("etsy_oauth_tokens")
        .select("*")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (tokenRow) {
        let accessToken: string = (tokenRow as any).access_token;
        const needsRefresh = Date.now() >= new Date((tokenRow as any).expires_at).getTime() - 5 * 60 * 1000;
        if (needsRefresh) {
          const clientId = ETSY_API_KEY.split(":")[0];
          const refreshRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: (tokenRow as any).refresh_token }),
            signal: AbortSignal.timeout(15_000),
          });
          if (refreshRes.ok) {
            const rd = await refreshRes.json() as any;
            accessToken = rd.access_token;
            try { await sb.from("etsy_oauth_tokens").update({ access_token: accessToken, refresh_token: rd.refresh_token ?? (tokenRow as any).refresh_token, expires_at: new Date(Date.now() + (rd.expires_in ?? 3600) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", (tokenRow as any).id); } catch (_) {}
            log("Etsy token refreshed");
          }
        }
        bearerToken = accessToken;
      }
    } catch (e) { log("OAuth load error", { err: String(e).slice(0, 80) }); }
    log("OAuth token loaded", { hasBearerToken: !!bearerToken });

    // Authenticated patch helper — Etsy requires both x-api-key AND Bearer for writes
    const etsyPatchAuth = async (path: string, body: Record<string, unknown>): Promise<Response> => {
      const hdrs: Record<string, string> = { "x-api-key": ETSY_HEADER_KEY, "Content-Type": "application/json" };
      if (bearerToken) hdrs["Authorization"] = `Bearer ${bearerToken}`;
      return fetch(`https://openapi.etsy.com/v3/application${path}`, {
        method: "PATCH", headers: hdrs, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
      });
    };

    // Fetch from DB — immune to Etsy API rate limits; etsy-listing-sync keeps this current
    const { data: dbListings, error: dbFetchErr } = await sb.from("etsy_listings")
      .select("listing_id, title, tags, description")
      .eq("status", "active")
      .limit(600);
    if (dbFetchErr) log("DB fetch error", { err: String(dbFetchErr).slice(0, 80) });
    const listings = (dbListings ?? []) as any[];
    log("Fetched listings from DB", { count: listings.length });

    // Find listings needing improvement (zero/partial tags or short descriptions)
    const needsWork = listings.filter((l: any) => {
      const tagCount = Array.isArray(l.tags) ? l.tags.length : 0;
      const descLen = (l.description || "").length;
      return tagCount < 13 || descLen < 200;
    });

    log("Listings needing work", { count: needsWork.length, total: listings.length });

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const listing of needsWork.slice(0, 20)) {
      const l = listing as any;
      const listingId = l.listing_id;
      const currentTags: string[] = Array.isArray(l.tags) ? l.tags : [];
      const currentDesc: string = l.description || "";

      const tagCount = currentTags.length;
      const descLen = currentDesc.length;

      if (!OPENAI_API_KEY) {
        skipped++;
        continue;
      }

      try {
        const completed = await aiComplete(l.title || "", currentDesc, currentTags);
        if (!completed) { errors++; continue; }

        const patch: Record<string, unknown> = {};

        if (tagCount < 13 && completed.tags.length === 13) {
          patch.tags = completed.tags.slice(0, 13).map((t: string) => t.slice(0, 20));
        }

        if (descLen < 200 && completed.description.length > descLen) {
          patch.description = completed.description.slice(0, 2000);
        }

        if (Object.keys(patch).length === 0) { skipped++; continue; }

        const res = await etsyPatchAuth(`/shops/${ETSY_SHOP_ID}/listings/${listingId}`, patch);
        if (res.ok) {
          fixed++;
          // Mirror the fix to DB so next run skips this listing
          const dbUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (patch.tags) dbUpdate.tags = patch.tags;
          if (patch.description) dbUpdate.description = patch.description;
          try { await sb.from("etsy_listings").update(dbUpdate).eq("listing_id", String(listingId)); } catch (_) {}
          log("Fixed listing", { listingId, title: (l.title || "").slice(0, 40), tagCount, descLen, patched: Object.keys(patch) });
        } else {
          errors++;
          const errBody = await res.text().catch(() => "");
          log("Patch FAILED", { listingId, status: res.status, body: errBody.slice(0, 120), hasBearerToken: !!bearerToken });
        }

        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        errors++;
        log("Error", { listingId, error: String(e).slice(0, 80) });
      }
    }

    // ── rotateTags mode: refresh 3 low-traffic tags on fully-complete listings ──
    let tagsRotated = 0;
    if (rotateTags && OPENAI_API_KEY) {
      const trendingTags = await fetchTrendingTags();
      log("Trending tags fetched", { count: trendingTags.length });

      const completeListing = listings.filter((l: any) => {
        const tagCount = Array.isArray(l.tags) ? l.tags.length : 0;
        return tagCount >= 13;
      });

      const cutoff = new Date(Date.now() - ROTATE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

      for (const listing of completeListing.slice(0, 20)) {
        const l = listing as any;
        const listingId = String(l.listing_id);
        const stateKey = `tag_rotated_${listingId}`;

        // Check cooldown
        const { data: stateRow } = await sb.from("pod_agent_state").select("value").eq("key", stateKey).maybeSingle();
        if (stateRow?.value && stateRow.value > cutoff) { continue; }

        const currentTags: string[] = Array.isArray(l.tags) ? l.tags : [];
        const newTags = await aiRotateTags(l.title || "", currentTags, trendingTags);
        if (!newTags) continue;

        const res = await etsyPatchAuth(`/shops/${ETSY_SHOP_ID}/listings/${listingId}`, { tags: newTags });
        if (res.ok) {
          tagsRotated++;
          try { await sb.from("pod_agent_state").upsert({ key: stateKey, value: new Date().toISOString() }, { onConflict: "key" }); } catch (_) {}
          log("Rotated tags", { listingId, title: (l.title || "").slice(0, 40) });
        } else {
          log("Tag rotate patch failed", { listingId, status: res.status });
        }
        await new Promise(r => setTimeout(r, 600));
      }
    }

    try {
      await sb.from("agent_heartbeats").upsert({
        agent_name: "etsy-listing-completor",
        last_run_at: new Date().toISOString(),
        last_status: errors === 0 ? "ok" : "partial",
        last_result: JSON.stringify({ checked: listings.length, needs_work: needsWork.length, fixed, skipped, errors, tags_rotated: tagsRotated, titles_fixed: titlesFixed }),
      }, { onConflict: "agent_name" });
    } catch (_) {}

    return new Response(JSON.stringify({
      status: "ok",
      listings_checked: listings.length,
      needs_work: needsWork.length,
      fixed,
      skipped,
      errors,
      tags_rotated: tagsRotated,
      openai_available: !!OPENAI_API_KEY,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    log(`Fatal: ${err}`);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
