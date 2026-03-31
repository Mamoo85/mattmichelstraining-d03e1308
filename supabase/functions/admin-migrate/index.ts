import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Direct Postgres connection — no exec_sql bootstrap needed
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = new Client(dbUrl);

  try {
    await client.connect();

    // Ensure tracking table exists
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS public._applied_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    const { migrations } = await req.json();
    if (!migrations || !Array.isArray(migrations)) {
      return new Response(JSON.stringify({ error: "Expected { migrations: [{ name, sql }] }" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which have already been applied
    const applied = await client.queryArray(`SELECT name FROM public._applied_migrations`);
    const appliedSet = new Set(applied.rows.map((r: any) => r[0]));

    const results: { name: string; status: string; error?: string }[] = [];

    for (const m of migrations) {
      if (appliedSet.has(m.name)) {
        results.push({ name: m.name, status: "skipped" });
        continue;
      }

      try {
        await client.queryArray(m.sql);
        await client.queryArray(
          `INSERT INTO public._applied_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [m.name]
        );
        results.push({ name: m.name, status: "applied" });
      } catch (e: any) {
        results.push({ name: m.name, status: "error", error: e.message || String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    try { await client.end(); } catch {}
  }
});
