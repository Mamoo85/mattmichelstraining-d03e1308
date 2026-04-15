// missed-call-handler — Twilio VoiceUrl webhook
// Multi-tenant: serves both Matt's DWA number AND customer subscription numbers.
// For customer numbers: looks up missed_call_clients, forwards to their business phone.
// For Matt's DWA number (+13139921219): forwards to Matt's personal Google Fi.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const MATT_PERSONAL = Deno.env.get("MATT_PERSONAL_PHONE") || "+13138064952";

const TWIML_HEADERS = { "Content-Type": "text/xml" };

function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: TWIML_HEADERS,
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return twiml("<Hangup/>");
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const fromNumber = params.get("From") || "";
    const toNumber = params.get("To") || "";

    console.log(`[missed-call-handler] Call from=${fromNumber} to=${toNumber}`);

    if (!fromNumber) {
      return twiml("<Hangup/>");
    }

    const statusUrl = `${SUPABASE_URL}/functions/v1/missed-call-status`;
    const whisperUrl = `${SUPABASE_URL}/functions/v1/call-whisper`;

    // ── MULTI-TENANT: check if this is a customer subscription number ──────
    if (toNumber && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: client } = await sb
        .from("missed_call_clients")
        .select("business_phone, business_name")
        .eq("twilio_number", toNumber)
        .maybeSingle();

      if (client) {
        const bizName = (client as any).business_name || "us";
        const bizPhone = (client as any).business_phone;

        if (!bizPhone) {
          // No forwarding phone stored — play message, status callback will text caller
          return twiml(
            `<Say voice="alice">You've reached ${bizName}. We're sorry we missed your call — we'll text you right back shortly.</Say>` +
            `<Hangup/>`
          );
        }

        // Forward to the business owner's phone; action URL fires when dial completes
        return twiml(
          `<Dial timeout="25" action="${statusUrl}" method="POST">` +
          `<Number>${bizPhone}</Number>` +
          `</Dial>` +
          `<Say voice="alice">You've reached ${bizName}. We'll text you right back.</Say>` +
          `<Hangup/>`
        );
      }
    }

    // ── SELF-CALL DETECTION: skip forwarding when Matt calls his own line ──
    if (fromNumber === MATT_PERSONAL) {
      return twiml(
        `<Say voice="alice">You've reached Detroit Web Agency. We missed your call but we'll text you right back shortly.</Say>` +
        `<Hangup/>`
      );
    }

    // ── DWA MODE: Matt's personal number (+13139921219) ────────────────────
    return twiml(
      `<Dial timeout="25" action="${statusUrl}" method="POST">` +
      `<Number>${MATT_PERSONAL}</Number>` +
      `</Dial>` +
      `<Say voice="alice">You've reached Detroit Web Agency. Check your texts — Matt just sent you one. Talk soon.</Say>` +
      `<Hangup/>`
    );
  } catch (e: unknown) {
    console.error("[missed-call-handler] Error:", e instanceof Error ? e.message : String(e));
    return twiml("<Hangup/>");
  }
});
