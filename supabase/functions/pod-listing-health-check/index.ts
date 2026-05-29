// pod-listing-health-check — Etsy listing removal detector + auto-recovery (#18)
// Cron: daily 6am UTC (first cron to run — before all production crons)
//
// Detects silently removed Etsy listings (policy violations, DMCA, quality flags).
// Auto-re-queues removed listings in pod_product_queue with source='recovery'.
// If >10 removals in one day, it's a bulk removal signal — alerts via pod_agent_state.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-HEALTH-CHECK] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (!ETSY_API_KEY) {
    return new Response(JSON.stringify({ error: "ETSY_API_KEY not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Load published pod_listings — cap at 75 to stay within Etsy daily rate limit
  const { data: listings } = await sb
    .from("pod_listings")
    .select("id, etsy_listing_id, title, printify_product_id")
    .eq("status", "published")
    .not("etsy_listing_id", "is", null)
    .limit(75);

  if (!listings || listings.length === 0) {
    return new Response(JSON.stringify({ success: true, message: "No listings to check", removed: 0 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log("Checking listings", { count: listings.length });

  const removed: Array<{ etsy_listing_id: string; title: string; printify_product_id?: string }> = [];
  const errors: string[] = [];

  // Check in batches of 25 (Etsy supports batch listing lookup)
  for (let i = 0; i < listings.length; i += 25) {
    const batch = listings.slice(i, i + 25);
    const listingIds = batch.map(l => l.etsy_listing_id).join(",");

    try {
      const res = await fetch(
        `https://openapi.etsy.com/v3/application/listings/batch?listing_ids=${listingIds}`,
        {
          headers: { "x-api-key": ETSY_API_KEY },
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (!res.ok) {
        // If batch endpoint fails, check individually
        for (const listing of batch) {
          try {
            const singleRes = await fetch(
              `https://openapi.etsy.com/v3/application/listings/${listing.etsy_listing_id}`,
              { headers: { "x-api-key": ETSY_API_KEY }, signal: AbortSignal.timeout(8_000) }
            );
            if (singleRes.status === 404) {
              removed.push({ etsy_listing_id: listing.etsy_listing_id, title: listing.title, printify_product_id: listing.printify_product_id });
            } else if (singleRes.ok) {
              const detail = await singleRes.json();
              if (detail.state && detail.state !== "active") {
                removed.push({ etsy_listing_id: listing.etsy_listing_id, title: listing.title, printify_product_id: listing.printify_product_id });
              }
            }
          } catch { /* best effort */ }
          await new Promise(r => setTimeout(r, 200));
        }
        continue;
      }

      const batchData = await res.json();
      const activeIds = new Set<string>(
        (batchData.results ?? [])
          .filter((l: { state?: string }) => l.state === "active")
          .map((l: { listing_id?: number }) => String(l.listing_id))
      );

      for (const listing of batch) {
        if (!activeIds.has(listing.etsy_listing_id)) {
          removed.push({
            etsy_listing_id: listing.etsy_listing_id,
            title: listing.title,
            printify_product_id: listing.printify_product_id,
          });
        }
      }

      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      errors.push(`Batch check error: ${String(err).slice(0, 100)}`);
    }
  }

  log("Removals detected", { count: removed.length });

  // Process each removal: mark in pod_listings, insert to pod_removed_listings, re-queue
  let requeued = 0;
  for (const item of removed) {
    try {
      // Mark listing as removed
      await sb.from("pod_listings")
        .update({ status: "removed" })
        .eq("etsy_listing_id", item.etsy_listing_id);

      // Insert to removed listings log
      const { data: removedRow } = await sb.from("pod_removed_listings").insert({
        etsy_listing_id: item.etsy_listing_id,
        printify_product_id: item.printify_product_id ?? null,
        title: item.title,
        removed_at: new Date().toISOString(),
      }).select("id").maybeSingle();

      // Re-queue for automatic recreation
      const { data: queueRow } = await sb.from("pod_product_queue").insert({
        name: item.title.slice(0, 140),
        product_type: "mug", // will be detected from title; safest default
        image_prompt: `Recreate this product design: ${item.title.slice(0, 100)}`,
        description: `Recovery of removed Etsy listing. Original: "${item.title.slice(0, 80)}"`,
        tags: [],
        retail_price: 2199,
        status: "pending",
        source: "recovery",
      }).select("id").maybeSingle();

      // Link recovery queue row to removed listing record
      if (removedRow?.id && queueRow?.id) {
        await sb.from("pod_removed_listings")
          .update({ recovery_queue_id: queueRow.id })
          .eq("id", removedRow.id);
      }

      requeued++;
      log("Re-queued removed listing", { title: item.title.slice(0, 40) });
    } catch (err) {
      errors.push(`Re-queue error for ${item.etsy_listing_id}: ${String(err).slice(0, 80)}`);
    }
  }

  // Alert via pod_agent_state if bulk removal detected
  if (removed.length > 10) {
    await sb.from("pod_agent_state").upsert({
      key: "bulk_removal_alert",
      value: JSON.stringify({
        count: removed.length,
        date: new Date().toISOString(),
        titles: removed.slice(0, 5).map(r => r.title.slice(0, 40)),
      }),
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    log("BULK REMOVAL ALERT set", { count: removed.length });
  }

  return new Response(JSON.stringify({
    success: true,
    checked: listings.length,
    removed: removed.length,
    requeued,
    bulkAlert: removed.length > 10,
    errors: errors.slice(0, 5),
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
