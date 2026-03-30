import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendSms(to: string, from: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio error: ${errText}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const in1h = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // 24-hour reminders
    const { data: reminders24, error: err24 } = await supabase
      .from("appointment_reminders")
      .select("*, appointment_reminder_clients!inner(business_name, twilio_number, active)")
      .eq("reminded_24h", false)
      .eq("appointment_reminder_clients.active", true)
      .gte("appointment_at", in24h.toISOString())
      .lte("appointment_at", in25h.toISOString());

    if (err24) throw err24;

    let sent24 = 0;
    for (const reminder of reminders24 || []) {
      const client = reminder.appointment_reminder_clients;
      const apptTime = new Date(reminder.appointment_at).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
      });

      const message = `Hi ${reminder.contact_name}! This is a reminder from ${client.business_name}: you have an appointment tomorrow at ${apptTime}. Reply CONFIRM to confirm or call us to reschedule.`;

      await sendSms(reminder.contact_phone, client.twilio_number, message);

      await supabase
        .from("appointment_reminders")
        .update({ reminded_24h: true })
        .eq("id", reminder.id);

      sent24++;
    }

    // 1-hour reminders
    const { data: reminders1h, error: err1h } = await supabase
      .from("appointment_reminders")
      .select("*, appointment_reminder_clients!inner(business_name, twilio_number, active)")
      .eq("reminded_1h", false)
      .eq("appointment_reminder_clients.active", true)
      .gte("appointment_at", in1h.toISOString())
      .lte("appointment_at", in2h.toISOString());

    if (err1h) throw err1h;

    let sent1h = 0;
    for (const reminder of reminders1h || []) {
      const client = reminder.appointment_reminder_clients;
      const apptTime = new Date(reminder.appointment_at).toLocaleString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
      });

      const message = `Hi ${reminder.contact_name}! Just a heads up — your appointment with ${client.business_name} is coming up at ${apptTime} today. See you soon!`;

      await sendSms(reminder.contact_phone, client.twilio_number, message);

      await supabase
        .from("appointment_reminders")
        .update({ reminded_1h: true })
        .eq("id", reminder.id);

      sent1h++;
    }

    return new Response(
      JSON.stringify({ success: true, sent_24h: sent24, sent_1h: sent1h }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("appointment-reminder-sender error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
