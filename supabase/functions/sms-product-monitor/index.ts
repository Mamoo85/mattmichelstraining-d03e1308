// SMS PRODUCT MONITOR — Daily Account Health Watchdog
// Runs daily at 7am ET (after oracle-monitor's 6am briefing)
// Checks all 10 new B2B product accounts for:
//   1. Unconfigured accounts (active but missing setup >48h)
//   2. Stuck sequences (next_send_at overdue)
//   3. Silent active accounts (paying but never received service)
// Texts Matt at (313) 806-4952 with a summary ONLY if issues found.
// Zero noise when everything is healthy.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const MATT_PHONE = Deno.env.get("ADMIN_PHONE_NUMBER") || "+13138064952";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

interface Issue {
  severity: "critical" | "warning";
  product: string;
  business: string;
  detail: string;
  mrrAtRisk: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Service-role auth — cron only
  const auth = req.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${SUPABASE_SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const ago48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ago2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const ago30min = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const issues: Issue[] = [];

  // ── 1. UNCONFIGURED ACCOUNTS ────────────────────────────────────────────────

  // Review Monitor: active but no google_place_id after 48h
  try {
    const { data } = await sb.from("review_monitor_clients" as any)
      .select("business_name, email, created_at")
      .eq("active", true)
      .is("google_place_id", null)
      .lt("created_at", ago48h);
    for (const row of data || []) {
      const daysOld = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000);
      issues.push({ severity: daysOld > 5 ? "critical" : "warning", product: "Review Monitor ($25/mo)", business: row.business_name || row.email, detail: `No Google Place ID — ${daysOld}d since signup`, mrrAtRisk: 25 });
    }
  } catch (e) { console.error("review_monitor_clients check:", e); }

