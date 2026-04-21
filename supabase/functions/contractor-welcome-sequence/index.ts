// contractor-welcome-sequence — fired by stripe-webhook on contractor_lead_subscription
// Sends 3 welcome SMS over 7 days to set expectations + reinforce trust.
// T+5min = welcome + dashboard link, T+72h = status, T+7d = first recap.
// Schedules itself by writing to system_comms_queue OR fires immediately based on payload.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { contractor_id, message_index = 0 } = body;

    if (!contractor_id) {
      return new Response(JSON.stringify({ error: "contractor_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: c } = await sb
      .from("contractor_clients" as any)
      .select("id, business_name, phone, trade, city, roi_token, free_dead_leads_quota")
      .eq("id", contractor_id)
      .maybeSingle();

    if (!c?.phone) {
      return new Response(JSON.stringify({ error: "contractor or phone missing" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trade = ((c as any).trade || "service").toLowerCase();
    const city = (c as any).city || "your area";
    const portalUrl = `https://detroitwebagent.com/contractor-portal/${(c as any).roi_token || contractor_id}`;
    const intakeUrl = `https://detroitwebagent.com/dead-lead-intake?cid=${contractor_id}`;
    const quota = (c as any).free_dead_leads_quota || 40;

    const messages = [
      // T+5min — welcome + free boost CTA
      `Welcome to DWA. Your ${trade} lead system is LIVE in ${city}. FREE BOOST: paste up to ${quota} old quotes here for free SMS reactivation while Google ads warm up (3-5 days): ${intakeUrl}\n\nDashboard: ${portalUrl}\n— Matt (313) 992-1219`,
      // T+72h — status
      `${(c as any).business_name || "Hey"} — Day 3 update: your landing page is live + Google ads launching today. The 'priming period' takes 3-5 days. Dashboard: ${portalUrl}`,
      // T+7d — first recap
      `Week 1 recap is ready in your dashboard — leads delivered, free boost progress, lead probability %. View: ${portalUrl}`,
    ];

    const idx = Math.max(0, Math.min(2, Number(message_index)));
    const msg = messages[idx];

    await sendSMS(c.phone, TWILIO_PHONE_NUMBER, msg, "contractor_welcome");

    return new Response(JSON.stringify({ ok: true, sent: idx, phone: c.phone }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[contractor-welcome-sequence] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
