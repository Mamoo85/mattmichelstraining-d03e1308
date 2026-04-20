// Daily digest (8:15am ET) — emails Matt which secondary postcard offers are converting best.
// Aggregates postcard_conversions by product_key + audience_type over last 7 / 30 days.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const PRODUCT_LABELS: Record<string, string> = {
  techalert: "⚡ TechAlert",
  fielddesk: "🔧 FieldDesk",
  demand_radar: "📡 Demand Radar",
  missed_call: "📞 Missed Call Catch",
  growth_radar: "📈 Growth Radar",
};

function fmt(n: number) { return n.toLocaleString(); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400_000).toISOString();
    const d30 = new Date(now - 30 * 86400_000).toISOString();

    const { data: rows30 } = await sb
      .from("postcard_conversions")
      .select("event, product_key, audience_type, campaign_id, created_at")
      .gte("created_at", d30)
      .limit(5000);

    const all = rows30 || [];
    const last7 = all.filter((r: any) => r.created_at >= d7);

    // Aggregate: scans vs signups per product
    type Agg = { scans: number; signups: number };
    const byProduct7: Record<string, Agg> = {};
    const byProduct30: Record<string, Agg> = {};
    const byAudience7: Record<string, Agg> = {};

    const tally = (bucket: Record<string, Agg>, key: string, isSignup: boolean) => {
      if (!key) return;
      bucket[key] = bucket[key] || { scans: 0, signups: 0 };
      if (isSignup) bucket[key].signups++;
      else bucket[key].scans++;
    };

    for (const r of last7) {
      const isSignup = (r.event || "").startsWith("trial_signup");
      tally(byProduct7, r.product_key || "unknown", isSignup);
      tally(byAudience7, r.audience_type || "unknown", isSignup);
    }
    for (const r of all) {
      const isSignup = (r.event || "").startsWith("trial_signup");
      tally(byProduct30, r.product_key || "unknown", isSignup);
    }

    const totalScans7 = last7.filter((r: any) => r.event === "scan").length;
    const totalSignups7 = last7.filter((r: any) => (r.event || "").startsWith("trial_signup")).length;

    if (totalScans7 === 0 && totalSignups7 === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no activity" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productRows = Object.entries(byProduct7)
      .sort((a, b) => b[1].signups - a[1].signups || b[1].scans - a[1].scans)
      .map(([key, v]) => {
        const label = PRODUCT_LABELS[key] || key;
        const cvr = v.scans > 0 ? ((v.signups / v.scans) * 100).toFixed(1) : "—";
        const m30 = byProduct30[key] || { scans: 0, signups: 0 };
        return `<tr>
          <td style="padding:10px;border-bottom:1px solid #1f2937;color:#e2e8f0">${label}</td>
          <td style="padding:10px;border-bottom:1px solid #1f2937;color:#94a3b8;text-align:center">${fmt(v.scans)}</td>
          <td style="padding:10px;border-bottom:1px solid #1f2937;color:#22d3ee;text-align:center;font-weight:bold">${fmt(v.signups)}</td>
          <td style="padding:10px;border-bottom:1px solid #1f2937;color:#22c55e;text-align:center">${cvr}${cvr !== "—" ? "%" : ""}</td>
          <td style="padding:10px;border-bottom:1px solid #1f2937;color:#64748b;text-align:center">${fmt(m30.signups)}</td>
        </tr>`;
      }).join("");

    const audienceRows = Object.entries(byAudience7)
      .sort((a, b) => b[1].signups - a[1].signups)
      .map(([key, v]) => {
        const cvr = v.scans > 0 ? ((v.signups / v.scans) * 100).toFixed(1) + "%" : "—";
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #1f2937;color:#e2e8f0">${key}</td>
          <td style="padding:8px;border-bottom:1px solid #1f2937;color:#94a3b8;text-align:center">${fmt(v.scans)}</td>
          <td style="padding:8px;border-bottom:1px solid #1f2937;color:#22d3ee;text-align:center">${fmt(v.signups)}</td>
          <td style="padding:8px;border-bottom:1px solid #1f2937;color:#22c55e;text-align:center">${cvr}</td>
        </tr>`;
      }).join("");

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,sans-serif;color:#e2e8f0">
<div style="max-width:640px;margin:0 auto;padding:30px">
  <div style="background:linear-gradient(135deg,#0e7490,#155e75);padding:24px;border-radius:8px;margin-bottom:24px">
    <h1 style="margin:0;color:#fff;font-size:22px">📮 Postcard Offer Performance</h1>
    <p style="margin:8px 0 0 0;opacity:0.9">Last 7 days: ${fmt(totalScans7)} scans · ${fmt(totalSignups7)} signups</p>
  </div>

  <h2 style="color:#22d3ee;font-size:14px;letter-spacing:1px;margin:0 0 12px 0">BY PRODUCT (7 DAYS)</h2>
  <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden;margin-bottom:24px">
    <thead><tr>
      <th style="background:#1e3a5f;color:#22d3ee;padding:10px;text-align:left;font-size:11px">PRODUCT</th>
      <th style="background:#1e3a5f;color:#22d3ee;padding:10px;text-align:center;font-size:11px">SCANS</th>
      <th style="background:#1e3a5f;color:#22d3ee;padding:10px;text-align:center;font-size:11px">SIGNUPS</th>
      <th style="background:#1e3a5f;color:#22d3ee;padding:10px;text-align:center;font-size:11px">CVR</th>
      <th style="background:#1e3a5f;color:#22d3ee;padding:10px;text-align:center;font-size:11px">30D SIGNUPS</th>
    </tr></thead>
    <tbody>${productRows || `<tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b">No data</td></tr>`}</tbody>
  </table>

  <h2 style="color:#22d3ee;font-size:14px;letter-spacing:1px;margin:0 0 12px 0">BY AUDIENCE (7 DAYS)</h2>
  <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden">
    <thead><tr>
      <th style="background:#1e3a5f;color:#22d3ee;padding:8px;text-align:left;font-size:11px">AUDIENCE</th>
      <th style="background:#1e3a5f;color:#22d3ee;padding:8px;text-align:center;font-size:11px">SCANS</th>
      <th style="background:#1e3a5f;color:#22d3ee;padding:8px;text-align:center;font-size:11px">SIGNUPS</th>
      <th style="background:#1e3a5f;color:#22d3ee;padding:8px;text-align:center;font-size:11px">CVR</th>
    </tr></thead>
    <tbody>${audienceRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#64748b">No data</td></tr>`}</tbody>
  </table>

  <p style="color:#64748b;font-size:11px;margin-top:30px;text-align:center">
    Detroit Web Agency · Postcard Offer Digest · Highest-CVR product = next hero offer<br/>
    detroitwebagent.com
  </p>
</div></body></html>`;

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [ADMIN_EMAIL],
          subject: `📮 Postcard offers: ${totalSignups7} signups / ${totalScans7} scans (7d)`,
          html,
        }),
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      totalScans7, totalSignups7,
      byProduct7, byAudience7,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
