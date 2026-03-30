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
      .from("thank_you_sms_clients")
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

    const prompt = `Write a single warm, personalized thank-you sentence from ${client.business_name} (a ${client.industry} business) to a customer named ${customerName}. Keep it under 140 characters. Be genuine, not corporate. Do not use quotes around the message.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiResponse.json();
    const thankYouMessage = aiData.content?.[0]?.text?.trim() || `Thanks so much for choosing ${client.business_name}, ${customerName}! We truly appreciate your business.`;

    await sendSms(customerPhone, client.twilio_number, thankYouMessage);

    await supabase
      .from("thank_you_sms_clients")
      .update({
        thanks_sent: (client.thanks_sent || 0) + 1,
      })
      .eq("id", client.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Thank you SMS sent to ${customerName}`,
        text: thankYouMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("thank-you-sms-sender error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
