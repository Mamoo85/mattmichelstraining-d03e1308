import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { referrer_name, referrer_email, friend_name, friend_email, friend_business } = await req.json();
    if (!referrer_email || !friend_email) throw new Error("Missing required fields");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Generate referral code
    const code = `WD-${referrer_email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

    // Store referral
    await sb.from("web_design_referrals" as any).insert({
      referrer_email,
      referrer_name: referrer_name || null,
      referred_email: friend_email,
      referred_business_name: friend_business || null,
      referral_code: code,
      status: "pending",
    });

    // Email Matt about the referral
    if (RESEND_API_KEY) {
      // Notify Matt
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `🔗 New Web Design Referral — ${friend_business || friend_email}`,
          html: `<p><strong>New web design referral submitted!</strong></p>
<p><strong>Referrer:</strong> ${referrer_name || "Unknown"} (${referrer_email})<br>
<strong>Referred:</strong> ${friend_name || "Unknown"} (${friend_email})<br>
<strong>Business:</strong> ${friend_business || "Not specified"}<br>
<strong>Code:</strong> ${code}<br>
<strong>Payout:</strong> $50 when they purchase</p>
<p>Reach out to ${friend_email} ASAP with a free consultation offer.</p>`,
        }),
      });

      // Outreach email to the referred person
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [friend_email],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `${referrer_name || "A friend"} thinks you'd be a great fit — free website consultation`,
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;height:4px;"></div>
  <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
    <p>Hey${friend_name ? " " + friend_name : ""} —</p>
    <p><strong>${referrer_name || "Someone you know"}</strong> thought you might benefit from a professional website for ${friend_business ? `<strong>${friend_business}</strong>` : "your business"}.</p>
    <p>I'm Matt Michels — I build websites for local businesses starting at $499. No templates, no page builders — real custom sites that actually generate leads.</p>
    <p>I'd love to offer you a <strong>free 15-minute consultation</strong> to see if we'd be a good fit. No pressure, no pitch — just an honest conversation about what your business needs online.</p>
    <p><a href="https://www.mattmichelstraining.com/web-design-services?ref=${code}" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;font-size:14px;margin:8px 0;">See My Work & Pricing →</a></p>
    <p>Or just reply to this email — I respond personally within a few hours.</p>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
      <div style="font-size:13px;color:#94a3b8;">
        <strong style="color:#1e293b;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
      </div>
    </div>
  </div>
</div>
</body></html>`,
        }),
      });

      // Confirmation to referrer
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [referrer_email],
          bcc: ["matthewmichels4@gmail.com"],
          subject: "Your referral is in — $50 coming your way if they sign up!",
          html: `<p>Hey ${referrer_name || "there"} —</p>
<p>Got your referral for <strong>${friend_business || friend_email}</strong>. I'm reaching out to them now with a free consultation offer.</p>
<p>If they purchase any web design package ($499+), you'll get <strong>$50 cash</strong> — paid via Venmo, PayPal, or check within 7 days of their purchase.</p>
<p>Thanks for spreading the word!</p>
<p>— Matt<br>(313) 806-4952</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[SEND-WEB-DESIGN-REFERRAL] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
