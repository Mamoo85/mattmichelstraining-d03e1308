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

// ── Master Niche Smoother: 50+ trades ──
const NICHE_MAP: [RegExp, string][] = [
  [/hvac|heating|cooling|furnace|air.?condition/i, "HVAC"],
  [/plumb|pipe|drain|water.?heater/i, "plumbing"],
  [/roof|shingle|gutter/i, "roofing"],
  [/electric|wiring|lighting/i, "electrical"],
  [/concrete|paving|asphalt|cement|driveway|foundation/i, "concrete"],
  [/landscape|lawn|hardscape|irrigation|sprinkler/i, "landscaping"],
  [/tree|arborist|stump/i, "tree service"],
  [/paint|stain|coating/i, "painting"],
  [/floor|epoxy|carpet|tile|hardwood/i, "flooring"],
  [/remodel|renovat|kitchen|bath|addition/i, "remodeling"],
  [/fence|fencing|gate/i, "fencing"],
  [/deck|patio|porch/i, "decking"],
  [/pest|exterminat|bug|rodent/i, "pest control"],
  [/mason|brick|stone|chimney/i, "masonry"],
  [/carpenter|woodwork|cabinet|framing/i, "carpentry"],
  [/siding|exterior|stucco/i, "siding"],
  [/window|door|glass|glazing/i, "window and door"],
  [/clean|janitor|power.?wash|pressure.?wash|maid/i, "cleaning"],
  [/pool|spa|hot.?tub/i, "pool service"],
  [/drywall|sheetrock|plaster|insulation/i, "drywall"],
  [/excavat|grading|trench|dirt|site.?prep/i, "excavation"],
  [/weld|fabrication|metal/i, "welding"],
  [/garage|overhead.?door/i, "garage door"],
  [/security|alarm|cctv|av|home.?theater/i, "A/V and security"],
  [/solar|panel/i, "solar"],
  [/mold|water.?damage|fire.?damage|mitigation|restoration/i, "restoration"],
  [/septic|sewer/i, "septic"],
  [/moving|mover|storage/i, "moving"],
  [/locksmith|key|safe/i, "locksmith"],
  [/sign|awning/i, "signage"],
  [/appliance|repair/i, "appliance repair"],
  [/wrecker|tow/i, "towing"],
  [/snow|plow|ice/i, "snow removal"],
  [/junk|dumpster|hauling|waste/i, "junk removal"],
  [/wrought.?iron/i, "ironwork"],
  [/boiler|steam/i, "boiler service"],
  [/auto|mechanic|body.?shop|collision/i, "auto repair"],
  [/demol/i, "demolition"],
  [/asbestos|abatement|lead.?removal|hazmat/i, "environmental remediation"],
  [/fire.?protect|sprinkler.?system/i, "fire protection"],
  [/elevator|escalator/i, "elevator service"],
  [/marine|boat|dock/i, "marine service"],
  [/pav|striping|seal.?coat/i, "paving"],
];

function normalizeIndustry(raw: string | null | undefined): string {
  if (!raw) return "contracting";
  const input = raw.toLowerCase();
  for (const [regex, label] of NICHE_MAP) {
    if (regex.test(input)) return label;
  }
  return "contracting";
}

const DRIP_SCHEDULE = [
  { step: 1, delayDays: 0, subject: "Competitors getting calls you're not", label: "1_Day_1_Sent" },
  { step: 2, delayDays: 3, subject: "Quick follow-up — saw something on your site", label: "2_Day_4_Sent" },
  { step: 3, delayDays: 7, subject: "Quick online presence check for {{business}}", label: "3_Day_8_Sent" },
  { step: 4, delayDays: 14, subject: "Last message from me", label: "4_Day_15_Sent" },
];

const BANNER_URL = "https://mattmichelstraining.com/images/dwa-email-banner.png";
const BOAT_PHOTO_URL = "https://mattmichelstraining.com/images/matt-boat.jpg";

const EMAIL_SIGNATURE = `
<div style="margin-top:32px;padding-top:20px;border-top:1px solid #1e293b;">
  <table cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding-right:14px;vertical-align:top;">
      <img src="${BOAT_PHOTO_URL}" alt="Matt Michels" width="56" height="56" style="border-radius:50%;object-fit:cover;display:block;" />
    </td>
    <td style="vertical-align:top;font-size:13px;color:#94a3b8;font-family:Arial,sans-serif;">
      <strong style="color:#22d3ee;">Matt Michels</strong> | Lead Web Agent<br/>
      <span style="color:#64748b;">Detroit Web Agency · (313) 992-1219</span><br/>
      <a href="https://detroitwebagent.com" style="color:#22d3ee;text-decoration:none;font-size:12px;">detroitwebagent.com</a>
    </td>
  </tr></table>
</div>`;

