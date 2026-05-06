// voicemail-transcription-handler — Twilio transcribeCallback webhook.
// Fires after Twilio transcribes a voicemail left on the DWA number.
// Sends Matt an SMS with the transcript and stores it in missed_call_captures.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const transcript = params.get("TranscriptionText") || "";
    const callerPhone = params.get("From") || params.get("Called") || "";
    const status = params.get("TranscriptionStatus") || "";
    const recordingUrl = params.get("RecordingUrl") || "";
    const recordingDuration = parseInt(params.get("RecordingDuration") || "0", 10) || null;

    if (status !== "completed" || !transcript) return new Response("ok", { status: 200 });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Update the capture row with the transcript + recording playback URL
    await sb.from("missed_call_captures")
      .update({
        voicemail_transcript: transcript.slice(0, 1000),
        recording_url: recordingUrl ? `${recordingUrl}.mp3` : null,
        recording_duration: recordingDuration,
      })
      .eq("caller_number", callerPhone)
      .order("created_at", { ascending: false })
      .limit(1);

    // SMS Matt the transcript
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `🎙️ Voicemail from ${callerPhone}: "${transcript.slice(0, 140)}"`,
      "voicemail_transcript",
      false,
      { bypassQuietHours: true }
    );

    // CRM bridge: push caller into HubSpot so voicemails land in the pipeline
    import("../_shared/hubspot.ts").then(({ upsertContact }) =>
      upsertContact({
        email: `voicemail-${callerPhone.replace(/\D/g, "")}@missed-call.dwa.local`,
        phone: callerPhone,
        dwa_signal_source: "missed_call",
        hs_lead_status: "NEW",
      })
    ).catch(() => {});
  } catch (e) {
    console.error("[voicemail-transcription-handler]", e);
  }
  return new Response("ok", { status: 200 });
});
