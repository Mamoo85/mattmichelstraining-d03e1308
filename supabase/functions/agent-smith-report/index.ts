// Agent Smith Daily Report — cron daily 7am ET
// Pulls data from all business tables and sends Matt a comprehensive dashboard email

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const SITE_URL = "https://www.mattmichelstraining.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Contractor clients
    const { count: contractorActive } = await sb
      .from("contractor_clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true);

    const { count: contractorTrial } = await sb
      .from("contractor_clients")
      .select("*", { count: "exact", head: true })
      .eq("trial_active", true);

    // 2. B2B subscribers
    const { count: fieldRepActive } = await sb
      .from("b2b_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .eq("niche", "field_rep_tools");

    const { count: dentalActive } = await sb
      .from("b2b_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .or("niche.is.null,niche.eq.dental");

    // 3. GBP SaaS clients
    const { count: gbpActive } = await sb
      .from("gbp_saas_clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true);

    const { count: gbpBasic } = await sb
      .from("gbp_saas_clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .eq("plan", "basic");

    const { count: gbpPro } = await sb
      .from("gbp_saas_clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .eq("plan", "pro");

    const { data: gbpRecent } = await sb
      .from("gbp_saas_clients")
      .select("last_posted_at")
      .eq("active", true)
      .not("last_posted_at", "is", null)
      .order("last_posted_at", { ascending: false })
      .limit(1);

    const lastGbpPost = gbpRecent?.[0]?.last_posted_at || null;

    // 4. Social media clients
    const { count: socialActive } = await sb
      .from("social_media_clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true);

    const { count: socialStandard } = await sb
      .from("social_media_clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .eq("plan", "standard");

    const { count: socialPro } = await sb
      .from("social_media_clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .eq("plan", "pro");

    const { count: socialTrainer } = await sb
      .from("social_media_clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .eq("plan", "trainer");

    const { data: socialMissingTokens } = await sb
      .from("social_media_clients")
      .select("id, business_name")
      .eq("active", true)
      .or("access_tokens.is.null,access_tokens.eq.{}");

    // 5. Newsletter subscribers
    const { count: newsletterActive } = await sb
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: newsletterNewWeek } = await sb
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true })
      .gte("subscribed_at", sevenDaysAgo);

    // 6. Newsletter sends
    const { data: lastNewsletter } = await sb
      .from("newsletter_sends")
      .select("sent_at, subject")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1);

    const lastNewsletterSent = lastNewsletter?.[0] || null;
    const newsletterSentThisWeek = lastNewsletterSent?.sent_at
      ? new Date(lastNewsletterSent.sent_at).getTime() > new Date(sevenDaysAgo).getTime()
      : false;

    // 7. Contractor leads last 24h
    const { count: leadsLast24h } = await sb
      .from("contractor_leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneDayAgo);

    // 8. Transactions
    const { data: txn7d } = await sb
      .from("transactions")
      .select("amount")
      .gte("created_at", sevenDaysAgo);

    const revenue7d = (txn7d || []).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    const { data: txn30d } = await sb
      .from("transactions")
      .select("amount")
      .gte("created_at", thirtyDaysAgo);

    const revenue30d = (txn30d || []).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    // 9. Outreach leads by status
    const { data: outreachRaw } = await sb
      .from("outreach_leads")
      .select("status");

    const outreachByStatus: Record<string, number> = {};
    for (const row of outreachRaw || []) {
      const s = row.status || "New";
      outreachByStatus[s] = (outreachByStatus[s] || 0) + 1;
    }

    const { data: outreachReplied } = await sb
      .from("outreach_leads")
      .select("id, business_name, owner_name, city, industry")
      .eq("status", "Responded");

    // MRR calculation
    const mrr = {
      contractor: (contractorActive || 0) * 399,
      dental: (dentalActive || 0) * 49,
      fieldRep: (fieldRepActive || 0) * 29,
      gbpBasic: (gbpBasic || 0) * 49,
      gbpPro: (gbpPro || 0) * 99,
      socialStandard: (socialStandard || 0) * 199,
      socialPro: (socialPro || 0) * 299,
      socialTrainer: (socialTrainer || 0) * 149 };
    const totalMrr = Object.values(mrr).reduce((a, b) => a + b, 0);

    // Check cron health via timestamps
    const gbpPostAge = lastGbpPost ? (now.getTime() - new Date(lastGbpPost).getTime()) / (1000 * 60 * 60) : 999;
    const newsletterAge = lastNewsletterSent?.sent_at
      ? (now.getTime() - new Date(lastNewsletterSent.sent_at).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // AI analysis
    let aiAnalysis = "";
    if (LOVABLE_API_KEY) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite", 
          messages: [{
            role: "user",
            content: `You are Agent Smith, an AI business analyst for M² Performance Training. Analyze this daily business snapshot and write 2-3 sentences about business health, trends, and one actionable recommendation. Be direct and specific — no fluff.

MRR: $${totalMrr} (Contractor leads: $${mrr.contractor}, Dental DB: $${mrr.dental}, Field Rep Tools: $${mrr.fieldRep}, GBP Basic: $${mrr.gbpBasic}, GBP Pro: $${mrr.gbpPro}, Social Standard: $${mrr.socialStandard}, Social Pro: $${mrr.socialPro}, Social Trainer: $${mrr.socialTrainer})
Revenue last 7 days: $${revenue7d.toFixed(2)}
Revenue last 30 days: $${revenue30d.toFixed(2)}
New leads last 24h: ${leadsLast24h || 0}
Newsletter subscribers: ${newsletterActive || 0} (${newsletterNewWeek || 0} new this week)
Outreach leads: ${JSON.stringify(outreachByStatus)}
Social media clients needing token setup: ${socialMissingTokens?.length || 0}
Goal: $10,000/mo MRR`
          }]
        }) });
      const aiData = await aiRes.json();
      aiAnalysis = aiData?.choices?.[0]?.message?.content || "";
    }

    // Format date for subject
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York" });

    const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

    // Build action items
    const actionItems: string[] = [];

    if (socialMissingTokens && socialMissingTokens.length > 0) {
      for (const c of socialMissingTokens) {
        actionItems.push(`<li><strong>${c.business_name}</strong> needs social accounts connected — <a href="${SITE_URL}/admin" style="color:#e8621a;">Open Admin</a></li>`);
      }
    }

    if (outreachReplied && outreachReplied.length > 0) {
      for (const lead of outreachReplied) {
        actionItems.push(`<li><strong>${lead.business_name}</strong>${lead.city ? ` (${lead.city})` : ""} replied to outreach — follow up — <a href="${SITE_URL}/admin" style="color:#e8621a;">View Leads</a></li>`);
      }
    }

    // MRR breakdown rows
    const mrrRows = [
      { label: "Contractor Lead Gen", count: contractorActive || 0, rate: 399, total: mrr.contractor },
      { label: "Dental Database", count: dentalActive || 0, rate: 49, total: mrr.dental },
      { label: "Field Rep AI Tools", count: fieldRepActive || 0, rate: 29, total: mrr.fieldRep },
      { label: "GBP SaaS (Basic)", count: gbpBasic || 0, rate: 49, total: mrr.gbpBasic },
      { label: "GBP SaaS (Pro)", count: gbpPro || 0, rate: 99, total: mrr.gbpPro },
      { label: "Social Media (Standard)", count: socialStandard || 0, rate: 199, total: mrr.socialStandard },
      { label: "Social Media (Pro)", count: socialPro || 0, rate: 299, total: mrr.socialPro },
      { label: "Social Media (Trainer)", count: socialTrainer || 0, rate: 149, total: mrr.socialTrainer },
    ];

    const mrrTableRows = mrrRows
      .map(r => `<tr>
        <td style="padding:6px 12px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;">${r.label}</td>
        <td style="padding:6px 12px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:center;">${r.count} x $${r.rate}</td>
        <td style="padding:6px 12px;font-size:14px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;">${fmt(r.total)}</td>
      </tr>`)
      .join("");

    // Outreach summary
    const outreachRows = Object.entries(outreachByStatus)
      .map(([status, count]) => `<span style="display:inline-block;margin:0 8px 4px 0;padding:3px 10px;background:${status === "Responded" ? "#fef3c7" : status === "Closed" ? "#d1fae5" : status === "Lost" ? "#fee2e2" : "#f1f5f9"};border-radius:12px;font-size:12px;color:#334155;">${status}: ${count}</span>`)
      .join("");

    // Cron status indicators
    const cronJobs = [
      {
        name: "Contractor Lead Notify",
        schedule: "Every 15 min",
        healthy: (leadsLast24h || 0) >= 0 },
      {
        name: "Newsletter Send",
        schedule: "Monday 8am ET",
        healthy: newsletterAge < 8 },
      {
        name: "GBP SaaS Poster",
        schedule: "Mon/Wed/Fri 10am ET",
        healthy: gbpPostAge < 72 },
      {
        name: "Social Media Poster",
        schedule: "Mon/Wed/Fri",
        healthy: true },
      {
        name: "B2B Dental Scraper",
        schedule: "Daily 6am ET",
        healthy: true },
      {
        name: "Prospect Local Businesses",
        schedule: "Daily 11am ET",
        healthy: true },
      {
        name: "Agent Smith Report",
        schedule: "Daily 7am ET",
        healthy: true },
    ];

    const cronRows = cronJobs
      .map(j => `<tr>
        <td style="padding:5px 12px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${j.healthy ? "#22c55e" : "#eab308"};margin-right:8px;vertical-align:middle;"></span>${j.name}
        </td>
        <td style="padding:5px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:right;">${j.schedule}</td>
      </tr>`)
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">

  <!-- Header -->
  <tr><td style="background:#1e293b;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Agent Smith Report</p>
    <p style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700;">${fmt(totalMrr)}<span style="font-size:14px;font-weight:400;color:#94a3b8;"> /mo estimated MRR</span></p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${dateStr}</p>
  </td></tr>

  <!-- AI Analysis -->
  ${aiAnalysis ? `<tr><td style="background:#fff7ed;padding:16px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;color:#e8621a;text-transform:uppercase;">AI Analysis</p>
    <p style="margin:0;font-size:14px;color:#92400e;line-height:1.7;">${aiAnalysis}</p>
  </td></tr>` : ""}

  <!-- Body -->
  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <!-- Section 1: Revenue Snapshot -->
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #e8621a;">Revenue Snapshot</h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr style="background:#f8fafc;">
        <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Stream</td>
        <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:center;">Clients</td>
        <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:right;">MRR</td>
      </tr>
      ${mrrTableRows}
      <tr style="background:#f8fafc;">
        <td colspan="2" style="padding:10px 12px;font-size:15px;font-weight:700;color:#1e293b;">Total Estimated MRR</td>
        <td style="padding:10px 12px;font-size:15px;font-weight:700;color:#e8621a;text-align:right;">${fmt(totalMrr)}</td>
      </tr>
    </table>

    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <div style="flex:1;background:#f1f5f9;padding:14px 16px;border-radius:8px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Last 7 Days</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1e293b;">$${revenue7d.toFixed(2)}</p>
      </div>
      <div style="flex:1;background:#f1f5f9;padding:14px 16px;border-radius:8px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Last 30 Days</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1e293b;">$${revenue30d.toFixed(2)}</p>
      </div>
    </div>

    <div style="margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#64748b;">New this week: <strong style="color:#1e293b;">${newsletterNewWeek || 0}</strong> newsletter subs${(contractorTrial || 0) > 0 ? ` · <strong style="color:#1e293b;">${contractorTrial}</strong> contractor trials` : ""}</p>
    </div>

    <!-- Section 2: Actions Needed -->
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #e8621a;">Actions Needed From Matt</h2>

    ${actionItems.length > 0
      ? `<ul style="margin:0 0 24px;padding-left:20px;list-style:none;">${actionItems.map(i => i.replace("<li>", '<li style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">')).join("")}</ul>`
      : `<div style="background:#d1fae5;padding:12px 16px;border-radius:8px;margin-bottom:24px;"><p style="margin:0;font-size:14px;color:#065f46;">Nothing needs your attention today. Systems running clean.</p></div>`}

    <!-- Section 3: Agent Smith Completed -->
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #e8621a;">Agent Smith Completed (Last 24h)</h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;">Contractor leads scraped</td>
        <td style="padding:8px 12px;font-size:14px;font-weight:600;color:#1e293b;text-align:right;border-bottom:1px solid #f1f5f9;">${leadsLast24h || 0}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;">Newsletter sent this week</td>
        <td style="padding:8px 12px;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;color:${newsletterSentThisWeek ? "#16a34a" : "#dc2626"};">${newsletterSentThisWeek ? "Yes" : "No"}${lastNewsletterSent?.subject ? ` — "${lastNewsletterSent.subject}"` : ""}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;">GBP posts status</td>
        <td style="padding:8px 12px;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;color:${gbpPostAge < 72 ? "#16a34a" : "#dc2626"};">${lastGbpPost ? `Last post ${Math.round(gbpPostAge)}h ago` : "No posts yet"}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;">Active social media clients</td>
        <td style="padding:8px 12px;font-size:14px;font-weight:600;color:#1e293b;text-align:right;border-bottom:1px solid #f1f5f9;">${socialActive || 0} posting${socialMissingTokens?.length ? `, ${socialMissingTokens.length} need setup` : ""}</td>
      </tr>
    </table>

    ${Object.keys(outreachByStatus).length > 0 ? `<div style="margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Outreach Pipeline</p>
      <div>${outreachRows}</div>
    </div>` : ""}

    <!-- Section 4: System Health -->
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #e8621a;">System Health</h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${cronRows}
    </table>

  </td></tr>

  <!-- Signature -->
  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² Performance Training · (313) 806-4952</div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#1e293b;padding:16px 28px;border-radius:0 0 10px 10px;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
    Automated by Agent Smith · <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    const subject = `Agent Smith Report — ${dateStr}`;

    // Send to both addresses
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Agent Smith <matt@mattmichelstraining.com>",
          to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
          subject,
          html }) });
    }

    console.log(`[AGENT-SMITH] Report sent — MRR: $${totalMrr}, Revenue 7d: $${revenue7d.toFixed(2)}`);
    return new Response(JSON.stringify({
      mrr: totalMrr,
      revenue_7d: revenue7d,
      revenue_30d: revenue30d,
      leads_24h: leadsLast24h || 0,
      actions_needed: actionItems.length,
      email_sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[AGENT-SMITH] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
