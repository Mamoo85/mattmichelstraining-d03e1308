// pinterest-pinner — daily 12pm UTC
// Auto-pins recent POD listings and Etsy digital listings to themed Pinterest boards.
// Pinterest drives 3-10% of all Etsy traffic — fully automatable via Pinterest API v5.
//
// SETUP REQUIRED (one-time):
//   1. Create Pinterest Business account
//   2. Create a Pinterest app at developers.pinterest.com
//   3. Complete OAuth to get access_token
//   4. Create themed boards (links in logs) and note their board IDs
//   5. Set secrets: PINTEREST_ACCESS_TOKEN, PINTEREST_BOARD_IDS (JSON map)
//
// PINTEREST_BOARD_IDS should be a JSON string like:
//   {"default":"BOARD_ID","nurse":"BOARD_ID","teacher":"BOARD_ID","dad":"BOARD_ID","cat":"BOARD_ID","dog":"BOARD_ID","funny":"BOARD_ID","graduation":"BOARD_ID"}
//
// Until configured, returns 503 with setup instructions.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[PINTEREST] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// Map niche keywords to board categories
function getBoardCategory(title: string): string {
  const lower = title.toLowerCase();
  if (/nurse|medical|doctor|hospital|healthcare/.test(lower)) return "nurse";
  if (/teacher|school|classroom|education/.test(lower)) return "teacher";
  if (/dad|father|fathers day|papa/.test(lower)) return "dad";
  if (/cat|kitty|feline/.test(lower)) return "cat";
  if (/dog|puppy|canine|pup/.test(lower)) return "dog";
  if (/graduate|graduation|class of/.test(lower)) return "graduation";
  if (/coffee|mug|caffeine/.test(lower)) return "funny";
  return "default";
}

