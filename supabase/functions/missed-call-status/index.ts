// missed-call-status — Twilio <Dial> action callback for +13139921219
// Fires when the forwarded call to Matt's phone completes (answered or missed).
// If Matt didn't answer (no-answer / busy / failed), queues a 5-minute delayed text-back
// by inserting into pending_sms. The process-pending-sms cron handles delivery.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendSMS } from "../_shared/twilio.ts";

const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const MISSED_STATUSES = new Set(["no-answer", "busy", "failed"]);

const TEXT_BODY =
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

    console.log(`[missed-call-status] DialCallStatus=${dialStatus} from=${callerPhone}`);

    if (MISSED_STATUSES.has(dialStatus) && callerPhone) {
      const result = await sendSMS(callerPhone, TWILIO_PHONE_NUMBER, TEXT_BODY, "missed_call");
      if (result.success) {
        console.log(`[missed-call-status] Text-back sent to ${callerPhone} — SID: ${result.sid}`);
      } else {
        console.error(`[missed-call-status] Text-back failed for ${callerPhone}:`, result.error);
      }
    } else {
      console.log(`[missed-call-status] Call answered (status=${dialStatus}) — no text needed`);
    }
  } catch (e: unknown) {
    console.error("[missed-call-status] Error:", e instanceof Error ? e.message : String(e));
  }

  return new Response(TWIML_EMPTY, { headers: { "Content-Type": "text/xml" } });
});