  // SMS Blast: active but no contacts after 48h
  try {
    const { data } = await sb.from("sms_blast_clients" as any)
      .select("business_name, email, created_at")
      .eq("active", true)
      .eq("contact_count", 0)
      .lt("created_at", ago48h);
    for (const row of data || []) {
      const daysOld = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000);
      issues.push({ severity: daysOld > 5 ? "critical" : "warning", product: "Weekly SMS Blast ($19/mo)", business: row.business_name || row.email, detail: `No contact list uploaded — ${daysOld}d since signup`, mrrAtRisk: 19 });
    }
  } catch (e) { console.error("sms_blast_clients check:", e); }

  // Slow Day: active but no contacts or no twilio_phone after 48h
  try {
    const { data } = await sb.from("slow_day_clients" as any)
      .select("business_name, email, created_at, contact_count, twilio_phone")
      .eq("active", true)
      .lt("created_at", ago48h);
    for (const row of data || []) {
      const noContacts = (row.contact_count || 0) === 0;
      const noPhone = !row.twilio_phone;
      if (noContacts || noPhone) {
        const daysOld = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000);
        const missingItems = [noContacts && "no contact list", noPhone && "no trigger number"].filter(Boolean).join(", ");
        issues.push({ severity: daysOld > 5 ? "critical" : "warning", product: "Slow Day SMS ($25/mo)", business: row.business_name || row.email, detail: `Setup incomplete (${missingItems}) — ${daysOld}d since signup`, mrrAtRisk: 25 });
      }
    }
  } catch (e) { console.error("slow_day_clients check:", e); }

  // Seasonal Promos: active but no contacts after 48h
  try {
    const { data } = await sb.from("promo_blaster_clients" as any)
      .select("business_name, email, created_at")
      .eq("active", true)
      .eq("contact_count", 0)
      .lt("created_at", ago48h);
    for (const row of data || []) {
      const daysOld = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000);
      issues.push({ severity: daysOld > 5 ? "critical" : "warning", product: "Seasonal Promos ($29/mo)", business: row.business_name || row.email, detail: `No contact list — ${daysOld}d since signup`, mrrAtRisk: 29 });
    }
  } catch (e) { console.error("promo_blaster_clients check:", e); }

  // Homeowner Campaign: active but no service_area after 48h
  try {
    const { data } = await sb.from("homeowner_campaign_clients" as any)
      .select("business_name, email, created_at")
      .eq("active", true)
      .is("service_area", null)
      .lt("created_at", ago48h);
    for (const row of data || []) {
      const daysOld = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000);
      issues.push({ severity: daysOld > 5 ? "critical" : "warning", product: "Homeowner Campaign ($59/mo)", business: row.business_name || row.email, detail: `No service area set — ${daysOld}d since signup`, mrrAtRisk: 59 });
    }
  } catch (e) { console.error("homeowner_campaign_clients check:", e); }

  // ── 2. STUCK SEQUENCES ──────────────────────────────────────────────────────

  // After-Job sequences overdue
  try {
    const { data } = await sb.from("afterjob_sequences" as any)
      .select("client_id, customer_name, next_send_at, current_step")
      .eq("stopped", false)
      .lt("next_send_at", ago2h)
      .limit(10);
    if ((data || []).length > 0) {
      issues.push({ severity: "critical", product: "After-Job Drip", business: `${data!.length} sequence(s) stuck`, detail: `Steps overdue by 2h+. Check afterjob_sequences table.`, mrrAtRisk: 0 });
    }
  } catch (e) { console.error("afterjob_sequences check:", e); }

  // Estimate sequences overdue
  try {
    const { data } = await sb.from("estimate_sequences" as any)
      .select("client_id, prospect_name, next_send_at, current_step")
      .eq("completed", false)
      .eq("stopped", false)
      .lt("next_send_at", ago2h)
      .limit(10);
    if ((data || []).length > 0) {
      issues.push({ severity: "critical", product: "Estimate Follow-Up Drip", business: `${data!.length} sequence(s) stuck`, detail: `Steps overdue by 2h+. Check estimate_sequences table.`, mrrAtRisk: 0 });
    }
  } catch (e) { console.error("estimate_sequences check:", e); }

  // Tracked invoices with overdue reminders
  try {
    const { data } = await sb.from("tracked_invoices" as any)
      .select("client_id, customer_name, invoice_amount, next_reminder_at")
      .eq("paid", false)
      .lt("next_reminder_at", ago2h)
      .limit(10);
    if ((data || []).length > 0) {
      issues.push({ severity: "critical", product: "Invoice Chaser", business: `${data!.length} invoice reminder(s) overdue`, detail: `Reminders not sent. Check tracked_invoices table.`, mrrAtRisk: 0 });
    }
  } catch (e) { console.error("tracked_invoices check:", e); }

  // No-show events stuck
  try {
    const { data } = await sb.from("noshow_events" as any)
      .select("client_id, customer_name, send_at")
      .eq("status", "pending")
      .lt("send_at", ago30min)
      .limit(10);
    if ((data || []).length > 0) {
      issues.push({ severity: "critical", product: "No-Show Re-Booker", business: `${data!.length} re-booking text(s) not sent`, detail: `Pending texts stuck. Check noshow_events table.`, mrrAtRisk: 0 });
    }
  } catch (e) { console.error("noshow_events check:", e); }

  // ── 3. SILENT ACTIVE ACCOUNTS (paying but never received service) ──────────

  // SMS Blast: active 7+ days, never blasted
  try {
    const { data } = await sb.from("sms_blast_clients" as any)
      .select("business_name, email, created_at, contact_count")
      .eq("active", true)
      .is("last_blast_at", null)
      .lt("created_at", ago7d)
      .gt("contact_count", 0);
    for (const row of data || []) {
      const daysOld = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000);
      issues.push({ severity: "warning", product: "Weekly SMS Blast ($19/mo)", business: row.business_name || row.email, detail: `Has ${row.contact_count} contacts but never received a blast — ${daysOld}d active`, mrrAtRisk: 19 });
    }
  } catch (e) { console.error("sms_blast silent check:", e); }

  // Slow Day: active 7+ days, never blasted
  try {
    const { data } = await sb.from("slow_day_clients" as any)
      .select("business_name, email, created_at, contact_count")
      .eq("active", true)
      .is("last_blast_at", null)
      .lt("created_at", ago7d)
      .gt("contact_count", 0);
    for (const row of data || []) {
      const daysOld = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000);
      issues.push({ severity: "warning", product: "Slow Day SMS ($25/mo)", business: row.business_name || row.email, detail: `Has contacts, trigger set, but never blasted — ${daysOld}d active`, mrrAtRisk: 25 });
    }
  } catch (e) { console.error("slow_day silent check:", e); }

  // Seasonal Promos: active 30+ days, never run a promo
  try {
    const { data } = await sb.from("promo_blaster_clients" as any)
      .select("business_name, email, created_at, contact_count")
      .eq("active", true)
      .is("last_promo_at", null)
      .lt("created_at", ago30d)
      .gt("contact_count", 0);
    for (const row of data || []) {
      issues.push({ severity: "warning", product: "Seasonal Promos ($29/mo)", business: row.business_name || row.email, detail: `Active 30+ days, has contacts, no promo sent yet`, mrrAtRisk: 29 });
    }
  } catch (e) { console.error("promo_blaster silent check:", e); }

  // ── BUILD SMS & SEND ────────────────────────────────────────────────────────

  const criticals = issues.filter(i => i.severity === "critical");
  const warnings = issues.filter(i => i.severity === "warning");
  const totalMrrAtRisk = issues.reduce((sum, i) => sum + i.mrrAtRisk, 0);

  console.log(`[sms-product-monitor] Found ${criticals.length} critical, ${warnings.length} warning issues. MRR at risk: $${totalMrrAtRisk}`);

  if (issues.length === 0) {
    return new Response(JSON.stringify({ status: "healthy", issues: 0, message: "All 10 product accounts healthy — no SMS sent." }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Build the SMS
  const lines: string[] = [`M² Watchdog — ${issues.length} issue${issues.length > 1 ? "s" : ""} found`];
  if (totalMrrAtRisk > 0) lines.push(`💸 $${totalMrrAtRisk}/mo at risk`);
  lines.push("");

  let lineNum = 1;
  for (const issue of criticals.slice(0, 4)) {
    lines.push(`${lineNum}. 🔴 ${issue.business}: ${issue.detail}`);
    lineNum++;
  }
  for (const issue of warnings.slice(0, 3)) {
    lines.push(`${lineNum}. 🟡 ${issue.business}: ${issue.detail}`);
    lineNum++;
  }
  if (issues.length > 7) {
    lines.push(`...and ${issues.length - 7} more. Check admin.`);
  }
  lines.push("\nmattmichelstraining.com/admin");

  const smsBody = lines.join("\n");
  await sendSMS(MATT_PHONE, TWILIO_FROM, smsBody, "sms_product_monitor");

  return new Response(JSON.stringify({ status: "issues_found", criticals: criticals.length, warnings: warnings.length, mrrAtRisk: totalMrrAtRisk, smsSent: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
