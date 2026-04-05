// Insurance Lead Drip Runner — cron every 2 hours (0 */2 * * *)
// Sends personalized 5-step drip sequence to insurance prospects via email + SMS

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

// Days until next send for each step
const STEP_DELAYS_DAYS = [0, 3, 7, 14, 21];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find all prospects due for their next step
  const { data: prospects, error } = await sb
    .from("insurance_prospects")
    .select("*, insurance_drip_clients(*)")
    .eq("completed", false)
    .lte("next_send_at", new Date().toISOString())
    .order("next_send_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[insurance-drip-runner] DB error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!prospects?.length) {
    console.log("[insurance-drip-runner] No prospects due");
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  let sent = 0;
  let failed = 0;

  for (const prospect of prospects) {
    try {
      const step = prospect.current_step || 0;
      const coverageType = prospect.coverage_type || "insurance";
      const prospectName = prospect.first_name || prospect.name || "there";
      const prospectEmail = prospect.email;
      const prospectPhone = prospect.phone || null;

      // Get agent info from linked client
      const agent = prospect.insurance_drip_clients;
      const agentName = agent?.contact_name || agent?.agent_name || "your agent";
      const agentEmail = agent?.email || "";
      const agentPhone = agent?.phone || "";
      const agencyName = agent?.business_name || "our agency";

      // Step context map
      const stepContexts = [
        {
          intent: "warm introduction",
          instruction: `Introduce yourself warmly. Mention you specialize in ${coverageType}. Offer a free, no-obligation quote with no pressure. Keep it under 120 words. Sound like a real person, not a salesperson.`,
          subject: `Quick question about your ${coverageType}`,
        },
        {
          intent: "value-add tip",
          instruction: `Share one genuinely useful tip specific to ${coverageType} coverage — something most people don't know that could save them money or give better protection. Do NOT mention a quote or push for a meeting. Just be helpful. Under 130 words.`,
          subject: `One thing most ${coverageType} buyers miss`,
        },
        {
          intent: "social proof",
          instruction: `Share a brief, realistic social proof story: "A few of my ${coverageType} clients recently..." and describe a positive outcome (saved money, got better coverage, resolved a claim faster). Don't use fake names. Keep it authentic and under 120 words. End with a soft offer to see if you can do the same for them.`,
          subject: `What my other ${coverageType} clients are doing`,
        },
        {
          intent: "scarcity / capacity",
          instruction: `Mention that you only take on a limited number of new ${coverageType} clients each month to ensure personalized service. You have a spot opening soon. Ask if they'd like to grab 15 minutes before it's filled. Under 100 words. Firm but not pushy.`,
          subject: `Limited spots for new ${coverageType} clients`,
        },
        {
          intent: "final touchpoint",
          instruction: `This is the final message. Be gracious — if now isn't the right time, no hard feelings. Leave the door open. Ask if they'd like to be kept on your list for future updates, otherwise you'll close the file. Under 90 words. End on a positive, human note.`,
          subject: `Closing the loop — ${coverageType} coverage`,
        },
      ];

      const ctx = stepContexts[Math.min(step, 4)];

      const prompt = `You are ${agentName} from ${agencyName}, a professional insurance agent. Write a short, personalized follow-up email to a prospect.

Prospect first name: ${prospectName}
Coverage type they're interested in: ${coverageType}
This is step ${step + 1} of 5 in your follow-up sequence.
Your goal for this message: ${ctx.intent}

Instructions: ${ctx.instruction}

Sign the email as:
${agentName}
${agencyName}
${agentPhone ? agentPhone : ""}

Write ONLY the email body — no subject line, no "Hi" greeting on its own line (start directly with the salutation like "Hi ${prospectName}," as part of the message). Plain text style that will be wrapped in an HTML template.`;

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const aiData = await aiRes.json();
      const emailBody = aiData?.content?.[0]?.text?.trim() || "";

      // Send email
      if (RESEND_API_KEY && prospectEmail) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: agentEmail
              ? `${agentName} <matt@mattmichelstraining.com>`
              : `${agentName} <matt@mattmichelstraining.com>`,
            to: [prospectEmail],
            subject: ctx.subject,
            html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-radius:10px;">
    <p style="margin:0 0 20px;font-size:15px;color:#1e293b;line-height:1.9;white-space:pre-line;">${emailBody.replace(/\n/g, "<br>")}</p>
    <hr style="border:1px solid #f1f5f9;margin:24px 0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      You're receiving this because you expressed interest in ${coverageType} coverage.
      ${agentEmail ? `<br>Reply directly to <a href="mailto:${agentEmail}" style="color:#e8621a;">${agentEmail}</a> with any questions.` : ""}
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
          }),
        });
      }

      // SMS for steps 0-2 if phone available
      if (prospectPhone && step <= 2) {
        const smsMessages = [
          `Hi ${prospectName}, this is ${agentName} from ${agencyName}. I specialize in ${coverageType} and would love to offer you a free quote — no pressure at all. Just reply here or check your email. Thanks!`,
          `Hi ${prospectName} — ${agentName} here. Quick tip on ${coverageType}: check your email, I sent something you might find useful. No pitch, just helpful info.`,
          `Hi ${prospectName}, ${agentName} again. Sent you a note about what other ${coverageType} clients have been doing. Worth a 30-second read. Talk soon!`,
        ];
        await sendSMS(prospectPhone, TWILIO_PHONE_NUMBER, smsMessages[step], "insurance_drip");
      }

      // Calculate next send date based on upcoming step
      const nextStep = step + 1;
      const isCompleted = nextStep >= 5;
      const nextSendAt = isCompleted
        ? null
        : daysFromNow(STEP_DELAYS_DAYS[nextStep] - STEP_DELAYS_DAYS[step]);

      // Update prospect
      await sb
        .from("insurance_prospects")
        .update({
          current_step: nextStep,
          next_send_at: nextSendAt,
          completed: isCompleted,
          last_sent_at: new Date().toISOString(),
        })
        .eq("id", prospect.id);

      // Increment agent stat
      if (agent?.id) {
        await sb
          .from("insurance_drip_clients")
          .update({ prospects_enrolled: (agent.prospects_enrolled || 0) + 1 })
          .eq("id", agent.id);
      }

      sent++;
      console.log(`[insurance-drip-runner] Sent step ${step + 1} to ${prospectName} (${prospectEmail})`);
    } catch (e) {
      console.error(`[insurance-drip-runner] Error for prospect ${prospect.id}:`, e);
      failed++;
    }
  }

  console.log(`[insurance-drip-runner] Done — ${sent} sent, ${failed} failed`);
  return new Response(JSON.stringify({ processed: prospects.length, sent, failed }), { status: 200 });
});
