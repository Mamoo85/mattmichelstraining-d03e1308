// Refreshes marketplace_inventory_status from unified_lead_marketplace_view
// + sold counts from marketplace_lead_locks. Run via cron every 10 min.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERTICALS = ["mortgage", "talent", "demand", "supply", "growth"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: Record<string, unknown> = {};

  for (const vertical of VERTICALS) {
    try {
      const [{ count: avail }, { count: hot }, { count: sold24 }] = await Promise.all([
        sb.from("unified_lead_marketplace_view" as any)
          .select("id", { count: "exact", head: true })
          .eq("product", vertical),
        sb.from("unified_lead_marketplace_view" as any)
          .select("id", { count: "exact", head: true })
          .eq("product", vertical)
          .eq("signal_strength_tier", "hot"),
        sb.from("marketplace_lead_locks")
          .select("id", { count: "exact", head: true })
          .eq("product", vertical)
          .eq("status", "sold")
          .gte("updated_at", new Date(Date.now() - 86_400_000).toISOString()),
      ]);

      const available_count = avail || 0;
      // Read current threshold to preserve it
      const { data: cur } = await sb
        .from("marketplace_inventory_status")
        .select("min_visible_threshold")
        .eq("vertical", vertical)
        .maybeSingle();
      const threshold = cur?.min_visible_threshold ?? 10;

      await sb.from("marketplace_inventory_status").upsert({
        vertical,
        available_count,
        hot_count: hot || 0,
        sold_24h: sold24 || 0,
        is_visible: available_count >= threshold,
        last_refreshed_at: new Date().toISOString(),
      }, { onConflict: "vertical" });

      results[vertical] = { available_count, hot: hot || 0, sold_24h: sold24 || 0, visible: available_count >= threshold };
    } catch (e: any) {
      results[vertical] = { error: e?.message || String(e) };
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
