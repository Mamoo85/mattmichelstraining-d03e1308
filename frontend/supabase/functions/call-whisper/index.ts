// call-whisper — Twilio whisper URL
// Plays "Detroit Web Agency call from [number]" to Matt ONLY before connecting.
// The caller hears normal ringing. Matt hears this, then the call connects.
// Twilio POSTs call params (including From) to this URL when the <Number url="..."> is dialed.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

function formatNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `${d.slice(0, 3)}, ${d.slice(3, 6)}, ${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}, ${digits.slice(3, 6)}, ${digits.slice(6)}`;
  }
  return raw;
}

serve(async (req) => {
  let callerSay = "unknown caller";
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get("From") || params.get("from") || "";
    if (from) callerSay = formatNumber(from);
  } catch {
    // fall through to default
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Detroit Web Agency call from ${callerSay}.</Say></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
});
