// wire-morning-digest — 7am ET cron, emails fresh contractor leads to active Wire subscribers
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function renderRadarSection(signals: any[]): string {
  if (!signals?.length) return "";
  const cards = signals.slice(0, 4).map((s: any) => {
    const conf = s.confidence || 0;
    const confColor = conf >= 8 ? "#10b981" : conf >= 6 ? "#f59e0b" : "#64748b";
    return `
      <tr><td style="padding:10px 8px;border-bottom:1px solid #1e293b;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="color:#a78bfa;font-size:13px;font-weight:700;">${s.company_name || "Local business"}</div>
          <div style="background:${confColor};color:#000;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;">CONF ${conf}/10</div>
        </div>
        <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">${s.location || s.county || "Metro Detroit"} · ${s.expansion_type || s.signal_type || "Expansion signal"}</div>
        <div style="color:#cbd5e1;font-size:12px;line-height:1.45;">${(s.recommended_pitch || s.summary || "").slice(0, 200)}</div>
      </td></tr>`;
  }).join("");

  return `
    <div style="padding:18px 24px 4px;border-top:1px solid #1e293b;background:#0a1628;">
      <div style="color:#a78bfa;font-size:11px;letter-spacing:2px;font-weight:700;margin-bottom:8px;">📡 DEMAND RADAR · EXPANSION SIGNALS</div>
      <div style="color:#64748b;font-size:11px;margin-bottom:10px;">Local businesses showing buying intent — reach out before the competition does.</div>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#0a1628;">${cards}</table>`;
}

function renderDigest(businessName: string, leads: any[], signals: any[] = []): string {
  const rows = leads.map(l => `
    <tr style="border-bottom:1px solid #1e293b;">
      <td style="padding:12px 8px;color:#e2e8f0;font-size:14px;">
        <div style="font-weight:600;color:#00d4ff;">${l.trade || "Lead"} · ${l.city || ""}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:2px;">${l.description?.slice(0, 140) || ""}</div>
      </td>
      <td style="padding:12px 8px;text-align:right;vertical-align:top;">
        <a href="https://detroitwebagent.com/claim-lead?id=${l.id}" style="background:#00d4ff;color:#0a1628;padding:8px 14px;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px;">Claim</a>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#0a1628;font-family:-apple-system,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#0f1f35;border:1px solid #00d4ff;border-radius:12px;overflow:hidden;">
      <div style="padding:24px;border-bottom:1px solid #1e293b;">
        <div style="color:#00d4ff;font-size:12px;letter-spacing:2px;font-weight:700;">📡 THE WIRE</div>
        <h1 style="color:#fff;font-size:22px;margin:8px 0 4px;">Morning Drop · ${leads.length} fresh leads</h1>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Hey ${businessName}, here's what came over the wire overnight:</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="padding:20px 24px;background:#0a1628;text-align:center;border-top:1px solid #1e293b;">
        <a href="https://detroitwebagent.com/the-wire" style="color:#00d4ff;text-decoration:none;font-size:13px;font-weight:600;">View all leads on The Wire →</a>
        <div style="margin-top:12px;color:#475569;font-size:11px;">Detroit Web Agency · (313) 992-1219</div>
      </div>
    </div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { data: subs } = await supabase
      .from("wire_subscribers")
      .select("*")
      .eq("active", true)
      .eq("digest_enabled", true);

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no active subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: recentLeads } = await supabase
      .from("contractor_leads")
      .select("id, trade, city, description, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    let sent = 0;
    for (const sub of subs) {
      const trades = (sub.trades || []).map((t: string) => t.toLowerCase());
      const cities = (sub.cities || []).map((c: string) => c.toLowerCase());

      const matched = (recentLeads || []).filter((l: any) => {
        const tradeOk = !trades.length || trades.includes((l.trade || "").toLowerCase());
        const cityOk = !cities.length || cities.includes((l.city || "").toLowerCase());
        return tradeOk && cityOk;
      });

      if (!matched.length) continue;

      // Filter out already-sent leads
      const { data: alreadySent } = await supabase
        .from("wire_digest_log")
        .select("lead_id")
        .eq("subscriber_id", sub.id)
        .in("lead_id", matched.map((m: any) => m.id));

      const sentIds = new Set((alreadySent || []).map((s: any) => s.lead_id));
      const fresh = matched.filter((m: any) => !sentIds.has(m.id));
      if (!fresh.length) continue;

      const html = renderDigest(sub.business_name || "there", fresh);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "The Wire <matt@detroitwebagent.com>",
          to: [sub.email],
          subject: `📡 ${fresh.length} fresh lead${fresh.length > 1 ? "s" : ""} · The Wire`,
          html,
        }),
      });

      if (res.ok) {
        sent++;
        await supabase.from("wire_digest_log").insert(
          fresh.map((l: any) => ({ subscriber_id: sub.id, lead_id: l.id }))
        );
        await supabase.from("wire_subscribers").update({ last_digest_sent_at: new Date().toISOString() }).eq("id", sub.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, total_subs: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[wire-morning-digest]", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
