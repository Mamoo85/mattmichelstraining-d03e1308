// fielddesk-cold-blast — Cold email pitch for FieldDesk to home-service shops
// in outreach_leads that haven't received a FieldDesk pitch yet.
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaEmail, listUnsubHeaders } from "../_shared/dwa-email.ts";
import { teaserCardHtml } from "../_shared/teaser-card.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { isMarketingBlocked } from "../_shared/marketing-kill-switch.ts";
import { wasContactedRecently } from "../_shared/cold-email-dedup.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_CAP = parseInt(Deno.env.get("FIELDDESK_BLAST_CAP") || "175", 10);
const SITE = "https://detroitwebagent.com";

const FIELD_INDUSTRIES = ["hvac", "plumb", "roof", "electric", "pest", "landscap", "gutter", "garage", "appliance", "handyman", "painter", "lawn"];

function isFieldServiceShop(industry: string): boolean {
  const i = (industry || "").toLowerCase();
  return FIELD_INDUSTRIES.some((k) => i.includes(k));
}

function emailHtml(lead: any): string {
  const fn = lead.first_name || lead.owner_name?.split(" ")[0] || "there";
  const biz = lead.business_name || "your shop";
  const city = lead.city || "Michigan";
  const card = teaserCardHtml({
    headline: `🛠 FieldDesk for ${biz}`,
    scoreLabel: "$199/mo · 7-day trial · 50% off 3 mo",
    bullets: [
      "Live tech GPS, job dispatch, customer portal — one screen",
      "Migrates from eWay/ServiceTitan in a weekend (we do it)",
      "Built for 2–20 tech shops · no per-seat ripoff",
    ],
    ctaText: "Start free 7-day trial →",
    ctaUrl: `${SITE}/start-trial?product=field_desk`,
    badge: "FIELDDESK · TRIAL",
  });
  return `<div style="max-width:600px;margin:0 auto;padding:24px 16px;background:#fff;">
  <p style="font:15px/1.55 -apple-system,Segoe UI,Arial;color:#0f2540;margin:0 0 10px;">Hey ${fn},</p>
  <p style="font:15px/1.55 -apple-system,Segoe UI,Arial;color:#0f2540;margin:0 0 10px;">Quick one — what's ${biz} using to dispatch jobs and track tech location in ${city}? Most shops your size are stuck on either paper, eWay, or ServiceTitan (which costs $300+ per seat).</p>
  <p style="font:15px/1.55 -apple-system,Segoe UI,Arial;color:#0f2540;margin:0 0 10px;">FieldDesk is the modern alternative built in Michigan for trades shops. One flat $199/mo, unlimited techs.</p>
  ${card}
  <p style="font:13px/1.5 -apple-system,Segoe UI,Arial;color:#7a8aa0;margin:16px 0 0;">P.S. — Also hiring? We monitor LARA licenses + job boards 24/7 and alert you the moment a licensed HVAC tech enters the market. <a href="${SITE}/start-trial?product=techalert" style="color:#0077b6;">Free trial →</a></p>
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
    .select("id, business_name, owner_name, first_name, email, city, industry, drip_campaign_status")
    .not("email", "is", null)
    .limit(DAILY_CAP * 4);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  let sent = 0, failed = 0, blockedCount = 0, skipped = 0;

  for (const lead of (leads || [])) {
    if (sent >= DAILY_CAP) break;
    if (!isFieldServiceShop(lead.industry || "")) { skipped++; continue; }
    if ((lead.drip_campaign_status as any)?.last_product_pitched === "field_crm") { skipped++; continue; }

    try {
      const b = await isBlocked(sb, { email: lead.email, business_name: lead.business_name });
      if (b.blocked) { blockedCount++; continue; }
    } catch (_) {}

    const subject = `${lead.business_name || "your shop"} — dispatch + tech tracking for $199 flat`;
    const r = await dwaEmail({ to: lead.email, subject, html: emailHtml(lead), headers: listUnsubHeaders(lead.email) });
    if (r.ok) {
      sent++;
      await sb.from("outreach_leads").update({
        last_contact_date: new Date().toISOString().slice(0, 10),
        drip_campaign_status: {
          ...((lead.drip_campaign_status as any) || {}),
          current_stage: "1_DWA_Cold_Sent",
          last_engagement_timestamp: new Date().toISOString(),
          last_product_pitched: "field_crm",
        },
      }).eq("id", lead.id);
    } else { failed++; }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, blocked: blockedCount, skipped, cap: DAILY_CAP }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
