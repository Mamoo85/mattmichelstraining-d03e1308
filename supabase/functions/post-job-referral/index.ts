// Referral Multiplier — daily cron, texts homeowners 48h after job completion
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Find jobs completed 44-52 hours ago that haven't been asked for referral
    const now = Date.now();
    const windowStart = new Date(now - 52 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now - 44 * 60 * 60 * 1000).toISOString();

    const { data: jobs } = await sb
      .from("field_service_jobs")
      .select("id, client_id, customer_id, completed_at")
      .eq("status", "completed")
      .is("referral_asked_at", null)
      .gte("completed_at", windowStart)
      .lte("completed_at", windowEnd)
      .limit(50);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const job of jobs) {
      // Get customer phone
      const { data: customer } = await sb
        .from("field_service_customers")
        .select("phone, name")
        .eq("id", job.customer_id)
        .single();

      if (!customer?.phone) {
        await sb.from("field_service_jobs")
          .update({ referral_asked_at: new Date().toISOString() })
          .eq("id", job.id);
        continue;
      }

      // Get client business name and trade
      const { data: client } = await sb
        .from("field_crm_clients")
        .select("business_name, industry")
        .eq("id", job.client_id)
        .single();

      const bizName = client?.business_name || "your service provider";
      const trade = client?.industry || "home service";

      const smsBody = `Thanks for choosing ${bizName}! Know someone who needs ${trade} work? Reply with their name and number — we'll give them $25 off their first service. 🔧`;

      const result = await sendSMS(customer.phone, TWILIO_PHONE, smsBody, "referral_multiplier");

      if (result.success || result.skipped) {
        await sb.from("field_service_jobs")
          .update({ referral_asked_at: new Date().toISOString() })
          .eq("id", job.id);
        if (result.success) sent++;
      }
    }

    console.log(`[post-job-referral] Sent ${sent} referral asks from ${jobs.length} completed jobs`);
    return new Response(JSON.stringify({ sent, total_jobs: jobs.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[post-job-referral]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
