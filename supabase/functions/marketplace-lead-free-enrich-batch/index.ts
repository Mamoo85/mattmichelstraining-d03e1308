// Batch wrapper: hourly cron picks up to 100 unenriched mortgage_radar_leads
// and fans out to marketplace-lead-free-enrich one at a time.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: leads } = await sb
    .from("mortgage_radar_leads")
    .select("id")
    .is("free_enrich_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!leads?.length) {
    return new Response(JSON.stringify({ ok: true, enriched: 0 }), { status: 200 });
  }

  let ok = 0;
  for (const l of leads) {
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
    } catch (e) {
      console.error("[FREE-ENRICH-BATCH]", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, enriched: ok, attempted: leads.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
