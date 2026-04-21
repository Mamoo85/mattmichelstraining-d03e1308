// contractor-welcome-status-callback — Twilio StatusCallback receiver.
// Wire this up in Twilio messaging service (or per-message StatusCallback URL)
// so delivery state propagates back into contractor_welcome_log.
//
// Twilio posts: MessageSid, MessageStatus, ErrorCode (if any), To, From.
// We match by MessageSid → twilio_sid and update twilio_status + twilio_error_code.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Twilio posts as application/x-www-form-urlencoded
    const formData = await req.formData().catch(() => null);
    const params: Record<string, string> = {};
    if (formData) {
      for (const [k, v] of formData.entries()) params[k] = String(v);
    } else {
      // Fall back to JSON for manual testing
      const json = await req.json().catch(() => ({}));
      Object.assign(params, json);
    }

    const sid = params.MessageSid || params.SmsSid;
    const twilioStatus = (params.MessageStatus || params.SmsStatus || "").toLowerCase();
    const errorCode = params.ErrorCode || null;

    if (!sid) {
      return new Response(JSON.stringify({ error: "missing_sid" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Map Twilio status → our internal status when terminal
    // Twilio terminal states: delivered, undelivered, failed
    let internalStatus: string | undefined;
    if (twilioStatus === "delivered") internalStatus = "delivered";
    else if (twilioStatus === "undelivered" || twilioStatus === "failed") internalStatus = "failed";

    const update: Record<string, any> = {
      twilio_status: twilioStatus,
      twilio_error_code: errorCode,
    };
    if (internalStatus) update.status = internalStatus;
    if (errorCode) update.error_message = `Twilio error ${errorCode}`;

    const { error } = await sb
      .from("contractor_welcome_log" as any)
      .update(update)
      .eq("twilio_sid", sid);

    if (error) {
      console.error("[contractor-welcome-status-callback] update failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, sid, twilioStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[contractor-welcome-status-callback] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
