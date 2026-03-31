import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

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
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Please try again later.</Say></Response>`, { headers: { "Content-Type": "text/xml" } });
    }

    await sb.from("phone_answering_clients").update({ call_count: (client.call_count || 0) + 1 }).eq("id", client.id);

    if (!speechResult) {
      const greeting = client.greeting_script || `Thank you for calling ${client.business_name}. I'm an AI assistant. How can I help you today?`;
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

    let aiResponse = "Thanks for the message. Someone will get back to you shortly.";
    if (LOVABLE_API_KEY) {
      try {
        const claudeRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `You are a professional phone answering AI for ${client.business_name}. A caller said: "${speechResult}". Respond helpfully in 1-2 short sentences. Tell them their message has been noted and someone will follow up. Be warm and professional.` }],
          }),
        });
        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          aiResponse = claudeData?.choices?.[0]?.message?.content || aiResponse;
        }
      } catch { /* use default */ }
    }

    const transcript = `Call from ${fromNumber}\nCaller said: "${speechResult}"\nAI response: "${aiResponse}"`;

    if (LOVABLE_API_KEY && TWILIO_API_KEY && client.email) {
      await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: fromNumber,
          From: toNumber,
          Body: `Thanks for calling ${client.business_name}! Your message has been received. We'll follow up with you shortly. — ${client.contact_name || "The Team"}`,
        }).toString(),
      });

      await sb.from("phone_answering_clients").update({ message_count: (client.message_count || 0) + 1 }).eq("id", client.id);
    }

    if (RESEND_API_KEY && client.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² AI Answering <matt@mattmichelstraining.com>",
          to: [client.email], bcc: ["matthewmichels4@gmail.com"],
          subject: `📞 New call message — ${fromNumber}`,
          html: `<p><strong>New call transcript for ${client.business_name}</strong></p><p>From: ${fromNumber}<br>Call ID: ${callSid}</p><hr/><p><strong>Caller said:</strong> "${speechResult}"</p><p><strong>AI replied:</strong> "${aiResponse}"</p><p>A confirmation text was sent to the caller.<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
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
