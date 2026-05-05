// field-crm-monthly-proof
// Monthly value-proof email to every active FieldDesk client.
// Shows: jobs dispatched, avg response time, revenue invoiced this month.
// Cron: 1st of each month at 10am ET (14:00 UTC).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dwaEmail } from "../_shared/dwa-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    .from("field_crm_clients")
    .select("id, email, business_name, owner_name")
    .eq("active", true)
    .not("email", "is", null);

  let sent = 0;
  for (const client of (clients || []) as any[]) {
    if (!client.email) continue;

    const { data: jobs } = await sb
      .from("field_service_jobs")
      .select("id, status, created_at, scheduled_at, completed_at, invoice_amount")
      .eq("client_id", client.id)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd);

    const jobList = (jobs || []) as any[];
    const totalJobs = jobList.length;
    const completedJobs = jobList.filter((j) => j.status === "completed").length;
    const revenue = jobList.reduce((s: number, j: any) => s + (Number(j.invoice_amount) || 0), 0);

    // Avg response time (created → scheduled)
    const responseTimes = jobList
      .filter((j) => j.scheduled_at)
      .map((j) => (new Date(j.scheduled_at).getTime() - new Date(j.created_at).getTime()) / 3600000);
    const avgResponseHrs = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

    const name = client.owner_name?.split(" ")[0] || "there";
    const revenueStr = revenue > 0 ? `$${revenue.toLocaleString()}` : "—";
    const responseStr = avgResponseHrs != null ? `${avgResponseHrs}h avg` : "—";

    const html = `<div style="font-family:sans-serif;max-width:560px;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px">
<p style="color:#00d4ff;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.08em">FieldDesk Monthly Report</p>
<h2 style="margin:0 0 24px;font-size:22px;color:#fff">${monthLabel} Summary</h2>
<p style="margin:0 0 16px">Hey ${name} — here's what FieldDesk did for your business last month:</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 24px">
  <tr>
    <td style="padding:12px;background:#1e2d45;border-radius:8px 0 0 0;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#00d4ff">${totalJobs}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Jobs Dispatched</div>
    </td>
    <td style="padding:12px;background:#162236;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#34d399">${completedJobs}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Jobs Completed</div>
    </td>
    <td style="padding:12px;background:#1e2d45;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#fbbf24">${responseStr}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Avg Response Time</div>
    </td>
    <td style="padding:12px;background:#162236;border-radius:0 8px 8px 0;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#a78bfa">${revenueStr}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Revenue Invoiced</div>
    </td>
  </tr>
</table>
${totalJobs === 0 ? `<p style="color:#fbbf24;background:#2d1f00;padding:12px;border-radius:8px;font-size:14px">⚠️ No jobs were logged in ${monthLabel}. Need help setting up your job intake flow? Reply to this email.</p>` : ""}
<p style="font-size:14px;color:#94a3b8">Questions or want to discuss your numbers? Reply here or call (313) 992-1219.</p>
<p style="font-size:13px;color:#64748b;margin-top:24px">— Matt Michels · Detroit Web Agency</p>
</div>`;

    const res = await dwaEmail({ to: client.email, subject: `Your FieldDesk Report — ${monthLabel}`, html });
    if (res.ok) sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent, month: monthLabel }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
