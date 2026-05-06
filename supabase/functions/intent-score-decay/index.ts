// Runs compute_lead_intent_score() across all live leads with intent decay.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Fetch active leads (skip quarantined)
    const { data: leads, error } = await (sb.from as any)("mortgage_radar_leads")
      .select("id")
      .neq("pipeline_stage", "quarantined")
      .limit(2000);
    if (error) throw error;

    let updated = 0;
    for (const row of (leads || [])) {
      const { error: e2 } = await sb.rpc("compute_lead_intent_score" as any, { p_lead_id: row.id });
      if (!e2) updated++;
    }

    return new Response(JSON.stringify({ ok: true, updated, total: leads?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[intent-score-decay]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
