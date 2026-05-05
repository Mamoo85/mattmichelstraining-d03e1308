// missed-call-monthly-proof
// Monthly value-proof email to every active Missed-Call Catch client.
// Shows: calls caught, texts sent, response rate, avg response time.
// Cron: 1st of each month at 10am ET (14:00 UTC).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleString("en-US", { month: "long", year: "numeric" });

  const { data: clients } = await sb
    .from("missed_call_clients")
    .select("id, email, business_name, owner_name, phone")
    .eq("active", true)
    .not("email", "is", null);

  let sent = 0;
  for (const client of (clients || []) as any[]) {
    if (!client.email) continue;

    const { data: captures } = await sb
      .from("missed_call_captures")
      .select("id, caller_number, created_at, sms_sent_at, callback_completed_at, transcription")
      .eq("client_id", client.id)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd);

    const capList = (captures || []) as any[];
    const totalCalls = capList.length;
    const textsSent = capList.filter((c) => c.sms_sent_at).length;
    const callbacksCompleted = capList.filter((c) => c.callback_completed_at).length;

    // Avg time to first text (minutes)
    const responseTimes = capList
      .filter((c) => c.sms_sent_at)
      .map((c) => (new Date(c.sms_sent_at).getTime() - new Date(c.created_at).getTime()) / 60000);
    const avgResponseMin = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

    const responseRate = totalCalls > 0 ? Math.round((textsSent / totalCalls) * 100) : 0;
    const name = client.owner_name?.split(" ")[0] || "there";
    const responseStr = avgResponseMin != null ? `${avgResponseMin}m avg` : "—";

    // Estimate revenue saved: avg missed call = $150 value, 20% conversion
    const estimatedRevenue = Math.round(textsSent * 150 * 0.2);

    const html = `<div style="font-family:sans-serif;max-width:560px;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px">
<p style="color:#00d4ff;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.08em">Missed-Call Catch Monthly Report</p>
<h2 style="margin:0 0 24px;font-size:22px;color:#fff">${monthLabel} Summary</h2>
<p style="margin:0 0 16px">Hey ${name} — here's how many leads didn't slip through the cracks last month:</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 24px">
  <tr>
    <td style="padding:12px;background:#1e2d45;border-radius:8px 0 0 0;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#00d4ff">${totalCalls}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Calls Caught</div>
    </td>
    <td style="padding:12px;background:#162236;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#34d399">${textsSent}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Texts Sent</div>
    </td>
    <td style="padding:12px;background:#1e2d45;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#fbbf24">${responseRate}%</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Response Rate</div>
    </td>
    <td style="padding:12px;background:#162236;border-radius:0 8px 8px 0;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#a78bfa">${responseStr}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Avg Response</div>
    </td>
  </tr>
</table>
${estimatedRevenue > 0 ? `<p style="background:#162236;padding:14px;border-radius:8px;font-size:15px;margin:0 0 16px;text-align:center">
  💰 Estimated recovered revenue: <strong style="color:#34d399;font-size:20px">~$${estimatedRevenue.toLocaleString()}</strong>
  <span style="color:#64748b;font-size:12px;display:block;margin-top:4px">Based on avg $150 call value × 20% conversion rate</span>
</p>` : ""}
${callbacksCompleted > 0 ? `<p style="font-size:14px;color:#94a3b8">✅ ${callbacksCompleted} callers confirmed a callback or appointment.</p>` : ""}
${totalCalls === 0 ? `<p style="color:#fbbf24;background:#2d1f00;padding:12px;border-radius:8px;font-size:14px">⚠️ No missed calls recorded in ${monthLabel}. Make sure your phone number is forwarding to our system. Reply to this email and I'll verify your setup.</p>` : ""}
<p style="font-size:13px;color:#64748b;margin-top:24px">— Matt Michels · Detroit Web Agency · (313) 992-1219</p>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt @ Detroit Web Agency <matt@detroitwebagent.com>",
        to: [client.email],
        subject: `Your Missed-Call Report — ${monthLabel}`,
        html,
      }),
    });
    if (res.ok) sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent, month: monthLabel }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
