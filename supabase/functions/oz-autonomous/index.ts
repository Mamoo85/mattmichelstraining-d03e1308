import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const now = () => new Date().toISOString();
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

async function sendOzEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) { console.log("[OZ] No RESEND_API_KEY, skipping email"); return; }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Oz <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">🤖</span>
          <strong style="color:#f97316;font-size:16px;">Agent Oz</strong>
          <span style="font-size:11px;color:#64748b;margin-left:auto;">${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
        </div>
        ${html}
        <hr style="border:none;border-top:1px solid #334155;margin:20px 0;" />
        <p style="font-size:10px;color:#475569;text-align:center;">Autonomous report from Agent Oz · M2 Development</p>
      </div>`,
    }),
  });
}

async function logOzAction(actionType: string, details: string, status: string = "auto_completed") {
  await sb.from("ai_action_queue").insert({
    action_type: `oz_${actionType}`,
    ai_result: details,
    status,
    context: { source: "oz-autonomous", timestamp: now() },
  });
}

/* ── OPS MONITOR (every 15 min) ─────────────────────────────────────────────── */
async function opsMonitor() {
  const issues: string[] = [];
  const fixes: string[] = [];

  // 1. Check delivery failures in the last hour
  const { data: failures } = await sb
    .from("delivery_failures")
    .select("id, function_name, customer_email, error_message, created_at")
    .gte("created_at", ago(60))
    .order("created_at", { ascending: false })
    .limit(20);

  if (failures?.length) {
    issues.push(`🔴 ${failures.length} delivery failure(s) in the last hour`);
    // Log each for visibility
    for (const f of failures) {
      issues.push(`  → ${f.function_name}: ${f.customer_email || "unknown"} — ${(f.error_message || "").slice(0, 80)}`);
    }
  }

  // 2. Check open support tickets
  const { count: openTickets } = await sb
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if ((openTickets ?? 0) > 3) {
    issues.push(`🟡 ${openTickets} open support tickets — consider auto-triage`);
  }

  // 3. Check pending AI queue items
  const { count: pendingAi } = await sb
    .from("ai_action_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if ((pendingAi ?? 0) > 5) {
    issues.push(`🟡 ${pendingAi} pending AI queue items piling up`);
    // Auto-approve low-risk items (content drafts)
    const { data: lowRisk } = await sb
      .from("ai_action_queue")
      .select("id, action_type")
      .eq("status", "pending")
      .in("action_type", ["workout_suggestion", "exercise_suggestion", "content_draft"])
      .limit(10);
    if (lowRisk?.length) {
      const ids = lowRisk.map((r) => r.id);
      await sb.from("ai_action_queue").update({
        status: "approved",
        reviewed_by: "oz-autonomous",
        reviewed_at: now(),
        admin_notes: "Auto-approved by Agent Oz (low-risk)",
      }).in("id", ids);
      fixes.push(`✅ Auto-approved ${ids.length} low-risk AI queue items`);
    }
  }

  // 4. Check pending coach AI drafts
  const { count: pendingDrafts } = await sb
    .from("coach_ai_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if ((pendingDrafts ?? 0) > 5) {
    issues.push(`🟡 ${pendingDrafts} pending coach AI drafts need review`);
  }

  // 5. Check email send log for recent errors
  const { data: emailErrors } = await sb
    .from("email_send_log")
    .select("id, template_name, recipient_email, error_message")
    .eq("status", "error")
    .gte("created_at", ago(60))
    .limit(10);
  if (emailErrors?.length) {
    issues.push(`🔴 ${emailErrors.length} email send error(s) in the last hour`);
  }

  // 6. Check SMS/product table health — flag active clients with no recent activity
  const smsProducts = [
    { table: "review_monitor_clients", name: "Review Monitor", lastField: "last_sent_at" },
    { table: "sms_blast_clients", name: "SMS Blast", lastField: "last_sent_at" },
    { table: "noshow_clients", name: "No-Show", lastField: "last_sent_at" },
    { table: "estimate_drip_clients", name: "Estimate Drip", lastField: "last_sent_at" },
    { table: "invoice_chaser_clients", name: "Invoice Chaser", lastField: "last_sent_at" },
    { table: "afterjob_drip_clients", name: "After-Job Drip", lastField: "last_sent_at" },
    { table: "promo_blaster_clients", name: "Promo Blaster", lastField: "last_sent_at" },
    { table: "referral_program_clients", name: "Referral Program", lastField: "last_sent_at" },
    { table: "slow_day_clients", name: "Slow Day SMS", lastField: "last_sent_at" },
    { table: "homeowner_campaign_clients", name: "Homeowner Campaign", lastField: "last_sent_at" },
  ];

  for (const prod of smsProducts) {
    try {
      const { data: stale } = await (sb as any)
        .from(prod.table)
        .select("id, business_name")
        .eq("active", true)
        .lt(prod.lastField, daysAgo(7))
        .limit(5);
      if (stale?.length) {
        issues.push(`🟡 ${prod.name}: ${stale.length} active client(s) with no send in 7+ days`);
      }
    } catch { /* table may not exist yet */ }
  }

  // Report
  if (issues.length > 0 || fixes.length > 0) {
    const report = [
      ...issues.map((i) => `<p style="font-size:13px;margin:4px 0;">${i}</p>`),
      fixes.length > 0 ? `<h3 style="color:#22c55e;margin-top:16px;">Auto-Fixes Applied</h3>` : "",
      ...fixes.map((f) => `<p style="font-size:13px;margin:4px 0;">${f}</p>`),
    ].join("");

    await sendOzEmail(
      `🤖 Oz Ops Alert — ${issues.length} issue(s) found`,
      `<h2 style="color:#f97316;margin:0 0 12px;">Ops Monitor Report</h2>${report}`
    );
    await logOzAction("ops_monitor", `${issues.length} issues, ${fixes.length} auto-fixes`);
  }

  return { issues: issues.length, fixes: fixes.length };
}

/* ── GROWTH ANALYST (daily) ─────────────────────────────────────────────────── */
async function growthAnalyst() {
  const sections: string[] = [];

  // 1. MRR from transactions (last 30 days)
  const { data: txns } = await (sb as any)
    .from("transactions")
    .select("amount")
    .eq("status", "completed")
    .gte("created_at", daysAgo(30));
  const currentMrr = (txns || []).reduce((s: number, t: any) => s + (t.amount || 0), 0);

  const { data: prevTxns } = await (sb as any)
    .from("transactions")
    .select("amount")
    .eq("status", "completed")
    .gte("created_at", daysAgo(60))
    .lt("created_at", daysAgo(30));
  const prevMrr = (prevTxns || []).reduce((s: number, t: any) => s + (t.amount || 0), 0);

  const mrrChange = prevMrr > 0 ? ((currentMrr - prevMrr) / prevMrr * 100).toFixed(1) : "N/A";
  const mrrEmoji = currentMrr >= prevMrr ? "🟢" : "🔴";
  sections.push(`
    <h3 style="color:#22c55e;">💰 Revenue</h3>
    <p>${mrrEmoji} Current 30-day revenue: <strong>$${(currentMrr / 100).toFixed(2)}</strong></p>
    <p>Previous 30 days: $${(prevMrr / 100).toFixed(2)} (${mrrChange}% change)</p>
  `);

  // 2. Most active users (by activity_logs count, last 14 days)
  const { data: activeUsers } = await sb
    .from("activity_logs")
    .select("user_id")
    .gte("created_at", daysAgo(14));
  if (activeUsers?.length) {
    const counts: Record<string, number> = {};
    for (const a of activeUsers) { counts[a.user_id] = (counts[a.user_id] || 0) + 1; }
    const top5 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sections.push(`
      <h3 style="color:#3b82f6;">🏆 Top 5 Active Users (14 days)</h3>
      ${top5.map(([id, c], i) => `<p>${i + 1}. ${id.slice(0, 8)}… — ${c} activities</p>`).join("")}
    `);
  }

  // 3. Users with no activity in 14+ days (churn risk)
  const { data: allProfiles } = await sb.from("profiles").select("user_id, full_name, athlete_name").limit(200);
  const activeSet = new Set((activeUsers || []).map((a) => a.user_id));
  const atRisk = (allProfiles || []).filter((p) => !activeSet.has(p.user_id)).slice(0, 10);
  if (atRisk.length) {
    sections.push(`
      <h3 style="color:#ef4444;">⚠️ At-Risk Users (no activity 14+ days)</h3>
      ${atRisk.map((u) => `<p>• ${u.athlete_name || u.full_name || u.user_id.slice(0, 8)}</p>`).join("")}
      <p style="font-size:11px;color:#64748b;">${atRisk.length > 10 ? `Showing 10 of ${atRisk.length}` : ""}</p>
    `);
  }

  // 4. Stale web design leads
  const { data: staleLeads } = await (sb as any)
    .from("web_design_leads")
    .select("id, business_name, status, updated_at")
    .neq("status", "closed")
    .neq("status", "won")
    .lt("updated_at", daysAgo(7))
    .limit(10);
  if (staleLeads?.length) {
    sections.push(`
      <h3 style="color:#a855f7;">🕸️ Stale Web Design Leads (7+ days)</h3>
      ${staleLeads.map((l: any) => `<p>• ${l.business_name || "Unknown"} — status: ${l.status}</p>`).join("")}
    `);
  }

  // 5. B2B referral partner ROI
  const { data: partners } = await sb.from("b2b_referral_partners").select("name, total_earned, status").eq("status", "active");
  if (partners?.length) {
    sections.push(`
      <h3 style="color:#06b6d4;">🤝 Active Referral Partners</h3>
      ${partners.map((p) => `<p>• ${p.name}: $${p.total_earned.toFixed(2)} earned</p>`).join("")}
    `);
  }

  const html = sections.join("<hr style='border:none;border-top:1px solid #1e293b;margin:16px 0;' />");
  await sendOzEmail("📈 Oz Daily Growth Report", `<h2 style="color:#f97316;margin:0 0 12px;">Daily Growth Report</h2>${html}`);
  await logOzAction("growth_report", `MRR: $${(currentMrr / 100).toFixed(2)}, At-risk: ${atRisk.length}`);

  return { mrr: currentMrr, atRisk: atRisk.length };
}

/* ── WEEKLY REPORT (Monday) ─────────────────────────────────────────────────── */
async function weeklyReport() {
  // Gather all the data
  const [
    { count: totalUsers },
    { count: openTickets },
    { data: recentFailures },
    { count: pendingAi },
  ] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("delivery_failures").select("id, function_name").gte("created_at", daysAgo(7)),
    sb.from("ai_action_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  // Product health: count active clients per product table
  const productTables = [
    "gbp_saas_clients", "social_media_clients", "blog_post_clients",
    "contractor_clients", "review_monitor_clients", "sms_blast_clients",
    "noshow_clients", "estimate_drip_clients", "invoice_chaser_clients",
    "afterjob_drip_clients", "local_seo_clients", "chatbot_clients",
  ];
  const productHealth: string[] = [];
  for (const t of productTables) {
    try {
      const { count } = await (sb as any).from(t).select("id", { count: "exact", head: true }).eq("active", true);
      if ((count ?? 0) > 0) {
        productHealth.push(`<p>• ${t.replace(/_clients$/, "").replace(/_/g, " ")}: <strong>${count}</strong> active</p>`);
      }
    } catch { /* skip */ }
  }

  // Use AI to generate recommendations
  let recommendations = "<p>AI recommendations unavailable.</p>";
  if (LOVABLE_API_KEY) {
    try {
      const context = `Total users: ${totalUsers}, Open tickets: ${openTickets}, Delivery failures this week: ${recentFailures?.length || 0}, Pending AI items: ${pendingAi}. Active products: ${productHealth.length}. The business is M2 Development - AI automation and web design agency in Metro Detroit.`;
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You are Oz, an autonomous business intelligence agent for M2 Development. Give exactly 3 concise, actionable recommendations for this week based on the data. Be direct, no fluff. Use bullet points." },
            { role: "user", content: context },
          ],
        }),
      });
      const aiData = await aiRes.json();
      recommendations = aiData?.choices?.[0]?.message?.content || recommendations;
    } catch (e) { console.error("[OZ] AI recommendation failed:", e); }
  }

  const html = `
    <h2 style="color:#f97316;margin:0 0 16px;">Weekly Intelligence Report</h2>
    
    <h3 style="color:#22c55e;">📊 Overview</h3>
    <table style="width:100%;border-collapse:collapse;margin:8px 0;">
      <tr><td style="padding:6px;color:#94a3b8;">Total Users</td><td style="padding:6px;font-weight:bold;">${totalUsers ?? 0}</td></tr>
      <tr><td style="padding:6px;color:#94a3b8;">Open Support Tickets</td><td style="padding:6px;font-weight:bold;">${openTickets ?? 0}</td></tr>
      <tr><td style="padding:6px;color:#94a3b8;">Delivery Failures (7d)</td><td style="padding:6px;font-weight:bold;${(recentFailures?.length ?? 0) > 0 ? "color:#ef4444;" : ""}">${recentFailures?.length ?? 0}</td></tr>
      <tr><td style="padding:6px;color:#94a3b8;">Pending AI Queue</td><td style="padding:6px;font-weight:bold;">${pendingAi ?? 0}</td></tr>
    </table>

    <h3 style="color:#3b82f6;">📦 Active Products</h3>
    ${productHealth.length > 0 ? productHealth.join("") : "<p style='color:#64748b;'>No active product clients yet.</p>"}

    <h3 style="color:#a855f7;">🎯 Oz's Recommendations</h3>
    <div style="background:#1e293b;padding:12px;border-radius:8px;font-size:13px;">
      ${recommendations.replace(/\n/g, "<br/>")}
    </div>

    <h3 style="color:#f97316;margin-top:16px;">Action Items</h3>
    <p style="font-size:13px;">${(openTickets ?? 0) > 0 ? "🔴 Review open support tickets<br/>" : ""}${(recentFailures?.length ?? 0) > 0 ? "🔴 Investigate delivery failures<br/>" : ""}${(pendingAi ?? 0) > 5 ? "🟡 Clear AI queue backlog<br/>" : ""}${(openTickets ?? 0) === 0 && (recentFailures?.length ?? 0) === 0 && (pendingAi ?? 0) <= 5 ? "🟢 All systems green. No urgent actions." : ""}</p>
  `;

  await sendOzEmail("🤖 Oz Weekly Report — Monday Briefing", html);
  await logOzAction("weekly_report", `Users: ${totalUsers}, Tickets: ${openTickets}, Failures: ${recentFailures?.length}`);

  return { sent: true };
}

/* ── Main Handler ───────────────────────────────────────────────────────────── */
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let mode = "ops";
    try {
      const body = await req.json();
      mode = body.mode || "ops";
    } catch { /* default to ops */ }

    let result: any;
    switch (mode) {
      case "ops":
        result = await opsMonitor();
        break;
      case "growth":
        result = await growthAnalyst();
        break;
      case "weekly":
        result = await weeklyReport();
        break;
      default:
        result = { error: "Unknown mode. Use: ops, growth, weekly" };
    }

    return new Response(JSON.stringify({ ok: true, mode, result, timestamp: now() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[OZ] Fatal error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
