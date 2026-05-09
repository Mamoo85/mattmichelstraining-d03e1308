// Fires when source_registry.status transitions to 'live' (a "promotion").
// Triggered by the on_source_registry_promoted DB trigger via pg_net.
// Sends Matt a single SMS so he knows a new data source just went live.
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* trigger may pass empty body on ping */ }

  const product = String(payload.product ?? "?");
  const source_key = String(payload.source_key ?? "?");
  const source_name = String(payload.source_name ?? source_key);
  const previous_status = String(payload.previous_status ?? "?");

  const body = `🟢 Source promoted to LIVE\n${source_name}\nproduct: ${product}\nkey: ${source_key}\nwas: ${previous_status}`;

  try {
    await sendSMS(ADMIN_PHONE, TWILIO_FROM, body, "source_promoted");
  } catch (e) {
    console.warn("[notify-source-promoted] sms failed:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
