// Custom enterprise plan request — public endpoint
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json();
    const { company_name, contact_name, email, phone, target_accounts, geographic_radius, message } = body || {};
    if (!company_name || !email) {
      return new Response(JSON.stringify({ error: "company_name and email required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: row, error } = await sb.from("buyer_radar_custom_requests" as any).insert({
      company_name, contact_name, email, phone,
      target_accounts: target_accounts ? Number(target_accounts) : null,
      geographic_radius, message,
    }).select().single();
    if (error) throw error;

    // Fire-and-forget notifications
    const notify = async () => {
      const subj = `🎯 Buyer Radar Custom Request — ${company_name}`;
      const html = `<h2>New Buyer Radar Enterprise Inquiry</h2>
<p><b>Company:</b> ${company_name}</p>
<p><b>Contact:</b> ${contact_name || "—"}</p>
<p><b>Email:</b> ${email}</p>
<p><b>Phone:</b> ${phone || "—"}</p>
<p><b>Target accounts:</b> ${target_accounts || "—"}</p>
<p><b>Geographic radius:</b> ${geographic_radius || "—"}</p>
<p><b>Message:</b><br/>${(message || "").replace(/\n/g, "<br/>")}</p>`;
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Buyer Radar <matt@detroitwebagent.com>",
            to: [ADMIN_EMAIL], subject: subj, html,
          }),
        }).catch(() => {});
      }
      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && ADMIN_PHONE) {
        const sms = `Buyer Radar custom: ${company_name} (${email}). ${target_accounts || "?"} accounts.`;
        const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const form = new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_PHONE_NUMBER, Body: sms });
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        }).catch(() => {});
      }
    };
    notify();

    return new Response(JSON.stringify({ ok: true, id: row.id }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[request-buyer-radar-custom]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
