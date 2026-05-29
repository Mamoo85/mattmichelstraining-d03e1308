// fielddesk-cold-blast — Cold email pitch for FieldDesk to home-service shops
// in outreach_leads that haven't received a FieldDesk pitch yet.
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { isMarketingBlocked } from "../_shared/marketing-kill-switch.ts";
import { wasRecentlyEmailed } from "../_shared/cold-email-dedup.ts";

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
  const ctaUrl = `${SITE}/start-trial?product=field_desk&email=${encodeURIComponent(lead.email || "")}&utm_source=cold_email&utm_medium=email&utm_campaign=fielddesk_blast`;
  return `<div style="font:15px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:560px;">
<p style="margin:0 0 14px;">Hey ${fn},</p>
<p style="margin:0 0 14px;">Quick one — what's ${biz} using to dispatch jobs and track tech GPS in ${city}? Most shops your size are either on paper, a spreadsheet, or paying $300+ per seat for ServiceTitan.</p>
<p style="margin:0 0 14px;">FieldDesk is $199/mo flat — unlimited techs, live GPS tracking, job dispatch, and a customer portal. Built for 2–20 tech trades shops in Michigan. We do the migration from whatever you're on now (usually a weekend).</p>
<p style="margin:0 0 14px;">Free 7-day trial, no card:</p>
<p style="margin:0 0 14px;"><a href="${ctaUrl}" style="color:#0a58ca;">${ctaUrl}</a></p>
<p style="margin:18px 0 4px;">— Matt Michels</p>
<p style="margin:0 0 4px;color:#555;">Detroit Web Agency · (313) 992-1219</p>
<p style="margin:14px 0 0;font-size:12px;color:#888;">Reply STOP to opt out. <a href="${SITE}/unsubscribe?email=${encodeURIComponent(lead.email)}" style="color:#888;">Unsubscribe</a>.</p>
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

    // Cross-product 5-day dedup
    if (await wasRecentlyEmailed(sb, lead.email)) { skipped++; continue; }

    const subject = `${lead.business_name || "your shop"} — what are you using to dispatch jobs right now?`;
    const r = await dwaColdEmail({
      to: lead.email,
      subject,
      bodyHtml: emailHtml(lead),
      product: "fielddesk",
      ctaUrl: `${SITE}/start-trial?product=field_desk`,
      templateName: "fielddesk_cold_blast",
      plainMode: true,
    }, sb);
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
