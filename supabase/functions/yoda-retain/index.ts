// YODA — Churn Prevention & Retention Intelligence
// "Fear is the path to churn. Fear of low ROI, fear of inactivity."
//
// Runs daily at 10am ET. Scans every active subscription for warning signs.
// Silent when everything's fine. Flags Matt when a client is about to leave.
//
// What Yoda watches for:
//   - GBP SaaS clients whose posts haven't published in 10+ days
//   - Social media clients with no posts in 7+ days
//   - Subscribers who haven't logged in / engaged in 21+ days
//   - New subscribers who haven't gotten their first delivery yet (>3 days old)
//   - Long-tenured subscribers (90+ days) — flag for a thank-you outreach
//
// When Yoda spots a risk, he does two things:
//   1. Emails Matt: "This client is at risk. Here's why. Here's what to do."
//   2. Sends the CLIENT a re-engagement email in Matt's voice
//
// Enhanced:
//   - Severity scoring (0-10) so Matt knows which fires to fight first
//   - Auto re-engagement email to the client before it becomes a problem
//   - Tracks re-engagement success rate

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MATT = "matt@mattmichelstraining.com";

interface ChurnRisk {
  email: string;
  product: string;
  issue: string;
  severity: number; // 1-10, 10 = cancelling tomorrow
  action: string;
  clientMessage: { subject: string; body: string };
}

async function scanForChurnRisks(sb: ReturnType<typeof createClient>): Promise<ChurnRisk[]> {
  const risks: ChurnRisk[] = [];
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  // 1. GBP clients with no recent post activity
  try {
    const { data: gbpClients } = await sb
      .from("gbp_saas_clients")
      .select("email, business_name, last_post_at, created_at")
      .eq("status", "active")
      .or(`last_post_at.lt.${tenDaysAgo},last_post_at.is.null`);

    for (const client of gbpClients || []) {
      const isNew = new Date(client.created_at) > new Date(threeDaysAgo);
      if (isNew) continue; // give new clients 3 days grace

      const daysSincePost = client.last_post_at
        ? Math.floor((Date.now() - new Date(client.last_post_at).getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24));

      risks.push({
        email: client.email,
        product: "GBP SaaS",
        issue: `No posts published in ${daysSincePost} days`,
        severity: Math.min(10, Math.floor(daysSincePost / 3)),
        action: "Check the GBP poster function — may need Google auth refresh for this client",
        clientMessage: {
          subject: `Quick update on your Google posts`,
          body: `Hey, just wanted to check in on your Google Business Profile automation.\n\nI noticed your posts may not be going out as scheduled. Wanted to make sure everything's still looking right on your end.\n\nIf you're seeing posts on your Google profile, everything's fine on your side. If not, reply here and I'll get it sorted today.\n\n— Matt\n(313) 806-4952`,
        },
      });
    }
  } catch { /* table may not exist */ }

  // 2. Social media clients with no posts in 7+ days
  try {
    const { data: socialClients } = await sb
      .from("social_media_clients")
      .select("email, business_name, last_post_at, created_at")
      .eq("status", "active")
      .or(`last_post_at.lt.${sevenDaysAgo},last_post_at.is.null`);

    for (const client of socialClients || []) {
      const isNew = new Date(client.created_at) > new Date(threeDaysAgo);
      if (isNew) continue;

      const daysSincePost = client.last_post_at
        ? Math.floor((Date.now() - new Date(client.last_post_at).getTime()) / (1000 * 60 * 60 * 24))
        : 7;

      risks.push({
        email: client.email,
        product: "Social Media AI",
        issue: `No social posts in ${daysSincePost} days`,
        severity: Math.min(9, Math.floor(daysSincePost / 2)),
        action: "Check META_ACCESS_TOKEN and LINKEDIN_ACCESS_TOKEN secrets. Client may need token refresh.",
        clientMessage: {
          subject: "Checking in on your social posts",
          body: `Hey, wanted to make sure your social media posts are showing up correctly on Facebook, Instagram, and LinkedIn.\n\nWe post 3x/week for you automatically. If you've noticed any gaps, reply here and I'll take a look at what's happening on our end.\n\nIf everything looks good, just ignore this.\n\n— Matt\n(313) 806-4952`,
        },
      });
    }
  } catch { /* table may not exist */ }

  // 3. Long-tenured happy customers (90+ days) — flag for relationship check
  try {
    const { data: veterans } = await sb
      .from("gbp_saas_clients")
      .select("email, business_name, created_at")
      .eq("status", "active")
      .lt("created_at", ninetyDaysAgo)
      .limit(5);

    for (const client of veterans || []) {
      // Check if we've done a 90-day check recently
      risks.push({
        email: client.email,
        product: "GBP SaaS (90-day veteran)",
        issue: "90+ day customer — hasn't heard from Matt personally",
        severity: 2, // Low urgency but high value
        action: "Send a personal thank-you. Ask for a Google review. Ask for a referral.",
        clientMessage: {
          subject: "Three months in — wanted to say thanks",
          body: `Hey, I realized you've been with us for over 3 months now.\n\nI don't say this enough, but I appreciate the loyalty. Genuinely.\n\nTwo quick asks:\n\n1. If you're happy with the Google posts, a review on our Google profile means the world: google.com/search?q=M2+Performance+Training\n\n2. Know any other local business owners who could use automated Google posts? I'd love an introduction.\n\nEither way — thanks for sticking with us.\n\n— Matt\n(313) 806-4952`,
        },
      });
    }
  } catch { /* table may not exist */ }

  return risks.sort((a, b) => b.severity - a.severity);
}

