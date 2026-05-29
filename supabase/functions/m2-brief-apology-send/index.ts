// m2-brief-apology-send — One-shot "we're sorry" issue for the M² Brief launch bug.
//
// Why this exists:
//   Issues #1–#5 of the M² Brief shipped the IDENTICAL body (MD5 0f820be3...)
//   for 5 weeks straight to all 26 active subscribers. Root cause was a
//   silent AI gateway failure that defaulted to a hardcoded fallback. That
//   fallback bug is fixed in sports-newsletter-weekly (rotating bank + dupe
//   guard + AI gateway switch). This function is the human apology + restart.
//
// Behavior:
//   - Sends ONCE. Idempotent via newsletter_sends template_name='m2_brief_apology_v1'.
//   - Targets all is_active=true subscribers in newsletter_subscribers.
//   - Generates a fresh real Brief via the same AI prompt path as the weekly,
//     so they get an apology AT THE TOP and then immediately a real, useful issue.
//   - SMS confirmation to Matt on success/failure.
//   - Audit-logged in newsletter_sends so the dupe guard sees it as a recent send.
//
// Trigger: pg_cron one-shot (created via migration) or manual invoke.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[M2-BRIEF-APOLOGY] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const TEMPLATE_KEY = "m2_brief_apology_v1";

const APOLOGY_INTRO_MD = `## A note from Matt — and an apology

You may have noticed the last few M² Briefs looked... the same. Same drill, same nutrition tip, same closer. That's because they **were** the same.

A bug in the generator silently defaulted every issue back to the same template for five weeks. I just shipped the fix this weekend — duplicate-content guard, rotating angle bank, and a kill-switch that blocks any send that matches a recent issue.

Thank you for sticking with me during the launch. Here's a real one.

---

`;

