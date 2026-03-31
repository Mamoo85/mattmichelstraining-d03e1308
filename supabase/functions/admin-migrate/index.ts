import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: require service_role key OR authenticated admin user
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isServiceRole = authHeader === `Bearer ${serviceKey}`;

  if (!isServiceRole) {
    // Check if caller is an authenticated admin via Supabase anon key + JWT
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || serviceKey,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sbAdmin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data: isAdmin } = await sbAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Direct Postgres connection
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
        // Wrap in transaction for atomicity
        await client.queryArray("BEGIN");
        await client.queryArray(m.sql);
        await client.queryArray(
          `INSERT INTO public._applied_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [m.name]
        );
        await client.queryArray("COMMIT");
        results.push({ name: m.name, status: "applied" });
      } catch (e: any) {
        await client.queryArray("ROLLBACK").catch(() => {});
        results.push({ name: m.name, status: "error", error: e.message || String(e) });
        // Stop on first error — later migrations may depend on this one
        break;
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
