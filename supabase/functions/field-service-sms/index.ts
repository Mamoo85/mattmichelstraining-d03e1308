import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REMOTE_CONTROL_SECRET = Deno.env.get("REMOTE_CONTROL_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!REMOTE_CONTROL_SECRET || token !== REMOTE_CONTROL_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event, job_id } = await req.json() as { event: string; job_id: string };

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch job with related data
    const { data: job, error: jobError } = await sb
      .from("field_service_jobs")
      .select(
        "id, title, scheduled_time, assigned_tech_id, field_service_customers(company_name, address, phone), field_crm_clients:client_id(business_name)"
      )
      .eq("id", job_id)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobData = job as any;
    const customerArr = jobData.field_service_customers;
    const customer = Array.isArray(customerArr) ? customerArr[0] : customerArr;
    const clientArr = jobData.field_crm_clients;
    const client = Array.isArray(clientArr) ? clientArr[0] : clientArr;

    // Fetch tech phone separately for job_assigned
    let techPhoneNumber: string | null = null;
    let techName = "A technician";
    if (jobData.assigned_tech_id) {
      const { data: techRow } = await sb
        .from("field_service_techs")
        .select("name, phone")
        .eq("id", jobData.assigned_tech_id)
        .maybeSingle();
      if (techRow?.phone) techPhoneNumber = techRow.phone;
      if (techRow?.name) techName = techRow.name;
    }

    const clientName = client?.business_name ?? "Your service provider";
    const custAddress = customer?.address ?? "your location";
    const custPhone = customer?.phone ?? null;
    const custCompany = customer?.company_name ?? "customer";
    const scheduledTime = jobData.scheduled_time ?? "TBD";

    let smsTo: string | null = null;
    let smsBody = "";

    if (event === "job_assigned") {
      smsTo = techPhoneNumber;
      smsBody = `New job: ${custCompany} at ${custAddress}. Scheduled ${scheduledTime}.`;
    } else if (event === "tech_en_route") {
      smsTo = custPhone;
      smsBody = `${clientName} technician ${techName} is on the way. ETA ~15 min. Reply STOP to opt out.`;
    } else if (event === "job_completed") {
      smsTo = custPhone;
      smsBody = `Your service at ${custAddress} is complete. Thank you for choosing ${clientName}!`;
    } else if (event === "review_request") {
      smsTo = custPhone;
      smsBody = `How was your service from ${clientName}? Leave us a Google review! Reply STOP to opt out.`;
    } else {
      return new Response(JSON.stringify({ error: "Unknown event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!smsTo) {
      return new Response(JSON.stringify({ ok: false, reason: "No phone number available for recipient" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendSMS(smsTo, TWILIO_PHONE_NUMBER, smsBody, "field_service");

    return new Response(JSON.stringify({ ok: true, event }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("field-service-sms error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});