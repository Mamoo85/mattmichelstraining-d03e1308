// TOKEN-2 fix: server-side proxy for FieldServiceTechApp job reads.
// Validates tech session token before returning today's or history jobs.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { makeServiceClient, validateTechSession } from "../_shared/tech-session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "");
    const scope: "today" | "history" = body?.scope === "history" ? "history" : "today";

    const sb = makeServiceClient();
    const session = await validateTechSession(sb, token);
    if (!session) {
      return new Response(JSON.stringify({ error: "invalid_session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let q = sb
      .from("field_service_jobs")
      .select(
        "id, title, description, priority, status, scheduled_date, scheduled_time, notes, field_service_customers(company_name, address, city, phone)"
      )
      .eq("assigned_tech_id", session.tech_id);

    if (scope === "today") {
      const today = new Date().toISOString().split("T")[0];
      q = q
        .eq("scheduled_date", today)
        .not("status", "in", '("completed","invoiced")')
        .order("scheduled_time", { ascending: true });
    } else {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];
      q = q
        .in("status", ["completed", "invoiced"])
        .gte("scheduled_date", fourteenDaysAgo)
        .order("scheduled_date", { ascending: false });
    }

    const { data, error } = await q;
    if (error) {
      console.error("[tech-jobs-get] query error:", error);
      return new Response(JSON.stringify({ error: "query_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ jobs: data || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[tech-jobs-get] fatal:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
