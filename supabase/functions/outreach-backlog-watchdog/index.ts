// Sprint F: Backlog & freshness watchdog.
// Reads outreach_backlog_health, SMS Matt when thresholds breached.
// Fires a digest at most once every 4h (de-duped via outreach_global_settings.meta).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";

const THRESHOLDS = {
  send_queue_overdue_1h: 50,
  send_queue_overdue_24h: 1,
  send_queue_stuck_claimed: 5,
  statewide_unenriched_48h: 100,
  unhandled_replies_6h: 1,
  bounces_24h: 20,
};

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4h

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: health, error } = await sb
    .from("outreach_backlog_health")
    .select("*")
    .maybeSingle();

  if (error || !health) {
    console.error("backlog-watchdog: health query failed", error);
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? "no row" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build alert lines for breached thresholds
  const breaches: string[] = [];
  for (const [key, limit] of Object.entries(THRESHOLDS)) {
    const val = Number((health as Record<string, unknown>)[key] ?? 0);
    if (val >= limit) {
      breaches.push(`${key.replace(/_/g, " ")}: ${val} (≥${limit})`);
    }
  }

  // Cooldown check via outreach_global_settings
  const { data: settings } = await sb
    .from("outreach_global_settings")
    .select("meta")
    .eq("id", 1)
    .maybeSingle();

  const meta = ((settings?.meta ?? {}) as Record<string, unknown>) || {};
  const lastAlertAt = typeof meta.backlog_last_alert_at === "string"
    ? new Date(meta.backlog_last_alert_at).getTime()
    : 0;
  const now = Date.now();

  let alerted = false;
  if (breaches.length > 0 && now - lastAlertAt > COOLDOWN_MS) {
    const body =
      `[DWA backlog]\n` +
      breaches.map((b) => `• ${b}`).join("\n") +
      `\n→ /admin → Outreach Observability`;
    try {
      await sendSMS(ADMIN_PHONE, body);
      alerted = true;
      await sb
        .from("outreach_global_settings")
        .update({ meta: { ...meta, backlog_last_alert_at: new Date().toISOString() } })
        .eq("id", 1);
    } catch (e) {
      console.error("backlog-watchdog: SMS failed", e);
      // Fail-fast (Defensive Programming Protocol)
      return new Response(
        JSON.stringify({ ok: false, error: "sms_failed", breaches }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  return new Response(
    JSON.stringify({ ok: true, breaches, alerted, health }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
