// dwa-v4-retention-sweep — v4 daily retention + growth autopilot
// Runs §3 Anniversary Notices, §1 Health Score Triage, §4 Upsell Triggers
// Scheduled daily at 10am ET.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// All DWA client tables to scan for active subscriptions
const CLIENT_TABLES: { table: string; product: string; emailCol: string; createdCol: string }[] = [
  { table: "field_crm_clients", product: "FieldDesk", emailCol: "owner_email", createdCol: "created_at" },
  { table: "hire_alert_clients", product: "TechAlert", emailCol: "contact_email", createdCol: "created_at" },
  { table: "contractor_clients", product: "Contractor Leads", emailCol: "owner_email", createdCol: "created_at" },
  { table: "missed_call_clients", product: "Missed-Call Catch", emailCol: "owner_email", createdCol: "created_at" },
  { table: "mortgage_radar_clients", product: "Mortgage Radar", emailCol: "owner_email", createdCol: "created_at" },
];

function anniversaryRecapHtml(name: string, product: string, year: number) {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0a1628;">
    <p style="color:#00d4ff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">YEAR ${year} ANNIVERSARY</p>
    <h1 style="font-size:28px;font-weight:900;line-height:1.2;margin:0 0 18px;">Your ${product} price is locked. Forever.</h1>
    <p style="font-size:16px;line-height:1.6;color:#334155;">
      Hey ${name || "there"} — quick heads up: you've been a ${product} client for ${year} year${year === 1 ? "" : "s"} now.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#334155;">
      We just raised pricing for new customers, but <strong>your rate stays exactly where it is</strong>. That's the deal we made when you signed up, and we're keeping it.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#334155;">
      No action needed. Just wanted you to know.
    </p>
    <p style="font-size:14px;color:#64748b;margin-top:32px;">
      — Matt<br/>Detroit Web Agency<br/>(313) 992-1219
    </p>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const stats = {
    anniversary_sent: 0,
    health_scored: 0,
    health_red: 0,
    upsells_detected: 0,
    errors: [] as string[],
  };

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // --- §3 Anniversary Notices: clients whose signup anniversary is in 30 days ---
  for (const cfg of CLIENT_TABLES) {
    try {
      const { data: clients } = await sb
        .from(cfg.table)
        .select(`id, ${cfg.emailCol}, ${cfg.createdCol}`)
        .limit(1000);
      if (!clients) continue;

      for (const c of clients as any[]) {
        const email = c[cfg.emailCol];
        const created = c[cfg.createdCol];
        if (!email || !created) continue;

        const signupDate = new Date(created);
        // Compute next anniversary
        const thisYearAnniv = new Date(now.getFullYear(), signupDate.getMonth(), signupDate.getDate());
        const nextAnniv = thisYearAnniv > now
          ? thisYearAnniv
          : new Date(now.getFullYear() + 1, signupDate.getMonth(), signupDate.getDate());
        const daysUntil = Math.floor((nextAnniv.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        if (daysUntil !== 30) continue;

        const noticeYear = nextAnniv.getFullYear() - signupDate.getFullYear();
        if (noticeYear < 1) continue;

        // Idempotency: skip if already sent this year
        const { data: existing } = await sb
          .from("anniversary_notices")
          .select("id")
          .eq("client_email", email)
          .eq("product", cfg.product)
          .eq("notice_year", noticeYear)
          .maybeSingle();
        if (existing) continue;

        await sendEmail(
          email,
          `Your ${cfg.product} price is locked — year ${noticeYear} 🔒`,
          anniversaryRecapHtml(email.split("@")[0], cfg.product, noticeYear),
        );
        await sb.from("anniversary_notices").insert({
          client_email: email,
          product: cfg.product,
          signup_date: signupDate.toISOString().slice(0, 10),
          notice_year: noticeYear,
          recap_data: { sent_on: today },
        });
        stats.anniversary_sent++;
      }
    } catch (err) {
      stats.errors.push(`anniversary:${cfg.product}:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- §1 Health Score Triage (weekly: only run on Mondays) ---
  if (now.getUTCDay() === 1) {
    for (const cfg of CLIENT_TABLES) {
      try {
        const { data: clients } = await sb
          .from(cfg.table)
          .select(`id, ${cfg.emailCol}, ${cfg.createdCol}`)
          .limit(1000);
        if (!clients) continue;

        for (const c of clients as any[]) {
          const email = c[cfg.emailCol];
          if (!email) continue;

          // Simple signal collection (extensible — start lean)
          const signals: Record<string, any> = {};
          let score = 100;

          // Signal 1: payment failures in last 30 days
          const { count: failedPayments } = await sb
            .from("email_send_log")
            .select("id", { count: "exact", head: true })
            .eq("template_name", "payment_failed")
            .ilike("to_email", email)
            .gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
          signals.payment_failures_30d = failedPayments || 0;
          if ((failedPayments || 0) >= 1) score -= 30;

          // Signal 2: account age (newer = riskier)
          const ageDays = Math.floor((now.getTime() - new Date(c[cfg.createdCol]).getTime()) / (24 * 60 * 60 * 1000));
          signals.account_age_days = ageDays;
          if (ageDays < 30) score -= 10;

          // Signal 3: NPS detractor in last 90d
          const { data: npsRow } = await sb
            .from("client_nps_scores")
            .select("score")
            .eq("client_email", email)
            .gte("created_at", new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (npsRow) {
            signals.last_nps = (npsRow as any).score;
            if ((npsRow as any).score <= 6) score -= 40;
            else if ((npsRow as any).score <= 8) score -= 10;
          }

          score = Math.max(0, Math.min(100, score));
          const status: "green" | "yellow" | "red" = score >= 75 ? "green" : score >= 50 ? "yellow" : "red";

          await sb.from("client_health_scores").insert({
            client_email: email,
            product: cfg.product,
            score,
            status,
            signals,
            matt_notified_at: status === "red" ? new Date().toISOString() : null,
          });
          stats.health_scored++;
          if (status === "red") {
            stats.health_red++;
            await notifyMatt(`🔴 HEALTH: ${email} (${cfg.product}) score=${score}. Reach out today.`);
          }
        }
      } catch (err) {
        stats.errors.push(`health:${cfg.product}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // --- §4 Smart Upsell Triggers ---
  try {
    // Trigger A: FieldDesk client with 50+ jobs/mo → pitch SiteRadar Pro
    const { data: fdHeavy } = await sb
      .from("field_crm_clients")
      .select("id, owner_email")
      .limit(500);
    for (const c of (fdHeavy as any[]) || []) {
      if (!c.owner_email) continue;
      const { count: jobs } = await sb
        .from("field_service_jobs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", c.id)
        .gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if ((jobs || 0) < 50) continue;

      const { error: upErr } = await sb.from("upsell_opportunities").upsert({
        client_email: c.owner_email,
        current_product: "FieldDesk",
        suggested_addon: "SiteRadar Pro",
        trigger_reason: `${jobs} jobs in last 30 days — high-volume shop, ready for visitor intel`,
        signal_data: { jobs_30d: jobs },
        outcome: "pending",
      }, { onConflict: "client_email,suggested_addon", ignoreDuplicates: true });
      if (!upErr) stats.upsells_detected++;
    }

    // Trigger B: SiteRadar client with 10+ hot visitors/wk → pitch Mortgage Radar
    const { data: srClients } = await sb
      .from("field_crm_clients")
      .select("id, owner_email, visitor_script_key")
      .not("visitor_script_key", "is", null)
      .limit(500);
    for (const c of (srClients as any[]) || []) {
      if (!c.owner_email) continue;
      const { count: visitors } = await sb
        .from("crm_visitor_events")
        .select("id", { count: "exact", head: true })
        .eq("client_id", c.id)
        .gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if ((visitors || 0) < 10) continue;

      const { error: upErr } = await sb.from("upsell_opportunities").upsert({
        client_email: c.owner_email,
        current_product: "SiteRadar",
        suggested_addon: "Mortgage Radar",
        trigger_reason: `${visitors} hot visitors last 7 days — homeowner intent signals worth chasing`,
        signal_data: { visitors_7d: visitors },
        outcome: "pending",
      }, { onConflict: "client_email,suggested_addon", ignoreDuplicates: true });
      if (!upErr) stats.upsells_detected++;
    }
  } catch (err) {
    stats.errors.push(`upsell:${err instanceof Error ? err.message : String(err)}`);
  }

  // Daily SMS digest
  await notifyMatt(
    `📊 v4 Sweep ${today}: ${stats.anniversary_sent} anniversary, ${stats.health_scored} health (${stats.health_red} red), ${stats.upsells_detected} upsells${stats.errors.length ? ` | ${stats.errors.length} errors` : ""}`,
  );

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
