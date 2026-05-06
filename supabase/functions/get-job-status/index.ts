// Public job status page API — homeowner checks "where's my tech?"
// No login required. Token = auth.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_ORDER = ["open", "assigned", "en_route", "on_site", "completed"];

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

    // Join through all related tables for public display
    const { data: job, error } = await sb
      .from("field_service_jobs")
      .select(`
        id, title, status, scheduled_date, scheduled_time,
        estimated_duration_minutes, started_at, completed_at,
        field_service_techs:assigned_tech_id(name, phone),
        field_service_customers:customer_id(company_name),
        field_service_clients:client_id(company_name)
      `)
      .eq("job_token", token)
      .maybeSingle();

    if (error || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const statusIndex = STATUS_ORDER.indexOf(job.status);

    // Compute ETA label
    let eta: string | null = null;
    if (job.status === "en_route" && job.scheduled_time) {
      eta = `Expected on-site by ${job.scheduled_time}`;
    } else if (job.status === "on_site" && job.estimated_duration_minutes && job.started_at) {
      const startedMs = new Date(job.started_at).getTime();
      const etaMs = startedMs + job.estimated_duration_minutes * 60 * 1000;
      const etaDate = new Date(etaMs);
      eta = `Est. complete by ${etaDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else if (job.status === "completed" && job.completed_at) {
      eta = `Completed at ${new Date(job.completed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else if (job.scheduled_time) {
      eta = `Scheduled for ${job.scheduled_time}${job.scheduled_date ? ` on ${job.scheduled_date}` : ""}`;
    }

    return new Response(JSON.stringify({
      title: job.title,
      status: job.status,
      status_index: statusIndex,
      status_count: STATUS_ORDER.length,
      tech_name: (job.field_service_techs as any)?.name || null,
      customer_name: (job.field_service_customers as any)?.company_name || null,
      company_name: (job.field_service_clients as any)?.company_name || null,
      scheduled_date: job.scheduled_date,
      scheduled_time: job.scheduled_time,
      started_at: job.started_at,
      completed_at: job.completed_at,
      eta,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[get-job-status]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
