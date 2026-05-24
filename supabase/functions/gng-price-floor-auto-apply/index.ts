// Auto-raises Etsy listing prices to floor (cost*2.4 + $4.50). Safety: only raises (never lowers),
// max gap $3 per run, max 25 listings/run, logs every adjustment.
// Cron: daily 10am ET. Manual: POST { dry_run?, max_gap_cents?, max_listings? }.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FLOOR_MULT = 2.4;
const FLOOR_ADD_CENTS = 450;
const DEFAULT_MAX_GAP_CENTS = 300; // never auto-raise by more than $3
const DEFAULT_MAX_LISTINGS = 25;
const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run === true;
    const maxGap = Math.max(100, Math.min(Number(body.max_gap_cents ?? DEFAULT_MAX_GAP_CENTS), 1000));
    const maxListings = Math.min(Number(body.max_listings ?? DEFAULT_MAX_LISTINGS), 100);

    const { apiKey, accessToken, shopId } = await getEtsyAuth(sb);
    if (!shopId) throw new Error("shop_id_missing");

    const { data: printify, error } = await sb
      .from("printify_products")
      .select("etsy_listing_id, retail_cents, cost_cents, title")
      .not("etsy_listing_id", "is", null)
      .not("cost_cents", "is", null);
    if (error) throw error;

    const candidates: Array<{ listing_id: number; old: number; floor: number; cost: number; title: string }> = [];
    for (const p of printify ?? []) {
      const current = p.retail_cents ?? 0;
      const cost = p.cost_cents ?? 0;
      if (!current || !cost) continue;
      const floor = Math.round(cost * FLOOR_MULT) + FLOOR_ADD_CENTS;
      if (current >= floor) continue;
      const gap = floor - current;
      if (gap < 100) continue; // skip sub-$1 raises
      if (gap > maxGap) continue; // require Lisa approval for big jumps (skip silently here)
      candidates.push({ listing_id: p.etsy_listing_id, old: current, floor, cost, title: p.title ?? "" });
    }

    // Sort by smallest gap first (lowest-risk wins) and cap
    candidates.sort((a, b) => (a.floor - a.old) - (b.floor - b.old));
    const batch = candidates.slice(0, maxListings);

    let applied = 0;
    const results: any[] = [];

    for (const c of batch) {
      const newPriceUsd = (c.floor / 100).toFixed(2);
      const logRow = {
        listing_id: c.listing_id,
        old_price_cents: c.old,
        new_price_cents: c.floor,
        cost_cents: c.cost,
        reason: `auto_floor cost=${(c.cost / 100).toFixed(2)} mult=${FLOOR_MULT} add=$${FLOOR_ADD_CENTS / 100}`,
      };

      if (dryRun) {
        await sb.from("gng_price_auto_adjustments").insert({ ...logRow, applied: false });
        results.push({ ...c, action: "dry_run", new_price_usd: newPriceUsd });
        continue;
      }

      try {
        const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${c.listing_id}`;
        const formBody = new URLSearchParams({ price: newPriceUsd });
        const r = await fetch(url, {
          method: "PATCH",
          headers: {
            "x-api-key": apiKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formBody.toString(),
        });
        if (!r.ok) {
          const t = await r.text();
          await sb.from("gng_price_auto_adjustments").insert({ ...logRow, applied: false, apply_error: `etsy_${r.status}: ${t.slice(0, 200)}` });
          results.push({ ...c, action: "error", error: `etsy_${r.status}` });
          continue;
        }
        // Update printify_products mirror to new price
        await sb.from("printify_products").update({ retail_cents: c.floor }).eq("etsy_listing_id", c.listing_id);
        await sb.from("gng_price_auto_adjustments").insert({ ...logRow, applied: true });
        applied++;
        results.push({ ...c, action: "applied", new_price_usd: newPriceUsd });
        await SLEEP(400);
      } catch (e) {
        await sb.from("gng_price_auto_adjustments").insert({ ...logRow, applied: false, apply_error: (e as Error).message.slice(0, 200) });
        results.push({ ...c, action: "exception", error: (e as Error).message.slice(0, 150) });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      candidates: candidates.length,
      batch_size: batch.length,
      applied,
      dry_run: dryRun,
      max_gap_cents: maxGap,
      results: results.slice(0, 30),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
