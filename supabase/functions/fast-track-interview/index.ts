// Fast-Track Interview — sends candidate an SMS invite with client's booking link
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { token, candidate_id, is_demo } = await req.json();

    // Demo mode: send SMS to admin phone instead of candidate
    if (is_demo || token === "DWA_DEMO_MASTER") {
      const demoBody = `[DEMO] Hi John, this is Demo Company. We're actively hiring boiler operators and want to talk to you. Book a quick phone interview:\nhttps://calendly.com/demo-link\n\nQuestions? Reply to this text.`;
      const result = await sendSMS(ADMIN_PHONE, TWILIO_PHONE, demoBody, "techalert_fast_track_demo");
      return new Response(JSON.stringify({
        success: result.success,
        candidate_name: "John Mitchell (Demo)",
        demo: true,
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!token || !candidate_id) {
      return new Response(JSON.stringify({ error: "token and candidate_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up client
    const { data: client } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, booking_link, owner_email")
      .eq("dashboard_token", token)
      .eq("active", true)
      .single();

    if (!client) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!client.booking_link) {
      return new Response(JSON.stringify({ error: "no_booking_link", message: "Add your scheduling link in your TechAlert settings to enable Fast-Track." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Get candidate
    const { data: candidate } = await sb
      .from("hire_alert_candidates")
      .select("id, full_name, phone, license_type")
      .eq("id", candidate_id)
      .single();

    if (!candidate || !candidate.phone) {
      return new Response(JSON.stringify({ error: "Candidate not found or no phone number" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Send SMS to candidate
    const roleLabel = candidate.license_type || "technician";
    const smsBody = `${client.company_name} is actively hiring ${roleLabel}s and wants to talk to you. Book a quick phone interview at your convenience:\n${client.booking_link}\n\nQuestions? Reply to this text.`;

    const result = await sendSMS(candidate.phone, TWILIO_PHONE, smsBody, "techalert_fast_track");

    if (result.success) {
      // Update client_action to contacted
      await sb.from("hire_alert_client_candidates")
        .update({ client_action: "contacted" })
        .eq("client_id", client.id)
        .eq("candidate_id", candidate_id);
    }

    return new Response(JSON.stringify({ 
      success: result.success, 
      skipped: result.skipped,
      candidate_name: candidate.full_name 
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[fast-track-interview]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
