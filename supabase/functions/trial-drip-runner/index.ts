// Trial Drip Runner — single function handles all day-touches
// Runs daily at 11am ET (15:00 UTC).
// For each active trial in trial_signups:
//   - Calculates days_elapsed
//   - Fires day2 / day5 / day6 concierge touches (idempotent via trial_drip_state)
//   - On day 4: checks SLA status, auto-extends Stripe trial +7d if under-delivered
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { sendSMS } from "../_shared/twilio.ts";
import { dwaEmail } from "../_shared/dwa-email.ts";
import { wrapServe } from "../_shared/telemetry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Per-product minimum lead expectations by day-3
const PRODUCT_MIN_LEADS_D3: Record<string, number> = {
  trade_radar: 3,
  mortgage_radar: 2,
  contractor: 2,
  talent_radar: 1,
  hire_alert: 1,
};

function productFamily(product_key: string): string {
  if (product_key?.startsWith("trade_radar")) return "trade_radar";
  if (product_key?.startsWith("mortgage_radar")) return "mortgage_radar";
  if (product_key?.includes("contractor")) return "contractor";
  if (product_key?.includes("talent") || product_key?.includes("hire_alert")) return "talent_radar";
  return product_key;
}

function daysElapsed(startISO: string): number {
  return Math.floor((Date.now() - new Date(startISO).getTime()) / 86_400_000);
}

interface Trial {
  id: string;
  email: string;
  phone: string | null;
  product_key: string;
  stripe_subscription_id: string | null;
  trial_started_at: string;
  trial_ends_at: string;
  first_lead_delivered_at: string | null;
  lead_count_d1: number;
  lead_count_d2: number;
  lead_count_d3: number;
  sla_status: string;
  compensation_applied_at: string | null;
}

async function alreadySent(sb: any, trial_id: string, touch_key: string): Promise<boolean> {
  const { data } = await sb
    .from("trial_drip_state")
    .select("id")
    .eq("trial_signup_id", trial_id)
    .eq("touch_key", touch_key)
    .maybeSingle();
  return !!data;
}

async function recordTouch(sb: any, trial_id: string, touch_key: string, channel: string, status: string, error?: string, meta?: any) {
  await sb.from("trial_drip_state").insert({
    trial_signup_id: trial_id,
    touch_key,
    channel,
    status,
    error: error || null,
    meta: meta || {},
  });
  await sb.from("trial_signups")
    .update({ last_concierge_touch_at: new Date().toISOString() })
    .eq("id", trial_id);
}

async function sendDay2(sb: any, t: Trial) {
  const totalLeads = t.lead_count_d1 + t.lead_count_d2;
  if (t.phone) {
    const body = `Hey — Matt here. Day 2 of your trial. You've got ${totalLeads} lead${totalLeads === 1 ? "" : "s"} so far. Reply 1=great 2=mixed 3=need help — I read every reply personally.`;
    try {
      await sendSMS(t.phone, TWILIO_FROM, body, "trial_day2_checkin");
      await recordTouch(sb, t.id, "day2", "sms", "sent", undefined, { lead_count: totalLeads });
    } catch (e) {
      await recordTouch(sb, t.id, "day2", "sms", "failed", String(e));
    }
  } else {
    await dwaEmail({ to: t.email, subject: "Day 2 of your trial — how's it going?", html: `<p>Hey,</p><p>Matt here. Day 2 of your trial. You've got <strong>${totalLeads}</strong> lead${totalLeads === 1 ? "" : "s"} so far.</p><p>Reply with anything you're seeing — I read every reply personally.</p><p>— Matt · (313) 992-1219</p>` });
    await recordTouch(sb, t.id, "day2", "email", "sent");
  }
}

async function sendDay5(sb: any, t: Trial) {
  const total = t.lead_count_d1 + t.lead_count_d2 + t.lead_count_d3 + (t as any).lead_count_d4 + (t as any).lead_count_d5;
  await dwaEmail({ to: t.email, subject: `Mid-trial recap — ${total} leads delivered so far`, html: `<p>Hey,</p><p>Quick mid-trial check-in. So far you've received <strong>${total} leads</strong> across the first 5 days of your trial.</p><p>You've got 2 more days of trial leads coming. After that, your subscription auto-converts unless you cancel.</p><p>Reply if anything's off, or just keep watching the dashboard.</p><p>— Matt · (313) 992-1219</p>` });
  await recordTouch(sb, t.id, "day5", "email", "sent", undefined, { total_leads: total });
}

