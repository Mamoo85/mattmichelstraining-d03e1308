// Daily quarantine report. Runs quarantine_suspect_leads() then DMs Matt the count.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data, error } = await sb.rpc("quarantine_suspect_leads" as any);
    if (error) throw error;
    const count = Number(data ?? 0);

    // Audit log
    await (sb.from as any)("admin_decision_audit").insert({
      action_type: "quarantine_run",
      entity_type: "mortgage_radar_leads",
      details: { quarantined_count: count, run_at: new Date().toISOString() },
      actor: "cron:quarantine-daily-report",
    });

    return new Response(JSON.stringify({ ok: true, quarantined: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[quarantine-daily-report]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
