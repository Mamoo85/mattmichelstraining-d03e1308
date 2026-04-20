/**
 * fax-tracking-digest — Daily HTML email digest of fax campaign performance.
 * Mirrors postcard-tracking-digest. Aggregates last 7d + 30d.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isoDaysAgo(d: number) {
  const dt = new Date(); dt.setUTCDate(dt.getUTCDate() - d); return dt.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const since7 = isoDaysAgo(7);
    const since30 = isoDaysAgo(30);

    const [logs7, logs30, conv7, conv30, recentCampaigns] = await Promise.all([
      sb.from("fax_send_log").select("status,cost,audience_type").gte("sent_at", since7),
      sb.from("fax_send_log").select("status,cost,audience_type").gte("sent_at", since30),
      sb.from("fax_conversions").select("event,product_key,audience_type").gte("created_at", since7),
      sb.from("fax_conversions").select("event,product_key,audience_type").gte("created_at", since30),
      sb.from("fax_campaigns").select("name,status,total_sent,total_cost,last_error,sent_at,created_at,target_segment")
        .order("created_at", { ascending: false }).limit(10),
    ]);

    function summarize(rows: any[] | null) {
      const r = rows || [];
      const sent = r.filter(x => x.status === "sent").length;
      const failed = r.filter(x => x.status === "failed").length;
      const skipped = r.filter(x => x.status === "skipped_opt_out").length;
      const cost = r.reduce((s, x) => s + (Number(x.cost) || 0), 0);
      return { sent, failed, skipped, cost: +cost.toFixed(2) };
    }
    function summarizeConv(rows: any[] | null) {
      const r = rows || [];
      const scans = r.filter(x => x.event === "scan" || x.event === "page_view").length;
      const signups = r.filter(x => x.event && x.event.startsWith("trial_signup")).length;
      return { scans, signups, cvr: scans > 0 ? Math.round((signups / scans) * 100) : 0 };
    }

    const s7 = summarize(logs7.data);
    const s30 = summarize(logs30.data);
    const c7 = summarizeConv(conv7.data);
    const c30 = summarizeConv(conv30.data);

    // Per-product 7d
    const byProduct: Record<string, { scans: number; signups: number }> = {};
    (conv7.data || []).forEach((x: any) => {
      const k = x.product_key || "general";
      if (!byProduct[k]) byProduct[k] = { scans: 0, signups: 0 };
      if (x.event === "scan" || x.event === "page_view") byProduct[k].scans++;
      else if (x.event && x.event.startsWith("trial_signup")) byProduct[k].signups++;
    });

    const productRows = Object.entries(byProduct).map(([k, v]) => `
      <tr><td style="padding:6px 10px;">${k}</td>
        <td style="padding:6px 10px;text-align:right;">${v.scans}</td>
        <td style="padding:6px 10px;text-align:right;">${v.signups}</td>
        <td style="padding:6px 10px;text-align:right;">${v.scans > 0 ? Math.round((v.signups/v.scans)*100) : 0}%</td></tr>
    `).join("") || `<tr><td colspan="4" style="padding:10px;color:#888;text-align:center;">No conversions yet</td></tr>`;

    const campRows = (recentCampaigns.data || []).map((c: any) => `
      <tr>
        <td style="padding:6px 10px;">${c.name}</td>
        <td style="padding:6px 10px;color:#888;">${c.target_segment}</td>
        <td style="padding:6px 10px;"><span style="color:${c.status === 'sent' ? '#10b981' : c.status === 'failed' ? '#ef4444' : '#888'};font-weight:bold;">${c.status}</span></td>
        <td style="padding:6px 10px;text-align:right;">${c.total_sent || 0}</td>
        <td style="padding:6px 10px;text-align:right;">$${(c.total_cost || 0).toFixed(2)}</td>
        <td style="padding:6px 10px;color:#a00;font-size:9pt;">${c.last_error ? c.last_error.slice(0, 60) : ""}</td>
      </tr>
    `).join("");

    const html = `
<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;background:#0a1628;color:#e6f1ff;padding:24px;">
  <h1 style="color:#00d4ff;border-bottom:2px solid #00d4ff;padding-bottom:8px;">📠 Fax Campaign Digest</h1>

  <h2 style="color:#fff;margin-top:24px;">Last 7 days</h2>
  <p style="font-size:11pt;line-height:1.7;">
    📨 <strong>${s7.sent}</strong> sent · <strong>${s7.failed}</strong> failed · <strong>${s7.skipped}</strong> opt-outs · 💸 <strong>$${s7.cost}</strong> spent<br>
    👁️ <strong>${c7.scans}</strong> page visits · ✍️ <strong>${c7.signups}</strong> signups · 📈 <strong>${c7.cvr}% CVR</strong>
  </p>

  <h2 style="color:#fff;margin-top:24px;">Last 30 days</h2>
  <p style="font-size:11pt;line-height:1.7;">
    📨 <strong>${s30.sent}</strong> sent · 💸 <strong>$${s30.cost}</strong> spent · ✍️ <strong>${c30.signups}</strong> signups · 📈 <strong>${c30.cvr}% CVR</strong>
  </p>

  <h2 style="color:#fff;margin-top:28px;">Conversions by product (7d)</h2>
  <table style="width:100%;border-collapse:collapse;background:#0f1f35;border-radius:6px;overflow:hidden;">
    <thead style="background:#11253f;color:#00d4ff;text-align:left;font-size:10pt;">
      <tr><th style="padding:8px 10px;">Product</th><th style="padding:8px 10px;text-align:right;">Visits</th><th style="padding:8px 10px;text-align:right;">Signups</th><th style="padding:8px 10px;text-align:right;">CVR</th></tr>
    </thead>
    <tbody style="font-size:10pt;">${productRows}</tbody>
  </table>

  <h2 style="color:#fff;margin-top:28px;">Recent campaigns</h2>
  <table style="width:100%;border-collapse:collapse;background:#0f1f35;border-radius:6px;overflow:hidden;">
    <thead style="background:#11253f;color:#00d4ff;text-align:left;font-size:10pt;">
      <tr><th style="padding:8px 10px;">Name</th><th style="padding:8px 10px;">Segment</th><th style="padding:8px 10px;">Status</th><th style="padding:8px 10px;text-align:right;">Sent</th><th style="padding:8px 10px;text-align:right;">Cost</th><th style="padding:8px 10px;">Last error</th></tr>
    </thead>
    <tbody style="font-size:10pt;">${campRows || `<tr><td colspan="6" style="padding:10px;color:#888;text-align:center;">No campaigns yet</td></tr>`}</tbody>
  </table>

  <p style="margin-top:32px;font-size:9pt;color:#688;">Detroit Web Agency · Fax Engine · automated daily</p>
</div>`;

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "DWA Fax Engine <matt@detroitwebagent.com>",
          to: [ADMIN_EMAIL],
          subject: `📠 Fax Digest — ${s7.sent} sent, ${c7.signups} signups (7d)`,
          html,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, summary_7d: s7, conv_7d: c7 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[fax-tracking-digest]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
