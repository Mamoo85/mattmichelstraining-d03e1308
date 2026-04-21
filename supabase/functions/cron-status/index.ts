// cron-status — Admin-gated read endpoint. Returns merged view of cron.job + cron_job_health
// + most recent run details. Backs the AdminCronStatus screen.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Admin gate
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: CORS });

  // Query cron.job via raw SQL through PostgREST RPC if available, fallback to pg_cron view
  // We use a security-definer wrapper if needed — for now query via cron_job_health + cron_schedule_history
  const { data: health = [] } = await sb
    .from("cron_job_health")
    .select("*")
    .order("jobname");

  const { data: history = [] } = await sb
    .from("cron_schedule_history")
    .select("jobname, schedule, command, replaced_at, active")
    .eq("active", true);

  // Merge: every active history row + its health
  const healthMap = new Map((health || []).map((h: any) => [h.jobname, h]));
  const jobs = (history || []).map((h: any) => ({
    jobname: h.jobname,
    schedule: h.schedule,
    command: h.command,
    health: healthMap.get(h.jobname) || null,
  }));

  // Surface jobs that have health rows but no history (legacy crons)
  for (const h of (health || [])) {
    if (!jobs.find((j: any) => j.jobname === (h as any).jobname)) {
      jobs.push({ jobname: (h as any).jobname, schedule: null, command: null, health: h });
    }
  }

  // KPIs
  const now = Date.now();
  const total = jobs.length;
  const failing = jobs.filter((j: any) => j.health && (j.health.consecutive_failures || 0) > 0).length;
  const stale = jobs.filter((j: any) => {
    if (!j.health?.last_success_at) return true;
    const ageHr = (now - new Date(j.health.last_success_at).getTime()) / 3_600_000;
    return ageHr > 26; // >26h since last success = stale
  }).length;
  const healthy = total - failing - stale;

  return new Response(JSON.stringify({
    ok: true,
    kpis: { total, healthy, failing, stale },
    jobs,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
