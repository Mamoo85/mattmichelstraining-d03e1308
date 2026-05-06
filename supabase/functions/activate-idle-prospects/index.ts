// activate-idle-prospects — Flip eligible prospects from new_lead to outreach_sent
// so the existing web-design-drip cron picks them up tomorrow.
// Eligibility: has email, not yet contacted, industry maps to a landing page (or default).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mirrors web-design-drip INDUSTRY_PAGE_MAP keys (substring match)
const MAPPED_INDUSTRY_KEYS = [
  "dentist","orthodontist","law firm","attorney","personal injury",
  "physical therapy","chiropractic","urgent care","accounting","insurance",
  "veterinary","restaurant","bar and grill","pizza","manufacturing","machine shop",
  "fabrication","metal","real estate","mortgage","roof","plumb","electric","hvac",
  "landscape","contractor","deck","auto repair","home inspect","septic","tree",
  "appliance","medical spa","financial advisor",
];

function industryHasMappedPage(industry: string | null): boolean {
  if (!industry) return true; // default page applies
  const l = industry.toLowerCase();
  return MAPPED_INDUSTRY_KEYS.some((k) => l.includes(k)) || true; // default catches everything
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Admin auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims } = await userClient.auth.getClaims(token);
  if (!claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: claims.claims.sub, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dry_run === true;
  const maxActivate = Math.min(Number(body.limit) || 200, 500);

  // Eligible: has email, never contacted, not yet in outreach_sent stage
  const { data: candidates, error } = await supabase
    .from("prospect_pipeline")
    .select("id, business_name, industry, email, pipeline_stage")
    .not("email", "is", null)
    .in("pipeline_stage", ["new_lead", "scored", "researched"])
    .is("last_drip_at", null)
    .limit(maxActivate);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eligible = (candidates ?? []).filter((c) => industryHasMappedPage(c.industry));

  // Group by industry for the preview
  const byIndustry: Record<string, number> = {};
  for (const c of eligible) {
    const k = c.industry || "Unknown";
    byIndustry[k] = (byIndustry[k] ?? 0) + 1;
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: true,
        eligible_count: eligible.length,
        by_industry: byIndustry,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Activate: stage → outreach_sent, last_drip_at = null so cron picks tomorrow
  const ids = eligible.map((c) => c.id);
  if (ids.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, activated: 0, by_industry: byIndustry }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: updateErr } = await supabase
    .from("prospect_pipeline")
    .update({
      pipeline_stage: "outreach_sent",
      drip_step: 0,
      drip_status: "pending",
      last_drip_at: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      activated: ids.length,
      by_industry: byIndustry,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
