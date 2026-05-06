// enrichment-cost-report-weekly — Sunday 9pm ET (Mon 01:00 UTC) cron.
// Aggregates last 7 days from candidate_enrichment_log per source/provider:
//   calls made, hits, hit rate %, total cost, cost-per-successful-lead.
// Flags providers with hit rate < 5% as "kill candidates".
// Sends SMS to ADMIN_PHONE + full HTML email digest.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

interface LogRow {
  source: string;
  success: boolean;
  cost_estimate: number | null;
  hit_fields: string[] | null;
}

interface ProviderStat {
  source: string;
  calls: number;
  hits: number;
  hit_rate: number;
  total_cost: number;
  cost_per_hit: number;
  fields_returned: number;
  verdict: "keep" | "review" | "kill";
}

function classify(stat: Omit<ProviderStat, "verdict">): ProviderStat["verdict"] {
  if (stat.calls < 10) return "review"; // not enough data
  if (stat.hit_rate < 5) return "kill";
  if (stat.hit_rate < 25 || stat.cost_per_hit > 1.0) return "review";
  return "keep";
}

function aggregateBySource(rows: LogRow[]): ProviderStat[] {
  const map = new Map<string, { calls: number; hits: number; total_cost: number; fields: number }>();
  for (const r of rows) {
    const k = (r.source || "unknown").toLowerCase();
    const cur = map.get(k) || { calls: 0, hits: 0, total_cost: 0, fields: 0 };
    cur.calls++;
    if (r.success) cur.hits++;
    cur.total_cost += Number(r.cost_estimate || 0);
    cur.fields += (r.hit_fields?.length || 0);
    map.set(k, cur);
  }
  const stats: ProviderStat[] = [];
  for (const [source, v] of map) {
    const hit_rate = v.calls > 0 ? (v.hits / v.calls) * 100 : 0;
    const cost_per_hit = v.hits > 0 ? v.total_cost / v.hits : 0;
    const base = { source, calls: v.calls, hits: v.hits, hit_rate, total_cost: v.total_cost, cost_per_hit, fields_returned: v.fields };
    stats.push({ ...base, verdict: classify(base) });
  }
  return stats.sort((a, b) => b.total_cost - a.total_cost);
}