async function generateFreshBrief(): Promise<string> {
  // Same model + tone as sports-newsletter-weekly, but no recent-topics deny
  // list (we're explicitly resetting). Keep it tight and useful.
  if (!LOVABLE_API_KEY) return FALLBACK_FRESH_BRIEF;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 1100,
        messages: [
          {
            role: "system",
            content:
              "You are Matt Michels, founder of M² Performance Training in Grosse Pointe, MI. You write a weekly newsletter for parents of high school athletes. Tone: direct, no fluff, like a coach texting a friend. Markdown headers, no emoji.",
          },
          {
            role: "user",
            content: `Write THIS WEEK's M² Brief. Use these exact section headers in this order:

## This Week's Training Truth
## The Weekly Drill
## Nutrition for Athletes
## Matt's Take
## This Week's Challenge Spotlight

Constraints:
- Pick a fresh angle. Suggested seed: "ankle and hip mobility windows that compound long-term for jumping athletes."
- Drill section MUST name a specific exercise, sets/reps, and the #1 mistake to avoid.
- Nutrition section MUST give a specific food + timing.
- Matt's Take MUST be 2-3 sentences of opinion that reads like a coach venting.
- Challenge Spotlight MUST be 2-3 sentences and end with a clear ask.
- 350-450 words total. No preamble.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      log("AI gateway failed — using fresh-brief fallback", { status: res.status });
      return FALLBACK_FRESH_BRIEF;
    }
    const data = await res.json();
    const body = (data.choices?.[0]?.message?.content || "").trim();
    return body || FALLBACK_FRESH_BRIEF;
  } catch (err) {
    log("AI threw — using fresh-brief fallback", { err: String(err) });
    return FALLBACK_FRESH_BRIEF;
  }
}

const FALLBACK_FRESH_BRIEF = `## This Week's Training Truth
Mobility windows in the ankle and hip compound. Five minutes a day for 12 weeks beats a 60-minute "mobility session" once a month — every single time.

## The Weekly Drill
World's Greatest Stretch — 2 sets of 5 reps per side. Step into a deep lunge, drop the back knee, drive the same-side elbow inside the front foot, then rotate the upper torso open toward the ceiling. The #1 mistake: collapsing the front knee inward. Drive the knee OUT, hold the rotation for a full breath.

## Nutrition for Athletes
Whole milk before bed on hard training days. 8 oz of regular cow's milk has ~8g protein and the casein gives a slow overnight amino release that supports muscle repair. Skip it on rest days if your athlete already hits their daily protein target.

## Matt's Take
Half the high school athletes I see can't sit in a deep squat. Not because they're weak — because nobody told them mobility is a skill. Skill that takes minutes a day, not hour-long yoga classes. Five minutes of ankle and hip work after homework. That's it. The kids who do it at 14 are still playing in college. The ones who don't are on the trainer's table by junior year.

## This Week's Challenge Spotlight
This week's challenge: 5 minutes of mobility work, 7 days straight. Pick one ankle drill and one hip drill, do them after dinner. Send me a photo or text by Sunday night. The athletes who finish all 7 days get a shoutout in next Monday's Brief — and a free spot in the May small-group session.`;

function buildApologyHtml(subject: string, bodyMd: string): string {
  // Convert minimal markdown
  const html = bodyMd
    .split("\n")
    .map((line) => {
      if (line.startsWith("## ")) return `<h2 style="font-size:18px;color:#1e293b;margin-top:24px;margin-bottom:8px;font-weight:700;">${line.slice(3)}</h2>`;
      if (line.startsWith("---")) return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">`;
      if (line.trim() === "") return "<br>";
      return `<p style="font-size:15px;line-height:1.65;color:#334155;margin:8px 0;">${line}</p>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:32px 20px;background:#ffffff;">
    <div style="border-bottom:3px solid #e8621a;padding-bottom:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#e8621a;text-transform:uppercase;">M² Brief — Apology &amp; Restart</p>
      <h1 style="margin:6px 0 0;font-size:24px;color:#1e293b;font-weight:800;">${subject}</h1>
    </div>
    ${html}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">
      <p style="margin:0 0 6px;">— Matt</p>
      <p style="margin:0;">M² Performance Training · Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#e8621a;text-decoration:none;">(313) 806-4952</a></p>
      <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">You're getting this because you're an active M² Brief subscriber. Want out? Just reply UNSUBSCRIBE.</p>
    </div>
  </div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dry_run === true;

    // Idempotency: refuse if already sent
    const { data: prior } = await sb
      .from("newsletter_sends")
      .select("id")
      .eq("template_name", TEMPLATE_KEY)
      .limit(1);

    if (!dryRun && prior && prior.length > 0) {
      log("Already sent — refusing duplicate", { id: prior[0].id });
      return new Response(JSON.stringify({ skipped: true, reason: "already_sent", id: prior[0].id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active subscribers
    const { data: subs, error: subErr } = await sb
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true);
    if (subErr) throw subErr;

    const emails = (subs || []).map((s: { email: string }) => s.email).filter(Boolean);
    log("Active subscribers", { count: emails.length });

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No active subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fresh = await generateFreshBrief();
    const fullBody = APOLOGY_INTRO_MD + fresh;

    const subject = "About the last few M² Briefs — and a real one this week";
    const html = buildApologyHtml(subject, fullBody);

    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, subject, body: fullBody, html, would_send_to: emails.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch send
    let sentCount = 0;
    const batchSize = 50;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          batch.map((email: string) => ({
            from: "Matt Michels · M² Training <matt@detroitwebagent.com>",
            to: [email],
            bcc: ["matthewmichels4@gmail.com"],
            subject,
            html,
          }))
        ),
      });
      if (res.ok) sentCount += batch.length;
      else log("Batch send error", { status: res.status, text: (await res.text()).slice(0, 200) });
      await new Promise((r) => setTimeout(r, 300));
    }

    // Audit insert (so the duplicate guard in sports-newsletter-weekly sees this in recent sends)
    await sb.from("newsletter_sends").insert({
      subject,
      body: fullBody,
      recipient_count: sentCount,
      template_name: TEMPLATE_KEY,
    });

    log("Apology shipped", { sentCount });

    await sendSMS(
      ADMIN_PHONE,
      TWILIO_FROM,
      `M² Brief APOLOGY shipped to ${sentCount}/${emails.length} subs. Fresh content + bug-fix note. No further action needed.`,
      "ops_alert"
    ).catch((err) => console.error("[M2-BRIEF-APOLOGY] confirmation SMS failed", err));

    return new Response(JSON.stringify({ sent: sentCount, total: emails.length, subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    await logError({
      source: "edge_function",
      function_name: "m2-brief-apology-send",
      severity: "critical",
      error_message: msg,
    }).catch(() => {});
    await sendSMS(ADMIN_PHONE, TWILIO_FROM, `M² Brief apology FAILED: ${msg.slice(0, 200)}`, "ops_alert").catch(() => {});
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
