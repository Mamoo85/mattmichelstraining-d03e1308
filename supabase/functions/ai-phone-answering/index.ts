import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

// Twilio calls this webhook when a call comes in to the client's Twilio number.
// We use TwiML <Gather> to collect speech, Claude to generate a response,
// then <Say> the response. We also SMS + email the transcript to the client.
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const toNumber = params.get("To") || "";
    const fromNumber = params.get("From") || "";
    const speechResult = params.get("SpeechResult") || "";
    const callSid = params.get("CallSid") || "";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: client } = await sb
      .from("phone_answering_clients")
      .select("id, business_name, contact_name, email, greeting_script, call_count, message_count")
      .eq("twilio_number", toNumber)
      .eq("active", true)
      .single();

    if (!client) {
      // No client found — just hang up politely
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Please try again later.</Say></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Increment call count
    await sb.from("phone_answering_clients")
      .update({ call_count: (client.call_count || 0) + 1 })
      .eq("id", client.id);

    // If no speech yet — greet and gather
    if (!speechResult) {
      const greeting = client.greeting_script ||
        `Thank you for calling ${client.business_name}. I'm an AI assistant. How can I help you today?`;

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${SUPABASE_URL}/functions/v1/ai-phone-answering" method="POST">
    <Say voice="Polly.Joanna">${greeting}</Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't catch that. Please call back and we'll be happy to help. Goodbye!</Say>
</Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // We have speech — ask Claude to respond
    let aiResponse = "Thanks for the message. Someone will get back to you shortly.";
    if (ANTHROPIC_API_KEY) {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `You are a professional phone answering AI for ${client.business_name}. A caller said: "${speechResult}". Respond helpfully in 1-2 short sentences. Tell them their message has been noted and someone will follow up. Be warm and professional.`,
          }],
        }),
      });
      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        aiResponse = claudeData?.content?.[0]?.text || aiResponse;
      }
    }

    // Send transcript to client via SMS and email
    const transcript = `Call from ${fromNumber}\nCaller said: "${speechResult}"\nAI response: "${aiResponse}"`;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && client.email) {
      // SMS to client's business phone
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({
          To: fromNumber,  // confirm message to caller
          From: toNumber,
          Body: `Thanks for calling ${client.business_name}! Your message has been received. We'll follow up with you shortly. — ${client.contact_name || "The Team"}`,
        }).toString(),
      });

      await sb.from("phone_answering_clients")
        .update({ message_count: (client.message_count || 0) + 1 })
        .eq("id", client.id);
    }

    if (RESEND_API_KEY && client.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² AI Answering <matt@notify.m2training.com>",
          to: [client.email],
          subject: `📞 New call message — ${fromNumber}`,
          html: `<p><strong>New call transcript for ${client.business_name}</strong></p><p>From: ${fromNumber}<br>Call ID: ${callSid}</p><hr/><p><strong>Caller said:</strong> "${speechResult}"</p><p><strong>AI replied:</strong> "${aiResponse}"</p><p>A confirmation text was sent to the caller.</p>`,
        }),
      });
    }

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${aiResponse} Goodbye!</Say>
</Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (e: any) {
    console.error("[AI-PHONE-ANSWERING] Error:", e);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're experiencing technical difficulties. Please call back later. Thank you.</Say></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
