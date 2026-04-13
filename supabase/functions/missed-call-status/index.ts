// missed-call-status — Twilio <Dial> action callback
// Multi-tenant: serves both Matt's DWA number AND customer subscription numbers.
// Fires when a forwarded call completes (answered or missed).
// If no-answer/busy/failed, texts back the caller with the right business name.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const MISSED_STATUSES = new Set(["no-answer", "busy", "failed"]);

// Default text for Matt's DWA number
const DWA_TEXT_BODY =
  "Hey, this is Matt with Detroit Web Agency — sorry I missed your call! " +
  "Text back what you need and I'll get right back to you. — Matt (313) 992-1219";

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(TWIML_EMPTY, { headers: { "Content-Type": "text/xml" } });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);

    const dialStatus = params.get("DialCallStatus") || params.get("CallStatus") || "";
    const callerPhone = params.get("From") || "";
    // "Called" = the Twilio number that was originally dialed
    const calledNumber = params.get("Called") || params.get("To") || TWILIO_PHONE_NUMBER;

    console.log(`[missed-call-status] DialCallStatus=${dialStatus} from=${callerPhone} called=${calledNumber}`);

    if (!MISSED_STATUSES.has(dialStatus) || !callerPhone) {
      console.log(`[missed-call-status] Call answered or no caller (status=${dialStatus}) — no text needed`);
      return new Response(TWIML_EMPTY, { headers: { "Content-Type": "text/xml" } });
    }

    // ── MULTI-TENANT: check if this is a customer subscription number ──────
    if (calledNumber !== TWILIO_PHONE_NUMBER && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: client } = await sb
        .from("missed_call_clients")
        .select("business_name, response_message")
        .eq("twilio_number", calledNumber)
        .maybeSingle();

      if (client) {
        const bizName = (client as any).business_name || "us";
        const customMsg = (client as any).response_message;
        const textBody = customMsg ||
          `Hey! This is ${bizName} — sorry we missed your call. Text back what you need and we'll get right with you.`;
        const result = await sendSMS(callerPhone, calledNumber, textBody, "missed_call");
        if (result.success) {
          console.log(`[missed-call-status] Text-back sent to ${callerPhone} for ${bizName} — SID: ${result.sid}`);
        } else {
          console.error(`[missed-call-status] Text-back failed for ${callerPhone}:`, result.error);
        }
        return new Response(TWIML_EMPTY, { headers: { "Content-Type": "text/xml" } });
      }
    }

    // ── DWA MODE: Matt's number ────────────────────────────────────────────
    const result = await sendSMS(callerPhone, TWILIO_PHONE_NUMBER, DWA_TEXT_BODY, "missed_call");
    if (result.success) {
      console.log(`[missed-call-status] DWA text-back sent to ${callerPhone} — SID: ${result.sid}`);
    } else {
      console.error(`[missed-call-status] DWA text-back failed for ${callerPhone}:`, result.error);
    }
  } catch (e: unknown) {
    console.error("[missed-call-status] Error:", e instanceof Error ? e.message : String(e));
  }

  return new Response(TWIML_EMPTY, { headers: { "Content-Type": "text/xml" } });
});
