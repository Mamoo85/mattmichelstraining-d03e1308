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
  console.log(`[WEB-DESIGN-WINBACK] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

function buildWinbackEmail(lead: any): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e0e0e0;">
    <tr><td style="background:#1a1a2e;padding:20px 24px;text-align:center;">
      <div style="font-size:18px;font-weight:900;color:#f97316;">MATT MICHELS WEB DESIGN</div>
      <div style="font-size:9px;color:#aaa;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Grosse Pointe, MI</div>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="color:#1a1a2e;font-size:15px;font-weight:bold;margin:0 0 6px;">Hey ${lead.name || "there"} —</p>
      <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 16px;">
        We talked a few months back about a website for <strong>${lead.business || "your business"}</strong>. The timing wasn't right — I get it.
      </p>
      <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 16px;">
        I wanted to reach out because I've built a few new demos recently and have some open project slots. If you're still thinking about getting a site done, now's a good time.
      </p>

      <div style="background:#fff8f0;border-left:3px solid #f97316;padding:16px 20px;margin:0 0 20px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#1a1a2e;">What's new since we last talked:</p>
        <ul style="color:#555;font-size:13px;line-height:2;margin:0;padding-left:20px;">
          <li>New demo sites for auto shops, salons, cleaning services, real estate</li>
          <li>Google Business Profile setup now included with every build</li>
          <li>Still $499 to build — no agency markup, no hidden fees</li>
        </ul>
      </div>

      <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 20px;">
        If you want to see what I've built lately or get a quick quote, just reply or text me. No pressure — just wanted to check back in.
      </p>

      <a href="https://mattmichelstraining.com/detroit-web-design" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px;">See Recent Work</a>

      <p style="color:#1a1a2e;font-size:14px;font-weight:bold;margin-top:16px;">— Matt</p>
      <p style="color:#888;font-size:12px;">(313) 806-4952 · matt@m2training.com</p>
    </td></tr>
    <tr><td style="background:#f8f8f8;padding:12px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:11px;margin:0;">Matt Michels Web Design · Grosse Pointe, MI</p>
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

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find closed leads from 90+ days ago
    const { data: leads, error } = await sb
      .from("web_design_leads")
      .select("*")
      .eq("status", "closed")
      .lt("updated_at", ninetyDaysAgo.toISOString())
      .not("email", "is", null);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      log("No winback candidates");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emails = leads.map((l: any) => l.email).filter(Boolean);

    const { data: alreadySent } = await sb
      .from("email_send_log")
      .select("recipient_email")
      .eq("template_name", "web_design_winback")
      .in("recipient_email", emails);

    const sentSet = new Set((alreadySent || []).map((r: any) => r.recipient_email));
    const eligible = leads.filter((l: any) => l.email && !sentSet.has(l.email));

    // Filter out leads explicitly tagged as auto_prospected (cold outreach only, not real conversations)
    const realLeads = eligible.filter((l: any) =>
      !String(l.description || "").includes("SOURCE: auto_prospected")
    );

    log("Winback eligible (real leads)", { count: realLeads.length });

    let sent = 0;
    for (const lead of realLeads) {
      const { data: suppressed } = await sb
        .from("suppressed_emails").select("id").eq("email", lead.email).maybeSingle();
      if (suppressed) continue;

      const html = buildWinbackEmail(lead);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [lead.email],
          subject: `Checking back in — ${lead.business || "your website project"}`,
          html,
        }),
      });

      if (!res.ok) { log("Send failed", { email: lead.email }); continue; }

      await sb.from("email_send_log").insert({ template_name: "web_design_winback", recipient_email: lead.email });
      sent++;
      log("Winback sent", { email: lead.email });
      await new Promise((r) => setTimeout(r, 300));
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[WEB-DESIGN-WINBACK] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
