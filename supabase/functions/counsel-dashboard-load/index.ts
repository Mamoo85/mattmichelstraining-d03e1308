// Public, token-gated loader for the Counsel Records Search customer dashboard.
// Anon RLS blocks direct reads of counsel_search_clients, so the React page
// (MyCounselSearch.tsx) calls this function with email+token; we verify with
// service-role and return the client + recent searches only on a token match.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { email, token } = await req.json();
    if (!email || !token) {
      return new Response(JSON.stringify({ error: "missing_params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: client, error } = await sb
      .from("counsel_search_clients")
      .select("email,contact_name,firm_name,tier,monitoring_enabled,active,dashboard_token")
      .eq("email", String(email).toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!client || client.dashboard_token !== token) {
      return new Response(JSON.stringify({ error: "invalid_token" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: searches } = await sb
      .from("counsel_searches")
      .select("id,query_name,case_matter,total_hits,high_priority_hits,created_at")
      .eq("email", String(email).toLowerCase())
      .order("created_at", { ascending: false })
      .limit(50);
    const { dashboard_token: _t, ...safe } = client;
    return new Response(JSON.stringify({ ok: true, client: safe, searches: searches || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", message: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
