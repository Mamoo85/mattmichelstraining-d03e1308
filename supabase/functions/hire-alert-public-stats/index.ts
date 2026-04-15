// hire-alert-public-stats — public endpoint for scanner activity stats
// Used by: HireAlert landing page (weekly aggregate) + MyTechAlert dashboard (run history)
// No auth required — data is aggregate/non-sensitive.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Last 7 runs (most recent first) — for the dashboard run history table
    const { data: runs } = await sb
      .from("hire_alert_runs" as any)
      .select("run_at, source, candidates_found, new_candidates, alerts_sent, errors")
      .order("run_at", { ascending: false })
      .limit(7);

    // Weekly aggregate — for the landing page stat strip
    const { data: weekRuns } = await sb
      .from("hire_alert_runs" as any)
      .select("candidates_found, new_candidates, alerts_sent")
      .gte("run_at", sevenDaysAgo);

    const weeklyStats = (weekRuns || []).reduce(
      (acc: { candidates: number; new_candidates: number; alerts: number }, r: any) => ({
        candidates: acc.candidates + (r.candidates_found || 0),
        new_candidates: acc.new_candidates + (r.new_candidates || 0),
        alerts: acc.alerts + (r.alerts_sent || 0),
      }),
      { candidates: 0, new_candidates: 0, alerts: 0 }
    );

    return new Response(JSON.stringify({
      ok: true,
      runs: (runs || []).map((r: any) => ({
        run_at: r.run_at,
        source: r.source || "daily",
        candidates_found: r.candidates_found || 0,
        new_candidates: r.new_candidates || 0,
        alerts_sent: r.alerts_sent || 0,
        errors: r.errors || 0,
      })),
      weekly: weeklyStats,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
