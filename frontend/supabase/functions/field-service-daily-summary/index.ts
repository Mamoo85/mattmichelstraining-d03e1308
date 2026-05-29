import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function dwaEmail(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">
<div style="text-align:center;margin-bottom:24px">
<span style="color:#fff;font-weight:900;font-size:14px">DETROIT</span>
<span style="color:#00d4ff;font-weight:900;font-size:14px"> WEB AGENCY</span>
<span style="color:#6b7280;font-size:14px"> | FieldDesk</span>
</div>
${body}
<div style="border-top:1px solid #1e3a5f;margin-top:32px;padding-top:16px;text-align:center">
<p style="color:#6b7280;font-size:11px;margin:0">Detroit Web Agency — matt@detroitwebagent.com</p>
</div>
</div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toISOString().split("T")[0];

    // Get all active FieldDesk clients
    const { data: clients, error: clientErr } = await supabase
      .from("field_crm_clients")
      .select("id, business_name, email")
      .eq("active", true);

    if (clientErr) throw clientErr;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ message: "No active clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { client: string; sent: boolean }[] = [];

    for (const client of clients) {
      // Get today's jobs for this client
      const { data: jobs } = await supabase
        .from("field_service_jobs")
        .select("id, title, status, priority, scheduled_time, assigned_tech_id, started_at, completed_at, field_service_techs:assigned_tech_id(name), field_service_customers(company_name)")
        .eq("client_id", client.id)
        .eq("scheduled_date", today);

      if (!jobs || jobs.length === 0) {
        results.push({ client: client.business_name, sent: false });
        continue;
      }

      const completed = jobs.filter((j) => j.status === "completed" || j.status === "invoiced");
      const inProgress = jobs.filter((j) => j.status === "on_site" || j.status === "en_route");
      const open = jobs.filter((j) => j.status === "open" || j.status === "assigned");
      const emergency = jobs.filter((j) => j.priority === "emergency");

      // Count photos
      const jobIds = jobs.map((j) => j.id);
      const { count: photoCount } = await supabase
        .from("job_photos")
        .select("id", { count: "exact", head: true })
        .in("job_id", jobIds);

      const statsHtml = `
<div style="background:#0f1f35;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:16px">
<h2 style="color:#fff;font-size:18px;margin:0 0 16px 0">📊 Daily Summary — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</h2>
<table style="width:100%;border-collapse:collapse">
<tr>
<td style="padding:8px 0;color:#9ca3af;font-size:13px">Total Jobs</td>
<td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;font-weight:600">${jobs.length}</td>
</tr>
<tr>
<td style="padding:8px 0;color:#9ca3af;font-size:13px">Completed</td>
<td style="padding:8px 0;color:#22c55e;font-size:13px;text-align:right;font-weight:600">${completed.length}</td>
</tr>
<tr>
<td style="padding:8px 0;color:#9ca3af;font-size:13px">In Progress</td>
<td style="padding:8px 0;color:#f59e0b;font-size:13px;text-align:right;font-weight:600">${inProgress.length}</td>
</tr>
<tr>
<td style="padding:8px 0;color:#9ca3af;font-size:13px">Open/Assigned</td>
<td style="padding:8px 0;color:#00d4ff;font-size:13px;text-align:right;font-weight:600">${open.length}</td>
</tr>
${emergency.length > 0 ? `<tr>
<td style="padding:8px 0;color:#ef4444;font-size:13px;font-weight:600">⚠️ Emergency Jobs</td>
<td style="padding:8px 0;color:#ef4444;font-size:13px;text-align:right;font-weight:600">${emergency.length}</td>
</tr>` : ""}
<tr>
<td style="padding:8px 0;color:#9ca3af;font-size:13px">Photos Taken</td>
<td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;font-weight:600">${photoCount ?? 0}</td>
</tr>
</table>
</div>`;

      const jobRows = completed
        .map((j) => {
          const tech = (j.field_service_techs as Record<string, string> | null);
          const cust = (j.field_service_customers as Record<string, string> | null);
          return `<tr>
<td style="padding:6px 8px;color:#fff;font-size:12px;border-bottom:1px solid #1e3a5f">${j.title}</td>
<td style="padding:6px 8px;color:#9ca3af;font-size:12px;border-bottom:1px solid #1e3a5f">${cust?.company_name ?? "—"}</td>
<td style="padding:6px 8px;color:#9ca3af;font-size:12px;border-bottom:1px solid #1e3a5f">${tech?.name ?? "—"}</td>
</tr>`;
        })
        .join("");

      const completedTable = completed.length > 0
        ? `<div style="background:#0f1f35;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:16px">
<h3 style="color:#22c55e;font-size:14px;margin:0 0 12px 0">✅ Completed Jobs</h3>
<table style="width:100%;border-collapse:collapse">
<tr>
<th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;border-bottom:1px solid #1e3a5f">Job</th>
<th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;border-bottom:1px solid #1e3a5f">Customer</th>
<th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;border-bottom:1px solid #1e3a5f">Tech</th>
</tr>
${jobRows}
</table></div>`
        : "";

      const emailHtml = dwaEmail(`
<h1 style="color:#fff;font-size:20px;margin:0 0 8px 0">${client.business_name}</h1>
<p style="color:#9ca3af;font-size:13px;margin:0 0 20px 0">End-of-day field service report</p>
${statsHtml}
${completedTable}
`);

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "FieldDesk <matt@detroitwebagent.com>",
          to: [client.email],
          subject: `📊 FieldDesk Daily Summary — ${completed.length} jobs completed today`,
          html: emailHtml,
        }),
      });

      results.push({ client: client.business_name, sent: true });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("field-service-daily-summary error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
