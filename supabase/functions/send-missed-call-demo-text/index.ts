// send-missed-call-demo-text — public landing-page "Try It Live" demo.
// Sends a single SMS from the DWA Twilio number to a prospect's phone using
// the exact production missed-call template. Rate-limited per phone + IP to
// prevent abuse. Logs every send to system_comms_log with product='missed_call_demo'.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DWA_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limit (per cold-start instance)
const phoneCooldown = new Map<string, number>(); // phone -> last send ms
const ipBucket = new Map<string, { count: number; windowStart: number }>(); // ip -> {count, windowStart}
const COOLDOWN_MS = 10 * 60 * 1000; // 10 min per phone
const IP_LIMIT = 3; // max 3 sends per IP per hour
const IP_WINDOW_MS = 60 * 60 * 1000;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, city } = await req.json();
    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ error: "phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const e164 = normalizePhone(phone);
    if (!e164) {
      return new Response(JSON.stringify({ error: "Enter a valid 10-digit US phone number." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-phone cooldown
    const last = phoneCooldown.get(e164);
    if (last && Date.now() - last < COOLDOWN_MS) {
      const mins = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 60000);
      return new Response(JSON.stringify({
        error: `Demo already sent. Try again in ${mins} min.`,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Per-IP rate limit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const bucket = ipBucket.get(ip);
    const now = Date.now();
    if (bucket && now - bucket.windowStart < IP_WINDOW_MS) {
      if (bucket.count >= IP_LIMIT) {
        return new Response(JSON.stringify({
          error: "Too many demo requests. Try again later.",
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      bucket.count += 1;
    } else {
      ipBucket.set(ip, { count: 1, windowStart: now });
    }

    const safeCity = (typeof city === "string" && city.trim().length > 0 && city.length < 60)
      ? city.trim().replace(/[^A-Za-z .'-]/g, "")
      : "your area";

    const body = `Hey! I just missed your call from ${safeCity} — I'll call you right back! What can I help you with? — Detroit Web Agency [DEMO]`;

    const result = await sendSMS(e164, DWA_FROM, body, "missed_call_demo");
    if (!result.success) {
      const reason = (result.error || "").toLowerCase();
      // Friendly handling for TCPA quiet-hours + opt-out — return 200 so the UI shows a soft message
      if (reason.includes("quiet_hour") || reason.includes("quiet hour")) {
        phoneCooldown.set(e164, Date.now());
        return new Response(JSON.stringify({
          success: false,
          softError: true,
          message: "We pause demo texts between 9pm–9am (TCPA). Try again in the morning — your text will fly within 8 seconds.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      if (reason.includes("opt") && reason.includes("out")) {
        return new Response(JSON.stringify({
          success: false,
          softError: true,
          message: "This number has opted out of texts. Use a different phone to see the demo.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      return new Response(JSON.stringify({ error: result.error || "Could not send text." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    phoneCooldown.set(e164, Date.now());

    // Best-effort log of demo activity (separate from sendSMS's own log)
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      void sb.from("system_comms_log").insert({
        channel: "sms",
        direction: "outbound",
        recipient: e164,
        product: "missed_call_demo",
        body,
        metadata: { demo: true, ip, city: safeCity },
      }).then(() => {}, (err) => {
        console.warn("[missed-call-demo] log insert failed:", err?.message);
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-missed-call-demo-text] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
