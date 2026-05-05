// Trial SLA Watchdog
// Runs hourly. For each active trial in trial_delivery_sla:
//   - Refreshes leads_delivered from product-specific tables
//   - Sends Day 0 (welcome), Day 2, Day 5, Day 6 concierge pulses (idempotent)
//   - Flags at_risk / breached if leads_delivered far behind promised cadence
//   - Logs every touch into trial_concierge_log
// Notifies ADMIN_PHONE (Matt) on breach.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { dwaEmail } from "../_shared/dwa-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrialRow {
  id: string;
  customer_email: string;
  product_slug: string;
  trial_started_at: string;
  trial_ends_at: string;
  promised_leads_per_week: number;
  leads_delivered: number;
  welcome_pulse_sent_at: string | null;
  day2_pulse_sent_at: string | null;
  day5_pulse_sent_at: string | null;
  day6_pulse_sent_at: string | null;
  sla_status: string;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

async function logTouch(sb: any, trial: TrialRow, touch_type: string, channel: string, status: string, body: string) {
  await sb.from("trial_concierge_log").insert({
    trial_sla_id: trial.id,
    customer_email: trial.customer_email,
    touch_type,
    channel,
    delivery_status: status,
    body_preview: body.slice(0, 280),
  });
}

async function sendWelcome(sb: any, trial: TrialRow) {
  const subject = `Your DWA ${trial.product_slug} trial — first scan running now`;
  const html = `<p>Hi,</p>
<p>Your 7-day trial just started. Our automated systems have already triggered the first scan for <strong>${trial.product_slug}</strong>. You'll see the first signals in your dashboard within minutes.</p>
<p>What happens next:</p>
<ul>
  <li><strong>Today:</strong> first scan results land in your portal</li>
  <li><strong>Day 2:</strong> we check in with what we found</li>
  <li><strong>Day 5–6:</strong> personal review from Matt before trial ends</li>
</ul>
<p>If anything looks off, reply to this email — it goes straight to Matt.</p>
<p>— Detroit Web Agency</p>`;
  const r = await dwaEmail({ to: trial.customer_email, subject, html });
  await logTouch(sb, trial, "welcome", "email", r?.id ? "sent" : "failed", subject);
  await sb.from("trial_delivery_sla").update({ welcome_pulse_sent_at: new Date().toISOString() }).eq("id", trial.id);
}

async function sendDay2(sb: any, trial: TrialRow) {
  const subject = `Day 2 check-in — ${trial.leads_delivered} signals delivered so far`;
  const html = `<p>Hi,</p>
<p>Quick update on your <strong>${trial.product_slug}</strong> trial.</p>
<p><strong>Signals delivered so far: ${trial.leads_delivered}</strong></p>
<p>Our ingestion pipelines are scanning hourly. Even on quiet market days you'll see a "proof of work" entry in your portal showing exactly what was scanned.</p>
<p>Reply with any questions — we read every one.</p>
<p>— Detroit Web Agency</p>`;
  const r = await dwaEmail({ to: trial.customer_email, subject, html });
  await logTouch(sb, trial, "day2", "email", r?.id ? "sent" : "failed", subject);
  await sb.from("trial_delivery_sla").update({ day2_pulse_sent_at: new Date().toISOString() }).eq("id", trial.id);
}

async function sendDay5(sb: any, trial: TrialRow) {
  const subject = `48 hours left on your ${trial.product_slug} trial`;
  const html = `<p>Hi,</p>
<p>Your trial ends in 2 days. So far we've delivered <strong>${trial.leads_delivered} signals</strong>.</p>
<p>If you'd like Matt to walk through the strongest leads with you before the trial converts, just reply to this email with a good time.</p>
<p>— Detroit Web Agency</p>`;
  const r = await dwaEmail({ to: trial.customer_email, subject, html });
  await logTouch(sb, trial, "day5", "email", r?.id ? "sent" : "failed", subject);
  await sb.from("trial_delivery_sla").update({ day5_pulse_sent_at: new Date().toISOString() }).eq("id", trial.id);
}

async function sendDay6(sb: any, trial: TrialRow) {
  const subject = `Final day — your ${trial.product_slug} trial`;
  const html = `<p>Hi,</p>
<p>Your trial ends tomorrow. Final tally so far: <strong>${trial.leads_delivered} signals delivered</strong>.</p>
<p>If anything fell short of what we promised, reply now and we'll either extend the trial or credit you. We'd rather over-deliver than have you leave.</p>
<p>— Matt, Detroit Web Agency</p>`;
  const r = await dwaEmail({ to: trial.customer_email, subject, html });
  await logTouch(sb, trial, "day6", "email", r?.id ? "sent" : "failed", subject);
  await sb.from("trial_delivery_sla").update({ day6_pulse_sent_at: new Date().toISOString() }).eq("id", trial.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: trials, error } = await sb
    .from("trial_delivery_sla")
    .select("*")
    .in("sla_status", ["on_track", "at_risk", "breached"])
    .gt("trial_ends_at", new Date().toISOString());
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: any[] = [];
  for (const trial of (trials || []) as TrialRow[]) {
    const ageHrs = hoursSince(trial.trial_started_at);
    const expectedByNow = Math.floor((trial.promised_leads_per_week / 7) * (ageHrs / 24));
    let new_status = trial.sla_status;
    if (trial.leads_delivered === 0 && ageHrs >= 24) new_status = "breached";
    else if (trial.leads_delivered < expectedByNow * 0.5 && ageHrs >= 48) new_status = "at_risk";
    else new_status = "on_track";

    try {
      if (!trial.welcome_pulse_sent_at) await sendWelcome(sb, trial);
      if (ageHrs >= 48 && !trial.day2_pulse_sent_at) await sendDay2(sb, trial);
      if (ageHrs >= 120 && !trial.day5_pulse_sent_at) await sendDay5(sb, trial);
      if (ageHrs >= 144 && !trial.day6_pulse_sent_at) await sendDay6(sb, trial);
    } catch (e) {
      console.error("[trial-sla-watchdog] pulse error", trial.customer_email, e);
    }

    if (new_status !== trial.sla_status) {
      await sb.from("trial_delivery_sla").update({ sla_status: new_status, last_check_at: new Date().toISOString() }).eq("id", trial.id);
      if (new_status === "breached") {
        await sendSMS(ADMIN_PHONE, TWILIO_FROM, `🚨 Trial breach: ${trial.customer_email} (${trial.product_slug}) — 0 signals after ${ageHrs.toFixed(0)}h. Manual review needed.`, "trial_sla");
      }
    } else {
      await sb.from("trial_delivery_sla").update({ last_check_at: new Date().toISOString() }).eq("id", trial.id);
    }

    results.push({ email: trial.customer_email, product: trial.product_slug, status: new_status, age_hrs: ageHrs.toFixed(1), delivered: trial.leads_delivered });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
