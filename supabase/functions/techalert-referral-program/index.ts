/**
 * techalert-referral-program — Automated referral system for TechAlert
 * After 30+ days active, sends referral offer email.
 * "Give a friend 1 month free, get $50 credit."
 * Tracks referrals in techalert_referrals table.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCode(businessName: string): string {
  const clean = businessName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${clean}-${suffix}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));

    // MODE 1: Check/apply referral code during checkout
    if (body.action === "validate_code") {
      const { code } = body;
      if (!code) return new Response(JSON.stringify({ valid: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: referral } = await sb
        .from("techalert_referrals")
        .select("*")
        .eq("referral_code", code.toUpperCase())
        .eq("status", "pending")
        .maybeSingle();

      return new Response(
        JSON.stringify({ valid: !!referral, referral }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MODE 2: Record a successful referral conversion
    if (body.action === "convert") {
      const { code, referred_email } = body;
      if (!code || !referred_email) {
        return new Response(JSON.stringify({ error: "Missing code or email" }), { status: 400, headers: corsHeaders });
      }

      // Find the referral record
      const { data: ref } = await sb
        .from("techalert_referrals")
        .select("*")
        .eq("referral_code", code.toUpperCase())
        .eq("status", "pending")
        .maybeSingle();

      if (!ref) {
        return new Response(JSON.stringify({ error: "Invalid or already used code" }), { status: 400, headers: corsHeaders });
      }

      // Update referral status
      await sb.from("techalert_referrals").update({
        status: "converted",
        referred_email,
        credited_at: new Date().toISOString(),
      }).eq("id", ref.id);

      // Email Matt about the credit
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "DWA Referrals <matt@detroitwebagent.com>",
          to: ["matt@detroitwebagent.com"],
          subject: `🎉 Referral converted! Credit $50 to ${ref.referrer_email}`,
          html: `<p>Referral code <strong>${code}</strong> was used by ${referred_email}.</p>
                 <p>Credit <strong>$50</strong> to referrer: ${ref.referrer_email}</p>
                 <p>Apply in Stripe dashboard or use the API.</p>`,
        }),
      });

      return new Response(
        JSON.stringify({ ok: true, referrer: ref.referrer_email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MODE 3: Generate and send referral offers to eligible clients (cron)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: clients } = await sb
      .from("hire_alert_clients")
      .select("id, email, business_name, referral_code, created_at")
      .eq("active", true)
      .lte("created_at", thirtyDaysAgo);

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200, headers: corsHeaders });
    }

    let sent = 0;

    for (const client of clients) {
      // Skip if already has a referral code
      if (client.referral_code) continue;

      const code = generateCode(client.business_name || "TECH");

      // Save code to client
      await sb.from("hire_alert_clients").update({ referral_code: code }).eq("id", client.id);

      // Create referral record
      await sb.from("techalert_referrals").insert({
        referrer_client_id: client.id,
        referrer_email: client.email,
        referred_email: "",
        referral_code: code,
        status: "pending",
      });

      // Send referral offer email
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt at Detroit Web Agent <matt@detroitwebagent.com>",
          to: [client.email],
          subject: "Give a friend 1 month free TechAlert — get $50 credit",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:white;padding:40px;border-radius:12px;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:11px;letter-spacing:3px;color:#00d4ff;">DETROIT WEB AGENT</div>
                <h1 style="font-size:24px;margin:16px 0;">You've earned a referral reward 🎉</h1>
              </div>
              <p style="color:#94a3b8;line-height:1.6;">
                You've been using TechAlert for 30+ days. Share your referral code with another contractor — 
                they get <strong style="color:white;">their first month FREE</strong>, and you get a 
                <strong style="color:#00d4ff;">$50 credit</strong> on your next invoice.
              </p>
              <div style="background:#1e293b;border:2px solid #00d4ff;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
                <div style="font-size:12px;color:#64748b;margin-bottom:8px;">YOUR REFERRAL CODE</div>
                <div style="font-size:28px;font-weight:bold;color:#00d4ff;letter-spacing:2px;">${code}</div>
              </div>
              <p style="color:#94a3b8;font-size:14px;">
                Just tell them to mention code <strong style="color:white;">${code}</strong> when they sign up, 
                or forward this email. We'll handle the rest.
              </p>
              <div style="border-top:1px solid #1e293b;margin-top:32px;padding-top:16px;font-size:12px;color:#475569;">
                Matt Michels — Detroit Web Agent<br/>
                (313) 992-1219 · matt@detroitwebagent.com
              </div>
            </div>`,
        }),
      });

      sent++;
    }

    console.log(`[techalert-referral-program] Sent ${sent} referral offers`);
    return new Response(
      JSON.stringify({ ok: true, sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[techalert-referral-program] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