async function sendDay6(sb: any, t: Trial) {
  // Alert Matt — conversion happens tomorrow
  const total = t.lead_count_d1 + t.lead_count_d2 + t.lead_count_d3 + (t as any).lead_count_d4 + (t as any).lead_count_d5 + (t as any).lead_count_d6;
  await sendSMS(ADMIN_PHONE, TWILIO_FROM, `📅 Trial converts tomorrow: ${t.email} (${t.product_key}). ${total} leads delivered. Send a personal thanks?`, "trial_day6_admin_alert", false, { bypassQuietHours: true });
  await recordTouch(sb, t.id, "day6", "sms", "sent", undefined, { admin_alerted: true, total_leads: total });
}

async function checkAndCompensate(sb: any, t: Trial): Promise<boolean> {
  if (t.compensation_applied_at) return false;
  const fam = productFamily(t.product_key);
  const minD3 = PRODUCT_MIN_LEADS_D3[fam] ?? 2;
  const sumD123 = t.lead_count_d1 + t.lead_count_d2 + t.lead_count_d3;
  if (sumD123 >= minD3) {
    // SLA met — mark green
    await sb.from("trial_signups").update({ sla_status: "green" }).eq("id", t.id);
    return false;
  }
  // Under-delivered → red status + auto-extend Stripe trial + comp email/SMS
  await sb.from("trial_signups").update({ sla_status: "red" }).eq("id", t.id);

  let extendedTo: string | null = null;
  if (t.stripe_subscription_id && STRIPE_KEY) {
    try {
      const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-08-27.basil" });
      const sub = await stripe.subscriptions.retrieve(t.stripe_subscription_id);
      const currentEnd = sub.trial_end || Math.floor(Date.now() / 1000);
      const newEnd = currentEnd + 7 * 86400;
      await stripe.subscriptions.update(t.stripe_subscription_id, { trial_end: newEnd, proration_behavior: "none" });
      extendedTo = new Date(newEnd * 1000).toISOString();
    } catch (e) {
      console.error("[trial-drip] Stripe extend failed:", e);
    }
  }

  await sb.from("trial_signups")
    .update({
      compensation_applied_at: new Date().toISOString(),
      compensation_amount_cents: 0,
      trial_ends_at: extendedTo || t.trial_ends_at,
    })
    .eq("id", t.id);

  await dwaEmail({ to: t.email, subject: "We owe you — your trial is extended +7 days", html: `<p>Hey,</p><p>Heads up: your first 3 trial days delivered fewer leads than we promised (${sumD123} delivered, ${minD3} expected).</p><p>We've automatically extended your trial by 7 more days at no charge. No action needed from you.</p><p>If you want to talk through what happened, reply or text me at (313) 992-1219.</p><p>— Matt</p>` });

  await sendSMS(ADMIN_PHONE, TWILIO_FROM, `⚠️ Auto-comp: ${t.email} (${t.product_key}) under-delivered (${sumD123}/${minD3} by D3). Trial extended +7d.`, "trial_auto_comp", false, { bypassQuietHours: true });

  await recordTouch(sb, t.id, "day4_comp", "email+sms", "sent", undefined, { sumD123, minD3, extendedTo });
  return true;
}

export default wrapServe("trial-drip-runner", async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: trials, error } = await sb
    .from("trial_signups")
    .select("*")
    .eq("status", "active")
    .gte("trial_ends_at", new Date(Date.now() - 14 * 86400000).toISOString())
    .limit(500);

  if (error) throw error;

  const results = { day2: 0, day5: 0, day6: 0, comp: 0, skipped: 0, errors: 0 };

  for (const t of (trials || []) as Trial[]) {
    try {
      const days = daysElapsed(t.trial_started_at);

      if (days === 2 && !(await alreadySent(sb, t.id, "day2"))) {
        await sendDay2(sb, t); results.day2++;
      }
      if (days === 4 && !(await alreadySent(sb, t.id, "day4_comp"))) {
        if (await checkAndCompensate(sb, t)) results.comp++;
      }
      if (days === 5 && !(await alreadySent(sb, t.id, "day5"))) {
        await sendDay5(sb, t); results.day5++;
      }
      if (days === 6 && !(await alreadySent(sb, t.id, "day6"))) {
        await sendDay6(sb, t); results.day6++;
      }
      if (![2, 4, 5, 6].includes(days)) results.skipped++;
    } catch (e) {
      console.error("[trial-drip] trial error:", t.id, e);
      results.errors++;
    }
  }

  return new Response(JSON.stringify({ ok: true, scanned: trials?.length || 0, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
