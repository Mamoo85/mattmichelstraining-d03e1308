import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  const result = {
    auth_ok: false,
    db_read_ok: false,
    db_write_ok: false,
    latency_ms: 0,
    error_message: null as string | null,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Auth API reachable (anon client)
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { error: authErr } = await anon.auth.getSession();
    result.auth_ok = !authErr;

    // 2. DB read
    const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { error: readErr } = await svc.from("profiles").select("id").limit(1);
    result.db_read_ok = !readErr;

    // 3. DB write (insert + delete sentinel)
    const { data: ins, error: insErr } = await svc
      .from("health_check_pings")
      .insert({
        auth_ok: result.auth_ok,
        db_read_ok: result.db_read_ok,
        db_write_ok: true,
        latency_ms: Date.now() - t0,
      })
      .select("id")
      .single();
    result.db_write_ok = !insErr && !!ins;

    result.latency_ms = Date.now() - t0;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    result.error_message = e?.message ?? String(e);
    result.latency_ms = Date.now() - t0;
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
