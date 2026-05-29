// Weekly Monday 8am ET digest emails to TechAlert clients.
// Sends top 5 candidates from the past 7 days per active client.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Detroit Web Agency <matt@detroitwebagent.com>",
      to: [to],
      subject,
      html,
    }),
  });
  return r.ok;
}

function buildHtml(companyName: string, candidates: any[], dashboardToken: string | null): string {
  const link = dashboardToken
    ? `https://detroitwebagent.com/talent-radar/dashboard?token=${dashboardToken}`
    : "https://detroitwebagent.com";

  const rows = candidates
    .map((c, i) => {
      const score = c.score || c.availability_score || 0;
      const color = score >= 8 ? "#22c55e" : score >= 6 ? "#fbbf24" : "#94a3b8";
      return `<tr>
        <td style="padding:10px;border-bottom:1px solid #1f2937;color:#e2e8f0">
          <strong>${i + 1}. ${c.full_name || c.name || "Candidate"}</strong><br/>
          <span style="color:#64748b;font-size:11px">${c.license_type || c.trade || "Skilled trade"} · ${c.city || "Metro Detroit"}</span>
        </td>
        <td style="padding:10px;border-bottom:1px solid #1f2937;color:${color};font-weight:bold;text-align:center">${score}/10</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,sans-serif;color:#e2e8f0">
<div style="max-width:600px;margin:0 auto;padding:30px">
  <div style="background:linear-gradient(135deg,#0e7490,#155e75);padding:24px;border-radius:8px;margin-bottom:24px">
    <h1 style="margin:0;color:#fff">⚡ Talent Radar — Weekly Digest</h1>
    <p style="margin:8px 0 0 0;opacity:0.9">${candidates.length} new candidates for ${companyName} this week</p>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden">
    <thead><tr><th style="background:#1e3a5f;color:#22d3ee;padding:12px;text-align:left;font-size:12px">CANDIDATE</th><th style="background:#1e3a5f;color:#22d3ee;padding:12px;text-align:center;font-size:12px">SCORE</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="text-align:center;margin-top:30px">
    <a href="${link}" style="background:#22d3ee;color:#0a1628;padding:14px 28px;border-radius:6px;font-weight:bold;text-decoration:none;display:inline-block">View Full Dashboard →</a>
  </div>
  <p style="color:#64748b;font-size:11px;margin-top:40px;text-align:center">Detroit Web Agency · Talent Radar · detroitwebagent.com<br/>Reply to this email or text (313) 992-1219 for support.</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    const { data: clients } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, owner_email, dashboard_token, active, notify_email")
      .eq("active", true);

    let sent = 0;
    const results: any[] = [];
    for (const client of clients || []) {
      if (!(client as any).owner_email || !(client as any).notify_email) continue;

      const { data: rows } = await sb
        .from("hire_REDACTED")
        .select("candidate_id, alerted_at, hire_alert_candidates(full_name, name, license_type, trade, city, score, availability_score)")
        .eq("client_id", client.id)
        .gte("alerted_at", sevenDaysAgo)
        .limit(50);

      const candidates = (rows || [])
        .map((r: any) => r.hire_alert_candidates)
        .filter(Boolean)
        .filter((c: any) => (c.score || c.availability_score || 0) >= 5)
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);

      if (!candidates.length) {
        results.push({ client: client.company_name, sent: false, reason: "no candidates" });
        continue;
      }

      const html = buildHtml(client.company_name, candidates, (client as any).dashboard_token);
      const ok = await sendEmail(
        (client as any).owner_email,
        `⚡ Talent Radar: ${candidates.length} new candidates this week`,
        html,
      );
      if (ok) sent++;
      results.push({ client: client.company_name, sent: ok, count: candidates.length });
    }

    return new Response(JSON.stringify({ ok: true, sent, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
