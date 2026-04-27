/**
 * healthcare-sources-rerun
 *
 * Manually re-fires every healthcare-vertical candidate source for Metro
 * Detroit. Returns per-source success/error so the operator can see exactly
 * which scraper is broken.
 *
 * Sources fired (best-effort — missing functions are reported, not fatal):
 *   - hire-alert-runner               (main TechAlert dispatcher)
 *   - healthcare-license-scanner      (state board)
 *   - hire-alert-job-board-scrape     (Indeed/ZipRecruiter for nursing/CNA/LPN)
 *
 * Admin-only.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const HEALTHCARE_SOURCES = [
  { name: "hire-alert-runner", body: { vertical: "healthcare", trades: ["nursing", "home_health"], force: true } },
  { name: "healthcare-license-scanner", body: { metro: "detroit" } },
  { name: "hire-alert-job-board-scrape", body: { vertical: "healthcare", queries: ["RN Detroit", "CNA Detroit", "LPN Detroit", "Home Health Aide Metro Detroit"] } },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const baselineCount = await getRecentHealthcareCount();

    const results = await Promise.all(
      HEALTHCARE_SOURCES.map(async (src) => {
        const startMs = Date.now();
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/${src.name}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(src.body),
            signal: AbortSignal.timeout(60_000),
          });
          const elapsed_ms = Date.now() - startMs;
          let payload: any = null;
          try { payload = await res.json(); } catch (_) { payload = await res.text().catch(() => null); }
          return {
            source: src.name,
            status: res.status,
            ok: res.ok,
            elapsed_ms,
            error: res.ok ? null : (payload?.error || payload?.message || `HTTP ${res.status}`),
            inserted: payload?.inserted ?? payload?.added ?? null,
          };
        } catch (e) {
          return {
            source: src.name,
            status: 0,
            ok: false,
            elapsed_ms: Date.now() - startMs,
            error: e instanceof Error ? e.message : String(e),
            inserted: null,
          };
        }
      })
    );

    const newCount = await getRecentHealthcareCount();

    return new Response(JSON.stringify({
      ok: true,
      results,
      baseline_count_7d: baselineCount,
      new_count_7d: newCount,
      delta: newCount - baselineCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[healthcare-sources-rerun] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getRecentHealthcareCount(): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { count } = await sb
    .from("hire_alert_candidates")
    .select("id", { count: "exact", head: true })
    .in("trade", ["nursing", "home_health"])
    .gte("created_at", since);
  return count || 0;
}
