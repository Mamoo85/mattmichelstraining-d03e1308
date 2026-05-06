import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notifyMatt(subject: string, html: string) {
  if (!RESEND_API_KEY) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Detroit Web Agency <matt@detroitwebagent.com>",
      to: ["matt@detroitwebagent.com"],
      subject,
      html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0) || 0;
}

function getAvailabilityScore(candidate: any): number {
  return toNumber(candidate?.availability_score ?? candidate?.score);
}

function getActionable(candidate: any): boolean {
  const raw = (candidate?.raw_data ?? {}) as Record<string, unknown>;
  return Boolean(
    candidate?.email ||
    candidate?.phone ||
    raw?.pdl_mobile_phone ||
    raw?.npi_business_phone
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const shouldSend = Boolean(body?.send);
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const [clientsRes, candidates24Res, candidates7Res, runsRes] = await Promise.all([
      sb.from("hire_alert_clients").select("id", { count: "exact", head: true }).or("active.eq.true,trial_status.eq.active").not("tos_accepted_at", "is", null),
      sb.from("hire_alert_candidates").select("id, full_name, name, city, trade, license_type, license_number, source, email, phone, status, enrichment_status, availability_score, score, raw_data, first_seen_at").gte("first_seen_at", since24h).order("availability_score", { ascending: false }).limit(200),
      sb.from("hire_alert_candidates").select("id, status, enrichment_status, availability_score, score, first_seen_at").gte("first_seen_at", since7d).limit(1000),
      sb.from("hire_alert_runs").select("run_at, source, candidates_found, new_candidates, alerts_sent, status, errors").gte("run_at", since7d).order("run_at", { ascending: false }).limit(50),
    ]);

    const candidates24 = candidates24Res.data || [];
    const candidates7 = candidates7Res.data || [];
    const normalizedRuns = (runsRes.data || []).filter((run: any) => run?.status !== "skipped_no_worker");
    const recentRuns = normalizedRuns.slice(0, 7);

    const stats24 = {
      candidates: candidates24.length,
      enriched: candidates24.filter((c: any) => c.enrichment_status === "complete").length,
      hot: candidates24.filter((c: any) => getAvailabilityScore(c) >= 7).length,
      alerted: candidates24.filter((c: any) => c.status === "alerted").length,
      actionable: candidates24.filter((c: any) => getActionable(c)).length,
    };

    const stats7 = {
      candidates: candidates7.length,
      enriched: candidates7.filter((c: any) => c.enrichment_status === "complete").length,
      hot: candidates7.filter((c: any) => getAvailabilityScore(c) >= 7).length,
      alerted: candidates7.filter((c: any) => c.status === "alerted").length,
      run_alerts_sent: normalizedRuns
        .filter((r: any) => new Date(r.run_at).getTime() >= new Date(since7d).getTime())
        .reduce((sum: number, r: any) => sum + toNumber(r.alerts_sent), 0),
    };

    const subject = `${stats24.hot > 0 ? "🔥 " : ""}TechAlert — ${dateStr} — ${stats24.candidates} new · ${stats24.hot} hot · ${stats24.alerted} alerted`;

    const candidateRows = candidates24.length
      ? candidates24
          .sort((a: any, b: any) => getAvailabilityScore(b) - getAvailabilityScore(a))
          .map((candidate: any, index: number) => {
            const score = getAvailabilityScore(candidate);
            const raw = (candidate.raw_data ?? {}) as Record<string, unknown>;
            const actionable = getActionable(candidate);
            const rowBg = score >= 7 ? "#fff7ed" : index % 2 === 0 ? "#ffffff" : "#f8fafc";
            const badgeBg = score >= 8 ? "#dc2626" : score >= 7 ? "#ea580c" : score >= 5 ? "#f59e0b" : "#94a3b8";
            const displayName = candidate.full_name || candidate.name || "Unnamed";
            const displayTrade = candidate.trade || candidate.license_type || "—";
            const contactBits = [candidate.email, candidate.phone, raw.pdl_mobile_phone, raw.npi_business_phone].filter(Boolean).join(" · ");

            return `<tr style="background:${rowBg};border-bottom:1px solid #e2e8f0;">
              <td style="padding:12px 10px;font-size:13px;color:#0f172a;font-weight:700;">${displayName}${contactBits ? `<br><span style="font-size:11px;color:#64748b;font-weight:400;">${contactBits}</span>` : ""}</td>
              <td style="padding:12px 10px;font-size:12px;color:#475569;">${displayTrade}${candidate.license_number ? `<br><span style="font-size:10px;color:#94a3b8;">#${candidate.license_number}</span>` : ""}</td>
              <td style="padding:12px 10px;font-size:12px;color:#475569;">${candidate.city || "—"}</td>
              <td style="padding:12px 10px;font-size:11px;color:#475569;">${candidate.source || "—"}</td>
              <td style="padding:12px 10px;text-align:center;"><span style="display:inline-block;background:${badgeBg};color:#fff;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:800;">${score}/10</span></td>
              <td style="padding:12px 10px;font-size:11px;color:${actionable ? "#059669" : "#dc2626"};font-weight:700;">${actionable ? "✅ Actionable" : "❌ Ghost"}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" style="padding:32px;text-align:center;color:#94a3b8;font-size:14px;">No candidates were inserted in the last 24 hours.</td></tr>`;

    const runRows = recentRuns.length
      ? recentRuns
          .map((run: any) => `<tr>
            <td style="padding:8px 10px;font-size:12px;color:#0f172a;">${new Date(run.run_at).toLocaleString("en-US")}</td>
            <td style="padding:8px 10px;font-size:12px;color:#475569;">${run.source || "all"}</td>
            <td style="padding:8px 10px;font-size:12px;color:#475569;text-align:center;">${toNumber(run.candidates_found)}</td>
            <td style="padding:8px 10px;font-size:12px;color:#475569;text-align:center;">${toNumber(run.new_candidates)}</td>
            <td style="padding:8px 10px;font-size:12px;color:#475569;text-align:center;">${toNumber(run.alerts_sent)}</td>
          </tr>`)
          .join("")
      : `<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">No real runs in the last 7 days.</td></tr>`;

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;"><tr><td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;">
          <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:28px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
            <p style="margin:0;color:#00d4ff;font-size:10px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">⚡ TechAlert — Founder Report</p>
            <p style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">${dateStr}</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">DB-backed truth report · ${clientsRes.count || 0} active clients</p>
          </td></tr>
          <tr><td style="background:#1e293b;padding:20px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="text-align:center;padding:14px 8px;background:#ffffff08;border-radius:12px;"><p style="margin:0;font-size:28px;font-weight:900;color:#fff;">${stats24.candidates}</p><p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.3px;">24h New</p></td>
              <td width="8"></td>
              <td style="text-align:center;padding:14px 8px;background:#10b98118;border-radius:12px;"><p style="margin:0;font-size:28px;font-weight:900;color:#10b981;">${stats24.enriched}</p><p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.3px;">24h Enriched</p></td>
              <td width="8"></td>
              <td style="text-align:center;padding:14px 8px;background:#ea580c18;border-radius:12px;"><p style="margin:0;font-size:28px;font-weight:900;color:#ea580c;">${stats24.hot}</p><p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.3px;">24h Hot</p></td>
              <td width="8"></td>
              <td style="text-align:center;padding:14px 8px;background:#ffffff08;border-radius:12px;"><p style="margin:0;font-size:28px;font-weight:900;color:#00d4ff;">${stats24.alerted}</p><p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.3px;">24h Alerted</p></td>
            </tr></table>
            <p style="margin:14px 0 0;color:#94a3b8;font-size:12px;">7-day totals: ${stats7.candidates} candidates · ${stats7.hot} hot · ${stats7.alerted} alerted · ${stats7.run_alerts_sent} alerts sent in real runs</p>
          </td></tr>
          <tr><td style="background:#fff;padding:24px 20px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 16px;font-size:14px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">Candidates inserted in last 24 hours</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <tr style="background:#0a1628;">
                <th style="padding:10px;color:#94a3b8;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.4px;">Name</th>
                <th style="padding:10px;color:#94a3b8;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.4px;">Trade</th>
                <th style="padding:10px;color:#94a3b8;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.4px;">City</th>
                <th style="padding:10px;color:#94a3b8;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.4px;">Source</th>
                <th style="padding:10px;color:#94a3b8;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1.4px;">Score</th>
                <th style="padding:10px;color:#94a3b8;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.4px;">Status</th>
              </tr>
              ${candidateRows}
            </table>
          </td></tr>
          <tr><td style="background:#fff;padding:0 20px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:16px 0;font-size:14px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">Recent real runs (skips excluded)</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <tr style="background:#e2e8f0;">
                <th style="padding:8px 10px;color:#475569;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;">Run</th>
                <th style="padding:8px 10px;color:#475569;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;">Source</th>
                <th style="padding:8px 10px;color:#475569;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;">Found</th>
                <th style="padding:8px 10px;color:#475569;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;">New</th>
                <th style="padding:8px 10px;color:#475569;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;">Alerts</th>
              </tr>
              ${runRows}
            </table>
          </td></tr>
          <tr><td style="padding:20px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#0a1628;color:#64748b;font-size:12px;line-height:1.6;">
            This report is generated from live database state, not transient in-memory scanner arrays. Synthetic skipped runs are excluded.
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`;

    if (shouldSend) {
      await notifyMatt(subject, html);
    }

    return new Response(JSON.stringify({
      ok: true,
      subject,
      active_clients: clientsRes.count || 0,
      last_24h: stats24,
      last_7d: stats7,
      recent_runs: recentRuns,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});