import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const log = (step: string, data?: any) =>
  console.log(`[CONTRACTOR-DRIP] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Per-offer drip sequences ──
const DRIP: Record<string, { templateName: string; daysAfterPrev: number; subject: (biz: string, city: string) => string; body: (biz: string, city: string) => string }[]> = {
  leads: [
    {
      templateName: "contractor_drip_d4_leads",
      daysAfterPrev: 4,
      subject: (biz, city) => `Still one spot open for ${city}`,
      body: (biz, city) => `Hey —

Sent you an email a few days ago about the exclusive lead system I run for contractors in ${city}.

Still have one spot open for your trade. Once it's gone, the next contractor who signs up in your city gets every lead that would've gone to you.

No commitment to start — just reply and I'll show you what recent leads looked like.

— Matt, Grosse Pointe
(313) 806-4952`,
    },
    {
      templateName: "contractor_drip_d8_leads",
      daysAfterPrev: 4,
      subject: (biz, city) => `${biz} — competitor in ${city} just asked`,
      body: (biz, city) => `Hey —

Another ${city} contractor in your trade reached out about the lead spot. Wanted to give you first shot before I respond.

The system sends exclusive homeowner leads directly to you — no one else gets the same lead. $399/mo, cancel any time.

If you're good on leads, totally understand. Just didn't want you to find out I filled the spot with your competitor.

Reply here or text me: (313) 806-4952

— Matt`,
    },
    {
      templateName: "contractor_drip_d15_leads",
      daysAfterPrev: 7,
      subject: (biz, city) => `Last message — ${city} lead spot`,
      body: (biz, city) => `Hey —

Last one, I promise.

If the exclusive lead spot in ${city} interests you at all — even to just see what the leads look like — reply or text me at (313) 806-4952.

If not, no hard feelings. I'll reach back out if something changes.

— Matt, Grosse Pointe`,
    },
  ],
  gbp: [
    {
      templateName: "contractor_drip_d4_gbp",
      daysAfterPrev: 4,
      subject: (biz, city) => `${biz} — quick Google fix`,
      body: (biz, city) => `Hey —

Followed up from my email last week about your Google Business Profile.

The contractors I work with in Metro Detroit who were in the same spot as you — low reviews, no recent posts — are now showing up in the top 3 for their trade + city within 60 days. That's new calls every week on autopilot.

$199/mo, I handle everything. No work on your end.

Worth a 5-minute conversation? Reply here or text (313) 806-4952.

— Matt`,
    },
    {
      templateName: "contractor_drip_d8_gbp",
      daysAfterPrev: 4,
      subject: (biz, city) => `Who's ranking above you in ${city}?`,
      body: (biz, city) => `Hey —

Real quick: search "[your trade] ${city}" on Google. The guys in the top 3 are getting the calls. The ones below them are not.

The difference is almost always the Google Business Profile — review count, post frequency, Q&A activity.

I automate all of that for contractors. $199/mo. I run it, you get the calls.

If you want me to pull a free audit of your GBP and show you exactly what's holding you back, just reply.

— Matt
(313) 806-4952`,
    },
    {
      templateName: "contractor_drip_d15_gbp",
      daysAfterPrev: 7,
      subject: (biz, city) => `Last message from me, ${biz}`,
      body: (biz, city) => `Hey —

Last email on this. If the Google ranking stuff isn't a priority right now — totally get it.

If you ever want to rank higher in ${city} for your trade without touching Google yourself, I'm at (313) 806-4952.

— Matt, Grosse Pointe`,
    },
  ],
  missed_call: [
    {
      templateName: "contractor_drip_d4_missed",
      daysAfterPrev: 4,
      subject: (biz, city) => `How many calls did you miss this week?`,
      body: (biz, city) => `Hey —

Sent you a message last week about the missed-call text back system.

Quick stat: the average contractor misses 3-5 calls a week while on a job. That's 3-5 potential jobs that go to whoever answers first.

My system texts the missed caller back within 30 seconds — automatically. $99/mo. Takes 10 minutes to set up.

Want to see how it works? Reply or text (313) 806-4952.

— Matt`,
    },
    {
      templateName: "contractor_drip_d8_missed",
      daysAfterPrev: 4,
      subject: (biz, city) => `${biz} — the $99 fix for missed calls`,
      body: (biz, city) => `Hey —

One more follow-up on the missed-call system.

A plumber I set this up for in Warren picked up an extra $4,400 job last month because my system texted back a missed caller while he was under a sink. His competitor had already called. He got there first anyway.

$99/mo. I set it up. You just keep working.

Reply or text (313) 806-4952 if you want in.

— Matt, Grosse Pointe`,
    },
    {
      templateName: "contractor_drip_d15_missed",
      daysAfterPrev: 7,
      subject: (biz, city) => `Last message from me`,
      body: (biz, city) => `Hey —

Last one. If the missed-call issue ever costs you a job and you want an automatic fix for $99/mo — I'm at (313) 806-4952.

— Matt`,
    },
  ],
};

