// contractor-portal-lookup — public token-gated lookup for the contractor trust dashboard.
// Anon clients cannot SELECT contractor_clients due to RLS, so the dashboard fetches via this fn.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 8) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Lookup by roi_token first, then by id (UUID fallback).
    let { data: c } = await sb
      .from("contractor_clients")
      .select("id, business_name, trade, city, free_dead_leads_used, free_dead_leads_quota, email")
      .eq("roi_token", token)
      .maybeSingle();

    if (!c) {
      const fallback = await sb
        .from("contractor_clients")
        .select("id, business_name, trade, city, free_dead_leads_used, free_dead_leads_quota, email")
        .eq("id", token)
        .maybeSingle();
      c = fallback.data;
    }

    if (!c) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data: ld }, { data: bd }] = await Promise.all([
      sb.from("contractor_leads").select("id, created_at, project_description").eq("contractor_id", c.id).gte("created_at", since),
      sb.from("contractor_lead_boosts").select("*").eq("contractor_id", c.id).order("created_at", { ascending: false }).limit(5),
    ]);

    return new Response(JSON.stringify({ contractor: c, leads: ld || [], boosts: bd || [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[contractor-portal-lookup] error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
