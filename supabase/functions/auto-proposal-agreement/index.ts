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
  console.log(`[AUTO-PROPOSAL-AGREEMENT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

function buildAgreementEmail(lead: any): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e0e0e0;">
    <tr><td style="background:#1a1a2e;padding:24px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#f97316;letter-spacing:2px;">MATT MICHELS</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:4px;margin-top:2px;">WEB DESIGN · GROSSE POINTE, MI</div>
    </td></tr>
    <tr><td style="padding:32px 28px;">
      <h2 style="color:#1a1a2e;font-size:18px;margin:0 0 8px;">Service Agreement</h2>
      <p style="color:#666;font-size:13px;margin:0 0 24px;">Prepared for: <strong>${lead.business || lead.name}</strong> · ${today}</p>
      <hr style="border:none;border-top:2px solid #f97316;margin:0 0 24px;">

      <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px;">SCOPE OF WORK</h3>
      <p style="color:#444;font-size:13px;line-height:1.7;">
        Matt Michels Web Design agrees to design, build, and deliver a professional website for <strong>${lead.business || "your business"}</strong>. The site will include:
      </p>
      <ul style="color:#444;font-size:13px;line-height:2;">
        <li>Custom design built to match your brand</li>
        <li>Mobile-responsive layout (looks great on all devices)</li>
        <li>Contact/quote request form</li>
        <li>Google Maps integration</li>
        <li>Basic on-page SEO setup</li>
        <li>Up to 5 pages (Home, About, Services, Gallery, Contact)</li>
        <li>30-day post-launch support window</li>
      </ul>

      <h3 style="color:#1a1a2e;font-size:14px;margin:16px 0 8px;">INVESTMENT</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;margin-bottom:16px;">
        <tr style="background:#f8f8f8;">
          <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#444;">One-Time Build Fee</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:900;color:#f97316;text-align:right;">$499</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;color:#666;">Monthly Hosting + Maintenance (optional)</td>
          <td style="padding:10px 14px;font-size:13px;color:#666;text-align:right;">$49/mo</td>
        </tr>
      </table>
      <p style="color:#666;font-size:12px;">50% due to begin. Remaining 50% due at launch. Monthly maintenance billed on the 1st of each month.</p>

      <h3 style="color:#1a1a2e;font-size:14px;margin:20px 0 8px;">TIMELINE</h3>
      <p style="color:#444;font-size:13px;line-height:1.7;">
        Typical delivery: <strong>7–14 business days</strong> from deposit receipt, assuming timely delivery of content, photos, and feedback.
      </p>

      <h3 style="color:#1a1a2e;font-size:14px;margin:20px 0 8px;">TERMS</h3>
      <ul style="color:#555;font-size:12px;line-height:1.9;">
        <li>Client provides logo, photos, and copy (or approves Matt-drafted copy)</li>
        <li>2 rounds of revisions included before final delivery</li>
        <li>Domain and hosting setup included in monthly fee</li>
        <li>Monthly maintenance can be cancelled with 30 days notice</li>
        <li>Matt Michels retains the right to display completed site in portfolio</li>
      </ul>

      <div style="background:#f8f8f8;border-left:3px solid #f97316;padding:16px 20px;margin:24px 0;">
        <p style="margin:0;color:#1a1a2e;font-size:14px;font-weight:bold;">Ready to move forward?</p>
        <p style="margin:8px 0 0;color:#666;font-size:13px;">Reply to this email or call/text (313) 806-4952 and I'll send a payment link for the deposit.</p>
      </div>

      <p style="color:#1a1a2e;font-size:13px;margin-top:24px;">Looking forward to working with you,</p>
      <p style="color:#f97316;font-size:14px;font-weight:bold;margin-top:4px;">— Matt Michels</p>
      <p style="color:#888;font-size:12px;">(313) 806-4952 · matt@m2training.com · mattmichelstraining.com</p>
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

    // Find proposal_out leads that haven't had agreement sent
    const { data: leads, error } = await sb
      .from("web_design_leads")
      .select("*")
      .eq("status", "proposal_out")
      .not("email", "is", null);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      log("No proposal_out leads");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emails = leads.map((l: any) => l.email).filter(Boolean);

    // Check which already had agreement sent
    const { data: alreadySent } = await sb
      .from("email_send_log")
      .select("recipient_email")
      .eq("template_name", "proposal_agreement")
      .in("recipient_email", emails);

    const sentSet = new Set((alreadySent || []).map((r: any) => r.recipient_email));
    const eligible = leads.filter((l: any) => l.email && !sentSet.has(l.email));

    log("Eligible for agreement", { count: eligible.length });

    let sent = 0;
    for (const lead of eligible) {
      // Check suppression
      const { data: suppressed } = await sb
        .from("suppressed_emails")
        .select("id")
        .eq("email", lead.email)
        .maybeSingle();
      if (suppressed) continue;

      const html = buildAgreementEmail(lead);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@notify.m2training.com>",
          to: [lead.email],
          subject: `Service Agreement — ${lead.business || lead.name} Website Project`,
          html,
        }),
      });

      if (!res.ok) {
        log("Send failed", { email: lead.email, status: res.status });
        continue;
      }

      await sb.from("email_send_log").insert({
        template_name: "proposal_agreement",
        recipient_email: lead.email,
      });

      sent++;
      log("Agreement sent", { email: lead.email, business: lead.business });
      await new Promise((r) => setTimeout(r, 300));
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[AUTO-PROPOSAL-AGREEMENT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