async function generateDripEmail(step: number, businessName: string, industry: string, siteFlaw: string | null, contactName: string | null): Promise<{ subject: string; html: string }> {
  const scheduleItem = DRIP_SCHEDULE[step - 1];
  const subject = scheduleItem.subject.replace("{{business}}", businessName);
  const firstName = contactName?.split(" ")[0] || "there";
  const niche = normalizeIndustry(industry);

  const prompts: Record<number, string> = {
    1: `Write a cold outreach email from Matt at Detroit Web Agency (a web design & digital marketing agency in Grosse Pointe, MI). Recipient: ${firstName} at ${businessName} (a ${niche} company). Subject: "${subject}". The hook: ask if they're taking on new ${niche} jobs right now, and mention their competitors are showing up on Google and getting the calls they're not. ${siteFlaw ? `Mention this specific issue: "${siteFlaw}".` : ""} Include a soft CTA to check out a quick demo. Keep it under 150 words, conversational, not salesy. Do NOT include any signature — just the email body. Output ONLY the email body HTML (no subject line, no signature).`,
    2: `Write a short follow-up email (step 2 of 4) from Matt at Detroit Web Agency to ${firstName} at ${businessName} (${niche}). Reference the previous email about their online presence. Mention a demo link. Keep it under 100 words, casual. Do NOT include any signature. Output ONLY the email body HTML.`,
    3: `Write a value-add email (step 3 of 4) from Matt at Detroit Web Agency to ${firstName} at ${businessName} (${niche}). Do a quick "online presence check" — mention things like Google Business Profile, mobile speed, and local SEO. Keep it helpful, not pushy. Under 120 words. Do NOT include any signature. Output ONLY the email body HTML.`,
    4: `Write a breakup email (final step) from Matt at Detroit Web Agency to ${firstName} at ${businessName}. Keep it short, respectful, and leave the door open. Mention you won't email again but they can reach out anytime. Under 80 words. Do NOT include any signature. Output ONLY the email body HTML.`,
  };

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompts[step] || prompts[1] }],
        max_tokens: 600,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const body = data?.choices?.[0]?.message?.content || "";
      if (body.length > 50) {
        return { subject, html: wrapEmailHtml(body) };
      }
    }
  } catch (e) {
    console.error("[DRIP] AI generation error:", e);
  }

  // Fallback templates using normalized niche
  const fallbacks: Record<number, string> = {
    1: `<p>Hi ${firstName},</p><p>Are you guys taking on new ${niche} jobs right now? I was looking at ${niche} companies near you, and I noticed your competitors are showing up ahead of you on Google.</p>${siteFlaw ? `<p>I also spotted this on your site: <em>${siteFlaw}</em></p>` : ""}<p>If you're curious how they're getting those calls, I put together a quick breakdown. Happy to share — no strings attached.</p>`,
    2: `<p>Hi ${firstName},</p><p>Just following up on my note from a few days ago. I put together a quick demo showing what your online presence could look like with a few tweaks.</p><p>Worth a 2-minute look?</p>`,
    3: `<p>Hi ${firstName},</p><p>Did a quick online presence check for ${businessName} — looked at your Google Business Profile, mobile site speed, and local search visibility.</p><p>There are a few quick wins that could help you show up more for ${niche} searches in your area. Happy to share what I found.</p>`,
    4: `<p>Hi ${firstName},</p><p>This is my last note — I don't want to be that guy who keeps emailing. If you ever want to chat about getting more visibility online, I'm here.</p><p>Wishing you and ${businessName} all the best.</p>`,
  };

  return { subject, html: wrapEmailHtml(fallbacks[step] || fallbacks[1]) };
}

function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#e2e8f0;line-height:1.6;max-width:600px;margin:0 auto;padding:0;background:#0f172a;">
<div style="background:#0a0a0f;padding:0;">
  <img src="${BANNER_URL}" alt="Detroit Web Agency" width="600" style="width:100%;max-width:600px;display:block;height:auto;" />
</div>
<div style="padding:24px 20px;background:#0f172a;">
${body}
${EMAIL_SIGNATURE}
</div>
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
        from: "Matt Michels | Detroit Web Agency <matt@detroitwebagent.com>",
        to: [to],
        bcc: ["matthewmichels4@gmail.com"],
        subject,
        html,
        reply_to: "matt@detroitwebagent.com",
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
