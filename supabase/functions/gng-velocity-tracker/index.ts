// Daily snapshot of view/favorer counts pulled from etsy_products.raw, then computes 7d momentum
// and flags hot SKUs (favorers_delta_7d >= 5) into gng_inventory_alerts.
// Cron: daily 16:00 UTC (after etsy-product-sync runs at every-6h).
// Manual: POST { hot_threshold? } (default 5).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const hotThreshold = Math.max(1, Number(body.hot_threshold ?? 5));
    const today = new Date().toISOString().slice(0, 10);

    const { data: listings, error } = await sb
      .from("etsy_products")
      .select("listing_id, price_cents, quantity, raw")
      .eq("state", "active");
    if (error) throw error;

    let snapped = 0;
    const rows: any[] = [];
    for (const l of listings ?? []) {
      const raw = (l.raw ?? {}) as any;
      const views = Number(raw.views ?? 0);
      const fav = Number(raw.num_favorers ?? 0);
      rows.push({
        listing_id: l.listing_id,
        snapshot_date: today,
        views,
        num_favorers: fav,
        quantity: l.quantity ?? null,
        price_cents: l.price_cents ?? null,
      });
    }
    // Upsert (unique on listing_id+snapshot_date)
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error: upErr } = await sb.from("gng_velocity_snapshots").upsert(chunk, { onConflict: "listing_id,snapshot_date" });
      if (!upErr) snapped += chunk.length;
    }

    // Find 7-day-ago baseline for momentum
    const since = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
    const { data: baselines } = await sb
      .from("gng_velocity_snapshots")
      .select("listing_id, num_favorers, views, snapshot_date")
      .lte("snapshot_date", since)
      .order("snapshot_date", { ascending: false })
      .limit(5000);

    const baseByListing = new Map<number, { fav: number; views: number }>();
    for (const b of baselines ?? []) {
      if (!baseByListing.has(b.listing_id)) {
        baseByListing.set(b.listing_id, { fav: b.num_favorers ?? 0, views: b.views ?? 0 });
      }
    }

    const alerts: any[] = [];
    for (const r of rows) {
      const base = baseByListing.get(r.listing_id);
      if (!base) continue;
      const favDelta = (r.num_favorers ?? 0) - base.fav;
      const viewDelta = (r.views ?? 0) - base.views;
      if (favDelta >= hotThreshold) {
        alerts.push({
          listing_id: r.listing_id,
          alert_type: "hot_sku_momentum",
          signal: `+${favDelta} favorers / +${viewDelta} views in 7d`,
          views_7d: viewDelta,
          favorers_delta_7d: favDelta,
        });
      }
    }

    // Skip duplicates: only insert if no open alert for same listing in last 7d
    let inserted = 0;
    for (const a of alerts) {
      const { data: existing } = await sb
        .from("gng_inventory_alerts")
        .select("id")
        .eq("listing_id", a.listing_id)
        .eq("acknowledged", false)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(1);
      if (!existing || existing.length === 0) {
        const { error: insErr } = await sb.from("gng_inventory_alerts").insert(a);
        if (!insErr) inserted++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      snapped,
      candidates: alerts.length,
      alerts_inserted: inserted,
      hot_threshold: hotThreshold,
      sample_alerts: alerts.slice(0, 10),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
