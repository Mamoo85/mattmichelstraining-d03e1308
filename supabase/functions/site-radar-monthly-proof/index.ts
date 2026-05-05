// site-radar-monthly-proof
// Monthly value-proof email to every active SiteRadar client.
// Shows: companies identified, total visits, top visitor industries, new vs returning.
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

  // SiteRadar clients are rows in field_crm_clients with a visitor_script_key
  const { data: clients } = await sb
    .from("field_crm_clients")
    .select("id, email, business_name, owner_name, visitor_script_key")
    .eq("active", true)
    .not("visitor_script_key", "is", null)
    .not("email", "is", null);

  let sent = 0;
  for (const client of (clients || []) as any[]) {
    if (!client.email || !client.visitor_script_key) continue;

    const { data: events } = await sb
      .from("crm_visitor_events")
      .select("id, company_name, industry, ip_address, created_at, is_repeat")
      .eq("script_key", client.visitor_script_key)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd);

    const evList = (events || []) as any[];
    const totalVisits = evList.length;
    const uniqueCompanies = new Set(evList.map((e) => e.company_name).filter(Boolean)).size;
    const identified = evList.filter((e) => e.company_name).length;
    const repeatVisits = evList.filter((e) => e.is_repeat).length;

    // Top industries
    const industryCounts: Record<string, number> = {};
    for (const e of evList) {
      if (e.industry) industryCounts[e.industry] = (industryCounts[e.industry] || 0) + 1;
    }
    const topIndustries = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ind, cnt]) => `${ind} (${cnt})`);

    const name = client.owner_name?.split(" ")[0] || "there";
    const topIndustriesStr = topIndustries.length
      ? topIndustries.join(", ")
      : "not enough data yet";

    const html = `<div style="font-family:sans-serif;max-width:560px;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px">
<p style="color:#00d4ff;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.08em">SiteRadar Monthly Report</p>
<h2 style="margin:0 0 24px;font-size:22px;color:#fff">${monthLabel} Summary</h2>
<p style="margin:0 0 16px">Hey ${name} — here's who was scoping out your website last month:</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 24px">
  <tr>
    <td style="padding:12px;background:#1e2d45;border-radius:8px 0 0 0;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#00d4ff">${totalVisits}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Total Visits</div>
    </td>
    <td style="padding:12px;background:#162236;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#34d399">${uniqueCompanies}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Unique Companies</div>
    </td>
    <td style="padding:12px;background:#1e2d45;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#fbbf24">${identified}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Identified Visitors</div>
    </td>
    <td style="padding:12px;background:#162236;border-radius:0 8px 8px 0;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#a78bfa">${repeatVisits}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Repeat Visits</div>
    </td>
  </tr>
</table>
<p style="background:#162236;padding:12px;border-radius:8px;font-size:14px;margin:0 0 16px">
  <strong style="color:#00d4ff">Top visitor industries:</strong> ${topIndustriesStr}
</p>
${repeatVisits > 2 ? `<p style="background:#1a2e1a;color:#34d399;padding:12px;border-radius:8px;font-size:14px">💡 <strong>${repeatVisits} repeat visitors</strong> — companies that came back multiple times are the warmest prospects. Check your SiteRadar dashboard to see who they are.</p>` : ""}
${totalVisits === 0 ? `<p style="color:#fbbf24;background:#2d1f00;padding:12px;border-radius:8px;font-size:14px">⚠️ No visits tracked in ${monthLabel}. Make sure your SiteRadar snippet is installed on your site. Reply to this email and I'll help you check.</p>` : ""}
<p style="font-size:14px;color:#94a3b8">View your full visitor list at <a href="https://detroitwebagent.com/my-site-radar" style="color:#00d4ff">detroitwebagent.com/my-site-radar</a></p>
<p style="font-size:13px;color:#64748b;margin-top:24px">— Matt Michels · Detroit Web Agency · (313) 992-1219</p>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt @ Detroit Web Agency <matt@detroitwebagent.com>",
        to: [client.email],
        subject: `Your SiteRadar Report — ${monthLabel}`,
        html,
      }),
    });
    if (res.ok) sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent, month: monthLabel }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
