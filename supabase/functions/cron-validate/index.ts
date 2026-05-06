// cron-validate — Admin-gated dry-run. Calls public.safe_cron_validate() RPC and returns JSON result.
// Never touches pg_cron — purely advisory.

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

  const body = await req.json().catch(() => ({}));
  const { jobname, schedule, command } = body || {};
  if (!jobname || !schedule || !command) {
    return new Response(JSON.stringify({ ok: false, error: "jobname, schedule, command all required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await sb.rpc("safe_cron_validate", {
    p_jobname: jobname,
    p_schedule: schedule,
    p_command: command,
  });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
