import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendSMS } from "../_shared/twilio.ts";

const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const MATT_EMAIL = "matt@mattmichelstraining.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { to, email } = await req.json();

    if (email !== MATT_EMAIL && email !== "matthewmichels4@gmail.com") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to' phone number" }), { status: 400 });
    }

    if (!TWILIO_PHONE_NUMBER) {
      return new Response(
        JSON.stringify({ error: "TWILIO_PHONE_NUMBER secret not set in Supabase" }),
        { status: 500 }
      );
    }

    const result = await sendSMS(
      to,
      TWILIO_PHONE_NUMBER,
      "This is a test from M² Development. If you received this, Twilio is working! 🎉",
      "test-sms"
    );

    return new Response(JSON.stringify({
      ...result,
      from: TWILIO_PHONE_NUMBER,
      to,
      timestamp: new Date().toISOString(),
    }), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
