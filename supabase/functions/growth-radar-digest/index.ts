// growth-radar-digest — daily 7am ET consolidated digest of Growth Radar signals
// Filtered per-client by territory_counties + vertical.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildEmail(name: string, signals: any[]): string {
  const cards = signals.map((s) => {
    const conf = s.confidence || 0;
    const confColor = conf >= 8 ? "#10b981" : conf >= 6 ? "#f59e0b" : "#64748b";
    const value = s.value_usd ? `$${Math.round(s.value_usd).toLocaleString()}` : "—";
    return `
      <div style="background:#0f1f35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:16px;font-weight:600;color:#fff;">${s.company_name}</div>
          <div style="background:${confColor};color:#000;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;">CONF ${conf}/10</div>
        </div>
        <div style="color:#94a3b8;font-size:13px;margin-bottom:8px;">${(s.county || "MI")} · ${s.signal_type} · ${value}</div>
        <div style="color:#cbd5e1;font-size:13px;line-height:1.5;">${(s.recommended_pitch || "").slice(0, 320)}</div>
        ${s.source_url ? `<div style="margin-top:8px;"><a href="${s.source_url}" style="color:#00d4ff;font-size:12px;">View source →</a></div>` : ""}
      </div>`;
  }).join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#00d4ff;color:#000;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:1px;">📡 GROWTH RADAR</div>
        <h1 style="color:#fff;font-size:22px;margin:12px 0 4px;">Today's Growth Signals</h1>
        <p style="color:#64748b;font-size:13px;margin:0;">${signals.length} qualified ${signals.length === 1 ? "signal" : "signals"} in your territory</p>
      </div>
      ${cards}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;color:#475569;font-size:11px;">
        Detroit Web Agency · Growth Radar
      </div>
    </div>
  </body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Pull last 24h of signals
    const sinceISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: signals = [] } = await supabase
      .from("growth_radar_signals")
      .select("*")
      .gte("detected_at", sinceISO)
      .order("confidence", { ascending: false })
      .limit(50);

    // Pull active growth_radar_clients (table created in v1 migration)
    const { data: subs = [] } = await supabase
      .from("growth_radar_clients")
      .select("id, email, business_name, territory_counties, target_verticals, active, is_test_account")
      .eq("active", true);

    let sent = 0;
    const results: any[] = [];

    for (const sub of subs || []) {
      const counties: string[] = sub.territory_counties || [];
      const verticals: string[] = sub.target_verticals || [];

      const matches = (signals || []).filter((s: any) => {
        if (counties.length > 0) {
          const sigCounty = (s.county || "").toLowerCase();
          if (!counties.some((c) => sigCounty.includes(c.toLowerCase()))) return false;
        }
        if (verticals.length > 0 && s.vertical) {
          if (!verticals.some((v) => (s.vertical || "").toLowerCase().includes(v.toLowerCase()))) return false;
        }
        return true;
      }).slice(0, 8);

      if (!matches.length) continue;

      if (sub.is_test_account) {
        await supabase.from("system_comms_log").insert({
          channel: "email", product: "growth_radar_digest",
          recipient: sub.email, body_preview: `${matches.length} signals (sinkhole)`,
          status: "sinkhole", metadata: { client_id: sub.id },
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
            from: "Growth Radar <matt@detroitwebagent.com>",
            to: sub.email,
            subject: `📡 ${matches.length} growth ${matches.length === 1 ? "signal" : "signals"} in your territory today`,
            html: buildEmail(sub.business_name || "there", matches),
          }),
        });
        if (r.ok) sent++;
        results.push({ subscriber: sub.email, sent: r.ok ? matches.length : 0 });
      } catch (e) {
        results.push({ subscriber: sub.email, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ sent, total_subscribers: subs?.length || 0, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
