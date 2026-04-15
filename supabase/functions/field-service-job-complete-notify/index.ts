import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get job with customer and tech info
    const { data: job, error: jobError } = await supabase
      .from("field_service_jobs")
      .select("*, field_service_customers(company_name, address, city, phone), field_service_techs:assigned_tech_id(name)")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customer = job.field_service_customers as Record<string, string> | null;
    const tech = job.field_service_techs as Record<string, string> | null;
    const customerPhone = job.customer_contact_phone || customer?.phone;

    if (!customerPhone) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_customer_phone" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count photos for this job
    const { count: photoCount } = await supabase
      .from("job_photos")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job_id);

    // Get client business info for the sign-off
    const { data: client } = await supabase
      .from("field_crm_clients")
      .select("business_name, business_phone")
      .eq("id", job.client_id)
      .single();

    const businessName = client?.business_name || "Your service provider";
    const businessPhone = client?.business_phone || "";
    const techName = tech?.name || "Your technician";
    const address = customer?.address ? `${customer.address}` : "your location";
    const photoLine = (photoCount && photoCount > 0) ? ` ${photoCount} photo(s) documented.` : "";
    const callLine = businessPhone ? ` Questions? Call ${businessPhone}` : "";

    const smsBody = `✅ ${businessName}: Service at ${address} is complete. Tech: ${techName}.${photoLine}${callLine}`;

    await sendSMS(customerPhone, TWILIO_PHONE_NUMBER, smsBody, "field_service_complete");

    return new Response(JSON.stringify({ sent: true, to: customerPhone }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("field-service-job-complete-notify error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
