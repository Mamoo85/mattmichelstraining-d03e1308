// Nightly cleanup — marks stale candidates so they fall out of the dashboard feed.
// Does NOT touch enrichment, scanning, or alerts. Pure status update.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

    // new → monitoring after 7 days
    const { count: monitoring } = await sb
      .from("hire_alert_candidates")
      .update({ status: "monitoring" }, { count: "exact" })
      .eq("status", "new")
      .lt("first_seen_at", sevenDaysAgo)
      .select("id", { count: "exact", head: true });

    // anything not hired and >30 days → stale
    const { count: stale } = await sb
      .from("hire_alert_candidates")
      .update({ status: "stale" }, { count: "exact" })
      .neq("status", "hired")
      .neq("status", "stale")
      .lt("first_seen_at", thirtyDaysAgo)
      .select("id", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        ok: true,
        marked_monitoring: monitoring || 0,
        marked_stale: stale || 0,
        ran_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e instanceof Error ? e.message : e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
