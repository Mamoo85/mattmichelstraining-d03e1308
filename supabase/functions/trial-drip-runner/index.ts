// Trial → Paid Recovery Drip + SLA Watchdog
// Runs daily 9am ET. Sends day 3, 5, 6, 8, 14 touches per active trial.
// Also checks day-4 SLA: if < MIN_LEADS delivered, auto-extends trial 7 days via Stripe.
// Uses centralized offers.ts for pricing/copy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { OFFERS, offerCopy, INTRO_DISCOUNT_PCT, INTRO_DISCOUNT_MONTHS, TRIAL_DAYS } from "../_shared/offers.ts";
import { sendSMS } from "../_shared/twilio.ts";

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

// Minimum qualified leads expected by day 4 per product.
const MIN_LEADS: Record<string, number> = {
  trade_radar_roofing: 5, trade_radar_hvac: 5, trade_radar_plumbing: 5,
  trade_radar_electrical: 5, trade_radar_pest_control: 5, trade_radar_gutters: 5,
  trade_radar_exterior: 5, trade_radar_tree: 5, trade_radar_restoration: 5,
  trade_radar_demo_junk: 5, trade_radar_foundation: 5,
  mortgage_radar: 3, techalert: 2, contractor_leads: 2,
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "Detroit Web Agency <matt@detroitwebagent.com>";

interface DripTouch {
  key: "day3" | "day5" | "day6" | "day8" | "day14";
  daysAfterStart: number;
  subject: (productName: string) => string;
  body: (productName: string, ctaUrl: string) => string;
}

const TOUCHES: DripTouch[] = [
  {
    key: "day3",
    daysAfterStart: 3,
    subject: (p) => `Quick check-in on your ${p} trial`,
    body: (p, url) => `<p>Hi — Matt here from Detroit Web Agency.</p>
<p>You're 3 days into your ${p} trial. Have you seen your first signal yet? Most accounts surface their first qualified lead within 48 hours.</p>
<p>If you haven't logged in yet, here's the fastest path:</p>
<p><a href="${url}" style="background:#00d4ff;color:#0a1628;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:4px">Open ${p}</a></p>
<p>Reply to this email if anything looks off — I read every one.</p>
<p>— Matt</p>`,
  },
  {
    key: "day5",
    daysAfterStart: 5,
    subject: (p) => `Your ${p} trial ends in 48 hours`,
    body: (p, url) => `<p>Heads up — your ${TRIAL_DAYS}-day ${p} trial wraps up in 48 hours.</p>
<p>If you'd like to keep your data, signals, and dashboard live, you'll get <strong>${INTRO_DISCOUNT_PCT}% off your first ${INTRO_DISCOUNT_MONTHS} months</strong> automatically applied at checkout — no extra code needed.</p>
<p><a href="${url}" style="background:#00d4ff;color:#0a1628;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:4px">Continue with ${INTRO_DISCOUNT_PCT}% off</a></p>
<p>Questions? Just reply.</p>
<p>— Matt</p>`,
  },
  {
    key: "day6",
    daysAfterStart: 6,
    subject: (_p) => `A note from Matt — and 3 extra trial days if you need them`,
    body: (p, url) => `<p>Hey,</p>
<p>I noticed your ${p} trial ends tomorrow and you haven't converted yet. No pressure — I've been on the other side of this email a hundred times.</p>
<p>If you need more time to evaluate, just reply with "extend" and I'll add 3 more days to your trial personally. No catch.</p>
<p>Or if you're ready: <a href="${url}">${INTRO_DISCOUNT_PCT}% off your first ${INTRO_DISCOUNT_MONTHS} months still applies</a>.</p>
<p>Either way — thanks for trying us out.</p>
<p>— Matt Michels<br/>Detroit Web Agency<br/>(313) 992-1219</p>`,
  },
  {
    key: "day8",
    daysAfterStart: 8,
    subject: (p) => `Miss us? Reactivate ${p} at 50% off`,
    body: (p, url) => `<p>Your ${p} trial expired yesterday. We're saving your data for 14 more days in case you change your mind.</p>
<p>If you'd like to come back, the <strong>${INTRO_DISCOUNT_PCT}% off ${INTRO_DISCOUNT_MONTHS}-month</strong> intro is still good for you:</p>
<p><a href="${url}" style="background:#00d4ff;color:#0a1628;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:4px">Reactivate ${p}</a></p>
<p>— Matt</p>`,
  },
  {
    key: "day14",
    daysAfterStart: 14,
    subject: (p) => `Last call: your ${p} data archives tomorrow`,
    body: (p, url) => `<p>This is the last note — your ${p} account and historical signals will be archived tomorrow.</p>
<p>If you want to keep everything live, this is your last chance to claim ${INTRO_DISCOUNT_PCT}% off:</p>
<p><a href="${url}" style="background:#00d4ff;color:#0a1628;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:4px">Reactivate before archive</a></p>
<p>If not, no hard feelings — best of luck.</p>
<p>— Matt</p>`,
  },
];

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!r.ok) return { ok: false, error: `${r.status} ${await r.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";

  const { data: signups, error } = await sb
    .from("trial_signups")
    .select("id, email, phone, product_key, trial_started_at, status, converted_at, stripe_subscription_id, first_lead_delivered_at, compensation_applied, sla_status")
    .in("status", ["active", "expired"])
    .is("converted_at", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const results: Array<Record<string, unknown>> = [];

  for (const s of signups ?? []) {
    const offer = OFFERS[s.product_key as keyof typeof OFFERS];
    if (!offer) continue;
    const startMs = new Date(s.trial_started_at).getTime();
    const daysSince = Math.floor((now - startMs) / 86400000);

    // E5: Day-4 SLA check — auto-compensate if no leads delivered yet
    if (daysSince === 4 && !s.compensation_applied && !s.first_lead_delivered_at && s.status === "active") {
      const minLeads = MIN_LEADS[s.product_key] ?? 2;
      // Extend trial 7 days via Stripe if we have a subscription ID
      if (s.stripe_subscription_id && STRIPE_SECRET_KEY) {
        try {
          const newTrialEnd = Math.floor((Date.now() + 7 * 86400 * 1000) / 1000);
          await fetch(`https://api.stripe.com/v1/subscriptions/${s.stripe_subscription_id}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `trial_end=${newTrialEnd}`,
          });
        } catch (e) {
          console.error(`[trial-drip-runner] Stripe trial extend failed for ${s.email}:`, e);
        }
      }
      // Apology SMS if client has a phone
      if (s.phone) {
        await sendSMS(s.phone, TWILIO_FROM,
          `Hey — we didn't hit our lead promise this week. Extending your ${offer.displayName} trial 7 more days free, no charge. — Matt (313) 992-1219`,
          "trial_compensation"
        ).catch(() => {});
      }
      await sb.from("trial_signups").update({
        compensation_applied: true,
        compensation_reason: `0 leads delivered by day 4 (minimum: ${minLeads})`,
        sla_status: "red",
      }).eq("id", s.id);
      results.push({ email: s.email, product: s.product_key, action: "compensation_extended" });
    }

    // Update SLA status (amber if no lead by day 2)
    if (daysSince >= 2 && !s.first_lead_delivered_at && s.sla_status === "green") {
      await sb.from("trial_signups").update({ sla_status: "amber" }).eq("id", s.id);
    }

    const due = TOUCHES.find((t) => t.daysAfterStart === daysSince);
    if (!due) continue;

    const { data: existing } = await sb
      .from("trial_drip_state")
      .select("id")
      .eq("trial_signup_id", s.id)
      .eq("touch_key", due.key)
      .maybeSingle();
    if (existing) continue;

    const copy = offerCopy(s.product_key as keyof typeof OFFERS);
    const ctaUrl = `https://detroitwebagent.com${copy.ctaPath}&utm_source=trial_drip&utm_medium=email&utm_campaign=${due.key}`;

    if (dryRun) {
      results.push({ email: s.email, product: s.product_key, touch: due.key, dryRun: true });
      continue;
    }

    const sendResult = await sendEmail(s.email, due.subject(offer.displayName), due.body(offer.displayName, ctaUrl));

    await sb.from("trial_drip_state").insert({
      trial_signup_id: s.id,
      touch_key: due.key,
      channel: "email",
      status: sendResult.ok ? "sent" : "failed",
      error: sendResult.error ?? null,
    });

    results.push({ email: s.email, product: s.product_key, touch: due.key, ok: sendResult.ok, error: sendResult.error });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
