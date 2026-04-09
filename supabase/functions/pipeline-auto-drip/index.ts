// pipeline-auto-drip: Automated drip sequence for prospect_pipeline leads
// Triggered by cron (every hour) — checks for leads needing drip emails
// Day 1: Hook email, Day 4: Follow-up + demo, Day 8: Online presence check, Day 15: Breakup

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DRIP_SCHEDULE = [
  { step: 1, delayDays: 0, subject: "Competitors getting calls you're not", label: "1_Day_1_Sent" },
  { step: 2, delayDays: 3, subject: "Quick follow-up — saw something on your site", label: "2_Day_4_Sent" },
  { step: 3, delayDays: 7, subject: "Quick online presence check for {{business}}", label: "3_Day_8_Sent" },
  { step: 4, delayDays: 14, subject: "Last message from me", label: "4_Day_15_Sent" },
];

async function generateDripEmail(step: number, businessName: string, industry: string, siteFlaw: string | null, contactName: string | null): Promise<{ subject: string; html: string }> {
  const scheduleItem = DRIP_SCHEDULE[step - 1];
  const subject = scheduleItem.subject.replace("{{business}}", businessName);
  const firstName = contactName?.split(" ")[0] || "there";

  const prompts: Record<number, string> = {
    1: `Write a cold outreach email from Matt at M² Digital (a web design & digital marketing agency). Recipient: ${firstName} at ${businessName} (${industry}). Subject: "${subject}". The hook: their competitors are showing up on Google and getting the calls they're not. ${siteFlaw ? `Mention this specific issue: "${siteFlaw}".` : ""} Include a soft CTA to check out a quick demo. Keep it under 150 words, conversational, not salesy. Sign off as Matt Michels. Output ONLY the email body HTML (no subject line).`,
    2: `Write a short follow-up email (step 2 of 4) from Matt at M² Digital to ${firstName} at ${businessName}. Reference the previous email about their online presence. Mention a demo link. Keep it under 100 words, casual. Sign off as Matt. Output ONLY the email body HTML.`,
    3: `Write a value-add email (step 3 of 4) from Matt at M² Digital to ${firstName} at ${businessName} (${industry}). Do a quick "online presence check" — mention things like Google Business Profile, mobile speed, and local SEO. Keep it helpful, not pushy. Under 120 words. Sign off as Matt. Output ONLY the email body HTML.`,
    4: `Write a breakup email (final step) from Matt at M² Digital to ${firstName} at ${businessName}. Keep it short, respectful, and leave the door open. Mention you won't email again but they can reach out anytime. Under 80 words. Sign off as Matt Michels. Output ONLY the email body HTML.`,
  };

  try {
    const res = await fetch("https://ai.lovable.dev/api/generate-text", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        prompt: prompts[step] || prompts[1],
        max_tokens: 600,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const body = data?.text || data?.content || "";
      if (body.length > 50) {
        return { subject, html: wrapEmailHtml(body) };
      }
    }
  } catch (e) {
    console.error("[DRIP] AI generation error:", e);
  }

  // Fallback templates
  const fallbacks: Record<number, string> = {
    1: `<p>Hi ${firstName},</p><p>I was looking at businesses in the ${industry} space near you, and I noticed something — your competitors are showing up ahead of you on Google.</p>${siteFlaw ? `<p>I also spotted this on your site: <em>${siteFlaw}</em></p>` : ""}<p>If you're curious how they're getting those calls, I put together a quick breakdown. Happy to share — no strings attached.</p><p>Best,<br/>Matt Michels<br/>M² Digital</p>`,
    2: `<p>Hi ${firstName},</p><p>Just following up on my note from a few days ago. I put together a quick demo showing what your online presence could look like with a few tweaks.</p><p>Worth a 2-minute look?</p><p>— Matt</p>`,
    3: `<p>Hi ${firstName},</p><p>Did a quick online presence check for ${businessName} — looked at your Google Business Profile, mobile site speed, and local search visibility.</p><p>There are a few quick wins that could help you show up more. Happy to share what I found.</p><p>— Matt</p>`,
    4: `<p>Hi ${firstName},</p><p>This is my last note — I don't want to be that guy who keeps emailing. If you ever want to chat about getting more visibility online, I'm here.</p><p>Wishing you and ${businessName} all the best.</p><p>— Matt Michels<br/>M² Digital</p>`,
  };

  return { subject, html: wrapEmailHtml(fallbacks[step] || fallbacks[1]) };
}

