// dead-lead-outreach-drip — daily noon ET
// Follows up with contractors who were emailed the dead lead pitch but haven't replied.
// D4: soft follow-up. D8: final note with social proof.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

// CTA button — primary self-onboard link, rendered above signature on mobile.
function ctaButton(url: string, label = "Start free →"): string {
  return `<div style="margin:24px 0 8px 0;text-align:center;">
<a href="${url}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:6px;letter-spacing:0.3px;">${label}</a>
</div>
<div style="text-align:center;font-size:12px;color:#64748b;margin-bottom:8px;">or reply to this email</div>`;
}

function buildHtml(body: string, cta?: { url: string; label?: string }): string {
  const ctaHtml = cta ? ctaButton(cta.url, cta.label) : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
<tr><td style="background:#00d4ff;padding:3px 0;"></td></tr>
<tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.8;">${body.replace(/\n/g, "<br>")}
${ctaHtml}
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
<span style="font-size:13px;color:#334155;"><strong>Matt Michels</strong> · Detroit Web Agency · (313) 992-1219</span>
</div></td></tr>
<tr><td style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
Detroit Web Agency · Grosse Pointe, MI · detroitwebagent.com
</td></tr></table></td></tr></table></body></html>`;
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  let d4Sent = 0;
  let d8Sent = 0;
  let scD4Sent = 0;
  let scD8Sent = 0;

  // ── Senior Care TechAlert drip (D4 + D8) ────────────────────────────────────
  const { data: scLeads } = await sb
    .from("outreach_leads" as any)
    .select("id, business_name, email, industry, city, drip_campaign_status, last_contact_date")
    .eq("offer_pitched", "techalert_senior_care")
    .eq("status", "emailed")
    .not("email", "is", null);

  for (const lead of (scLeads || [])) {
    const drip = (lead.drip_campaign_status as any) || {};
    if (!drip.d0_sent) continue;
    const d0Date = drip.d0_sent_at ? new Date(drip.d0_sent_at) : new Date(lead.last_contact_date || now);
    const daysSince = (now.getTime() - d0Date.getTime()) / 86400000;

    if (daysSince >= 4 && daysSince < 9 && !drip.d4_sent) {
      const body = `Hey — just following up on the note I sent earlier this week about TechAlert.

Finding licensed CNAs and LPNs who are actually available right now is the hardest part of running a senior care facility. Michigan publishes every nursing license as public record — we just check it every morning and text you the moment a new one goes active in your area.

$99/mo. No agency fees. You're always first to call.

Start your free trial in 60 seconds (no card required) using the button below, or text me at (313) 992-1219.

— Matt, Detroit Web Agency`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@detroitwebagent.com>",
          to: [lead.email],
          bcc: ["matt@detroitwebagent.com"],
          subject: `quick follow-up — ${lead.business_name}`,
          html: buildHtml(body, { url: "https://www.detroitwebagent.com/hire-alert", label: "Start free trial →" }),
        }),
      });
      if (res.ok) {
        await sb.from("outreach_leads" as any).update({
          drip_campaign_status: { ...drip, d4_sent: true, d4_sent_at: now.toISOString() },
        }).eq("id", lead.id);
        scD4Sent++;
      }
      await new Promise(r => setTimeout(r, 500));

    } else if (daysSince >= 8 && !drip.d8_sent) {
      const body = `Hey — last note on this.

A home health agency in Warren used TechAlert to find a new LPN last month. She'd just passed her boards and hadn't posted anywhere yet. They called her before she ever got on Indeed.

If staffing ever gets tight enough to try something different — start a free trial in 60 seconds (button below) or text me at (313) 992-1219.

— Matt, Detroit Web Agency`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@detroitwebagent.com>",
          to: [lead.email],
          bcc: ["matt@detroitwebagent.com"],
          subject: `last note — ${lead.business_name}`,
          html: buildHtml(body, { url: "https://www.detroitwebagent.com/hire-alert", label: "Start free trial →" }),
        }),
      });
      if (res.ok) {
        await sb.from("outreach_leads" as any).update({
          drip_campaign_status: { ...drip, d8_sent: true, d8_sent_at: now.toISOString() },
          status: "drip_complete",
        }).eq("id", lead.id);
        scD8Sent++;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ── Dead lead reactivation drip (D4 + D8) ───────────────────────────────────
  const { data: leads } = await sb
    .from("outreach_leads" as any)
    .select("id, business_name, email, industry, city, drip_campaign_status, last_contact_date")
    .eq("offer_pitched", "dead_lead_reactivation")
    .eq("status", "emailed")
    .not("email", "is", null);

  for (const lead of (leads || [])) {
    const drip = (lead.drip_campaign_status as any) || {};
    if (!drip.d0_sent) continue;

    const d0Date = drip.d0_sent_at ? new Date(drip.d0_sent_at) : new Date(lead.last_contact_date || now);
    const daysSince = (now.getTime() - d0Date.getTime()) / 86400000;

    // D4 follow-up
    if (daysSince >= 4 && daysSince < 9 && !drip.d4_sent) {
      const tradeClean = (lead.industry || "contractor").toLowerCase();
      const body = `Hey — just wanted to follow up on my note from earlier this week.

Most ${tradeClean}s I talk to have 50–150 dead estimates in their CRM that never turned into jobs. We SMS them on your behalf — you pay $50 only if one replies YES they still need the work. Zero monthly fee, zero risk.

Upload your dead leads in 60 seconds (no card required) using the button below, or text me at (313) 992-1219.

— Matt, Detroit Web Agency`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@detroitwebagent.com>",
          to: [lead.email],
          bcc: ["matt@detroitwebagent.com"],
          subject: `quick follow-up — ${lead.business_name}`,
          html: buildHtml(body, { url: "https://www.detroitwebagent.com/dead-lead-intake", label: "Start free →" }),
        }),
      });

      if (res.ok) {
        await sb.from("outreach_leads" as any).update({
          drip_campaign_status: { ...drip, d4_sent: true, d4_sent_at: now.toISOString() },
        }).eq("id", lead.id);
        d4Sent++;
      }
      await new Promise(r => setTimeout(r, 500));

    // D8 final note
    } else if (daysSince >= 8 && !drip.d8_sent) {
      const body = `Hey — last note on this, I promise.

I ran a free test batch for an HVAC contractor in Warren a few months back — got 3 YES replies in 5 days from his dead leads. That's $150 he'd have left on the table otherwise.

If you ever want to try it with your own dead estimates — upload them in 60 seconds using the button below (first batch free, no card required), or text (313) 992-1219.

— Matt, Detroit Web Agency`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@detroitwebagent.com>",
          to: [lead.email],
          bcc: ["matt@detroitwebagent.com"],
          subject: `last note — ${lead.business_name}`,
          html: buildHtml(body, { url: "https://www.detroitwebagent.com/dead-lead-intake", label: "Start free →" }),
        }),
      });

      if (res.ok) {
        await sb.from("outreach_leads" as any).update({
          drip_campaign_status: { ...drip, d8_sent: true, d8_sent_at: now.toISOString() },
          status: "drip_complete",
        }).eq("id", lead.id);
        d8Sent++;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`[dead-lead-outreach-drip] d4=${d4Sent}, d8=${d8Sent}, sc_d4=${scD4Sent}, sc_d8=${scD8Sent}`);
  return new Response(JSON.stringify({ ok: true, d4: d4Sent, d8: d8Sent, senior_care_d4: scD4Sent, senior_care_d8: scD8Sent }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
