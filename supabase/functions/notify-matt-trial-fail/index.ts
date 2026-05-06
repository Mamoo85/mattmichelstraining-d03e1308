// notify-matt-trial-fail — Called when StartTrial form submission errors.
// Sends Matt an SMS so he can manually rescue the lead.
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const product = String(body.product || "unknown").slice(0, 60);
  const email = String(body.email || "").slice(0, 100);
  const error = String(body.error || "unknown error").slice(0, 120);

  const msg = `⚠️ TRIAL FAIL\nProduct: ${product}\nEmail: ${email || "(blank)"}\nErr: ${error}\nReach out manually → (313) 992-1219`;

  await sendSMS(ADMIN_PHONE, TWILIO_FROM, msg, "trial_fail_alert", false, { bypassQuietHours: true })
    .catch((e) => console.error("[notify-matt-trial-fail]", e));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
