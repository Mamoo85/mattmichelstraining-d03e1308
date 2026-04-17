// dead-lead-daily-notifier — 5pm ET daily
// SMSes Matt if any dead leads were revived in the last 24h.
// Always emails Matt a full campaign digest so he never has to log in.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Count positive replies in last 24h
  const { count: todayPositive } = await sb
    .from("dead_lead_contacts" as any)
    .select("id", { count: "exact", head: true })
    .eq("status", "replied_positive")
    .gte("contractor_notified_at", oneDayAgo);

  // All-time totals
  const { count: totalPositive } = await sb
    .from("dead_lead_contacts" as any)
    .select("id", { count: "exact", head: true })
    .eq("status", "replied_positive");

  const { count: totalInDrip } = await sb
    .from("dead_lead_contacts" as any)
    .select("id", { count: "exact", head: true })
    .in("status", ["drip1_sent", "drip2_sent", "drip3_sent"]);

  // Campaign summary
  const { data: campaigns } = await sb
    .from("dead_lead_campaigns" as any)
    .select("id, name, status, contractor_clients(business_name)")
    .eq("status", "active");

  // Per-campaign stats
  const campaignRows: string[] = [];
  for (const camp of (campaigns || [])) {
    const { data: contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("status, contractor_notified_at")
      .eq("campaign_id", camp.id);

    const total = contacts?.length || 0;
    const inDrip = contacts?.filter((c: any) => ["drip1_sent", "drip2_sent", "drip3_sent"].includes(c.status)).length || 0;
    const positive = contacts?.filter((c: any) => c.status === "replied_positive").length || 0;
    const finished = contacts?.filter((c: any) => ["replied_positive", "replied_negative", "review_requested", "opted_out"].includes(c.status)).length || 0;

    // Flag for invoicing: has positive replies AND drip appears complete
    const needsInvoice = positive > 0 && (finished / Math.max(total, 1)) > 0.8;
    const statusLabel = needsInvoice ? "🔴 INVOICE NOW" : inDrip > 0 ? "🟢 Active" : "✅ Done";

    const bizName = (camp.contractor_clients as any)?.business_name || "Unknown";
    campaignRows.push(`<tr style="border-top:1px solid #e2e8f0;">
      <td style="padding:10px 12px;font-size:14px;color:#1e293b;">${camp.name}<br><span style="font-size:12px;color:#64748b;">${bizName}</span></td>
      <td style="padding:10px 12px;font-size:14px;text-align:center;">${inDrip}</td>
      <td style="padding:10px 12px;font-size:14px;text-align:center;color:#10b981;font-weight:700;">${positive} (+$${positive * 50})</td>
      <td style="padding:10px 12px;font-size:13px;">${statusLabel}</td>
    </tr>`);
  }

  const todayRev = (todayPositive || 0) * 50;
  const totalRev = (totalPositive || 0) * 50;

  // Skip empty digest entirely — no noise on quiet days
  if ((todayPositive || 0) === 0 && (totalInDrip || 0) === 0 && (campaigns?.length || 0) === 0) {
    console.log(`[dead-lead-daily-notifier] skipped — no activity today`);
    return new Response(JSON.stringify({ ok: true, skipped: "no activity" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // SMS Matt if any revived today
  if ((todayPositive || 0) > 0) {
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `♻️ Dead Leads: ${todayPositive} revived today (+$${todayRev}). All-time: ${totalPositive} replies, $${totalRev}. ${campaigns?.length || 0} active campaigns. Check admin.`,
      "dead_lead_reactivation"
    );
  }

  // Always email digest
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#0f2342;border:1px solid #1e3a5f;border-radius:10px;overflow:hidden;">
<tr><td style="background:#00d4ff;padding:4px 0;"></td></tr>
<tr><td style="padding:24px 28px;">
  <h2 style="color:#fff;margin:0 0 4px;font-size:20px;">♻️ Dead Lead Daily Report</h2>
  <p style="color:#64748b;margin:0 0 20px;font-size:13px;">${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
    <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:16px;text-align:center;">
      <div style="color:#10b981;font-size:32px;font-weight:900;">${todayPositive || 0}</div>
      <div style="color:#64748b;font-size:12px;font-weight:600;letter-spacing:0.5px;">REVIVED TODAY</div>
      <div style="color:#10b981;font-size:13px;font-weight:700;">+$${todayRev}</div>
    </div>
    <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:16px;text-align:center;">
      <div style="color:#00d4ff;font-size:32px;font-weight:900;">${totalInDrip || 0}</div>
      <div style="color:#64748b;font-size:12px;font-weight:600;letter-spacing:0.5px;">IN DRIP NOW</div>
    </div>
    <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:16px;text-align:center;">
      <div style="color:#f59e0b;font-size:32px;font-weight:900;">$${totalRev}</div>
      <div style="color:#64748b;font-size:12px;font-weight:600;letter-spacing:0.5px;">ALL-TIME REVENUE</div>
    </div>
  </div>
  ${campaignRows.length > 0 ? `
  <table width="100%" style="border-collapse:collapse;background:#0a1628;border-radius:8px;overflow:hidden;">
    <thead><tr style="background:#0a1628;">
      <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;letter-spacing:0.5px;">CAMPAIGN</th>
      <th style="padding:10px 12px;text-align:center;color:#64748b;font-size:12px;font-weight:600;">IN DRIP</th>
      <th style="padding:10px 12px;text-align:center;color:#64748b;font-size:12px;font-weight:600;">POSITIVE</th>
      <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;">STATUS</th>
    </tr></thead>
    <tbody>${campaignRows.join("")}</tbody>
  </table>` : `<p style="color:#64748b;text-align:center;font-size:14px;">No active campaigns yet.</p>`}
</td></tr>
<tr><td style="background:#0a1628;padding:16px 28px;border-top:1px solid #1e3a5f;">
  <a href="https://detroitwebagent.com/admin" style="color:#00d4ff;font-size:13px;text-decoration:none;">Open Admin Panel →</a>
</td></tr>
</table></td></tr></table></body></html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DWA System <matt@detroitwebagent.com>",
      to: ["matt@detroitwebagent.com"],
      subject: `♻️ Dead Leads Daily: ${todayPositive || 0} revived, $${todayRev} earned`,
      html,
    }),
  });

  console.log(`[dead-lead-daily-notifier] todayPositive=${todayPositive}, totalPositive=${totalPositive}`);
  return new Response(JSON.stringify({ ok: true, todayPositive, totalPositive, totalInDrip }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
