// Client-facing dashboard API for Demand Radar Intelligence
// Authenticated via dashboard_token (no login required)

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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate client — both active subscribers AND one-time snapshot buyers (active=false) are allowed
    const { data: client } = await sb.from("industry_pulse_clients")
      .select("id, company_name, target_industries, target_roles, active, stripe_subscription_id, created_at")
      .eq("dashboard_token", token)
      .maybeSingle();

    if (!client) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const isSnapshot = client.active === false && !client.stripe_subscription_id;

    // Fetch signals from last 30 days, ordered by confidence
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: signals }, { data: actions }] = await Promise.all([
      sb.from("industry_pulse_signals")
        .select("*")
        .gte("detected_at", cutoff)
        .order("confidence", { ascending: false })
        .order("detected_at", { ascending: false })
        .limit(50),
      sb.from("industry_pulse_client_actions")
        .select("signal_id, action, deal_value, note, created_at")
        .eq("client_id", client.id),
    ]);

    // Build actions map keyed by signal_id
    const actionMap: Record<string, { action: string; deal_value: number; note: string | null; created_at: string }> = {};
    for (const a of actions || []) {
      actionMap[a.signal_id] = { action: a.action, deal_value: a.deal_value || 0, note: a.note, created_at: a.created_at };
    }

    // Filter by client's target industries if set
    const targetIndustries = client.target_industries || [];
    let filtered = signals || [];
    if (targetIndustries.length > 0) {
      filtered = filtered.filter((s: any) => {
        if (!s.industry) return true;
        return targetIndustries.some((ti: string) =>
          s.industry.toLowerCase().includes(ti.toLowerCase()) ||
          ti.toLowerCase().includes(s.industry.toLowerCase())
        );
      });
    }

    // Compute signal stats
    const highConf = filtered.filter((s: any) => s.confidence >= 7).length;
    const crossRef = filtered.filter((s: any) => s.cross_referenced).length;
    const thisWeek = filtered.filter((s: any) =>
      new Date(s.detected_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length;

    // Compute ROI stats from actions
    const wonActions = (actions || []).filter((a: any) => a.action === "won");
    const roiStats = {
      contacted: (actions || []).filter((a: any) => a.action === "contacted").length,
      won: wonActions.length,
      lost: (actions || []).filter((a: any) => a.action === "lost").length,
      passed: (actions || []).filter((a: any) => a.action === "passed").length,
      total_revenue: wonActions.reduce((sum: number, a: any) => sum + (a.deal_value || 0), 0),
    };

    return new Response(JSON.stringify({
      company_name: client.company_name,
      plan: isSnapshot ? "snapshot" : (client.stripe_subscription_id ? "subscription" : "trial"),
      stats: {
        total: filtered.length,
        high_confidence: highConf,
        cross_referenced: crossRef,
        this_week: thisWeek,
      },
      roi: roiStats,
      signals: filtered.map((s: any) => ({
        id: s.id,
        company_name: s.company_name,
        location: s.location,
        industry: s.industry,
        signal_type: s.cross_referenced ? "cross_referenced" : s.signal_type || "expansion",
        confidence: s.confidence,
        recommended_pitch: s.recommended_pitch,
        hiring_roles: s.hiring_roles || [],
        hiring_count: s.hiring_count || 0,
        predicted_needs: s.predicted_needs || [],
        detected_at: s.detected_at,
        source_urls: s.source_urls || [],
        client_action: actionMap[s.id] || null,
      })),
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[get-industry-pulse-dashboard]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
