import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Ensure _applied_migrations table exists
    await sb.rpc("exec_sql", {
      query: `CREATE TABLE IF NOT EXISTS public._applied_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT now()
      );`,
    }).then(() => {}).catch(() => {});

    const { migrations } = await req.json();
    if (!migrations || !Array.isArray(migrations)) {
      return new Response(JSON.stringify({ error: "Expected { migrations: [{ name, sql }] }" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which have already been applied
    const { data: applied } = await sb
      .from("_applied_migrations")
      .select("name");
    const appliedSet = new Set((applied || []).map((r: any) => r.name));

    const results: { name: string; status: string; error?: string }[] = [];

    for (const m of migrations) {
      if (appliedSet.has(m.name)) {
        results.push({ name: m.name, status: "skipped" });
        continue;
      }

      try {
        // Execute via Postgres REST — use the raw SQL execution RPC
        const { error } = await sb.rpc("exec_sql", { query: m.sql });
        if (error) throw new Error(error.message);

        await sb.from("_applied_migrations").insert({ name: m.name });
        results.push({ name: m.name, status: "applied" });
      } catch (e: any) {
        results.push({ name: m.name, status: "error", error: e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
