// En-Route Transparency Engine — Google Distance Matrix ETA + SMS to customer
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_DISTANCE_MATRIX_API_KEY") || Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get job with customer and tech info
    const { data: job } = await sb
      .from("field_service_jobs")
      .select("id, client_id, assigned_tech_id, customer_id, customer_notified_at")
      .eq("id", job_id)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ error: "job not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Prevent duplicate notifications
    if (job.customer_notified_at) {
      return new Response(JSON.stringify({ skipped: true, reason: "already_notified" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Get customer info
    const { data: customer } = await sb
      .from("field_service_customers")
      .select("id, name, phone, address, city, state, zip")
      .eq("id", job.customer_id)
      .single();

    if (!customer?.phone) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_customer_phone" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Get tech info
    const { data: tech } = await sb
      .from("field_service_techs")
      .select("id, name")
      .eq("id", job.assigned_tech_id)
      .single();

    // Get tech's last GPS location
    const { data: techLoc } = await sb
      .from("tech_locations")
      .select("lat, lng")
      .eq("tech_id", job.assigned_tech_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get client business name
    const { data: client } = await sb
      .from("field_crm_clients")
      .select("business_name")
      .eq("id", job.client_id)
      .single();

    const techName = tech?.name || "your technician";
    const businessName = client?.business_name || "your service provider";

    // Build customer address string
    const customerAddr = [customer.address, customer.city, customer.state, customer.zip]
      .filter(Boolean).join(", ");

    let etaText = "";

    // Call Google Distance Matrix API if we have tech GPS and customer address
    if (techLoc?.lat && techLoc?.lng && customerAddr && GOOGLE_MAPS_API_KEY) {
      try {
        const origins = `${techLoc.lat},${techLoc.lng}`;
        const destinations = encodeURIComponent(customerAddr);
        const dmUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=${GOOGLE_MAPS_API_KEY}&units=imperial`;

        const dmRes = await fetch(dmUrl);
        const dmData = await dmRes.json();

        if (dmData.rows?.[0]?.elements?.[0]?.status === "OK") {
          const duration = dmData.rows[0].elements[0].duration;
          const durationMin = Math.ceil(duration.value / 60);
          etaText = ` Estimated arrival: ${durationMin} minutes.`;
          console.log(`[en-route] ETA calculated: ${durationMin} min for job ${job_id}`);
        } else {
          console.log(`[en-route] Distance Matrix returned status: ${dmData.rows?.[0]?.elements?.[0]?.status}`);
        }
      } catch (gErr) {
        console.error("[en-route] Distance Matrix error:", gErr);
        // Continue without ETA
      }
    } else if (!techLoc?.lat) {
      console.log(`[en-route] No GPS data for tech ${job.tech_id}`);
    }

    // Send SMS to customer
    const smsBody = `${businessName}: ${techName} is now en route to your location.${etaText} We'll see you shortly! Questions? Call (313) 992-1219.`;

    const result = await sendSMS(customer.phone, TWILIO_PHONE, smsBody, "fielddesk_en_route");

    // Mark as notified
    if (result.success) {
      await sb.from("field_service_jobs")
        .update({ customer_notified_at: new Date().toISOString() })
        .eq("id", job_id);
    }

    return new Response(JSON.stringify({
      success: result.success,
      eta: etaText || "no ETA available",
      customer_name: customer.name,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[en-route]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
