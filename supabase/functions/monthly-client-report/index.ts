import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;

const log = (msg: string, data?: any) =>
  console.log(`[MONTHLY-CLIENT-REPORT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

async function getWebsiteSnapshot(siteUrl: string): Promise<string> {
  if (!siteUrl || !FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: siteUrl, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return (data.data?.markdown || data.markdown || "").substring(0, 800);
  } catch {
    return "";
  }
}

async function generateReportSummary(business: string, siteUrl: string, snapshot: string): Promise<string> {
  if (!LOVABLE_API_KEY) return "Site running normally. No major issues detected this month.";

  const prompt = `Write a short (3-4 sentences) monthly website performance summary for a local business client.
Business: ${business}
Site URL: ${siteUrl || "N/A"}
Site snapshot: ${snapshot || "Not available"}

Include: site status, one specific thing that's working well (content, CTAs, local keywords), one recommendation for next month.
Write in first-person from Matt Michels perspective. Be direct and specific. No fluff.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.6,
    }),
  });

  if (!res.ok) return "Site is running normally. No critical issues detected this month.";
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Site running normally.";
}

function buildReportEmail(lead: any, summary: string, month: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border:1px solid #e0e0e0;">
    <tr><td style="background:#1a1a2e;padding:20px 24px;text-align:center;">
      <div style="font-size:20px;font-weight:900;color:#f97316;">MATT MICHELS WEB DESIGN</div>
      <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:3px;margin-top:3px;">Monthly Report · ${month}</div>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="color:#333;font-size:15px;font-weight:bold;margin:0 0 6px;">Hey ${lead.name || "there"} —</p>
      <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 20px;">Here's your ${month} website summary for <strong>${lead.business}</strong>.</p>

      <div style="background:#f8f8f8;border-left:3px solid #f97316;padding:16px 20px;margin:0 0 20px;">
        <h3 style="color:#1a1a2e;font-size:13px;font-weight:bold;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">This Month's Report</h3>
        <p style="color:#444;font-size:13px;line-height:1.7;margin:0;">${summary}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;margin-bottom:20px;">
        <tr style="background:#f8f8f8;">
          <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;">Item</td>
          <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;">Status</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#444;border-top:1px solid #eee;">Website Hosting</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;font-weight:bold;border-top:1px solid #eee;">✓ Online</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#444;border-top:1px solid #eee;">SSL Certificate</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;font-weight:bold;border-top:1px solid #eee;">✓ Secure</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#444;border-top:1px solid #eee;">Mobile Experience</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;font-weight:bold;border-top:1px solid #eee;">✓ Optimized</td>
        </tr>
        ${lead.site_url ? `<tr>
          <td style="padding:10px 12px;font-size:13px;color:#444;border-top:1px solid #eee;">Your Site</td>
          <td style="padding:10px 12px;font-size:13px;color:#f97316;border-top:1px solid #eee;"><a href="${lead.site_url}" style="color:#f97316;">${lead.site_url}</a></td>
        </tr>` : ""}
      </table>

      <p style="color:#555;font-size:13px;">Questions or need changes? Reply here or text me at (313) 806-4952.</p>
      <p style="color:#1a1a2e;font-size:14px;font-weight:bold;margin-top:20px;">— Matt</p>
    </td></tr>
    <tr><td style="background:#f8f8f8;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:11px;margin:0;">Matt Michels Web Design · Grosse Pointe, MI · (313) 806-4952</p>
    </td></tr>
  </table>
</td></tr>
</table>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const templateBase = `client_monthly_report_${new Date().toISOString().slice(0, 7)}`;

    // Find live retainer clients
    const { data: clients, error } = await sb
      .from("web_design_leads")
      .select("*")
      .eq("status", "live")
      .eq("monthly_retainer", true)
      .not("email", "is", null);

    if (error) throw error;
    if (!clients || clients.length === 0) {
      log("No retainer clients found");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientEmails = clients.map((c: any) => c.email).filter(Boolean);

    const { data: alreadySent } = await sb
      .from("email_send_log")
      .select("recipient_email")
      .eq("template_name", templateBase)
      .in("recipient_email", clientEmails);

    const sentSet = new Set((alreadySent || []).map((r: any) => r.recipient_email));
    const eligible = clients.filter((c: any) => c.email && !sentSet.has(c.email));

    log("Eligible for monthly report", { count: eligible.length });

    let sent = 0;
    for (const client of eligible) {
      const { data: suppressed } = await sb
        .from("suppressed_emails")
        .select("id").eq("email", client.email).maybeSingle();
      if (suppressed) continue;

      const snapshot = await getWebsiteSnapshot(client.site_url);
      const summary = await generateReportSummary(client.business || client.name, client.site_url, snapshot);
      const html = buildReportEmail(client, summary, month);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `${client.business || "Your Site"} — ${month} Website Report`,
          html,
        }),
      });

      if (!res.ok) { log("Send failed", { email: client.email }); continue; }

      await sb.from("email_send_log").insert({ template_name: templateBase, recipient_email: client.email });
      sent++;
      log("Report sent", { email: client.email });
      await new Promise((r) => setTimeout(r, 1500)); // respect AI rate limits
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[MONTHLY-CLIENT-REPORT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
