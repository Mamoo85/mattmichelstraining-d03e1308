// FieldDesk onboarding checklist status — returns tech/job/customer counts + snippet detection
// Called from FieldServiceDispatch.tsx to drive the onboarding banner.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Resolve client via dispatch_token (field_crm_clients)
    const { data: crmClient } = await sb
      .from("field_crm_clients")
      .select("id, visitor_script_key")
      .eq("dispatch_token", token)
      .maybeSingle();

    if (!crmClient) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const clientId = crmClient.id;
    const visitorScriptKey = crmClient.visitor_script_key;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Run all counts in parallel
    const [techRes, jobRes, customerRes, snippetRes] = await Promise.all([
      sb.from("field_service_techs").select("id", { count: "exact", head: true }).eq("client_id", clientId),
      sb.from("field_service_jobs").select("id", { count: "exact", head: true }).eq("client_id", clientId),
      sb.from("field_service_customers").select("id", { count: "exact", head: true }).eq("client_id", clientId),
      visitorScriptKey
        ? sb.from("crm_visitor_events").select("id", { count: "exact", head: true })
            .eq("visitor_script_key", visitorScriptKey)
            .gte("created_at", sevenDaysAgo)
        : Promise.resolve({ count: 0 }),
    ]);

    return new Response(JSON.stringify({
      tech_count: techRes.count ?? 0,
      job_count: jobRes.count ?? 0,
      customer_count: customerRes.count ?? 0,
      snippet_active: (snippetRes.count ?? 0) > 0,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[get-fielddesk-onboarding]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
