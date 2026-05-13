// prospect-email-backfill — Backfill emails on idle prospect_pipeline rows.
// Walks the shared 6-stage email waterfall (site_scrape → snov → apollo →
// pattern_verify → hunter → pdl). Records per-source hit counts and an
// enrichment_trace into prospect_pipeline.meta.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { runEmailWaterfall, WATERFALL_PROVIDERS, type WaterfallCounters } from "../_shared/email-waterfall.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const log = (s: string, d?: unknown) =>
  console.log(`[email-backfill] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Admin auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 50, 100);
  const dryRun = body.dry_run === true;

  // Idle prospects: no email, not archived, has a website OR business_name+city (PDL fallback)
  const { data: prospects, error } = await supabase
    .from("prospect_pipeline")
    .select("id, business_name, website, industry, city, state, contact_name, meta")
    .is("email", null)
    .neq("pipeline_stage", "archived")
    .limit(limit);

  if (error) {
    log("query failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("processing", { count: prospects?.length ?? 0, dryRun });

  const counters: WaterfallCounters = {};
  for (const p of WATERFALL_PROVIDERS) counters[p] = 0;
  let skipped = 0;
  const results: any[] = [];

  for (const p of prospects ?? []) {
    if (!p.website && !(p.business_name && p.city)) { skipped++; continue; }

    const [first, ...rest] = (p.contact_name || "").trim().split(/\s+/);
    const last = rest.length ? rest.join(" ") : null;

    const result = await runEmailWaterfall(supabase, {
      website: p.website,
      business_name: p.business_name,
      city: p.city,
      state: p.state,
      contact_first_name: first || null,
      contact_last_name: last,
    }, counters);

    if (!result.email) { skipped++; continue; }

    results.push({
      id: p.id,
      business_name: p.business_name,
      email: result.email,
      source: result.source,
      confidence: result.confidence,
    });

    if (!dryRun) {
      const existingTrace = Array.isArray(p.meta?.enrichment_trace) ? p.meta!.enrichment_trace : [];
      const newTraceEntry = {
        ts: new Date().toISOString(),
        flow: "email_waterfall",
        winner: result.source,
        steps: result.trace,
      };
      const meta = { ...(p.meta || {}), enrichment_trace: [...existingTrace, newTraceEntry] };
      await supabase
        .from("prospect_pipeline")
        .update({ email: result.email, meta, updated_at: new Date().toISOString() })
        .eq("id", p.id);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: prospects?.length ?? 0,
      enriched: results.length,
      // legacy keys (UI back-compat)
      hunter_hits: counters.hunter || 0,
      scrape_hits: counters.site_scrape || 0,
      // full breakdown
      counters,
      skipped,
      dry_run: dryRun,
      sample: results.slice(0, 10),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
