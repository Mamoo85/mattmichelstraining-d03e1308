// call-whisper — Twilio whisper URL
// Plays "Detroit Web Agency call" to Matt ONLY before connecting.
// The caller hears normal ringing. Matt hears this, then the call connects.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

serve((_req) => {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew-Neural">Detroit Web Agency call.</Say></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
});
