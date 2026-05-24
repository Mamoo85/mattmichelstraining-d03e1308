// Flags Etsy listings that haven't been updated in 90+ days (likely dead SKUs).
// Read-only: writes to gng_dead_sku_log for Matt to review. Never deactivates anything.
// Cron: weekly Mon 13:30 UTC. Manual: POST {}.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const cutoffSec = Math.floor(Date.now() / 1000) - 90 * 86400;

    const { data: listings, error } = await sb
      .from("etsy_products")
      .select("listing_id,title,url,etsy_updated_ts,etsy_created_ts,price_cents")
      .eq("state", "active");
    if (error) throw error;

    const dead = (listings ?? []).filter((l: any) => {
      const upd = Number(l.etsy_updated_ts ?? l.etsy_created_ts ?? 0);
      return upd > 0 && upd < cutoffSec;
    });

    if (dead.length) {
      const rows = dead.map((l: any) => ({
        listing_id: l.listing_id,
        title: l.title,
        url: l.url,
        last_updated_ts: l.etsy_updated_ts ?? l.etsy_created_ts,
        price_cents: l.price_cents,
        flagged_reason: "stale_90d",
      }));
      await sb.from("gng_dead_sku_log").upsert(rows, { onConflict: "listing_id,flagged_reason" });
    }

    return new Response(
      JSON.stringify({ ok: true, total_active: listings?.length ?? 0, flagged: dead.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
