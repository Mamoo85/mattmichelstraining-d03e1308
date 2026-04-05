import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const JSON_HEADERS = { "Content-Type": "application/json" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEVERE_EVENTS = ["Hail", "Tornado", "Wind", "Flood"];
const SEVERE_LEVELS = ["Severe", "Extreme"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch active weather alerts for Michigan
    const alertsRes = await fetch("https://api.weather.gov/alerts/active?area=MI", {
      headers: { "User-Agent": "M2Development/1.0" },
    });

    if (!alertsRes.ok) {
      console.error(`[storm-lead-blaster] NWS API error: ${alertsRes.status}`);
      return new Response(JSON.stringify({ error: "NWS API unavailable" }), {
        status: 502,
        headers: { ...JSON_HEADERS, ...CORS_HEADERS },
      });
    }

    const alertData = await alertsRes.json();
    const features: any[] = alertData.features || [];

    // Filter for severe/extreme hail, tornado, wind, or flood alerts
    const relevantAlerts = features.filter((f) => {
      const { severity, event } = f.properties || {};
      const severityMatch = SEVERE_LEVELS.includes(severity);
      const eventMatch = SEVERE_EVENTS.some((e) => event?.includes(e));
      return severityMatch && eventMatch;
    });

    console.log(`[storm-lead-blaster] ${relevantAlerts.length} relevant alerts found`);

    // Fetch active storm lead clients
    const { data: clients, error: clientErr } = await (sb as any)
      .from("storm_lead_clients")
      .select("id, phone, zip_codes")
      .eq("active", true);

    if (clientErr) {
      console.error("[storm-lead-blaster] Client query error:", clientErr.message);
      return new Response(JSON.stringify({ error: clientErr.message }), {
        status: 500,
        headers: { ...JSON_HEADERS, ...CORS_HEADERS },
      });
    }

    let alertsProcessed = 0;
    let smsSent = 0;

    for (const feature of relevantAlerts) {
      const { id: alertId, event, severity, areaDesc } = feature.properties || {};

      if (!alertId) continue;

      // Skip already-processed alerts
      const { data: existing } = await (sb as any)
        .from("storm_alerts_sent")
        .select("id")
        .eq("alert_id", alertId)
        .maybeSingle();

      if (existing) {
        console.log(`[storm-lead-blaster] Alert ${alertId} already sent — skipping`);
        continue;
      }

      alertsProcessed++;

      // Match clients whose zip codes appear in the alert's areaDesc
      const matchedClients = (clients || []).filter((client: any) => {
        const zips: string[] = client.zip_codes || [];
        return zips.some((zip) => areaDesc?.includes(zip));
      });

      const body = `⚠️ ${event} reported near your area. ${areaDesc}. Expect incoming calls — be ready!`;

      // Send SMS to each matched client
      const smsPromises = matchedClients.map(async (client: any) => {
        if (!client.phone) return;
        const result = await sendSMS(client.phone, TWILIO_PHONE_NUMBER, body, "storm_lead_blaster");
        if (result.success) smsSent++;
      });

      await Promise.all(smsPromises);

      // Record alert as sent
      await (sb as any).from("storm_alerts_sent").insert({ alert_id: alertId });
    }

    console.log(`[storm-lead-blaster] Done — ${alertsProcessed} processed, ${smsSent} SMS sent`);

    return new Response(
      JSON.stringify({ alertsProcessed, smsSent }),
      { headers: { ...JSON_HEADERS, ...CORS_HEADERS } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[storm-lead-blaster] Exception:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...JSON_HEADERS, ...CORS_HEADERS },
    });
  }
});
