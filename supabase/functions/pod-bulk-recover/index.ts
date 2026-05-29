// pod-bulk-recover — Disaster Recovery from Shop State Snapshot (#20)
// On-demand (no cron) — triggered manually or by pod-listing-health-check on bulk removal
//
// Reads the latest pod_listing_snapshots to find listings missing from pod_listings,
// re-queues them in pod_product_queue for automatic recreation.
// Body: { "maxRecover": 50 } — optional limit on how many to re-queue at once
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[BULK-RECOVER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

type ProductType = "mug" | "tshirt" | "hoodie" | "sock" | "hat" | "mousepad" | "onesie" | "tumbler" | "blanket" | "sweatshirt" | "longsleeve" | "travelmug";

const FINAL_PRICES: Record<ProductType, number> = {
  mug: 2199, tshirt: 2699, hoodie: 4499, sock: 1899, hat: 3299, mousepad: 1999,
  onesie: 2499, tumbler: 3999, blanket: 6499, sweatshirt: 4999, longsleeve: 3499, travelmug: 3499,
};

function detectTypeFromTitle(title: string): ProductType {
  const t = title.toLowerCase();
  if (/\btumbler\b|20oz/.test(t)) return "tumbler";
  if (/\bblanket\b|\bsherpa\b/.test(t)) return "blanket";
  if (/\bsweatshirt\b|\bcrewneck\b/.test(t)) return "sweatshirt";
  if (/long sleeve|longsleeve/.test(t)) return "longsleeve";
  if (/travel mug/.test(t)) return "travelmug";
  if (/\bmug\b|coffee mug/.test(t)) return "mug";
  if (/\bhoodie\b/.test(t)) return "hoodie";
  if (/\bsock\b/.test(t)) return "sock";
  if (/\bhat\b|\bcap\b/.test(t)) return "hat";
  if (/mousepad/.test(t)) return "mousepad";
  if (/\bonesie\b|\bbaby\b/.test(t)) return "onesie";
  return "tshirt";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let maxRecover = 50;
  let dryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.maxRecover === "number") maxRecover = Math.min(body.maxRecover, 200);
    if (body.dryRun === true) dryRun = true;
  } catch { /* no body */ }

  // Get the most recent snapshot date
  const { data: latestSnapshot } = await sb
    .from("pod_listing_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSnapshot) {
    return new Response(JSON.stringify({ error: "No snapshots found — run store-audit-agent first" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const snapshotDate = latestSnapshot.snapshot_date;
  log("Using snapshot", { date: snapshotDate });

  // Get all listings from latest snapshot
  const { data: snapshots } = await sb
    .from("pod_listing_snapshots")
    .select("etsy_listing_id, title, description, tags, price_cents")
    .eq("snapshot_date", snapshotDate)
    .limit(500);

  if (!snapshots || snapshots.length === 0) {
    return new Response(JSON.stringify({ error: "Snapshot is empty" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Find which listings are currently active (published) in pod_listings
  const { data: activeLisingIds } = await sb
    .from("pod_listings")
    .select("etsy_listing_id")
    .eq("status", "published");

  const activeSet = new Set((activeLisingIds ?? []).map(r => r.etsy_listing_id));

  // Find listings in snapshot but not currently active
  const missing = snapshots.filter(s => !activeSet.has(s.etsy_listing_id));

  log("Missing listings found", { total: snapshots.length, active: activeSet.size, missing: missing.length });

  if (missing.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      message: "No missing listings — shop matches snapshot",
      snapshotDate,
      snapshotSize: snapshots.length,
      activeListings: activeSet.size,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (dryRun) {
    return new Response(JSON.stringify({
      success: true,
      dryRun: true,
      snapshotDate,
      missing: missing.length,
      wouldRequeue: Math.min(missing.length, maxRecover),
      sample: missing.slice(0, 10).map(m => m.title.slice(0, 60)),
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let requeued = 0;
  const requeuedTitles: string[] = [];

  for (const listing of missing.slice(0, maxRecover)) {
    try {
      const type = detectTypeFromTitle(listing.title);
      const price = listing.price_cents || FINAL_PRICES[type];

      const { error } = await sb.from("pod_product_queue").insert({
        name: listing.title.slice(0, 140),
        product_type: type,
        image_prompt: `Recreate this POD design: ${listing.title.slice(0, 100)}. Original description: ${(listing.description ?? "").slice(0, 100)}`,
        description: listing.description?.slice(0, 500) ?? `Recovered listing: ${listing.title}`,
        tags: listing.tags ?? [],
        retail_price: price,
        status: "pending",
        source: "disaster_recovery",
      });

      if (!error) {
        requeued++;
        requeuedTitles.push(listing.title.slice(0, 50));
      }
    } catch (err) {
      log("Re-queue error", { title: listing.title.slice(0, 40), error: String(err).slice(0, 80) });
    }
  }

  log("Recovery complete", { requeued, total: missing.length });

  return new Response(JSON.stringify({
    success: true,
    snapshotDate,
    totalMissing: missing.length,
    requeued,
    requeuedTitles: requeuedTitles.slice(0, 20),
    remaining: Math.max(0, missing.length - requeued),
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
