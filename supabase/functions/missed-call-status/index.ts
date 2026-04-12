// missed-call-status — Twilio <Dial> action callback for +13139921219
// Fires when the forwarded call to Matt's phone completes (answered or missed).
// If Matt didn't answer (no-answer / busy / failed), queues a 5-minute delayed text-back
// by inserting into pending_sms. The process-pending-sms cron handles delivery.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const MISSED_STATUSES = new Set(["no-answer", "busy", "failed"]);

const TEXT_BODY =
  "Hey, it's Matt from Detroit Web Agency — sorry I missed your call! " +
  "What were you calling about? I'll get back to you ASAP. — Matt (313) 992-1219";

serve(async (req) => {
  if (req.method !== "POST") {
    // Must return valid TwiML — Twilio ignores the body but expects 200 + XML
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
      headers: { "Content-Type": "text/xml" },
    });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);

    const dialStatus = params.get("DialCallStatus") || params.get("CallStatus") || "";
    const callerPhone = params.get("From") || "";

    console.log(`[missed-call-status] DialCallStatus=${dialStatus} from=${callerPhone}`);

    if (MISSED_STATUSES.has(dialStatus) && callerPhone) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Schedule text to go out 5 minutes from now
      const sendAfter = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error } = await sb.from("pending_sms").insert({
        to_phone: callerPhone,
        from_phone: TWILIO_PHONE_NUMBER,
        body: TEXT_BODY,
        send_after: sendAfter,
        product: "missed_call",
      });

      if (error) {
        console.error("[missed-call-status] Failed to queue SMS:", error.message);
      } else {
        console.log(`[missed-call-status] Queued text-back to ${callerPhone} for ${sendAfter}`);
      }
    } else {
      console.log(`[missed-call-status] Call was answered (status=${dialStatus}) — no text needed`);
    }
  } catch (e: unknown) {
    console.error("[missed-call-status] Error:", e instanceof Error ? e.message : String(e));
  }

  // Always return valid empty TwiML — Twilio expects this from the action URL
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    headers: { "Content-Type": "text/xml" },
  });
});
