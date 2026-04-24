// TOKEN-2 fix: server-side proxy for FieldServiceTechApp status updates.
// Validates tech session token + ensures the job belongs to the tech.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { makeServiceClient, validateTechSession } from "../_shared/tech-session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_STATUSES = new Set(["open", "assigned", "en_route", "on_site", "completed", "invoiced"]);

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
    const jobId = String(body?.job_id || "");
    const status = String(body?.status || "");
    const timestamp = body?.timestamp ? String(body.timestamp) : new Date().toISOString();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
      return new Response(JSON.stringify({ error: "invalid_job_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return new Response(JSON.stringify({ error: "invalid_status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = makeServiceClient();
    const session = await validateTechSession(sb, token);
    if (!session) {
      return new Response(JSON.stringify({ error: "invalid_session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify job belongs to this tech (defense in depth)
    const { data: job, error: lookupErr } = await sb
      .from("field_service_jobs")
      .select("id, assigned_tech_id, client_id")
      .eq("id", jobId)
      .maybeSingle();

    if (lookupErr) {
      console.error("[tech-job-update] lookup error:", lookupErr);
      return new Response(JSON.stringify({ error: "lookup_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!job) {
      return new Response(JSON.stringify({ error: "job_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (job.assigned_tech_id !== session.tech_id) {
      return new Response(JSON.stringify({ error: "not_assigned" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = { status };
    if (status === "on_site") updates.started_at = timestamp;
    if (status === "completed") updates.completed_at = timestamp;

    const { error: updateErr } = await sb
      .from("field_service_jobs")
      .update(updates)
      .eq("id", jobId);

    if (updateErr) {
      console.error("[tech-job-update] update error:", updateErr);
      return new Response(JSON.stringify({ error: "update_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[tech-job-update] fatal:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