function buildHtmlReport(stats: ProviderStat[], weekStart: string, weekEnd: string): string {
  const totalCost = stats.reduce((s, x) => s + x.total_cost, 0);
  const totalCalls = stats.reduce((s, x) => s + x.calls, 0);
  const totalHits = stats.reduce((s, x) => s + x.hits, 0);
  const overallHitRate = totalCalls > 0 ? (totalHits / totalCalls) * 100 : 0;

  const verdictColor = (v: string) =>
    v === "keep" ? "#10b981" : v === "kill" ? "#ef4444" : "#f59e0b";
  const verdictIcon = (v: string) => v === "keep" ? "✅" : v === "kill" ? "🔴" : "⚠️";

  const rows = stats.map(s => `
    <tr style="border-bottom:1px solid #1e293b">
      <td style="padding:12px 8px;color:#fff;font-weight:600">${verdictIcon(s.verdict)} ${s.source.toUpperCase()}</td>
      <td style="padding:12px 8px;color:#94a3b8;text-align:right">${s.calls}</td>
      <td style="padding:12px 8px;color:#94a3b8;text-align:right">${s.hits}</td>
      <td style="padding:12px 8px;color:${s.hit_rate < 5 ? "#ef4444" : s.hit_rate < 25 ? "#f59e0b" : "#10b981"};text-align:right;font-weight:700">${s.hit_rate.toFixed(1)}%</td>
      <td style="padding:12px 8px;color:#fff;text-align:right">$${s.total_cost.toFixed(2)}</td>
      <td style="padding:12px 8px;color:#fff;text-align:right">${s.hits > 0 ? "$" + s.cost_per_hit.toFixed(3) : "—"}</td>
      <td style="padding:12px 8px;color:${verdictColor(s.verdict)};font-weight:700;text-transform:uppercase">${s.verdict}</td>
    </tr>`).join("");

  const killCandidates = stats.filter(s => s.verdict === "kill");
  const killBlock = killCandidates.length > 0 ? `
    <div style="background:#7f1d1d;border:2px solid #ef4444;border-radius:8px;padding:16px;margin:24px 0">
      <div style="color:#fff;font-weight:700;font-size:16px;margin-bottom:8px">🔴 KILL CANDIDATES (hit rate < 5%)</div>
      <div style="color:#fecaca;font-size:14px">${killCandidates.map(s => `<strong>${s.source}</strong> — burned $${s.total_cost.toFixed(2)} for ${s.hits} hits in ${s.calls} calls`).join("<br>")}</div>
      <div style="color:#fecaca;font-size:13px;margin-top:8px">Recommend: pause these vendors and re-evaluate next week.</div>
    </div>` : "";

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628"><tr><td align="center" style="padding:32px 16px">
    <table width="100%" style="max-width:680px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden">
      <tr><td style="padding:32px 32px 16px;border-bottom:1px solid #1e293b">
        <div style="color:#00d4ff;font-size:14px;font-weight:700;letter-spacing:2px">DETROIT WEB AGENCY</div>
        <h1 style="color:#fff;font-size:24px;margin:8px 0 4px">📊 Weekly Enrichment Cost Audit</h1>
        <div style="color:#64748b;font-size:13px">${weekStart} → ${weekEnd}</div>
      </td></tr>
      <tr><td style="padding:24px 32px">
        <table width="100%" style="margin-bottom:24px"><tr>
          <td style="padding:16px;background:#1e293b;border-radius:8px;text-align:center">
            <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px">Total Spend</div>
            <div style="color:#00d4ff;font-size:28px;font-weight:700;margin-top:4px">$${totalCost.toFixed(2)}</div>
          </td>
          <td width="12"></td>
          <td style="padding:16px;background:#1e293b;border-radius:8px;text-align:center">
            <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px">API Calls</div>
            <div style="color:#fff;font-size:28px;font-weight:700;margin-top:4px">${totalCalls.toLocaleString()}</div>
          </td>
          <td width="12"></td>
          <td style="padding:16px;background:#1e293b;border-radius:8px;text-align:center">
            <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px">Hit Rate</div>
            <div style="color:${overallHitRate < 25 ? "#f59e0b" : "#10b981"};font-size:28px;font-weight:700;margin-top:4px">${overallHitRate.toFixed(1)}%</div>
          </td>
        </tr></table>

        ${killBlock}

        <h3 style="color:#fff;font-size:16px;margin:24px 0 12px">Per-Provider Breakdown</h3>
        <table width="100%" style="border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#1e293b">
            <th style="padding:10px 8px;color:#94a3b8;text-align:left;font-size:11px;text-transform:uppercase">Provider</th>
            <th style="padding:10px 8px;color:#94a3b8;text-align:right;font-size:11px;text-transform:uppercase">Calls</th>
            <th style="padding:10px 8px;color:#94a3b8;text-align:right;font-size:11px;text-transform:uppercase">Hits</th>
            <th style="padding:10px 8px;color:#94a3b8;text-align:right;font-size:11px;text-transform:uppercase">Hit %</th>
            <th style="padding:10px 8px;color:#94a3b8;text-align:right;font-size:11px;text-transform:uppercase">Cost</th>
            <th style="padding:10px 8px;color:#94a3b8;text-align:right;font-size:11px;text-transform:uppercase">$/Hit</th>
            <th style="padding:10px 8px;color:#94a3b8;text-align:left;font-size:11px;text-transform:uppercase">Verdict</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="7" style="padding:32px;text-align:center;color:#64748b">No enrichment activity this week.</td></tr>`}</tbody>
        </table>

        <div style="background:#1e293b;border-radius:8px;padding:16px;margin-top:24px;color:#94a3b8;font-size:12px;line-height:1.6">
          <strong style="color:#00d4ff">How to read this:</strong><br>
          • <strong style="color:#10b981">KEEP</strong> — hit rate ≥ 25% AND cost-per-hit ≤ $1.00<br>
          • <strong style="color:#f59e0b">REVIEW</strong> — hit rate 5-25%, OR cost-per-hit > $1.00, OR insufficient data (&lt; 10 calls)<br>
          • <strong style="color:#ef4444">KILL</strong> — hit rate &lt; 5% with 10+ calls (vendor is burning credits)
        </div>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#020617;color:#475569;font-size:11px;text-align:center">
        Auto-generated every Sunday at 9:00 PM ET • Detroit Web Agency Internal Report
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) { console.warn("[cost-report] RESEND_API_KEY not set"); return; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Detroit Web Agency <matt@detroitwebagent.com>",
        to: [to], subject, html,
      }),
    });
    if (!res.ok) console.error("[cost-report] Resend error:", await res.text());
  } catch (e) {
    console.error("[cost-report] Email exception:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const sinceISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const weekEnd = new Date().toISOString().slice(0, 10);
    const weekStart = sinceISO.slice(0, 10);

    const { data, error } = await sb
      .from("candidate_enrichment_log")
      .select("source, success, cost_estimate, hit_fields")
      .gte("created_at", sinceISO)
      .limit(50000);

    if (error) throw error;

    const rows = (data || []) as LogRow[];
    const stats = aggregateBySource(rows);
    const totalCost = stats.reduce((s, x) => s + x.total_cost, 0);
    const totalHits = stats.reduce((s, x) => s + x.hits, 0);
    const totalCalls = stats.reduce((s, x) => s + x.calls, 0);
    const killList = stats.filter(s => s.verdict === "kill").map(s => s.source);

    // Email full report
    const html = buildHtmlReport(stats, weekStart, weekEnd);
    await sendEmail("matt@detroitwebagent.com", `📊 Weekly Enrichment Cost Audit — $${totalCost.toFixed(2)} spent`, html);

    // SMS summary
    const smsLines = [
      `📊 WEEKLY API AUDIT (${weekStart.slice(5)}-${weekEnd.slice(5)})`,
      `Spend: $${totalCost.toFixed(2)} | ${totalCalls} calls | ${totalHits} hits`,
      stats.slice(0, 5).map(s => `• ${s.source}: ${s.hit_rate.toFixed(0)}% / $${s.cost_per_hit.toFixed(2)}/hit [${s.verdict.toUpperCase()}]`).join("\n"),
      killList.length ? `\n🔴 KILL: ${killList.join(", ")}` : "",
      `Full report in your email.`,
    ].filter(Boolean).join("\n");

    await sendSMS(ADMIN_PHONE, TWILIO_PHONE, smsLines, "enrichment_cost_report");

    await sb.from("agent_heartbeats").upsert({
      agent_name: "enrichment-cost-report-weekly",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { total_cost: totalCost, total_calls: totalCalls, total_hits: totalHits, providers: stats.length, kill_candidates: killList },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({
      success: true,
      week_start: weekStart, week_end: weekEnd,
      total_cost: totalCost, total_calls: totalCalls, total_hits: totalHits,
      providers: stats,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("enrichment-cost-report-weekly error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
