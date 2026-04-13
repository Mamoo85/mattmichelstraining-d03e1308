// create-hire-alert-trial
// No-card trial signup for TechAlert. Matt manually provisions this after "Reply YES" to Tom's cold email.
// POST { name, email, phone, business_name, target_roles[] }
// Inserts into hire_alert_clients with trial_status='active', trial_ends_at=now()+72h

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const MATT_CELL = "+13139921219";
const FROM_EMAIL = "TechAlert <matt@detroitwebagent.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { name, email, phone, business_name, target_roles } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trialEndsAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const firstName = name ? name.split(" ")[0] : business_name || "there";

    // Insert trial client
    const { data: client, error } = await sb.from("hire_alert_clients").insert({
      owner_name: name || business_name || "",
      owner_email: email,
      phone: phone || null,
      company_name: business_name || "",
      target_roles: target_roles || ["Boiler Operator", "HVAC Technician", "Plumber"],
      active: false, // not a paid subscriber yet
      trial_status: "active",
      trial_started_at: new Date().toISOString(),
      trial_ends_at: trialEndsAt,
    }).select("id").single();

    if (error) throw error;

    // Send welcome email
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          reply_to: "matt@detroitwebagent.com",
          subject: "Your TechAlert 3-Day Trial Is Live",
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a1628;padding:32px;border-radius:12px;max-width:520px;margin:0 auto;">
<p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">⚡ TECHALERT — 3-DAY TRIAL</p>
<h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 16px;">Hey ${firstName} — you're in.</h2>
<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">For the next 72 hours, TechAlert will scan Michigan MIOSHA license records, Apollo, and live job boards every morning for available ${(target_roles || ["tradespeople"])[0]}s in your area.</p>
<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">When we find a score 7+ candidate, you'll get an email instantly. Score 5-6 goes in the daily digest.</p>
<p style="color:#e2e8f0;font-size:15px;margin:0 0 24px;"><strong>Trial ends:</strong> ${new Date(trialEndsAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${new Date(trialEndsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })} ET</p>
<p style="color:#64748b;font-size:13px;margin:0;">Questions? Text Matt: (313) 992-1219</p>
</div>`,
        }),
      });
    }

    // SMS welcome to client if phone provided
    if (phone) {
      await sendSMS(
        phone,
        TWILIO_PHONE_NUMBER,
        `Hey ${firstName} — your TechAlert 3-day trial is live. We'll text you when we find a solid candidate. Trial runs 72 hours. — Matt (313) 992-1219`,
        "hire_alert"
      );
    }

    // Notify Matt
    await sendSMS(
      MATT_CELL,
      TWILIO_PHONE_NUMBER,
      `✅ New TechAlert trial: ${business_name || name || email}. Trial ends in 72h. ID: ${client.id}`,
      "hire_alert"
    );

    return new Response(
      JSON.stringify({ ok: true, client_id: client.id, trial_ends_at: trialEndsAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-hire-alert-trial] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
