import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { agency_name, contact_name, email, phone, vertical, territory,
            sub_vendor_count, monthly_placements, notes } = body;

    if (!email || !agency_name) {
      return new Response(JSON.stringify({ error: "agency_name and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Log to system_comms_log (no dedicated table needed — sales call follow-up)
    await sb.from("system_comms_log").insert({
      channel: "form",
      product: "techalert_msp_inquiry",
      recipient: email,
      body_preview: `MSP Inquiry: ${agency_name} | ${vertical || "—"} | ${territory || "—"} | ${sub_vendor_count || 0} sub-vendors`,
      status: "received",
      metadata: body,
    });

    // Email Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "TechAlert MSP <matt@detroitwebagent.com>",
          to: ["matt@detroitwebagent.com"],
          subject: `🏢 MSP/Enterprise Inquiry — ${agency_name}`,
          html: `
            <div style="font-family:system-ui;max-width:600px;background:#0a1628;color:#fff;padding:24px;border-radius:8px">
              <h2 style="color:#00d4ff;margin:0 0 16px">New Enterprise / MSP Inquiry</h2>
              <table style="width:100%;font-size:14px">
                <tr><td style="padding:6px;color:#94a3b8">Agency:</td><td style="padding:6px"><b>${agency_name}</b></td></tr>
                <tr><td style="padding:6px;color:#94a3b8">Contact:</td><td style="padding:6px">${contact_name || "—"}</td></tr>
                <tr><td style="padding:6px;color:#94a3b8">Email:</td><td style="padding:6px"><a href="mailto:${email}" style="color:#00d4ff">${email}</a></td></tr>
                <tr><td style="padding:6px;color:#94a3b8">Phone:</td><td style="padding:6px">${phone || "—"}</td></tr>
                <tr><td style="padding:6px;color:#94a3b8">Vertical:</td><td style="padding:6px">${vertical || "—"}</td></tr>
                <tr><td style="padding:6px;color:#94a3b8">Territory:</td><td style="padding:6px">${territory || "—"}</td></tr>
                <tr><td style="padding:6px;color:#94a3b8">Sub-vendors:</td><td style="padding:6px">${sub_vendor_count || "—"}</td></tr>
                <tr><td style="padding:6px;color:#94a3b8">Monthly placements:</td><td style="padding:6px">${monthly_placements || "—"}</td></tr>
              </table>
              ${notes ? `<p style="background:#001a33;padding:12px;border-radius:6px;font-size:13px;margin-top:16px"><b style="color:#00d4ff">Notes:</b><br/>${notes}</p>` : ""}
              <p style="margin-top:20px;color:#94a3b8;font-size:12px">⚠️ Enterprise tier requires signed MSA before delivery — schedule a discovery call within 24h.</p>
            </div>
          `,
        }),
      }).catch(() => {});
    }

    // SMS Matt
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && ADMIN_PHONE && TWILIO_PHONE_NUMBER) {
      const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const params = new URLSearchParams({
        To: ADMIN_PHONE,
        From: TWILIO_PHONE_NUMBER,
        Body: `🏢 MSP Inquiry: ${agency_name} (${vertical || "—"}). ${email}. Check email for details.`,
      });
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[msp-inquiry-submit]", e);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
