// contractor-welcome-stale-check — cron-fired every 15 min.
// Finds contractor_welcome_log rows stuck in status='queued' for > 30 minutes
// without a Twilio terminal status (delivered/failed/undelivered). Texts Matt
// once per stale row and marks it `stale_alerted=true` to prevent re-spam.
//
// Common root causes when this fires:
//   - Twilio outage or degraded delivery
//   - Bad/unreachable phone number with no carrier callback
//   - StatusCallback URL not wired up in the Messaging Service
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Pull queued rows older than 30min that haven't reached a terminal Twilio state
    // and haven't already been alerted on.
    const { data: stale, error } = await sb
      .from("contractor_welcome_log" as any)
      .select("id, contractor_id, message_index, recipient_phone, twilio_sid, twilio_status, created_at")
      .eq("status", "queued")
      .lt("created_at", cutoff)
      .or("stale_alerted.is.null,stale_alerted.eq.false")
      .not("twilio_status", "in", "(delivered,failed,undelivered)")
      .limit(20);

    if (error) {
      console.error("[stale-check] query error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = (stale as any[]) || [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, stale: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hydrate contractor business names for the alert
    const ids = Array.from(new Set(rows.map((r) => r.contractor_id).filter(Boolean)));
    const { data: contractors } = await sb
      .from("contractor_clients" as any)
      .select("id, business_name")
      .in("id", ids);
    const nameById = new Map<string, string>();
    for (const c of (contractors as any[]) || []) nameById.set(c.id, c.business_name || "?");

    const lines = rows.map((r) => {
      const ageMin = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
      const name = nameById.get(r.contractor_id) || "unknown";
      return `• ${name} msg#${r.message_index + 1} stuck ${ageMin}m (${r.twilio_status || "no callback"})`;
    });

    const body =
      `⚠️ DWA welcome SMS stuck queued (${rows.length}):\n` +
      lines.slice(0, 6).join("\n") +
      (rows.length > 6 ? `\n+${rows.length - 6} more` : "") +
      `\n\nCheck Twilio status & StatusCallback URL.`;

    const smsResult = await sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, body, "internal_alert");

    // Mark all as alerted so we don't text Matt again about the same rows
    await sb
      .from("contractor_welcome_log" as any)
      .update({ stale_alerted: true })
      .in("id", rows.map((r) => r.id));

    return new Response(JSON.stringify({
      ok: true,
      stale: rows.length,
      sms_sent: smsResult.success,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[contractor-welcome-stale-check] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
