// pod-seo-agent — rolling SEO refresh for all Printify/Etsy listings
// Cron: daily at 2pm UTC via pg_cron (see migration 20260519130000_pod_agent_crons.sql)
// Processes 3 listings per run. With ~150 products, one full sweep takes ~50 days.
// Uses pod_agent_state table to persist offset between runs.
// Upgrade #15: Volume-based price ratchet on proven sellers.
// Upgrade #9: Stats-based listing triage (reports underperformers and dead listings).
//
// NEW — scoreAll mode (POST { "scoreAll": true }):
//   Scores ALL published listings using scoreListingViability() from _shared/validate-listing.ts.
//   Writes listing_viability_score + last_scored_at to pod_product_queue.
//   Tags top 20 as is_hero=true, rest as is_hero=false.
//   Returns reaperCandidates (bottom 10%) in the JSON response for review — does NOT delete them.
//   Zero Etsy API calls — all data from DB only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateInternationalMetadata } from "../_shared/ai.ts";
import { scoreListingViability } from "../_shared/validate-listing.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-SEO-AGENT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

// Printify base costs used as floor for price ratchet
const START_PRICES: Record<string, number> = {
  mug: 2199, tshirt: 2699, hoodie: 4499, sock: 1899, hat: 3299, mousepad: 1999,
  onesie: 2499, tumbler: 3999, blanket: 6499, sweatshirt: 4999, longsleeve: 3499, travelmug: 3499,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN");
  const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));

  try {
    // ── scoreAll mode: score every published listing, tag top 20 as hero ──────
    // POST { "scoreAll": true } → scores all published listings, writes
    // listing_viability_score + last_scored_at to pod_product_queue,
    // tags top 20 as is_hero=true, returns bottom 10% as reaperCandidates.
    // Zero Etsy API calls — all data from DB only.
    if (body.scoreAll) {
      const { data: listings, error: lErr } = await sb
        .from("pod_product_queue")
        .select("id, name, tags, description, product_type, etsy_listing_id, visual_score")
        .eq("status", "published");

      if (lErr) throw new Error(`scoreAll fetch failed: ${lErr.message}`);

      const rows = listings ?? [];
      log("scoreAll start", { total: rows.length });

      // Score ALL listings in memory first — zero DB writes during scoring loop
      // This avoids 647× individual round-trips which causes timeout.
      const scored: Array<{ id: number; etsy_listing_id: string; score: number; grade: string }> = [];

      for (const row of rows) {
        const result = scoreListingViability({
          title: row.name ?? "",
          tags: Array.isArray(row.tags) ? row.tags : [],
          hasShippingProfile: true, // Printify-published listings always have a shipping profile
          descriptionLength: (row.description ?? "").length,
          imageContrastScore: row.visual_score ?? 3, // assume neutral contrast if not scored yet
        });

        scored.push({
          id: row.id,
          etsy_listing_id: row.etsy_listing_id,
          score: result.total,
          grade: result.grade,
        });
      }

      // Sort by score DESC — top 20 become heroes
      scored.sort((a, b) => b.score - a.score);
      const heroCount = Math.min(20, scored.length);
      const heroIdSet = new Set(scored.slice(0, heroCount).map(r => r.id));

      // Batch-upsert: combine score + is_hero + last_scored_at in one pass.
      // Chunks of 100 → ~7 DB calls for 647 listings (vs 1,294 individual calls).
      const nowStr = new Date().toISOString();
      const CHUNK = 100;
      let upsertErrors = 0;

      for (let i = 0; i < scored.length; i += CHUNK) {
        const chunk = scored.slice(i, i + CHUNK).map(r => ({
          id: r.id,
          listing_viability_score: r.score,
          last_scored_at: nowStr,
          is_hero: heroIdSet.has(r.id),
        }));

        const { error: bErr } = await sb
          .from("pod_product_queue")
          .upsert(chunk, { onConflict: "id" });

        if (bErr) {
          upsertErrors++;
          log("Batch upsert error", { chunk: i, error: bErr.message.slice(0, 60) });
        }
      }

      // Bottom 10% = reaper candidates (returned for review, NOT deleted)
      const reaperCount = Math.max(1, Math.floor(scored.length * 0.1));
      const reaperCandidates = scored.slice(-reaperCount).map(r => ({
        id: r.id,
        etsy_listing_id: r.etsy_listing_id,
        score: r.score,
        grade: r.grade,
      }));

      const topHeroes = scored.slice(0, heroCount).map(r => ({
        id: r.id,
        etsy_listing_id: r.etsy_listing_id,
        score: r.score,
        grade: r.grade,
      }));

      log("scoreAll complete", { scored: scored.length, heroTagged: heroCount, reaperCount, upsertErrors });

      return new Response(JSON.stringify({
        success: true,
        scored: scored.length,
        heroTagged: heroCount,
        topHeroes,
        reaperCandidates,
        upsertErrors,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // ── Upgrade #15: Volume-Based Price Ratchet ────────────────────────────────
    // Find listings that have crossed sales thresholds and apply price escalation
    let priceRatchets = 0;
    if (PRINTIFY_KEY && PRINTIFY_SHOP_ID) {
      const pHeaders = {
        Authorization: `Bearer ${PRINTIFY_KEY}`,
        "Content-Type": "application/json",
      };

      // Find listings with recent sales data
      const { data: statsRows } = await sb
        .from("pod_listing_stats")
        .select("etsy_listing_id, num_sold")
        .gt("num_sold", 4)  // at least 5 sales
        .order("num_sold", { ascending: false })
        .limit(20);

      for (const stat of (statsRows ?? [])) {
        try {
          // Get the Printify product ID from pod_listings
          const { data: listing } = await sb
            .from("pod_listings")
            .select("printify_product_id, product_type")
            .eq("etsy_listing_id", stat.etsy_listing_id)
            .eq("status", "published")
            .maybeSingle();

          if (!listing?.printify_product_id) continue;

          const startPrice = START_PRICES[listing.product_type] ?? 2699;
          const cap = Math.floor(startPrice * 1.30);

          // Fetch current product to get variant prices
          const prodRes = await fetch(
            `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${listing.printify_product_id}.json`,
            { headers: pHeaders, signal: AbortSignal.timeout(10_000) }
          );
          if (!prodRes.ok) continue;

          const prod = await prodRes.json();
          const variants: Array<{ id: number; price: number }> = prod.variants ?? [];
          if (variants.length === 0) continue;

          const currentPrice = variants[0].price;
          if (currentPrice >= cap) continue; // already at cap

          // Compute new price based on sales tier
          let newPrice = currentPrice;
          const numSold = stat.num_sold ?? 0;
          if (numSold >= 30 && currentPrice < Math.floor(startPrice * 1.17)) {
            newPrice = Math.min(cap, Math.floor(currentPrice * 1.10));
          } else if (numSold >= 15 && currentPrice < Math.floor(startPrice * 1.08)) {
            newPrice = Math.min(cap, Math.floor(currentPrice * 1.09));
          } else if (numSold >= 5 && currentPrice < startPrice) {
            newPrice = Math.min(cap, Math.floor(currentPrice * 1.08));
          }

          if (newPrice <= currentPrice) continue; // no change warranted

          // Apply price update via Printify
          const updatedVariants = variants.map(v => ({ ...v, price: newPrice }));
          const patchRes = await fetch(
            `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${listing.printify_product_id}.json`,
            {
              method: "PUT",
              headers: pHeaders,
              body: JSON.stringify({ variants: updatedVariants }),
              signal: AbortSignal.timeout(10_000),
            }
          );

          if (patchRes.ok) {
            // Log to pod_price_history
            await sb.from("pod_price_history").insert({
              etsy_listing_id: stat.etsy_listing_id,
              old_price_cents: currentPrice,
              new_price_cents: newPrice,
              trigger: `sales_ratchet_${numSold}`,
              changed_at: new Date().toISOString(),
            });

            // Re-publish to sync price to Etsy
            await fetch(
              `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${listing.printify_product_id}/publish.json`,
              {
                method: "POST",
                headers: pHeaders,
                body: JSON.stringify({ variants: true }),
                signal: AbortSignal.timeout(10_000),
              }
            );

            priceRatchets++;
            log("Price ratchet applied", {
              listing: stat.etsy_listing_id,
              from: (currentPrice / 100).toFixed(2),
              to: (newPrice / 100).toFixed(2),
              numSold,
            });
            await new Promise(r => setTimeout(r, 2_000));
          }
        } catch (e) {
          log("Ratchet error", { listing: stat.etsy_listing_id, error: (e as Error).message.slice(0, 60) });
        }
      }
    }

    // ── Digital Price Ratchet: 20% bump at ≥5 sales (zero COGS = full margin capture) ──
    // Digital products have no base cost, so they get a more aggressive ratchet (vs 8% physical).
    // Cap: 2× original price_cents in pod_digital_products.
    let digitalRatchets = 0;
    try {
      const { data: digitalSold } = await sb
        .from("pod_listing_stats")
        .select("etsy_listing_id, num_sold")
        .gte("num_sold", 5)
        .limit(20);

      for (const stat of (digitalSold ?? [])) {
        try {
          const { data: dp } = await sb
            .from("pod_digital_products")
            .select("id, price_cents, etsy_listing_id")
            .eq("etsy_listing_id", stat.etsy_listing_id)
            .maybeSingle();
          if (!dp) continue; // Not a digital product — skip

          const { data: lastPrice } = await sb
            .from("pod_price_history")
            .select("new_price_cents")
            .eq("etsy_listing_id", stat.etsy_listing_id)
            .order("changed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const current = lastPrice?.new_price_cents ?? dp.price_cents;
          const cap = Math.floor(dp.price_cents * 2.0); // 2× original = max ceiling
          if (current >= cap) continue;

          const newPrice = Math.min(cap, Math.floor(current * 1.20));
          if (newPrice <= current) continue;

          await sb.from("pod_price_history").insert({
            etsy_listing_id: stat.etsy_listing_id,
            old_price_cents: current,
            new_price_cents: newPrice,
            trigger: `digital_ratchet_${stat.num_sold}`,
            changed_at: new Date().toISOString(),
          });
          digitalRatchets++;
          log("Digital price ratchet", {
            listing: stat.etsy_listing_id,
            from: (current / 100).toFixed(2),
            to: (newPrice / 100).toFixed(2),
            numSold: stat.num_sold,
          });
        } catch (e) {
          log("Digital ratchet error", { listing: stat.etsy_listing_id, error: (e as Error).message.slice(0, 60) });
        }
      }
    } catch (e) {
      log("Digital ratchet block error (non-fatal)", { error: (e as Error).message.slice(0, 60) });
    }

    // ── International Localization for Digital Listings ─────────────────────────
    // Generates DE/ES/FR marketplace metadata for digital-only products.
    // Processes up to 5 per run (~15s for AI calls). Skips already-localized.
    // Physical POD listings excluded — no international freight/VAT exposure.
    let localizationsGenerated = 0;
    try {
      const { data: unlocalized } = await sb
        .from("pod_digital_products")
        .select("id, etsy_listing_id, queue_id")
        .is("localized_metadata", null)
        .limit(5);

      for (const dp of (unlocalized ?? [])) {
        const { data: queueRow } = await sb
          .from("pod_product_queue")
          .select("name, description, tags")
          .eq("id", dp.queue_id)
          .maybeSingle();
        if (!queueRow) continue;

        const localized = await generateInternationalMetadata(
          queueRow.name,
          queueRow.description ?? "",
          queueRow.tags ?? [],
        );
        if (!localized) continue;

        await sb.from("pod_digital_products")
          .update({ localized_metadata: localized })
          .eq("id", dp.id);

        localizationsGenerated++;
        log("Localized digital listing", { id: dp.id, etsy: dp.etsy_listing_id });
      }
    } catch (e) {
      log("Localization block error (non-fatal)", { error: (e as Error).message.slice(0, 60) });
    }

    // ── Upgrade #9: Stats-Based Triage (identify underperformers and dead listings) ──
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentStats } = await sb
      .from("pod_listing_stats")
      .select("etsy_listing_id, views, favorites, conversion_rate")
      .gt("recorded_at", fourteenDaysAgo)
      .order("views", { ascending: false })
      .limit(200);

    let underperformers = 0;
    let deadListings = 0;
    if (recentStats && recentStats.length > 0) {
      const avgCTR = recentStats.reduce((sum, r) => sum + (r.conversion_rate ?? 0), 0) / recentStats.length;
      for (const r of recentStats) {
        if ((r.views ?? 0) < 10) deadListings++;
        else if ((r.conversion_rate ?? 0) < avgCTR * 0.5) underperformers++;
      }
      log("Stats triage", { avgCTR: avgCTR.toFixed(3), underperformers, deadListings });
      await sb.from("pod_agent_state").upsert({
        key: "seo_triage_summary",
        value: JSON.stringify({ avgCTR, underperformers, deadListings, analyzedAt: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    }

    // ── Regular SEO sweep ────────────────────────────────────────────────────
    const { data: stateRow } = await sb
      .from("pod_agent_state")
      .select("value")
      .eq("key", "seo_offset")
      .maybeSingle();

    const offset = parseInt(stateRow?.value ?? "0", 10) || 0;
    log("SEO sweep", { offset });

    // Phase 3b: hero-first — surface hero listing with lowest score so it
    // gets refreshed before the offset-based queue catches up to it.
    const { data: heroRow } = await sb
      .from("pod_product_queue")
      .select("etsy_listing_id")
      .eq("status", "published")
      .eq("is_hero", true)
      .order("listing_viability_score", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const updateRes = await fetch(`${SUPABASE_URL}/functions/v1/printify-product-creator`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        updateAll: true,
        offset,
        heroFirst: true,
        priorityListingId: heroRow?.etsy_listing_id ?? null,
      }),
      signal: AbortSignal.timeout(130_000),
    });

    const data = await updateRes.json().catch(() => ({}));
    log("updateAll response", data);

    const nextOffset: number | null = data.nextOffset ?? null;
    const newOffsetStr = nextOffset !== null ? String(nextOffset) : "0";
    await sb.from("pod_agent_state").upsert(
      { key: "seo_offset", value: newOffsetStr, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

    const sweepDone = nextOffset === null;
    if (sweepDone) log("Full sweep complete — resetting to offset 0");

    return new Response(JSON.stringify({
      success: true,
      ranAtOffset: offset,
      nextOffset: nextOffset ?? "reset (sweep complete)",
      updated: data.updated ?? 0,
      sweepComplete: sweepDone,
      priceRatchets,
      digitalRatchets,
      localizationsGenerated,
      statsTriageUnderperformers: underperformers,
      statsTriageDead: deadListings,
      priorityHeroListing: heroRow?.etsy_listing_id ?? null,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[POD-SEO-AGENT] Fatal:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
