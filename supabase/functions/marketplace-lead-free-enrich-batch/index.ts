// Batch wrapper: hourly cron picks up to 100 unenriched leads across all product types
// and fans out to marketplace-lead-free-enrich one at a time.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Pull unenriched leads from all three source tables
  // mortgage uses free_enrich_at; talent+pulse use human_summary (null = not yet summarized)
  const [mortgageRes, talentRes, pulseRes] = await Promise.all([
    sb.from("mortgage_radar_leads").select("id").is("free_enrich_at", null)
      .order("created_at", { ascending: false }).limit(34),
    sb.from("hire_alert_candidates").select("id").is("human_summary", null)
      .order("created_at", { ascending: false }).limit(33),
    sb.from("industry_pulse_signals").select("id").is("human_summary", null)
      .order("created_at", { ascending: false }).limit(33),
  ]);

  const leads = [
    ...(mortgageRes.data || []),
    ...(talentRes.data || []),
    ...(pulseRes.data || []),
  ];

  if (!leads.length) {
    return new Response(JSON.stringify({ ok: true, enriched: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let ok = 0;
  const deadline = Date.now() + 110_000; // 110s budget — stay under 150s idle timeout
  for (const l of leads) {
    if (Date.now() > deadline) break;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/marketplace-lead-free-enrich`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ lead_id: l.id }),
      });
      if (res.ok) ok++;
      // Chain gov-enrich fire-and-forget
      fetch(`${SUPABASE_URL}/functions/v1/marketplace-lead-gov-enrich`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ lead_id: l.id }),
      }).catch((e) => console.error("[GOV-ENRICH chain]", e));
    } catch (e) {
      console.error("[FREE-ENRICH-BATCH]", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, enriched: ok, attempted: leads.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
