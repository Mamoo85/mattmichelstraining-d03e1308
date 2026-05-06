// cron-status — Admin-gated read endpoint. Returns merged view of cron.job + cron_job_health
// + most recent run details + audit log. Backs the AdminCronStatus screen.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

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

  const [{ data: health = [] }, { data: history = [] }, { data: audit = [] }] = await Promise.all([
    sb.from("cron_job_health").select("*").order("jobname"),
    sb.from("cron_schedule_history").select("jobname, schedule, command, replaced_at, active").eq("active", true),
    sb.from("cron_schedule_audit").select("*").order("attempted_at", { ascending: false }).limit(50),
  ]);

  const healthMap = new Map((health || []).map((h: any) => [h.jobname, h]));
  const jobs = (history || []).map((h: any) => ({
    jobname: h.jobname,
    schedule: h.schedule,
    command: h.command,
    health: healthMap.get(h.jobname) || null,
  }));

  for (const h of (health || [])) {
    if (!jobs.find((j: any) => j.jobname === (h as any).jobname)) {
      jobs.push({ jobname: (h as any).jobname, schedule: null, command: null, health: h });
    }
  }

  const now = Date.now();
  const total = jobs.length;
  const failing = jobs.filter((j: any) => j.health && (j.health.consecutive_failures || 0) > 0).length;
  const stale = jobs.filter((j: any) => {
    if (!j.health?.last_success_at) return true;
    // Use per-job stale_after_minutes if available, else 26h fallback
    const staleMin = j.health.stale_after_minutes || 26 * 60;
    const ageMin = (now - new Date(j.health.last_success_at).getTime()) / 60_000;
    return ageMin > staleMin;
  }).length;
  const healthy = Math.max(0, total - failing - stale);

  return new Response(JSON.stringify({
    ok: true,
    kpis: { total, healthy, failing, stale },
    jobs,
    audit: audit || [],
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
