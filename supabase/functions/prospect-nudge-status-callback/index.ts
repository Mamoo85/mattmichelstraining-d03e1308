// prospect-nudge-status-callback — Twilio StatusCallback webhook for prospect-nudge SMS.
//
// Twilio POSTs delivery updates here for messages sent with product="dwa_prospect_nudge":
//   queued → sent → delivered (success path)
//   queued → sent → undelivered/failed (retry candidates)
//
// Updates two tables:
//   1. system_comms_log.twilio_status / twilio_error_code  (matched by provider_id = MessageSid)
//   2. prospect_nudges.last_nudge_status / last_nudge_error (matched by last_nudge_sid)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyTwilioSignature } from "../_shared/webhook-verify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const sid = params.get("MessageSid") || params.get("SmsSid") || "";
    const status = params.get("MessageStatus") || params.get("SmsStatus") || "";
    const errorCode = params.get("ErrorCode") || null;
    const errorMessage = params.get("ErrorMessage") || null;

    console.log(`[prospect-nudge-status-callback] sid=${sid} status=${status} err=${errorCode || "-"}`);

    if (!sid || !status) {
      return new Response("ok", { status: 200 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("[prospect-nudge-status-callback] missing supabase creds");
      return new Response("ok", { status: 200 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Update system_comms_log row matching this SID
    await sb
      .from("system_comms_log")
      .update({
        twilio_status: status,
        twilio_error_code: errorCode,
      })
      .eq("provider_id", sid);

    // 2. Update prospect_nudges row matching this SID
    await sb
      .from("prospect_nudges")
      .update({
        last_nudge_status: status,
        last_nudge_error: errorCode ? `${errorCode}${errorMessage ? `: ${errorMessage}` : ""}` : null,
      })
      .eq("last_nudge_sid", sid);
  } catch (e) {
    console.error("[prospect-nudge-status-callback] error:", e instanceof Error ? e.message : String(e));
  }

  return new Response("ok", { status: 200 });
});
