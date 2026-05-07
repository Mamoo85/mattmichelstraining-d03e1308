import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRODUCT_META: Record<string, { label: string; path: string }> = {
  mortgage_radar: { label: "Mortgage Radar", path: "/my-mortgage-radar" },
  techalert: { label: "TechAlert", path: "/talent-radar/dashboard" },
  site_radar: { label: "SiteRadar", path: "/my-site-radar" },
  contractor_leads: { label: "Contractor Leads", path: "/my-contractor-leads" },
  missed_call: { label: "Missed-Call Catch", path: "/my-missed-call" },
  industry_pulse: { label: "Demand Radar", path: "/my-demand-radar" },
  fielddesk: { label: "FieldDesk", path: "/my-field-desk" },
  bundle_revenue_suite: { label: "Bundle Revenue Suite", path: "/my-addons" },
  roofing_radar: { label: "Roofing Radar", path: "/my-roofing-radar" },
  hvac_radar: { label: "HVAC Radar", path: "/my-hvac-radar" },
  plumbing_radar: { label: "Plumbing Radar", path: "/my-plumbing-radar" },
  electrical_radar: { label: "Electrical Radar", path: "/my-electrical-radar" },
  pest_control_radar: { label: "Pest Control Radar", path: "/my-pest-control-radar" },
  gutters_radar: { label: "Gutters Radar", path: "/my-gutters-radar" },
  painting_radar: { label: "Painting Radar", path: "/my-painting-radar" },
  exterior_radar: { label: "Exterior Radar", path: "/my-exterior-radar" },
  tree_radar: { label: "Tree Radar", path: "/my-tree-radar" },
  restoration_radar: { label: "Restoration Radar", path: "/my-restoration-radar" },
  demo_junk_radar: { label: "Demo & Junk Radar", path: "/my-demo-junk-radar" },
  foundation_radar: { label: "Foundation Radar", path: "/my-foundation-radar" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb
      .from("radar_trials")
      .select("id, product, status, trial_started_at, expires_at, converted_at, last_login_at, magic_token, zip_codes")
      .ilike("email", email.trim())
      .order("expires_at", { ascending: true });
    if (error) throw error;

    const now = Date.now();
    const trials = (data || []).map((t: any) => {
      const meta = PRODUCT_META[t.product] || { label: t.product, path: "#" };
      const exp = t.expires_at ? new Date(t.expires_at).getTime() : null;
      const days_remaining = exp ? Math.ceil((exp - now) / 86400000) : null;
      const dashboard_url = t.magic_token
        ? `${meta.path}?email=${encodeURIComponent(email)}&token=${t.magic_token}`
        : `${meta.path}?email=${encodeURIComponent(email)}`;
      return { ...t, label: meta.label, dashboard_url, days_remaining };
    });

    return new Response(JSON.stringify({ trials }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
