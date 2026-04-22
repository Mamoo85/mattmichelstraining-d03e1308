/**
 * Pulse Alert Sender (Channel 7)
 * Triggered manually or by cron after new high-confidence industry_pulse_signals
 * land. Sends same-hour SMS to active pulse_alert_clients matching their
 * vertical/city filter. TCPA-safe via _shared/twilio.ts (quiet-hours + opt-out).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find new high-confidence signals from last 2 hours (not yet alerted)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: signals } = await supabase
      .from("industry_pulse_signals")
      .select("id, company_name, city, vertical, signal_type, headline, confidence_score")
      .gte("created_at", twoHoursAgo)
      .gte("confidence_score", 7)
      .order("confidence_score", { ascending: false })
      .limit(20);

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_new_signals" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: clients } = await supabase
      .from("pulse_alert_clients")
      .select("id, email, phone, vertical_filter, city_filter")
      .eq("active", true);

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_active_subscribers" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    const results: Array<{ client_id: string; signal_id: string; ok: boolean; error?: string }> = [];

    for (const client of clients) {
      // Match best signal for this client's filter
      const matched = signals.find((s) => {
        if (client.vertical_filter && s.vertical && !s.vertical.toLowerCase().includes(client.vertical_filter.toLowerCase())) return false;
        if (client.city_filter && s.city && !s.city.toLowerCase().includes(client.city_filter.toLowerCase())) return false;
        return true;
      }) || signals[0];

      if (!matched) continue;

      const link = `https://www.detroitwebagent.com/get-dossier?signal=${matched.id}`;
      const body = `🚨 ${matched.company_name} — ${matched.headline}. Free dossier: ${link}\n\nReply STOP to opt out.`;

      const result = await sendSMS(client.phone, TWILIO_FROM, body, "pulse_alerts");
      const ok = result.success === true;
      if (ok) {
        sentCount++;
        await supabase
          .from("pulse_alert_clients")
          .update({ last_alert_at: new Date().toISOString(), alert_count: (clients as Array<{ id: string }>).length })
          .eq("id", client.id);
      }
      results.push({ client_id: client.id, signal_id: matched.id, ok, error: result.error });
    }

    return new Response(JSON.stringify({ sent: sentCount, total_clients: clients.length, signals_found: signals.length, results }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
