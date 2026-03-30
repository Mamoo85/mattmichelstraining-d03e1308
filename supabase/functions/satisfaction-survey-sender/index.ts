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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { clientEmail, customerPhone, customerName } = await req.json();

    if (!clientEmail || !customerPhone || !customerName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: clientEmail, customerPhone, customerName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: client, error: clientError } = await supabase
      .from("satisfaction_survey_clients")
      .select("*")
      .eq("email", clientEmail)
      .eq("active", true)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = `Hi ${customerName}! Thanks for choosing ${client.business_name}. How would you rate your experience? Reply 1-5 (5 = amazing). Your feedback helps us improve!`;

    await sendSms(customerPhone, client.twilio_number, message);

    await supabase
      .from("satisfaction_survey_clients")
      .update({
        survey_count: (client.survey_count || 0) + 1,
      })
      .eq("id", client.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Survey sent to ${customerName} at ${customerPhone}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("satisfaction-survey-sender error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
