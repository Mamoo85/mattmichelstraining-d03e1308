// After-Job Drip Runner — cron every hour + intake endpoint
// 3-step sequence: Day 1 thank you, Day 3 review ask, Day 30 upsell

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Hours after job completion to send each step
const STEP_DELAYS_HOURS = [24, 72, 720]; // 1 day, 3 days, 30 days

async function generateMessage(step: number, customerName: string, jobType: string, businessName: string): Promise<string> {
  const firstName = customerName?.split(" ")[0] || "";
  const greeting = firstName ? `Hi ${firstName}` : "Hi";
  const job = jobType || "the work";

  const prompts = [
    `Write a warm 1-2 sentence thank-you SMS from ${businessName} to ${firstName || "a customer"} after completing ${job}. Genuine, not salesy. Under 140 chars.`,
    `Write a friendly 1-2 sentence SMS from ${businessName} asking ${firstName || "a happy customer"} for a Google review after their recent ${job}. Mention it takes 30 seconds. No link needed. Under 160 chars.`,
    `Write a 1-2 sentence check-in/upsell SMS from ${businessName} to ${firstName || "a past customer"} about 30 days after completing ${job}. Ask if they need anything else or have another project. Light, no pressure. Under 160 chars.`,
  ];

  const result = await generateText(prompts[step], 200);
  if (result) return result;

  const defaults = [
    `${greeting}, thanks for choosing ${businessName} for ${job}! We really appreciate your business. Don't hesitate to reach out if you need anything.`,
    `${greeting}, we hope you're enjoying the results from your recent ${job}! If you have a moment, we'd love a Google review — it means a lot to a small business. Thanks!`,
    `${greeting}, just checking in from ${businessName}! It's been about a month since we completed your ${job}. Time for any maintenance or have another project in mind? Give us a call!`,
  ];
  return defaults[step] || defaults[0];
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // POST = log completed job
  if (req.method === "POST") {
    try {
      const { client_email, customer_name, customer_phone, job_type } = await req.json();
      if (!client_email || !customer_phone) return new Response(JSON.stringify({ error: "client_email and customer_phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: client } = await sb.from("afterjob_drip_clients").select("id").eq("email", client_email).eq("active", true).maybeSingle();
      if (!client) return new Response(JSON.stringify({ error: "Client not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const firstSendAt = new Date(Date.now() + STEP_DELAYS_HOURS[0] * 3600 * 1000).toISOString();
      await sb.from("afterjob_sequences").insert({ client_id: client.id, customer_name: customer_name || null, customer_phone, job_type: job_type || null, completed_at: new Date().toISOString(), current_step: 0, next_send_at: firstSendAt });

      return new Response(JSON.stringify({ started: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // GET/cron = run pending steps
  const now = new Date().toISOString();
  const { data: sequences } = await sb.from("afterjob_sequences")
    .select("*, afterjob_drip_clients(business_name, business_type)")
    .eq("stopped", false)
    .lte("next_send_at", now)
    .lt("current_step", STEP_DELAYS_HOURS.length)
    .limit(100);

  if (!sequences?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  let sent = 0;
  for (const seq of sequences) {
    try {
      const client = seq.afterjob_drip_clients as any;
      const message = await generateMessage(seq.current_step, seq.customer_name, seq.job_type, client?.business_name || "us");
      // sendSMS handles TCPA opt-out check internally
      const result = await sendSMS(seq.customer_phone, TWILIO_FROM_NUMBER, message, "afterjob_drip");
      if (result.skipped) {
        await sb.from("afterjob_sequences").update({ stopped: true }).eq("id", seq.id);
        continue;
      }
      if (!result.success) continue;

      sent++;
      const nextStep = seq.current_step + 1;
      const isLast = nextStep >= STEP_DELAYS_HOURS.length;

      if (isLast) {
        await sb.from("afterjob_sequences").update({ stopped: true, current_step: nextStep }).eq("id", seq.id);
      } else {
        const delayHours = STEP_DELAYS_HOURS[nextStep] - STEP_DELAYS_HOURS[seq.current_step];
        const nextSendAt = new Date(Date.now() + delayHours * 3600 * 1000).toISOString();
        await sb.from("afterjob_sequences").update({ current_step: nextStep, next_send_at: nextSendAt }).eq("id", seq.id);
      }
    } catch (e) {
      console.error(`[afterjob-drip] Error for sequence ${seq.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ sent, total: sequences.length }), { status: 200 });
});
