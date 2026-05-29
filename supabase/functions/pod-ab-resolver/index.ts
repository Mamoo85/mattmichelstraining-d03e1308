// pod-ab-resolver — A/B Image Variant + Title Variant resolver (#6, #11)
// Cron: bi-weekly Tuesday 9am UTC
//
// Resolves A/B tests for:
//   1. Image variants: compares Etsy CTR (views→favorites) for listings with 2 images.
//      Reorders Printify product images to put winner first if B outperforms A.
//   2. Title variants: after 14 days, if current title is below shop avg CTR,
//      rotates to the next variant title. Locks the winner after all 3 variants tested.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[AB-RESOLVER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY");
  const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN");
  const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const results = { titleRotations: 0, imageSwaps: 0, titleLocks: 0, errors: [] as string[] };

  // ── A: Title Variant Rotation (#11) ───────────────────────────────────────
  // Find listings with active variants that have been running ≥14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: activeVariants } = await sb
    .from("pod_listing_variants")
    .select("id, etsy_listing_id, variant_index, title, activated_at")
    .eq("is_active", true)
    .lt("activated_at", fourteenDaysAgo)
    .limit(20);

  for (const variant of (activeVariants ?? [])) {
    try {
      // Get recent stats for this listing
      const { data: recentStats } = await sb
        .from("pod_listing_stats")
        .select("views, favorites, conversion_rate")
        .eq("etsy_listing_id", variant.etsy_listing_id)
        .order("recorded_at", { ascending: false })
        .limit(5);

      // Compute shop average CTR for comparison
      const { data: shopAvgData } = await sb
        .from("pod_listing_stats")
        .select("conversion_rate")
        .gt("views", 10)
        .order("recorded_at", { ascending: false })
        .limit(100);

      const shopAvgCTR = shopAvgData && shopAvgData.length > 0
        ? shopAvgData.reduce((sum, r) => sum + (r.conversion_rate ?? 0), 0) / shopAvgData.length
        : 1.0;

      const currentCTR = recentStats && recentStats.length > 0
        ? recentStats.reduce((sum, r) => sum + (r.conversion_rate ?? 0), 0) / recentStats.length
        : 0;

      // Check if all 3 variants have been tested
      const { data: allVariants } = await sb
        .from("pod_listing_variants")
        .select("id, variant_index, views_during_period, is_active, activated_at")
        .eq("etsy_listing_id", variant.etsy_listing_id)
        .order("variant_index", { ascending: true });

      const testedVariants = (allVariants ?? []).filter(v => v.activated_at !== null);

      if (testedVariants.length === 3) {
        // All variants tested — lock the winner (highest views_during_period)
        const winner = testedVariants.reduce((best, v) =>
          (v.views_during_period ?? 0) > (best.views_during_period ?? 0) ? v : best
        );

        // Mark all variants inactive except the winner
        for (const v of (allVariants ?? [])) {
          await sb.from("pod_listing_variants")
            .update({ is_active: v.id === winner.id })
            .eq("id", v.id);
        }

        results.titleLocks++;
        log("Title variant locked", { listing: variant.etsy_listing_id, winner: winner.variant_index });
        continue;
      }

      // Store views during this period on the current variant
      const totalViews = (recentStats ?? []).reduce((sum, r) => sum + (r.views ?? 0), 0);
      await sb.from("pod_listing_variants")
        .update({ views_during_period: totalViews })
        .eq("id", variant.id);

      // If current CTR is below shop average, rotate to next variant
      if (currentCTR < shopAvgCTR * 0.8) {
        const nextIndex = (variant.variant_index + 1) % 3;
        const { data: nextVariant } = await sb
          .from("pod_listing_variants")
          .select("id, title")
          .eq("etsy_listing_id", variant.etsy_listing_id)
          .eq("variant_index", nextIndex)
          .maybeSingle();

        if (nextVariant) {
          // Deactivate current, activate next
          await sb.from("pod_listing_variants").update({ is_active: false }).eq("id", variant.id);
          await sb.from("pod_listing_variants").update({
            is_active: true,
            activated_at: new Date().toISOString(),
          }).eq("id", nextVariant.id);

          results.titleRotations++;
          log("Title variant rotated", {
            listing: variant.etsy_listing_id,
            from: variant.variant_index,
            to: nextIndex,
            currentCTR: currentCTR.toFixed(2),
            shopAvg: shopAvgCTR.toFixed(2),
          });
        }
      }
    } catch (err) {
      results.errors.push(`Title AB error for ${variant.etsy_listing_id}: ${String(err).slice(0, 80)}`);
    }
  }

  // ── B: Image Variant Swap (#6) ─────────────────────────────────────────────
  if (PRINTIFY_KEY && PRINTIFY_SHOP_ID) {
    // Find listings with 2 image variants where variant B has more views than A
    const { data: imageVariants } = await sb
      .from("pod_image_variants")
      .select("id, queue_id, variant_index, printify_image_id, is_active")
      .not("printify_image_id", "is", null)
      .limit(40);

    // Group by queue_id
    const byQueue: Record<string, typeof imageVariants> = {};
    for (const v of (imageVariants ?? [])) {
      if (!byQueue[String(v.queue_id)]) byQueue[String(v.queue_id)] = [];
      byQueue[String(v.queue_id)]!.push(v);
    }

    for (const [queueId, variants] of Object.entries(byQueue)) {
      if (!variants || variants.length < 2) continue;

      try {
        // Get the pod_product_queue row for printify_id
        const { data: queueRow } = await sb
          .from("pod_product_queue")
          .select("printify_id, name")
          .eq("id", parseInt(queueId, 10))
          .maybeSingle();

        if (!queueRow?.printify_id) continue;

        // Get listing stats to compare performance across variants
        // We look at stats from pods_listings joined via printify_id
        const { data: listingRow } = await sb
          .from("pod_listings")
          .select("etsy_listing_id")
          .eq("printify_product_id", queueRow.printify_id)
          .maybeSingle();

        if (!listingRow?.etsy_listing_id) continue;

        // Get the most recent stats for this listing
        const { data: stats } = await sb
          .from("pod_listing_stats")
          .select("views, favorites, recorded_at")
          .eq("etsy_listing_id", listingRow.etsy_listing_id)
          .order("recorded_at", { ascending: false })
          .limit(14);

        if (!stats || stats.length < 3) continue; // need at least 3 data points

        // Simple heuristic: if CTR has been improving over last 14 days while B is active, keep B
        // If B variant is active and CTR is below median, try A
        const variantA = variants.find(v => v.variant_index === 0);
        const variantB = variants.find(v => v.variant_index === 1);
        if (!variantA || !variantB) continue;

        const activeVariant = variants.find(v => v.is_active);
        if (!activeVariant || activeVariant.variant_index !== 0) continue; // Only swap A→B once

        // Check if we should try variant B (B is not yet active)
        const favRate = stats.reduce((sum, s) => sum + (s.favorites ?? 0), 0) /
          Math.max(1, stats.reduce((sum, s) => sum + (s.views ?? 0), 0));

        // If favoriting rate is below 2%, try variant B by reordering Printify images
        if (favRate < 0.02 && variantB.printify_image_id) {
          const pHeaders = {
            Authorization: `Bearer ${PRINTIFY_KEY}`,
            "Content-Type": "application/json",
          };

          // Get current product images
          const prodRes = await fetch(
            `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${queueRow.printify_id}.json`,
            { headers: pHeaders, signal: AbortSignal.timeout(10_000) }
          );

          if (prodRes.ok) {
            const prod = await prodRes.json();
            const images: Array<{ id: string; position: number; is_default: boolean }> = prod.images ?? [];

            // Reorder: put variant B image first
            const bImage = images.find(img => img.id === variantB.printify_image_id);
            if (bImage) {
              const reordered = [
                { ...bImage, is_default: true, position: 0 },
                ...images.filter(img => img.id !== variantB.printify_image_id)
                  .map((img, i) => ({ ...img, position: i + 1 })),
              ];

              await fetch(
                `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${queueRow.printify_id}.json`,
                {
                  method: "PUT",
                  headers: pHeaders,
                  body: JSON.stringify({ images: reordered }),
                  signal: AbortSignal.timeout(15_000),
                }
              );

              // Update variant active state
              await sb.from("pod_image_variants").update({ is_active: false }).eq("id", variantA.id);
              await sb.from("pod_image_variants").update({ is_active: true }).eq("id", variantB.id);

              results.imageSwaps++;
              log("Image variant swapped to B", { product: queueRow.name.slice(0, 40), favRate: favRate.toFixed(3) });
            }
          }
        }
      } catch (err) {
        results.errors.push(`Image AB error for queue ${queueId}: ${String(err).slice(0, 80)}`);
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    ...results,
    errors: results.errors.slice(0, 5),
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
