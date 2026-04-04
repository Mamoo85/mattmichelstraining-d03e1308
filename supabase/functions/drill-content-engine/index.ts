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

async function sendDrillEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Drill <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#1e1b4b;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">📝</span>
          <strong style="color:#818cf8;font-size:16px;">Agent Drill — Content Engine Monitor</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const issues: string[] = [];
    const healthy: string[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // 1. GBP Auto-Poster — should post 3x/week
    const { data: gbpClients } = await sb
      .from("gbp_saas_clients")
      .select("business_name, last_posted_at, post_count")
      .eq("active", true)
      .limit(50);

    const gbpOverdue = gbpClients?.filter(c => !c.last_posted_at || c.last_posted_at < sevenDaysAgo) || [];
    if (gbpOverdue.length) {
      issues.push(`<div style="padding:6px;border-left:3px solid #f59e0b;">📍 <strong>GBP Posts</strong>: ${gbpOverdue.length}/${gbpClients?.length || 0} clients overdue (7+ days)<br/>${gbpOverdue.slice(0, 3).map(c => `• ${c.business_name}`).join("<br/>")}</div>`);
    } else {
      healthy.push(`GBP Posts: ${gbpClients?.length || 0} clients on schedule ✅`);
    }

    // 2. Blog Writer — should post weekly
    const { data: blogClients } = await sb
      .from("blog_post_clients")
      .select("business_name, last_sent_at, post_count")
      .eq("active", true)
      .limit(50);

    const blogOverdue = blogClients?.filter(c => !c.last_sent_at || c.last_sent_at < sevenDaysAgo) || [];
    if (blogOverdue.length) {
      issues.push(`<div style="padding:6px;border-left:3px solid #f59e0b;">✍️ <strong>Blog Posts</strong>: ${blogOverdue.length}/${blogClients?.length || 0} clients overdue<br/>${blogOverdue.slice(0, 3).map(c => `• ${c.business_name}`).join("<br/>")}</div>`);
    } else {
      healthy.push(`Blog Posts: ${blogClients?.length || 0} clients on schedule ✅`);
    }

    // 3. Social Media Poster — should post 3x/week
    const { data: socialClients } = await sb
      .from("social_media_clients")
      .select("business_name, last_posted_at")
      .eq("active", true)
      .limit(50);

    const socialOverdue = socialClients?.filter((c: any) => !c.last_posted_at || c.last_posted_at < sevenDaysAgo) || [];
    if (socialOverdue.length) {
      issues.push(`<div style="padding:6px;border-left:3px solid #f59e0b;">📱 <strong>Social Posts</strong>: ${socialOverdue.length} clients overdue</div>`);
    } else {
      healthy.push(`Social Posts: ${socialClients?.length || 0} clients on schedule ✅`);
    }

    // 4. Newsletter — check last send
    const { data: lastNewsletter } = await sb
      .from("newsletter_sends")
      .select("sent_at")
      .order("sent_at", { ascending: false })
      .limit(1);

    if (lastNewsletter?.[0]) {
      const daysSince = Math.floor((Date.now() - new Date(lastNewsletter[0].sent_at).getTime()) / 86400000);
      if (daysSince > 8) {
        issues.push(`<div style="padding:6px;border-left:3px solid #ef4444;">📧 <strong>Newsletter</strong>: Last sent ${daysSince} days ago (should be weekly)</div>`);
      } else {
        healthy.push(`Newsletter: Last sent ${daysSince} days ago ✅`);
      }
    }

    // 5. Content queue status
    const { data: pendingContent } = await sb
      .from("content_queue")
      .select("content_type, status")
      .eq("status", "pending");

    if (pendingContent?.length) {
      issues.push(`<div style="padding:6px;border-left:3px solid #3b82f6;">📋 <strong>Content Queue</strong>: ${pendingContent.length} items pending approval</div>`);
    }

    // NEW: 6. Audit landing pages for missing CTAs or broken checkout flows
    const { data: sites } = await sb
      .from("generated_sites")
      .select("business_name, slug, sections, is_published")
      .eq("is_published", true)
      .limit(20);

    let landingAuditHtml = "";
    if (sites?.length) {
      const sitesWithoutCta = sites.filter(s => {
        const sections = typeof s.sections === "string" ? JSON.parse(s.sections) : s.sections;
        const hasCta = JSON.stringify(sections).toLowerCase().includes("cta") || 
                       JSON.stringify(sections).toLowerCase().includes("contact") ||
                       JSON.stringify(sections).toLowerCase().includes("get started");
        return !hasCta;
      });
      if (sitesWithoutCta.length > 0) {
        issues.push(`<div style="padding:6px;border-left:3px solid #ef4444;">🔗 <strong>Landing Page Audit</strong>: ${sitesWithoutCta.length} published sites may be missing CTAs<br/>${sitesWithoutCta.slice(0, 3).map(s => `• ${s.business_name} (/${s.slug})`).join("<br/>")}</div>`);
      }
    }

    const hasIssues = issues.length > 0;
    const html = `
      ${issues.length ? `<h3 style="color:#f59e0b;">⚠️ Content Gaps</h3>${issues.join("<br/>")}` : ""}
      ${healthy.length ? `<h3 style="color:#22c55e;">✅ On Schedule</h3><ul>${healthy.map(h => `<li>${h}</li>`).join("")}</ul>` : ""}
    `;

    if (hasIssues) {
      await sendDrillEmail(`📝 Drill: ${issues.length} content gaps found`, html);
    }

    return new Response(JSON.stringify({
      ok: true,
      content_gaps: issues.length,
      healthy_channels: healthy.length,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[DRILL]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
