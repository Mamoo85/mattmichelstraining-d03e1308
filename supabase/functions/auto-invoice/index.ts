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

const log = (msg: string, data?: any) =>
  console.log(`[AUTO-INVOICE] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

function buildInvoiceEmail(lead: any, month: string, invoiceNumber: string): string {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e0e0e0;">
    <tr><td style="background:#1a1a2e;padding:20px 24px;">
      <table width="100%"><tr>
        <td>
          <div style="font-size:18px;font-weight:900;color:#f97316;">MATT MICHELS</div>
          <div style="font-size:9px;color:#aaa;letter-spacing:3px;text-transform:uppercase;">WEB DESIGN</div>
        </td>
        <td style="text-align:right;">
          <div style="font-size:20px;font-weight:900;color:#fff;">INVOICE</div>
          <div style="font-size:11px;color:#aaa;">#${invoiceNumber}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px;">
      <table width="100%" style="margin-bottom:24px;">
        <tr>
          <td style="vertical-align:top;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Bill To</div>
            <div style="font-size:14px;font-weight:bold;color:#1a1a2e;">${lead.business || lead.name}</div>
            <div style="font-size:13px;color:#555;">${lead.name}</div>
            <div style="font-size:13px;color:#555;">${lead.email}</div>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Invoice Date</div>
            <div style="font-size:13px;color:#555;">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
            <div style="font-size:11px;color:#888;margin-top:8px;text-transform:uppercase;letter-spacing:1px;">Due Date</div>
            <div style="font-size:13px;color:#555;">${dueDateStr}</div>
          </td>
        </tr>
      </table>

      <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
        <tr style="background:#f8f8f8;">
          <td style="padding:10px 14px;font-size:11px;font-weight:bold;color:#888;text-transform:uppercase;">Description</td>
          <td style="padding:10px 14px;font-size:11px;font-weight:bold;color:#888;text-transform:uppercase;text-align:right;">Amount</td>
        </tr>
        <tr style="border-top:1px solid #eee;">
          <td style="padding:14px;font-size:13px;color:#333;">
            <strong>${month} Website Hosting & Maintenance</strong><br>
            <span style="color:#888;font-size:12px;">${lead.business || lead.name} · ${lead.site_url || "Your site"}</span>
          </td>
          <td style="padding:14px;font-size:16px;font-weight:900;color:#1a1a2e;text-align:right;">$49.00</td>
        </tr>
        <tr style="background:#f8f8f8;border-top:2px solid #1a1a2e;">
          <td style="padding:12px 14px;font-size:13px;font-weight:bold;color:#1a1a2e;">TOTAL DUE</td>
          <td style="padding:12px 14px;font-size:20px;font-weight:900;color:#f97316;text-align:right;">$49.00</td>
        </tr>
      </table>

      <div style="background:#f8f8f8;border:1px solid #eee;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#1a1a2e;">Payment Options</p>
        <p style="margin:0;font-size:13px;color:#555;line-height:1.7;">
          Venmo: <strong>@MattMichels-Training</strong><br>
          PayPal: matt@m2training.com<br>
          Zelle: (313) 806-4952<br>
          Check payable to: Matt Michels
        </p>
      </div>

      <p style="color:#555;font-size:13px;line-height:1.7;">Questions? Reply to this email or text (313) 806-4952.</p>
      <p style="color:#1a1a2e;font-size:14px;font-weight:bold;margin-top:16px;">— Matt Michels</p>
    </td></tr>
    <tr><td style="background:#f8f8f8;padding:14px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:11px;margin:0;">Matt Michels Web Design · Grosse Pointe, MI · (313) 806-4952 · matt@m2training.com</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const month = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const monthKey = now.toISOString().slice(0, 7);
    const templateBase = `auto_invoice_${monthKey}`;

    // Get all live retainer clients
    const { data: clients, error } = await sb
      .from("web_design_leads")
      .select("*")
      .eq("status", "live")
      .eq("monthly_retainer", true)
      .not("email", "is", null);

    if (error) throw error;
    if (!clients || clients.length === 0) {
      log("No retainer clients");
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

    log("Eligible for invoice", { count: eligible.length });

    let sent = 0;
    for (let i = 0; i < eligible.length; i++) {
      const client = eligible[i];

      const { data: suppressed } = await sb
        .from("suppressed_emails").select("id").eq("email", client.email).maybeSingle();
      if (suppressed) continue;

      const invoiceNum = `${monthKey.replace("-", "")}-${String(i + 1).padStart(3, "0")}`;
      const html = buildInvoiceEmail(client, month, invoiceNum);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@notify.m2training.com>",
          to: [client.email],
          subject: `Invoice #${invoiceNum} — ${month} Website Maintenance — $49`,
          html,
        }),
      });

      if (!res.ok) { log("Send failed", { email: client.email }); continue; }

      await sb.from("email_send_log").insert({ template_name: templateBase, recipient_email: client.email });
      sent++;
      log("Invoice sent", { email: client.email, invoice: invoiceNum });
      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[AUTO-INVOICE] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