async function createPin(
  accessToken: string,
  boardId: string,
  title: string,
  description: string,
  imageUrl: string,
  linkUrl: string
): Promise<string> {
  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board_id: boardId,
      title: title.slice(0, 100),
      description: description.slice(0, 500),
      media_source: {
        source_type: "image_url",
        url: imageUrl,
      },
      link: linkUrl,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Pinterest API ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return String(data.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const PINTEREST_ACCESS_TOKEN = Deno.env.get("PINTEREST_ACCESS_TOKEN");
  const PINTEREST_BOARD_IDS_RAW = Deno.env.get("PINTEREST_BOARD_IDS");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!PINTEREST_ACCESS_TOKEN || !PINTEREST_BOARD_IDS_RAW) {
    return new Response(
      JSON.stringify({
        error: "Pinterest not configured",
        setup_required: [
          "1. Create Pinterest Business account at business.pinterest.com",
          "2. Create app at developers.pinterest.com → get client_id + client_secret",
          "3. Complete OAuth flow to get access_token",
          "4. Create boards: 'Funny Gifts', 'Nurse Gifts', 'Teacher Gifts', 'Dad Gifts', etc.",
          "5. Set PINTEREST_ACCESS_TOKEN secret in Supabase",
          "6. Set PINTEREST_BOARD_IDS secret as JSON: {\"default\":\"ID\",\"nurse\":\"ID\",...}",
        ],
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let boardIds: Record<string, string> = {};
  try {
    boardIds = JSON.parse(PINTEREST_BOARD_IDS_RAW);
  } catch {
    return new Response(JSON.stringify({ error: "PINTEREST_BOARD_IDS must be valid JSON" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const url = new URL(req.url);
  const batchMode = url.searchParams.get("batch") === "true";
  const pinsPerRun = batchMode ? 10 : 5;  // Stay conservative to avoid rate limits

  // ── Hero mode: pin hero listings first, route through track-click ──────────
  // Check pod_product_queue for is_hero=true listings not yet pinned as heroes.
  // Hero listings use real Etsy images and track-click for attribution.
  // Falls back to legacy recent-listings mode if hero set is empty.
  const { data: pinnedHeroIds } = await sb
    .from("pinterest_pins")
    .select("source_id")
    .eq("source_type", "hero_pod_listing");
  const pinnedHeroSet = new Set((pinnedHeroIds ?? []).map((r: { source_id: number }) => r.source_id));

  const { data: heroQueue } = await sb
    .from("pod_product_queue")
    .select("id, name, tags, etsy_listing_id")
    .eq("status", "published")
    .eq("is_hero", true)
    .order("listing_viability_score", { ascending: false, nullsFirst: false })
    .limit(pinsPerRun * 2);

  const unpinnedHeroes = (heroQueue ?? []).filter((r: { id: number }) => !pinnedHeroSet.has(r.id));

  const heroMode = unpinnedHeroes.length > 0;
  log(heroMode ? "heroMode: true" : "heroMode: false (fallback to recency)", { heroCount: unpinnedHeroes.length });

  if (heroMode) {
    // Join hero listings with etsy_listings to get real images + favorers
    const heroEtsyIds = unpinnedHeroes
      .map((r: { etsy_listing_id: string }) => r.etsy_listing_id)
      .filter(Boolean);

    const { data: etsyRows } = await sb
      .from("etsy_listings")
      .select("listing_id, main_image, num_favorers")
      .in("listing_id", heroEtsyIds.length ? heroEtsyIds : ["__none__"]);

    const etsyMap = new Map<string, { main_image: string | null; num_favorers: number }>();
    for (const row of etsyRows ?? []) {
      etsyMap.set(row.listing_id, { main_image: row.main_image ?? null, num_favorers: row.num_favorers ?? 0 });
    }

    const pinned: string[] = [];
    const errors: Array<{ title: string; error: string }> = [];

    for (const hero of unpinnedHeroes.slice(0, pinsPerRun)) {
      try {
        const heroTyped = hero as { id: number; name: string; tags: string[]; etsy_listing_id: string };
        const category = getBoardCategory(heroTyped.name ?? "");
        const boardId = boardIds[category] ?? boardIds["default"];

        if (!boardId) {
          errors.push({ title: (heroTyped.name ?? "").slice(0, 50), error: `No board ID for category "${category}"` });
          continue;
        }

        const etsyListingId = heroTyped.etsy_listing_id;
        const etsyUrl = `https://www.etsy.com/listing/${etsyListingId}`;
        const encoded = encodeURIComponent(btoa(etsyUrl));
        const niche = category;
        const linkUrl = `${SUPABASE_URL}/functions/v1/track-click?u=${encoded}&channel=pinterest&campaign=${encodeURIComponent(niche)}&listing=${etsyListingId}`;

        // Use real Etsy product image; fall back to Unsplash if not available
        const etsyData = etsyMap.get(etsyListingId);
        const imageUrl = etsyData?.main_image
          ?? `https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80`;

        // Build keyword-rich description from tags array
        const tags: string[] = Array.isArray(heroTyped.tags) ? heroTyped.tags : [];
        const hashtags = tags.slice(0, 5).map(t => `#${t.replace(/\s+/g, "")}`).join(" ");
        const description = `${heroTyped.name} — Unique gift, fast shipping! ${hashtags} #etsy #gifts #handmade`;

        const pinId = await createPin(
          PINTEREST_ACCESS_TOKEN, boardId,
          (heroTyped.name ?? "").slice(0, 100), description, imageUrl, linkUrl
        );

        await sb.from("pinterest_pins").insert({
          source_type: "hero_pod_listing",
          source_id: heroTyped.id,
          pin_id: pinId,
          board_id: boardId,
        });

        pinned.push((heroTyped.name ?? "").slice(0, 50));
        log("Hero pin created", { pinId, title: (heroTyped.name ?? "").slice(0, 40), board: category, etsyId: etsyListingId });
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        const msg = String(err);
        log("Error creating hero pin", { error: msg });
        errors.push({ title: ((hero as { name: string }).name ?? "").slice(0, 50), error: msg });
      }
    }

    log("Hero mode done", { pinned: pinned.length });
    return new Response(
      JSON.stringify({ pinned: pinned.length, heroMode: true, titles: pinned, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Fallback: legacy recency-based mode (no hero listings ready) ─────────
  // Find recent pod_listings not yet pinned
  const { data: pinnedPodIds } = await sb
    .from("pinterest_pins")
    .select("source_id")
    .eq("source_type", "pod_listing");
  const pinnedPodSet = new Set((pinnedPodIds ?? []).map((r: { source_id: number }) => r.source_id));

  const { data: podListings } = await sb
    .from("pod_listings")
    .select("id, title, printify_product_id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(pinsPerRun * 2);

  const unpinnedPod = (podListings ?? []).filter((l: { id: number }) => !pinnedPodSet.has(l.id));

  // Find recent etsy_digital_listings not yet pinned
  const { data: pinnedDigitalIds } = await sb
    .from("pinterest_pins")
    .select("source_id")
    .eq("source_type", "digital_listing");
  const pinnedDigitalSet = new Set((pinnedDigitalIds ?? []).map((r: { source_id: number }) => r.source_id));

  const { data: digitalListings } = await sb
    .from("etsy_digital_listings")
    .select("id, title, etsy_listing_id")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(pinsPerRun);

  const unpinnedDigital = (digitalListings ?? []).filter((l: { id: number }) => !pinnedDigitalSet.has(l.id));

  // Interleave POD + digital listings up to pinsPerRun
  const toPin: Array<{ type: "pod_listing" | "digital_listing"; id: number; title: string; externalId: string }> = [];
  let pi = 0, di = 0;
  while (toPin.length < pinsPerRun && (pi < unpinnedPod.length || di < unpinnedDigital.length)) {
    if (pi < unpinnedPod.length) {
      const l = unpinnedPod[pi++] as { id: number; title: string; printify_product_id: string };
      toPin.push({ type: "pod_listing", id: l.id, title: l.title, externalId: l.printify_product_id });
    }
    if (di < unpinnedDigital.length && toPin.length < pinsPerRun) {
      const l = unpinnedDigital[di++] as { id: number; title: string; etsy_listing_id: string };
      toPin.push({ type: "digital_listing", id: l.id, title: l.title, externalId: l.etsy_listing_id });
    }
  }

  if (toPin.length === 0) {
    log("No new listings to pin");
    return new Response(JSON.stringify({ pinned: 0, heroMode: false, message: "No new listings to pin" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pinned: string[] = [];
  const errors: Array<{ title: string; error: string }> = [];

  for (const item of toPin) {
    try {
      const category = getBoardCategory(item.title);
      const boardId = boardIds[category] ?? boardIds["default"];

      if (!boardId) {
        log("No board ID for category", { category, title: item.title.slice(0, 40) });
        errors.push({ title: item.title.slice(0, 50), error: `No board ID for category "${category}"` });
        continue;
      }

      // Build link URL — route through track-click for attribution
      const etsyUrl = item.type === "pod_listing"
        ? `https://www.etsy.com/shop/mattmichelstraining`
        : `https://www.etsy.com/listing/${item.externalId}`;
      const encoded = encodeURIComponent(btoa(etsyUrl));
      const linkUrl = `${SUPABASE_URL}/functions/v1/track-click?u=${encoded}&channel=pinterest&campaign=${getBoardCategory(item.title)}&listing=${item.externalId}`;

      const imageUrl = `https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80`;
      const description = item.type === "pod_listing"
        ? `${item.title} — Unique gift for every occasion! Ships in 3-5 days. ✨ #gift #etsy #handmade`
        : `${item.title} — Instant digital download! Print at home in minutes. ✨ #printable #wallart #gift`;

      const pinId = await createPin(
        PINTEREST_ACCESS_TOKEN, boardId,
        item.title.slice(0, 100), description, imageUrl, linkUrl
      );

      await sb.from("pinterest_pins").insert({
        source_type: item.type,
        source_id: item.id,
        pin_id: pinId,
        board_id: boardId,
      });

      pinned.push(item.title.slice(0, 50));
      log("Pin created", { pinId, title: item.title.slice(0, 40), board: category });
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      const msg = String(err);
      log("Error creating pin", { title: item.title.slice(0, 40), error: msg });
      errors.push({ title: item.title.slice(0, 50), error: msg });
    }
  }

  log("Done", { pinned: pinned.length });
  return new Response(
    JSON.stringify({ pinned: pinned.length, heroMode: false, titles: pinned, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
