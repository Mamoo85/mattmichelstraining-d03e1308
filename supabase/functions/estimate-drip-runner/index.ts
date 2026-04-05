// Estimate Drip Runner — cron every hour + intake endpoint
// Runs 5-step follow-up sequence after a contractor gives a quote

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Step delays from quote time
const STEP_DELAYS_HOURS = [2, 72, 168, 240, 336]; // 2h, 3d, 7d, 10d, 14d

const STEP_PROMPTS = [
  (n: string, job: string, biz: string) => `Write a 1-sentence friendly SMS follow-up from ${biz} to ${n || "a prospect"} to confirm they received the estimate for ${job || "the project"}. Casual, not pushy. Under 100 chars.`,
  (n: string, job: string, biz: string) => `Write a 1-sentence SMS from ${biz} to ${n || "a prospect"} about their ${job || "project"} estimate. Mention a recent similar completed job and offer to share photos. Friendly. Under 120 chars.`,
  (n: string, job: string, biz: string) => `Write a 1-sentence SMS from ${biz} to ${n || "a prospect"} about their pending ${job || "project"} estimate. Mention you have an opening in their area next week. Create mild urgency. Under 120 chars.`,
  (n: string, job: string, biz: string) => `Write a 1-sentence SMS from ${biz} to ${n || "a prospect"} still considering the ${job || "project"} estimate. Mention being licensed, insured, and satisfaction guaranteed to reduce risk. Under 130 chars.`,
  (n: string, job: string, biz: string) => `Write a short, final 1-sentence SMS from ${biz} to ${n || "a prospect"} about the ${job || "project"} estimate. Still deciding? Light, no pressure. Under 100 chars.`,
];

async function generateStepMessage(step: number, prospectName: string, jobType: string, businessName: string): Promise<string> {
  const prompt = STEP_PROMPTS[step](prospectName, jobType, businessName);
  const result = await generateText(prompt, 200);
  return result || `Hi${prospectName ? " " + prospectName : ""}, just checking in on your ${jobType || "project"} estimate. Any questions? — ${businessName}`;
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // POST = intake new estimate
  if (req.method === "POST") {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    try {
      const { client_email, prospect_name, prospect_phone, job_type, estimate_amount, city } = await req.json();
      if (!client_email || !prospect_phone) return new Response(JSON.stringify({ error: "client_email and prospect_phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: client } = await sb.from("estimate_drip_clients").select("id").eq("email", client_email).eq("active", true).maybeSingle();
      if (!client) return new Response(JSON.stringify({ error: "Client not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const firstSendAt = new Date(Date.now() + STEP_DELAYS_HOURS[0] * 3600 * 1000).toISOString();
      await sb.from("estimate_sequences").insert({ client_id: client.id, prospect_name: prospect_name || null, prospect_phone, job_type: job_type || null, estimate_amount: estimate_amount || null, city: city || null, current_step: 0, next_send_at: firstSendAt });

      return new Response(JSON.stringify({ started: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // GET/cron = run pending steps
  const now = new Date().toISOString();
  const { data: sequences } = await sb.from("estimate_sequences")
    .select("*, estimate_drip_clients(business_name, business_type)")
    .eq("completed", false)
    .eq("stopped", false)
    .lte("next_send_at", now)
    .limit(100);

  if (!sequences?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  let sent = 0;
  for (const seq of sequences) {
    try {
      const client = seq.estimate_drip_clients as any;
      const message = await generateStepMessage(seq.current_step, seq.prospect_name, seq.job_type, client?.business_name || "us");
      // sendSMS handles TCPA opt-out check internally
      const result = await sendSMS(seq.prospect_phone, TWILIO_FROM_NUMBER, message, "estimate_drip");
      if (result.skipped) {
        await sb.from("estimate_sequences").update({ stopped: true }).eq("id", seq.id);
        continue;
      }
      if (!result.success) continue;

      sent++;
      const nextStep = seq.current_step + 1;
      const isLastStep = nextStep >= STEP_DELAYS_HOURS.length;

      if (isLastStep) {
        await sb.from("estimate_sequences").update({ completed: true, current_step: nextStep }).eq("id", seq.id);
      } else {
        const nextDelay = STEP_DELAYS_HOURS[nextStep] - STEP_DELAYS_HOURS[seq.current_step];
        const nextSendAt = new Date(Date.now() + nextDelay * 3600 * 1000).toISOString();
        await sb.from("estimate_sequences").update({ current_step: nextStep, next_send_at: nextSendAt }).eq("id", seq.id);
      }
    } catch (e) {
      console.error(`[estimate-drip] Error for sequence ${seq.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ sent, total: sequences.length }), { status: 200 });
});
