// trade-radar-urgency-alert — Daily cron at 5pm ET.
// Finds score-9/10 Trade Radar leads that have sat uncontacted for 48+ hours
// and SMS-alerts the client: "This lead's window is closing — call now."
// Creates urgency, proves time-sensitive value, reduces silent churn.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERTICAL_LABELS: Record<string, string> = {
  roofing: "Roofing",
  hvac: "HVAC",
  plumbing: "Plumbing",
  electrical: "Electrical",
  pest_control: "Pest Control",
  gutters: "Gutters",
  exterior: "Exterior",
  tree: "Tree Service",
  restoration: "Restoration",
  demo_junk: "Demo/Junk",
  foundation: "Foundation",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let alertsSent = 0;

  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600000).toISOString();

    // Get active Trade Radar clients with a phone number
    const { data: clients } = await sb
      .from("trade_radar_clients")
      .select("id, phone, company_name, owner_name, vertical, email")
      .eq("active", true)
      .not("phone", "is", null);

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, alerts: 0, note: "no clients with phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const client of clients) {
      if (!client.phone) continue;

      // Find high-score leads for this vertical that are 48+ hours old and still "new"
      const { data: hotLeads } = await sb
        .from("trade_radar_leads")
        .select("id, address, city, score, signal_type, estimated_job_value")
        .eq("vertical", client.vertical)
        .gte("score", 9)
        .eq("status", "new")
        .lte("created_at", fortyEightHoursAgo)
        .order("score", { ascending: false })
        .limit(3);

      if (!hotLeads?.length) continue;

      const vertLabel = VERTICAL_LABELS[client.vertical] || client.vertical;
      const topLead = hotLeads[0];
      const location = topLead.address || topLead.city || "your area";
      const jobVal = topLead.estimated_job_value
        ? ` (~$${Number(topLead.estimated_job_value).toLocaleString()})`
        : "";
      const extraCount = hotLeads.length > 1 ? ` (+${hotLeads.length - 1} more)` : "";

      const firstName = client.owner_name?.split(" ")[0] || client.company_name || "Hey";
      const msg = `${firstName} — your TechAlert ${vertLabel} lead at ${location}${jobVal} is 48hrs old and still unclaimed${extraCount}. Homeowners get 3+ quotes fast. Log in to call or claim: https://detroitwebagent.com/my-${client.vertical.replace("_", "-")}-radar`;

      await sendSMS(client.phone, TWILIO_PHONE_NUMBER, msg, "trade_radar_urgency");
      alertsSent++;

      await new Promise((r) => setTimeout(r, 200));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "trade-radar-urgency-alert",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { alerts_sent: alertsSent },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ ok: true, alerts: alertsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
