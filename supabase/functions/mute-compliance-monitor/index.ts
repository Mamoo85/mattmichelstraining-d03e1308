import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// STOP keywords per CTIA guidelines
const STOP_KEYWORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"];

// All SMS product tables that send to phone numbers
const SMS_PRODUCTS = [
  "sms_blast_clients", "noshow_clients", "estimate_drip_clients",
  "invoice_chaser_clients", "afterjob_drip_clients", "promo_blaster_clients",
  "referral_program_clients", "slow_day_clients", "homeowner_campaign_clients",
  "birthday_campaign_clients", "appointment_reminders",
];

async function sendMuteEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Mute <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#1a1a2e;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">🔇</span>
          <strong style="color:#a78bfa;font-size:16px;">Agent Mute — Compliance Monitor</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const alerts: string[] = [];
    let violations = 0;

    // 1. Check suppressed_emails for any recently added
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: recentSuppressed, count: suppressedCount } = await sb
      .from("suppressed_emails")
      .select("email, reason, created_at", { count: "exact" })
      .gte("created_at", dayAgo)
      .limit(20);

    if (recentSuppressed?.length) {
      alerts.push(`<h3 style="color:#f59e0b;">📧 ${recentSuppressed.length} New Email Suppressions (24h)</h3>
        <ul>${recentSuppressed.map(s => `<li>${s.email} — ${s.reason || "unsubscribed"}</li>`).join("")}</ul>`);
    }

    // 2. Check newsletter unsubscribes
    const { data: recentUnsubs } = await sb
      .from("newsletter_subscribers")
      .select("email, unsubscribed_at")
      .not("unsubscribed_at", "is", null)
      .gte("unsubscribed_at", dayAgo)
      .limit(20);

    if (recentUnsubs?.length) {
      alerts.push(`<h3 style="color:#f59e0b;">📰 ${recentUnsubs.length} Newsletter Unsubscribes (24h)</h3>
        <ul>${recentUnsubs.map(u => `<li>${u.email}</li>`).join("")}</ul>`);
    }

    // 3. Cross-reference: ensure suppressed emails are NOT in any active outreach
    const { data: allSuppressed } = await sb
      .from("suppressed_emails")
      .select("email")
      .limit(1000);

    const suppressedSet = new Set((allSuppressed || []).map(s => s.email?.toLowerCase()));

    // Check outreach_leads for any suppressed emails still marked as "new" or in active drip
    if (suppressedSet.size > 0) {
      const { data: activeLeads } = await sb
        .from("outreach_leads")
        .select("id, email, business_name, status")
        .in("status", ["new", "emailed", "drip"])
        .limit(500);

      const violatingLeads = (activeLeads || []).filter(l => l.email && suppressedSet.has(l.email.toLowerCase()));

      if (violatingLeads.length > 0) {
        violations += violatingLeads.length;
        alerts.push(`<h3 style="color:#ef4444;">🚨 VIOLATION: ${violatingLeads.length} Suppressed Emails in Active Outreach!</h3>
          <p>These leads are on the suppressed list but still in active drip:</p>
          <ul>${violatingLeads.map(l => `<li><strong>${l.business_name}</strong> (${l.email}) — status: ${l.status}</li>`).join("")}</ul>
          <p style="color:#ef4444;font-weight:bold;">⚠️ Auto-pausing these leads now...</p>`);

        // Auto-fix: update these leads to "suppressed" status
        for (const lead of violatingLeads) {
          await sb.from("outreach_leads").update({ status: "suppressed" }).eq("id", lead.id);
        }
      }
    }

    // 4. Check email send volume (CAN-SPAM: don't send too many)
    const { count: emailsSent24h } = await sb
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo);

    if (emailsSent24h && emailsSent24h > 200) {
      alerts.push(`<h3 style="color:#f59e0b;">📊 High Email Volume: ${emailsSent24h} emails in 24h</h3>
        <p>Monitor for spam complaints. Resend daily limit may apply.</p>`);
    }

    // 5. Compliance summary
    const totalSuppressed = suppressedSet.size;
    const summaryHtml = `<h3 style="color:#a78bfa;">📋 Compliance Summary</h3>
      <p>Total suppressed emails: <strong>${totalSuppressed}</strong></p>
      <p>New suppressions (24h): <strong>${recentSuppressed?.length || 0}</strong></p>
      <p>Newsletter unsubs (24h): <strong>${recentUnsubs?.length || 0}</strong></p>
      <p>Emails sent (24h): <strong>${emailsSent24h || 0}</strong></p>
      <p>Violations found & fixed: <strong style="color:${violations > 0 ? '#ef4444' : '#10b981'};">${violations}</strong></p>`;

    // Only email if violations found or high volume
    if (violations > 0 || (emailsSent24h && emailsSent24h > 200)) {
      await sendMuteEmail(
        `🔇 Mute: ${violations} violations fixed, ${suppressedCount || 0} new suppressions`,
        alerts.join("") + summaryHtml
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      violations_fixed: violations,
      new_suppressions: recentSuppressed?.length || 0,
      newsletter_unsubs: recentUnsubs?.length || 0,
      total_suppressed: totalSuppressed,
      emails_sent_24h: emailsSent24h || 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[MUTE]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
