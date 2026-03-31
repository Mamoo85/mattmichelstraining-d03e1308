import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendSms(to: string, from: string, body: string) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio gateway error: ${await res.text()}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { clientEmail, customerPhone, customerName } = await req.json();
    if (!clientEmail || !customerPhone || !customerName) {
      return new Response(JSON.stringify({ error: "Missing required fields: clientEmail, customerPhone, customerName" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: client, error: clientError } = await supabase.from("thank_you_sms_clients").select("*").eq("email", clientEmail).eq("active", true).single();
    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let thankYouMessage = `Thanks so much for choosing ${client.business_name}, ${customerName}! We truly appreciate your business.`;
    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Write a single warm, personalized thank-you sentence from ${client.business_name} (a ${client.industry} business) to a customer named ${customerName}. Keep it under 140 characters. Be genuine, not corporate. Do not use quotes around the message.` }],
          }),
        });
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          thankYouMessage = aiData?.choices?.[0]?.message?.content?.trim() || thankYouMessage;
        }
      } catch { /* use default */ }
    }

    await sendSms(customerPhone, client.twilio_number, thankYouMessage);

    await supabase.from("thank_you_sms_clients").update({ thanks_sent: (client.thanks_sent || 0) + 1 }).eq("id", client.id);

    return new Response(JSON.stringify({ success: true, message: `Thank you SMS sent to ${customerName}`, text: thankYouMessage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("thank-you-sms-sender error:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : "Unknown error") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
