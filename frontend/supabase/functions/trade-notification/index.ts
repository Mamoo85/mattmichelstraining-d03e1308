/**
 * trade-notification — Phase 95
 * Sends an SMS alert whenever the autonomous trading bot executes a trade.
 * Called by the scheduled remote agent via curl with no auth (verify_jwt=false).
 *
 * POST body: { message: string, account?: string }
 */
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { message, account } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const prefix = account ? `🤖 TradeBot [${account}]` : "🤖 TradeBot";
    const sms = `${prefix}:\n${message}`;

    await sendSMS(ADMIN_PHONE, TWILIO_FROM, sms, "trade_notification");

    console.log(`[TRADE-NOTIFICATION] Sent: ${sms}`);

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[TRADE-NOTIFICATION] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
