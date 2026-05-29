// Monthly ROI digest per TechAlert client. Item #47.
// READ-ONLY against hire_REDACTED; writes to NEW client_roi_monthly table.
// Optionally emails Matt a summary. Does NOT email clients (manual review first).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";
const FEE_PER_HIRE = 8000; // conservative avg placement fee saved/earned

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: clients } = await sb.from("hire_alert_clients").select("id, business_name, email, subscription_status").eq("subscription_status", "active");
    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, message: "no active clients" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const rows: Array<{ business: string; surfaced: number; contacted: number; hired: number; roi: number }> = [];

    for (const client of clients) {
      const { data: alerts } = await sb
        .from("hire_REDACTED")
        .select("client_action, alerted_at")
        .eq("client_id", client.id)
        .gte("alerted_at", monthStart.toISOString())
        .lt("alerted_at", monthEnd.toISOString());

      const surfaced = alerts?.length ?? 0;
      const contacted = alerts?.filter(a => ["contacted", "hired", "interviewed"].includes(a.client_action ?? "")).length ?? 0;
      const hired = alerts?.filter(a => a.client_action === "hired").length ?? 0;

      if (surfaced === 0) continue;

      const revenue = hired * FEE_PER_HIRE;
      const cost = 149; // standalone TechAlert
      const roi = cost > 0 ? Math.round((revenue / cost) * 100) / 100 : 0;

      await sb.from("client_roi_monthly").upsert({
        client_id: client.id,
        month_start: monthStart.toISOString().split("T")[0],
        candidates_surfaced: surfaced,
        candidates_contacted: contacted,
        candidates_hired: hired,
        estimated_fee_revenue: revenue,
        subscription_cost: cost,
        roi_multiplier: roi,
      }, { onConflict: "client_id,month_start" });

      rows.push({ business: client.business_name ?? client.email ?? "Unknown", surfaced, contacted, hired, roi });
    }

    // Send admin digest
    if (RESEND_API_KEY && rows.length) {
      const monthLabel = monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });
      const tableRows = rows.map(r =>
        `<tr><td style="padding:8px;border-bottom:1px solid #1e293b">${r.business}</td><td style="padding:8px;text-align:right">${r.surfaced}</td><td style="padding:8px;text-align:right">${r.contacted}</td><td style="padding:8px;text-align:right">${r.hired}</td><td style="padding:8px;text-align:right;color:#00d4ff;font-weight:bold">${r.roi}x</td></tr>`
      ).join("");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [ADMIN_EMAIL],
          subject: `📊 TechAlert Client ROI — ${monthLabel}`,
          html: `<div style="background:#0a1628;color:#e2e8f0;padding:24px;font-family:system-ui">
            <h2 style="color:#00d4ff;margin:0 0 16px">Monthly ROI Rollup — ${monthLabel}</h2>
            <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden">
              <thead><tr style="background:#1e293b"><th style="padding:10px;text-align:left">Client</th><th style="padding:10px;text-align:right">Surfaced</th><th style="padding:10px;text-align:right">Contacted</th><th style="padding:10px;text-align:right">Hired</th><th style="padding:10px;text-align:right">ROI</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            <p style="margin-top:16px;color:#94a3b8;font-size:13px">Review these in /dwa-admin → Revenue Ops → Client ROI before sending to clients manually.</p>
          </div>`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, clients_rolled_up: rows.length }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
