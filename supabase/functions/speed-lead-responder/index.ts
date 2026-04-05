import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { clientEmail, leadPhone, leadName, leadMessage } = await req.json();

    if (!clientEmail || !leadPhone || !leadName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: client, error: clientError } = await supabase.from("speed_lead_clients").select("*").eq("client_email", clientEmail).eq("active", true).single();
    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const smsBody = `Hi ${leadName}! Thanks for reaching out to ${client.business_name}. We got your message and someone will be in touch shortly. Reply here if you need anything right away!`;

    const smsResult = await sendSMS(leadPhone, client.twilio_number, smsBody, "speed_lead");
    if (!smsResult.success && !smsResult.skipped) console.error("SMS send failed:", smsResult.error);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [client.client_email], bcc: ["matthewmichels4@gmail.com"],
        subject: `🔥 New Lead: ${leadName}`,
        html: `<h2>New Lead Received!</h2><table style="border-collapse:collapse;width:100%;max-width:500px;"><tr><td style="padding:8px;font-weight:bold;">Name:</td><td style="padding:8px;">${leadName}</td></tr><tr><td style="padding:8px;font-weight:bold;">Phone:</td><td style="padding:8px;">${leadPhone}</td></tr><tr><td style="padding:8px;font-weight:bold;">Message:</td><td style="padding:8px;">${leadMessage || "No message"}</td></tr></table><p style="margin-top:16px;color:#666;">An instant SMS has been sent to the lead. Follow up ASAP for best results!<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
      }),
    });
    if (!resendRes.ok) console.error("Resend email failed:", await resendRes.text());

    await supabase.from("speed_lead_clients").update({ lead_count: (client.lead_count || 0) + 1 }).eq("id", client.id);

    return new Response(JSON.stringify({ success: true, message: "Lead responded to instantly" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("speed-lead-responder error:", err);
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
