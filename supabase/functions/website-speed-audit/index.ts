// Website Speed Audit — cron 1st of month, 6am ET
// Runs PageSpeed Insights (mobile + desktop) for each active client,
// AI-writes a plain-English summary, and emails a branded HTML report.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

const JSON_HEADERS = { "Content-Type": "application/json" };

const CAN_SPAM_FOOTER = `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
    M² Development · Grosse Pointe, MI 48230<br>
    <a href="https://mattmichelstraining.com/unsubscribe" style="color:#94a3b8">Unsubscribe</a>
  </div>`;

function scoreColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

async function runPageSpeed(url: string, strategy: "mobile" | "desktop"): Promise<{ score: number; lcp: string; tbt: string }> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${GOOGLE_MAPS_API_KEY}&strategy=${strategy}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    console.error(`[website-speed-audit] PageSpeed ${strategy} failed for ${url}: ${res.status}`);
    return { score: 0, lcp: "N/A", tbt: "N/A" };
  }
  const data = await res.json();
  const score = Math.round((data?.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
  const lcp = data?.lighthouseResult?.audits?.["largest-contentful-paint"]?.displayValue ?? "N/A";
  const tbt = data?.lighthouseResult?.audits?.["total-blocking-time"]?.displayValue ?? "N/A";
  return { score, lcp, tbt };
}

function scoreBlock(label: string, score: number): string {
  const color = scoreColor(score);
  return `
    <div style="text-align:center;flex:1;padding:16px">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px">${label}</div>
      <div style="font-size:52px;font-weight:800;color:${color};line-height:1">${score}</div>
      <div style="font-size:12px;color:#94a3b8">/100</div>
    </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: clients } = await (sb as any).from("speed_audit_clients").select("*").eq("active", true);
  if (!clients?.length) {
    return new Response(JSON.stringify({ audited: 0 }), { status: 200, headers: JSON_HEADERS });
  }

  let audited = 0;

  for (const client of clients) {
    try {
      const [mobile, desktop] = await Promise.all([
        runPageSpeed(client.website_url, "mobile"),
        runPageSpeed(client.website_url, "desktop"),
      ]);

      const aiSummary = await generateText(
        `Write a brief website speed report for a business owner (not technical). Mobile score: ${mobile.score}/100, Desktop: ${desktop.score}/100. LCP: ${mobile.lcp}. TBT: ${mobile.tbt}. Give 3 specific, actionable recommendations. Keep it under 200 words.`,
        800
      );

      const html = `
<div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px">
  <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#e8621a;margin:0;font-size:22px">M² Website Speed Report</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${client.website_url}</p>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <div style="display:flex;gap:16px;margin-bottom:24px">
      ${scoreBlock("Mobile", mobile.score)}
      ${scoreBlock("Desktop", desktop.score)}
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      <tr>
        <td style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;color:#64748b">Largest Contentful Paint (Mobile)</td>
        <td style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;font-weight:600">${mobile.lcp}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b">Total Blocking Time (Mobile)</td>
        <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">${mobile.tbt}</td>
      </tr>
    </table>
    <h3 style="color:#1e293b;margin:0 0 12px;font-size:15px">What This Means For Your Business</h3>
    <div style="background:#fff;border-left:3px solid #e8621a;padding:16px;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap">${aiSummary}</div>
    ${CAN_SPAM_FOOTER}
  </div>
</div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Reports <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `Your Monthly Speed Report — Mobile ${mobile.score}/100 · Desktop ${desktop.score}/100`,
          html,
        }),
      });

      await (sb as any).from("speed_audit_clients").update({ last_report_at: new Date().toISOString() }).eq("id", client.id);
      audited++;
    } catch (e) {
      console.error(`[website-speed-audit] Error for ${client.email}:`, e);
    }
  }

  console.log(`[website-speed-audit] Audited ${audited} clients`);
  return new Response(JSON.stringify({ audited }), { status: 200, headers: JSON_HEADERS });
});
