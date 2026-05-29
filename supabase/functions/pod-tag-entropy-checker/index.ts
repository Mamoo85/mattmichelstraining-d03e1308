// pod-tag-entropy-checker — Shop-Wide Tag Entropy Monitor (#12)
// Cron: weekly Sunday 8am UTC
//
// Prevents keyword cannibalization: when >25% of listings use the same tag,
// the shop "competes with itself" in Etsy search ranking.
// Identifies oversaturated tags, replaces them with unused bench tags stored
// in pod_agent_state by the optimizeListing() function.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[TAG-ENTROPY] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Fetch all published listings with their tags from pod_product_queue
  // (queue stores the tags we originally submitted — good proxy for live tags)
  const { data: queueRows } = await sb
    .from("pod_product_queue")
    .select("name, tags, printify_id, product_type")
    .eq("status", "published")
    .not("tags", "eq", "{}")
    .limit(300);

  if (!queueRows || queueRows.length === 0) {
    return new Response(JSON.stringify({ success: true, message: "No listings with tags found", changes: 0 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const totalListings = queueRows.length;
  log("Analyzing tags", { listings: totalListings });

  // Count tag frequency across all listings
  const tagCounts: Record<string, number> = {};
  for (const row of queueRows) {
    for (const tag of (row.tags ?? [])) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  // Upsert tag registry for monitoring
  for (const [tag, count] of Object.entries(tagCounts)) {
    await sb.from("pod_tag_registry").upsert({
      tag,
      listing_count: count,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: "tag" });
  }

  // Identify oversaturated tags (>25% of listings)
  const oversaturationThreshold = Math.floor(totalListings * 0.25);
  const oversaturated = Object.entries(tagCounts)
    .filter(([, count]) => count > oversaturationThreshold)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  log("Oversaturated tags", { count: oversaturated.length, threshold: oversaturationThreshold, tags: oversaturated.slice(0, 5) });

  if (oversaturated.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      totalListings,
      uniqueTags: Object.keys(tagCounts).length,
      oversaturated: 0,
      changes: 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // For each listing with an oversaturated tag, try to replace it with a bench tag
  // Bench tags stored in pod_agent_state as JSON array under key "{listing_name_hash}_tag_bench"
  let changes = 0;
  let noReplacements = 0;

  // Load all bench keys to avoid N+1 queries
  const { data: benchRows } = await sb
    .from("pod_agent_state")
    .select("key, value")
    .like("key", "%_tag_bench");

  const benchMap: Record<string, string[]> = {};
  for (const row of (benchRows ?? [])) {
    try {
      benchMap[row.key] = JSON.parse(row.value);
    } catch { /* ignore */ }
  }

  // Process listings that have oversaturated tags (limit to 20 Etsy API calls)
  const toProcess = queueRows
    .filter(row => (row.tags ?? []).some((t: string) => oversaturated.includes(t)))
    .slice(0, 20);

  for (const row of toProcess) {
    const currentTags: string[] = row.tags ?? [];
    const oversaturatedInListing = currentTags.filter(t => oversaturated.includes(t));

    if (oversaturatedInListing.length === 0) continue;

    // Find bench tags for this listing
    const nameHash = row.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    const benchKey = `${nameHash}_tag_bench`;
    const benchTags: string[] = benchMap[benchKey] ?? [];

    if (benchTags.length === 0) {
      noReplacements++;
      continue;
    }

    // Build new tags: replace oversaturated ones with bench alternatives
    const usedBench = new Set(currentTags);
    const newTags = [...currentTags];

    for (const over of oversaturatedInListing) {
      // Find the first bench tag not already in use
      const replacement = benchTags.find(b => !usedBench.has(b) && !oversaturated.includes(b));
      if (!replacement) continue;

      const idx = newTags.indexOf(over);
      if (idx !== -1) {
        newTags[idx] = replacement;
        usedBench.add(replacement);
        log("Tag replaced", {
          listing: row.name.slice(0, 40),
          from: over,
          to: replacement,
        });
      }
    }

    if (JSON.stringify(newTags) === JSON.stringify(currentTags)) continue;

    // Update pod_product_queue with new tags
    await sb.from("pod_product_queue")
      .update({ tags: newTags })
      .eq("name", row.name);

    changes++;

    // Note: To propagate to live Etsy listings, pod-seo-agent's next sweep will
    // pick up the updated tags from pod_product_queue during optimizeListing calls.
    // Direct Etsy API tag patches would require OAuth access + listing ID lookup.
  }

  // Compute tag diversity score (unique tags / total tag slots)
  const totalTagSlots = queueRows.reduce((sum, r) => sum + (r.tags?.length ?? 0), 0);
  const uniqueTagCount = Object.keys(tagCounts).length;
  const diversityScore = totalTagSlots > 0 ? (uniqueTagCount / totalTagSlots).toFixed(3) : "0";

  log("Done", { changes, noReplacements, diversityScore });

  return new Response(JSON.stringify({
    success: true,
    totalListings,
    uniqueTags: uniqueTagCount,
    oversaturatedTags: oversaturated.slice(0, 10),
    changes,
    noReplacementsAvailable: noReplacements,
    tagDiversityScore: diversityScore,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