function buildHtml(body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%"><tr><td align="center" style="padding:24px 16px;">
<table style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
<tr><td style="background:#e8621a;padding:3px 0;"></td></tr>
<tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.8;">${htmlBody}
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
<img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;vertical-align:middle;" alt="Matt">
<span style="margin-left:12px;font-size:13px;color:#334155;vertical-align:middle;"><strong>Matt Michels</strong> · Grosse Pointe, MI · (313) 806-4952</span>
</div></td></tr>
<tr><td style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">M² Performance Training · Grosse Pointe, MI</td></tr>
</table></td></tr></table></body></html>`;
}

const DAILY_SEND_CAP = 30;

serve(async () => {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check daily volume cap (shared across all contractor outreach)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: dailySent } = await sb
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString())
      .like("template_name", "contractor_%");
    const remainingCap = DAILY_SEND_CAP - (dailySent || 0);
    if (remainingCap <= 0) {
      log("Daily send cap reached", { dailySent, cap: DAILY_SEND_CAP });
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "daily_cap_reached" }), { status: 200 });
    }

    // Pull all emailed leads still in active drip
    const { data: leads } = await sb
      .from("outreach_leads")
      .select("id, business_name, email, city, offer_pitched, last_contact_date")
      .eq("status", "emailed")
      .eq("channel", "email")
      .not("email", "is", null);

    if (!leads?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    let sent = 0;

    for (const lead of leads) {
      const offer = lead.offer_pitched || "leads";
      const sequence = DRIP[offer] || DRIP.leads;
      const email = lead.email;
      const biz = lead.business_name || "your business";
      const city = lead.city || "your area";

      // Check what's already been sent
      const { data: sentLogs } = await sb
        .from("email_send_log" as any)
        .select("template_name, created_at")
        .eq("recipient_email", email)
        .like("template_name", "contractor_drip_%")
        .order("created_at", { ascending: false });

      const sentTemplates = new Set((sentLogs || []).map((l: any) => l.template_name));
      const lastLog = sentLogs?.[0];
      const daysSinceLast = lastLog
        ? (Date.now() - new Date(lastLog.created_at).getTime()) / 86400000
        : (Date.now() - new Date(lead.last_contact_date || Date.now()).getTime()) / 86400000;

      // Find next step
      let nextStep = null;
      for (const step of sequence) {
        if (!sentTemplates.has(step.templateName) && daysSinceLast >= step.daysAfterPrev) {
          nextStep = step;
          break;
        }
      }

      if (!nextStep) continue;

      // Check suppression
      const { data: suppressed } = await sb
        .from("suppressed_emails" as any)
        .select("email")
        .eq("email", email.toLowerCase())
        .limit(1);
      if (suppressed?.length) continue;

      const subject = nextStep.subject(biz, city);
      const body = nextStep.body(biz, city);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@notify.m2training.com>",
          to: [email],
          bcc: ["matthewmichels@gmail.com", "matthewmichels4@gmail.com"],
          subject,
          html: buildHtml(body),
        }),
      });

      if (!res.ok) { log("Send failed", { email, status: res.status }); continue; }

      const { error: logErr } = await sb.from("email_send_log" as any).insert({
        recipient_email: email,
        template_name: nextStep.templateName,
        status: "sent",
        message_id: `contractor_drip_${lead.id}_${nextStep.templateName}`,
      });
      if (logErr) log("email_send_log insert failed", { email, error: logErr.message });

      const { error: updateErr } = await sb.from("outreach_leads").update({
        last_contact_date: new Date().toISOString().split("T")[0],
      }).eq("id", lead.id);
      if (updateErr) log("outreach_leads update failed", { id: lead.id, error: updateErr.message });

      sent++;
      log("Drip sent", { email, step: nextStep.templateName });
      await new Promise(r => setTimeout(r, 200));

      if (sent >= remainingCap) { log("Hit daily cap during drip"); break; }
    }

    return new Response(JSON.stringify({ ok: true, sent, total: leads.length }), { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
