// dwa-autopilot-sweep — §10 Cron-Everything Autopilot
// Daily sweep that:
//  1. Nudges referrers when their referred contact hasn't signed up after 7 days
//  2. Auto-promotes referrals from `signed_up` -> `paid` when matching subscription found
//  3. Follows up on stale FieldDesk eWay imports (created 5+ days ago, no activity)
//  4. Notifies Matt on the daily digest
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Detroit Web Agency <matt@detroitwebagent.com>",
      to: [to],
      subject,
      html,
    }),
  }).catch(() => {});
}

async function notifyMatt(msg: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return;
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: TWILIO_FROM, To: ADMIN_PHONE, Body: msg }).toString(),
  }).catch(() => {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const stats = { referral_nudges: 0, referral_promoted: 0, eway_followups: 0, errors: [] as string[] };
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();

  // --- 1. Referral nudges (pending 7+ days, not yet nudged) ---
  try {
    const { data: stale } = await sb
      .from("dwa_contractor_referrals")
      .select("id, referrer_email, referrer_name, referred_email, referred_name, product_interest, referral_code, created_at")
      .eq("status", "pending")
      .lt("created_at", sevenDaysAgo)
      .is("nudged_at", null)
      .limit(25);

    for (const r of stale || []) {
      const html = `
        <p>Hey ${r.referrer_name || "there"},</p>
        <p>Just a heads-up — <b>${r.referred_name || r.referred_email}</b> hasn't signed up yet for ${r.product_interest || "DWA"}.</p>
        <p>If you want to give them a friendly nudge, your referral code is still active: <b>${r.referral_code}</b></p>
        <p>You'll earn $50 in account credit the moment they pay.</p>
        <p>— Matt @ Detroit Web Agency</p>`;
      await sendEmail(r.referrer_email, `Reminder: ${r.referred_name || "Your referral"} hasn't signed up yet`, html);
      await sb.from("dwa_contractor_referrals").update({ nudged_at: new Date().toISOString() }).eq("id", r.id);
      stats.referral_nudges++;
    }
  } catch (e) {
    stats.errors.push(`referral_nudge: ${(e as Error).message}`);
  }

  // --- 2. Auto-promote signed_up -> paid when matching paid client found ---
  try {
    const { data: signedUp } = await sb
      .from("dwa_contractor_referrals")
      .select("id, referred_email, product_interest")
      .eq("status", "signed_up")
      .limit(50);

    for (const r of signedUp || []) {
      // Look for matching paid client across all DWA product tables
      const checks = await Promise.all([
        sb.from("contractor_clients").select("id").eq("email", r.referred_email).eq("active", true).maybeSingle(),
        sb.from("hire_alert_clients").select("id").eq("email", r.referred_email).eq("active", true).maybeSingle(),
        sb.from("field_crm_clients").select("id").eq("email", r.referred_email).eq("active", true).maybeSingle(),
      ]);
      const paid = checks.some((c) => c.data);
      if (paid) {
        await sb.from("dwa_contractor_referrals").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", r.id);
        stats.referral_promoted++;
        await notifyMatt(`💰 DWA Referral converted: ${r.referred_email} (${r.product_interest}) — $50 credit owed`);
      }
    }
  } catch (e) {
    stats.errors.push(`referral_promote: ${(e as Error).message}`);
  }

  // --- 3. eWay migration follow-ups (no activity 5+ days post-import) ---
  try {
    const { data: stale } = await sb
      .from("field_crm_clients")
      .select("id, email, business_name, created_at")
      .eq("active", true)
      .ilike("notes", "%eway%")
      .lt("created_at", fiveDaysAgo)
      .is("eway_followup_sent_at", null)
      .limit(20);

    for (const c of stale || []) {
      const html = `
        <p>Hey,</p>
        <p>Quick check-in — you imported your contacts from eWay into FieldDesk a few days ago. How's it going?</p>
        <p>If you hit any snags or want a 15-min walkthrough on routing/dispatching, just reply to this email.</p>
        <p>— Matt @ Detroit Web Agency</p>`;
      await sendEmail(c.email, `Quick eWay → FieldDesk check-in`, html);
      await sb.from("field_crm_clients").update({ eway_followup_sent_at: new Date().toISOString() }).eq("id", c.id);
      stats.eway_followups++;
    }
  } catch (e) {
    stats.errors.push(`eway_followup: ${(e as Error).message}`);
  }

  // --- 4. Daily digest to Matt (only if there's something to report) ---
  const total = stats.referral_nudges + stats.referral_promoted + stats.eway_followups;
  if (total > 0 || stats.errors.length > 0) {
    await notifyMatt(
      `🤖 DWA Autopilot: ${stats.referral_nudges} referral nudges, ${stats.referral_promoted} promoted, ${stats.eway_followups} eWay follow-ups${stats.errors.length ? `, ${stats.errors.length} errors` : ""}`,
    );
  }

  return new Response(JSON.stringify({ ok: true, ...stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