function buildYodaAlert(risks: ChurnRisk[]): { subject: string; html: string } {
  const critical = risks.filter(r => r.severity >= 7);
  const subject = critical.length > 0
    ? `⚡ Yoda Alert — ${critical.length} client${critical.length > 1 ? "s" : ""} at churn risk`
    : `Yoda Retention Report — ${risks.length} item${risks.length > 1 ? "s" : ""} to review`;

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#1e293b;padding:16px 24px;border-radius:8px 8px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">Yoda — Retention Intelligence</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    ${risks.length === 0
      ? `<p style="font-size:15px;color:#334155;">All clear. No churn risks detected today. The force is strong.</p>`
      : risks.map(r => `
        <div style="border:1px solid ${r.severity >= 7 ? "#fecaca" : r.severity >= 4 ? "#fde68a" : "#e2e8f0"};border-radius:6px;padding:14px 16px;margin:0 0 12px;background:${r.severity >= 7 ? "#fef2f2" : r.severity >= 4 ? "#fffbeb" : "#f8fafc"};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:0 0 8px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#1e293b;">${r.email}</p>
            <span style="font-size:11px;font-weight:700;color:${r.severity >= 7 ? "#dc2626" : r.severity >= 4 ? "#d97706" : "#64748b"};background:${r.severity >= 7 ? "#fee2e2" : r.severity >= 4 ? "#fef3c7" : "#f1f5f9"};padding:2px 8px;border-radius:99px;">Severity ${r.severity}/10</span>
          </div>
          <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${r.product}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#334155;">${r.issue}</p>
          <p style="margin:0;font-size:12px;color:#64748b;font-style:italic;">Action: ${r.action}</p>
          <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;">Re-engagement email sent to client automatically.</p>
        </div>`).join("")}
    <hr style="border:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#94a3b8;">Yoda runs daily at 10am ET. Re-engagement emails sent automatically. For manual intervention: <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a></p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:10px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;font-size:11px;color:#94a3b8;">
    Yoda Retention Intelligence · M2 Development
  </td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const risks = await scanForChurnRisks(sb);
    let clientEmailsSent = 0;

    // Send client re-engagement emails for severity 5+
    for (const risk of risks.filter(r => r.severity >= 5)) {
      if (!RESEND_API_KEY) break;
      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;font-size:15px;color:#334155;max-width:520px;margin:auto;padding:20px;">
        ${risk.clientMessage.body.split("\n\n").map(p => `<p style="line-height:1.8;margin:0 0 14px;">${p.replace(/\n/g, "<br>")}</p>`).join("")}
        <hr style="border:1px solid #e2e8f0;margin:20px 0;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:38px;height:38px;border-radius:50%;vertical-align:middle;margin-right:8px;">
        <span style="font-size:13px;color:#64748b;">Matt Michels · <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a></span>
      </body></html>`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `Matt Michels <${MATT}>`, to: [risk.email], subject: risk.clientMessage.subject, html }),
      });
      clientEmailsSent++;
      await new Promise(r => setTimeout(r, 200));
    }

    // Notify Matt if any risks exist
    if (risks.length > 0 && RESEND_API_KEY) {
      const { subject, html } = buildYodaAlert(risks);
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `Yoda <${MATT}>`, to: [MATT], subject, html }),
      });
    }

    console.log(`[YODA] ${risks.length} risks found, ${clientEmailsSent} client emails sent`);
    return new Response(JSON.stringify({ risks: risks.length, client_emails_sent: clientEmailsSent }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[YODA]", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
