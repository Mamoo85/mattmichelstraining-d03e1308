// demand-radar-digest — daily 7am ET email digest to active Demand Radar subscribers
// Sends top expansion signals matching their vertical + territory_counties.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildEmail(companyName: string, signals: any[], portalUrl: string): string {
  const cards = signals.map((s) => {
    const conf = s.confidence || 0;
    const confColor = conf >= 8 ? "#10b981" : conf >= 6 ? "#f59e0b" : "#64748b";
    const needs = (s.predicted_needs || []).slice(0, 3).join(", ");
    return `
      <div style="background:#0f1f35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:16px;font-weight:600;color:#fff;">${s.company_name}</div>
          <div style="background:${confColor};color:#000;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;">CONF ${conf}/10</div>
        </div>
        <div style="color:#94a3b8;font-size:13px;margin-bottom:8px;">${s.location || s.county || "Metro Detroit"} · ${s.expansion_type || s.signal_type || "Expansion"}</div>
        <div style="color:#cbd5e1;font-size:13px;line-height:1.5;margin-bottom:8px;">${(s.recommended_pitch || "").slice(0, 280)}</div>
        ${needs ? `<div style="color:#00d4ff;font-size:12px;"><strong>Predicted needs:</strong> ${needs}</div>` : ""}
      </div>`;
  }).join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#00d4ff;color:#000;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:1px;">📡 DEMAND RADAR</div>
        <h1 style="color:#fff;font-size:22px;margin:12px 0 4px;">Today's Expansion Signals</h1>
        <p style="color:#64748b;font-size:13px;margin:0;">${signals.length} qualified ${signals.length === 1 ? "signal" : "signals"} in your territory</p>
      </div>
      ${cards}
      <div style="margin-top:24px;text-align:center;">
        <a href="${portalUrl}" style="display:inline-block;background:#00d4ff;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Full Dashboard →</a>
      </div>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;color:#475569;font-size:11px;">
        Detroit Web Agency · Demand Radar<br>
        Reply STOP to unsubscribe
      </div>
    </div>
  </body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: subs = [] } = await supabase
      .from("industry_pulse_clients")
      .select("id, email, company_name, vertical, target_industries, territory_counties, dashboard_token, is_test_account")
      .eq("active", true);

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no active subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull last 24h of signals (confidence >= 6)
    const sinceISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: allSignals = [] } = await supabase
      .from("industry_pulse_signals")
      .select("*")
      .gte("detected_at", sinceISO)
      .gte("confidence", 6)
      .order("confidence", { ascending: false })
      .limit(100);

    let sent = 0;
    const results: any[] = [];

    for (const sub of subs) {
      // Filter by vertical/industries + counties
      const subVerticals = [sub.vertical, ...(sub.target_industries || [])].filter(Boolean).map((s: string) => s.toLowerCase());
      const wantsAll = subVerticals.includes("all") || subVerticals.length === 0;
      const subCounties: string[] = sub.territory_counties || [];

      const matches = allSignals.filter((s: any) => {
        const sigVert = (s.vertical || s.industry || s.sector || "").toLowerCase();
        const vertMatch = wantsAll || subVerticals.some((v: string) => sigVert.includes(v) || v.includes(sigVert));
        if (!vertMatch) return false;
        if (subCounties.length === 0) return true;
        const sigCounty = (s.county || s.location || "").toLowerCase();
        return subCounties.some((c: string) => sigCounty.includes(c.toLowerCase()));
      }).slice(0, 5);

      if (!matches.length) continue;

      const portalUrl = `https://www.detroitwebagent.com/demand-radar-portal?token=${sub.dashboard_token || sub.id}`;
      const html = buildEmail(sub.company_name || "there", matches, portalUrl);

      // Sinkhole test accounts
      if (sub.is_test_account) {
        await supabase.from("system_comms_log").insert({
          channel: "email", product: "demand_radar_digest",
          recipient: sub.email, body_preview: `${matches.length} signals (sinkhole)`,
          status: "sinkhole", metadata: { client_id: sub.id, reason: "is_test_account" },
        });
        results.push({ subscriber: sub.email, sent: 0, reason: "sinkhole" });
        continue;
      }

      if (!RESEND_API_KEY) continue;

      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Demand Radar <matt@detroitwebagent.com>",
            to: sub.email,
            subject: `📡 ${matches.length} expansion ${matches.length === 1 ? "signal" : "signals"} in your territory today`,
            html,
          }),
        });
        if (r.ok) {
          sent++;
          await supabase.from("industry_pulse_clients").update({ last_alerted_at: new Date().toISOString() }).eq("id", sub.id);
        }
        results.push({ subscriber: sub.email, sent: r.ok ? matches.length : 0 });
      } catch (e) {
        results.push({ subscriber: sub.email, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ sent, total_subscribers: subs.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
