// Drains the mortgage_radar_enrich_queue every 10 min — calls mortgage-radar-enrich
// for up to 5 pending leads per run. Inline scanner enrich handles the first 5 leads
// of each scan; everything else lands here.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: jobs } = await (sb.from as any)("mortgage_radar_enrich_queue")
    .select("id, lead_id, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  let processed = 0;
  let failed = 0;

  for (const job of (jobs || [])) {
    try {
      // Mark in-flight
      await (sb.from as any)("mortgage_radar_enrich_queue")
        .update({ status: "running", attempts: (job.attempts || 0) + 1 })
        .eq("id", job.id);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/mortgage-radar-enrich`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: job.lead_id }),
      });

      if (!res.ok) throw new Error(`enrich returned ${res.status}`);

      await (sb.from as any)("mortgage_radar_enrich_queue")
        .update({ status: "done", processed_at: new Date().toISOString() })
        .eq("id", job.id);
      processed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const newStatus = (job.attempts || 0) >= 2 ? "failed" : "pending";
      await (sb.from as any)("mortgage_radar_enrich_queue")
        .update({ status: newStatus, last_error: msg })
        .eq("id", job.id);
      failed += 1;
    }
  }

  await sb.from("agent_heartbeats").upsert({
    agent_name: "mortgage-radar-enrich-drain",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: { processed, failed, queued: jobs?.length || 0 },
  }, { onConflict: "agent_name" });

  return new Response(JSON.stringify({ ok: true, processed, failed, queued: jobs?.length || 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
