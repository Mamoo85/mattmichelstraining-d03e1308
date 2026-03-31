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

const PARTNER_REFERRAL_LINK = "https://mattmichelstraining.com/detroit-web-design?ref=partner";

function buildWelcomeKitEmail(name: string, business: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border:1px solid #e0e0e0;">
    <tr><td style="background:#1a1a2e;padding:24px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#f97316;">MATT MICHELS WEB DESIGN</div>
      <div style="font-size:10px;color:#aaa;letter-spacing:4px;text-transform:uppercase;margin-top:4px;">Referral Partner Program</div>
    </td></tr>
    <tr><td style="padding:32px 28px;">
      <p style="color:#1a1a2e;font-size:16px;font-weight:bold;margin:0 0 6px;">Welcome to the partner program, ${name}!</p>
      <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 20px;">
        I appreciate you joining. Here's everything you need to start earning $100 per referral.
      </p>

      <div style="background:#fff8f0;border-left:3px solid #f97316;padding:16px 20px;margin:0 0 20px;">
        <h3 style="color:#1a1a2e;font-size:13px;font-weight:bold;margin:0 0 8px;text-transform:uppercase;">Your Referral Link</h3>
        <p style="font-family:monospace;font-size:13px;color:#f97316;margin:0;word-break:break-all;">${PARTNER_REFERRAL_LINK}&partner=${encodeURIComponent(email)}</p>
        <p style="color:#888;font-size:12px;margin:8px 0 0;">Share this link with any local business owner who needs a website.</p>
      </div>

      <h3 style="color:#1a1a2e;font-size:14px;font-weight:bold;margin:0 0 12px;">HOW IT WORKS</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        ${[
          ["01", "Share your referral link with a business owner who needs a website"],
          ["02", "They click the link and fill out the inquiry form on my site"],
          ["03", "I close the deal and build their site ($499 build fee)"],
          ["04", "You receive $100 cash — Venmo, PayPal, or check within 7 days of site launch"],
        ].map(([n, t]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top;width:32px;">
            <span style="display:inline-block;background:#f97316;color:#fff;font-size:11px;font-weight:900;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;">${n}</span>
          </td>
          <td style="padding:10px 0 10px 12px;font-size:13px;color:#444;border-bottom:1px solid #eee;line-height:1.6;">${t}</td>
        </tr>`).join("")}
      </table>

      <h3 style="color:#1a1a2e;font-size:14px;font-weight:bold;margin:0 0 12px;">WHAT I BUILD</h3>
      <ul style="color:#555;font-size:13px;line-height:2;margin:0 0 20px;">
        <li>Professional websites for local trades & service businesses</li>
        <li>$499 one-time build fee · $49/month hosting & maintenance</li>
        <li>Plumbers, electricians, roofers, cleaners, salons, restaurants, etc.</li>
        <li>Typical turnaround: 1–2 weeks</li>
      </ul>

      <div style="background:#f8f8f8;padding:16px 20px;border:1px solid #eee;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#444;"><strong>Best referral targets:</strong> Any local business with no website, a bad website, or a site that hasn't been updated in 3+ years. If they show up on Yelp with no site link — they're a perfect lead.</p>
      </div>

      <p style="color:#555;font-size:13px;line-height:1.7;">Questions? Just reply to this email or text me at (313) 806-4952.</p>
      <p style="color:#1a1a2e;font-size:14px;font-weight:bold;margin-top:20px;">— Matt</p>
    </td></tr>
    <tr><td style="background:#f8f8f8;padding:14px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:11px;margin:0;">Matt Michels Web Design · (313) 806-4952 · Grosse Pointe, MI</p>
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
    const { name, business, email, phone, how_they_heard } = await req.json();
    if (!email || !name) throw new Error("name and email are required");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Insert as lead with partner tag
    await sb.from("web_design_leads").upsert({
      name,
      business: business || name,
      email,
      phone: phone || null,
      status: "new",
      description: `SOURCE: partner_inquiry | HOW_HEARD: ${how_they_heard || "web"} | Signed up as referral partner on ${new Date().toLocaleDateString()}`,
    }, { onConflict: "email" });

    // Check suppression
    const { data: suppressed } = await sb
      .from("suppressed_emails").select("id").eq("email", email).maybeSingle();

    if (!suppressed) {
      // Dedup
      const { data: already } = await sb
        .from("email_send_log").select("id")
        .eq("template_name", "partner_welcome_kit").eq("recipient_email", email).maybeSingle();

      if (!already) {
        const html = buildWelcomeKitEmail(name, business || name, email);

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [email],
            subject: "Welcome to the referral program — your link is inside",
            html,
          }),
        });

        await sb.from("email_send_log").insert({
          template_name: "partner_welcome_kit",
          recipient_email: email,
        });
      }
    }

    // Notify admin
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "M² Site <matt@mattmichelstraining.com>",
        to: ["matt@m2training.com"],
        subject: `New Partner Signup: ${name} (${business || "no business"})`,
        html: `<p>New referral partner: <strong>${name}</strong> — ${email} — ${phone || "no phone"} — ${business || "no business"}</p><p>How heard: ${how_they_heard || "not specified"}</p>`,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PARTNER-ONBOARDING] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
