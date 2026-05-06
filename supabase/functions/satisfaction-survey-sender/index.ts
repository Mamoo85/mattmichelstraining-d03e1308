import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { clientEmail, customerPhone, customerName } = await req.json();
    if (!clientEmail || !customerPhone || !customerName) {
      return new Response(JSON.stringify({ error: "Missing required fields: clientEmail, customerPhone, customerName" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: client, error: clientError } = await supabase.from("satisfaction_survey_clients").select("*").eq("email", clientEmail).eq("active", true).single();
    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const message = `Hi ${customerName}! Thanks for choosing ${client.business_name}. How would you rate your experience? Reply 1-5 (5 = amazing). Your feedback helps us improve!`;
    // Route through shared sendSMS — TCPA opt-out check + system_comms_log
    const result = await sendSMS(customerPhone, client.twilio_number, message, "satisfaction_survey");
    if (!result.success && !result.skipped) {
      return new Response(JSON.stringify({ error: result.error || "SMS send failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (result.skipped) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: "sms_opt_out" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("satisfaction_survey_clients").update({ survey_count: (client.survey_count || 0) + 1 }).eq("id", client.id);

    return new Response(JSON.stringify({ success: true, message: `Survey sent to ${customerName} at ${customerPhone}`, sid: result.sid }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("satisfaction-survey-sender error:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : "Unknown error") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
