// siteradar-cold-blast — Cold email pitch for SiteRadar to any business with a website.
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaEmail, listUnsubHeaders } from "../_shared/dwa-email.ts";
import { teaserCardHtml } from "../_shared/teaser-card.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { isMarketingBlocked } from "../_shared/marketing-kill-switch.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_CAP = parseInt(Deno.env.get("SITERADAR_BLAST_CAP") || "175", 10);
const SITE = "https://detroitwebagent.com";

function emailHtml(lead: any): string {
  const fn = lead.first_name || lead.owner_name?.split(" ")[0] || "there";
  const biz = lead.business_name || "your business";
  const card = teaserCardHtml({
    headline: `📡 SiteRadar for ${biz}`,
    scoreLabel: "$49/mo · 7-day trial",
    bullets: [
      "See every company that visits your site (by name, not IP)",
      "Instant Slack/SMS alert when a hot prospect returns",
      "Pulls firmographic data — industry, size, location",
    ],
    ctaText: "Start free 7-day trial →",
    ctaUrl: `${SITE}/start-trial?product=site_radar&email=${encodeURIComponent(lead.email || "")}&utm_source=cold_email&utm_medium=email&utm_campaign=siteradar_blast`,
    badge: "SITERADAR · TRIAL",
  });
  return `<div style="max-width:600px;margin:0 auto;padding:24px 16px;background:#fff;">
  <p style="font:15px/1.55 -apple-system,Segoe UI,Arial;color:#0f2540;margin:0 0 10px;">Hey ${fn},</p>
  <p style="font:15px/1.55 -apple-system,Segoe UI,Arial;color:#0f2540;margin:0 0 10px;">If your website gets traffic but only 2% of visitors convert, you're losing the other 98%. SiteRadar shows you who they were — by company name, industry, and size — so you can follow up.</p>
  ${card}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="font:12px/1.5 -apple-system,Segoe UI,Arial;color:#7a8aa0;margin:0;">
    Matt Michels — Detroit Web Agency · (313) 992-1219<br/>
    <a href="${SITE}/unsubscribe?email=${encodeURIComponent(lead.email)}" style="color:#7a8aa0;">Unsubscribe</a> · Reply STOP to opt out.
  </p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const ks = await isMarketingBlocked(sb);
    if (ks.blocked) return new Response(JSON.stringify({ ok: true, sent: 0, reason: "kill_switch", detail: ks.reason }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (_) {}

  const { data: leads, error } = await sb
    .from("outreach_leads")
    .select("id, business_name, owner_name, first_name, email, website, city, industry, drip_campaign_status")
    .not("email", "is", null)
    .not("website", "is", null)
    .limit(DAILY_CAP * 3);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  let sent = 0, failed = 0, blockedCount = 0, skipped = 0;

  for (const lead of (leads || [])) {
    if (sent >= DAILY_CAP) break;
    if ((lead.drip_campaign_status as any)?.last_product_pitched === "site_radar") { skipped++; continue; }

    try {
      const b = await isBlocked(sb, { email: lead.email, business_name: lead.business_name });
      if (b.blocked) { blockedCount++; continue; }
    } catch (_) {}

    const subject = `${lead.business_name || "your site"} — see who's actually visiting`;
    const r = await dwaEmail({ to: lead.email, subject, html: emailHtml(lead), headers: listUnsubHeaders(lead.email) });
    if (r.ok) {
      sent++;
      await sb.from("outreach_leads").update({
        last_contact_date: new Date().toISOString().slice(0, 10),
        drip_campaign_status: {
          ...((lead.drip_campaign_status as any) || {}),
          current_stage: "1_DWA_Cold_Sent",
          last_engagement_timestamp: new Date().toISOString(),
          last_product_pitched: "site_radar",
        },
      }).eq("id", lead.id);
    } else { failed++; }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, blocked: blockedCount, skipped, cap: DAILY_CAP }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