function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
${body}
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; resendId?: string; error?: string }> {
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not configured" };
  try {
    const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [to],
        subject,
        html,
        reply_to: "matt@mattmichelstraining.com",
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.message || `HTTP ${res.status}` };
    return { success: true, resendId: data?.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || "cron";

    // ── MODE: trigger — Send Day 1 for a specific lead (called on insert) ──
    if (mode === "trigger" && body.lead_id) {
      const { data: lead } = await sb.from("prospect_pipeline")
        .select("*").eq("id", body.lead_id).maybeSingle();
      if (!lead || !lead.email) {
        return new Response(JSON.stringify({ error: "Lead not found or no email" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (lead.drip_step > 0) {
        return new Response(JSON.stringify({ skipped: true, reason: "Already in drip" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { subject, html } = await generateDripEmail(1, lead.business_name, lead.industry || "", lead.specific_site_flaw || null, lead.contact_name);
      const result = await sendEmail(lead.email, subject, html);

      if (result.success) {
        await sb.from("prospect_pipeline").update({
          drip_step: 1,
          drip_status: "active",
          drip_subject: subject,
          last_drip_at: new Date().toISOString(),
          pipeline_stage: "outreach_sent",
        }).eq("id", lead.id);

        // Log the email
        await sb.from("prospect_email_log").insert({
          pipeline_lead_id: lead.id, business_name: lead.business_name,
          recipient_email: lead.email,
          subject,
          
          drip_step: 1,
          status: "sent",
          resend_id: result.resendId || null,
        }).then(() => {}).catch(() => {});
      }

      return new Response(JSON.stringify({ sent: result.success, step: 1, resend_id: result.resendId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── MODE: cron — Process all pending drip steps ──
    const now = new Date();
    let sent = 0;
    let errors = 0;

    // 1) New leads with email but no drip started → send Day 1
    const { data: newLeads } = await sb.from("prospect_pipeline")
      .select("*")
      .not("email", "is", null)
      .or("drip_step.is.null,drip_step.eq.0")
      .or("drip_status.is.null,drip_status.eq.not_started")
      .limit(20);

    for (const lead of newLeads || []) {
      try {
        const { subject, html } = await generateDripEmail(1, lead.business_name, lead.industry || "", lead.specific_site_flaw || null, lead.contact_name);
        const result = await sendEmail(lead.email, subject, html);
        if (result.success) {
          await sb.from("prospect_pipeline").update({
            drip_step: 1, drip_status: "active", drip_subject: subject,
            last_drip_at: now.toISOString(), pipeline_stage: "outreach_sent",
          }).eq("id", lead.id);
          await sb.from("prospect_email_log").insert({
            pipeline_lead_id: lead.id, business_name: lead.business_name, recipient_email: lead.email, subject, 
            drip_step: 1, status: "sent", resend_id: result.resendId || null,
          }).catch(() => {});
          sent++;
        } else { errors++; }
        await new Promise(r => setTimeout(r, 500)); // Rate limit
      } catch { errors++; }
    }

    // 2) Active drips needing next step
    for (let stepIdx = 1; stepIdx < DRIP_SCHEDULE.length; stepIdx++) {
      const schedule = DRIP_SCHEDULE[stepIdx];
      const prevSchedule = DRIP_SCHEDULE[stepIdx - 1];
      const daysSincePrev = schedule.delayDays - prevSchedule.delayDays;
      const cutoff = new Date(now.getTime() - daysSincePrev * 24 * 3600 * 1000).toISOString();

      const { data: readyLeads } = await sb.from("prospect_pipeline")
        .select("*")
        .eq("drip_step", stepIdx)
        .eq("drip_status", "active")
        .not("email", "is", null)
        .lte("last_drip_at", cutoff)
        .limit(20);

      for (const lead of readyLeads || []) {
        try {
          const nextStep = stepIdx + 1;
          const { subject, html } = await generateDripEmail(nextStep, lead.business_name, lead.industry || "", lead.specific_site_flaw || null, lead.contact_name);
          const result = await sendEmail(lead.email, subject, html);
          if (result.success) {
            const isLast = nextStep >= DRIP_SCHEDULE.length;
            await sb.from("prospect_pipeline").update({
              drip_step: nextStep,
              drip_status: isLast ? "completed" : "active",
              drip_subject: subject,
              last_drip_at: now.toISOString(),
            }).eq("id", lead.id);
            await sb.from("prospect_email_log").insert({
              pipeline_lead_id: lead.id, business_name: lead.business_name, recipient_email: lead.email, subject, 
              drip_step: nextStep, status: "sent", resend_id: result.resendId || null,
            }).catch(() => {});
            sent++;
          } else { errors++; }
          await new Promise(r => setTimeout(r, 500));
        } catch { errors++; }
      }
    }

    console.log(`[DRIP] Cron complete: ${sent} sent, ${errors} errors`);
    return new Response(JSON.stringify({ sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[DRIP] Fatal:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
