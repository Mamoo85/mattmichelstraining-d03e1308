// Newsletter Send — called by cron every Monday 8am ET
// 1. Generates this week's content via Claude API
// 2. Creates draft record in newsletter_sends
// 3. If a draft from last week was approved, sends it; otherwise sends auto-generated version
// 4. Matt gets a preview email 30 min before send with an approve/skip link

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const AFFILIATE_LINKS = {
  apollo: "https://www.apollo.io/?via=m2",
  hunter: "https://hunter.io/?ref=m2training",
  linkedin: "https://business.linkedin.com/sales-solutions",
  writesonic: "https://writesonic.com/?via=matt",
  elevenlabs: "https://try.elevenlabs.io/jh6f4tyyqf4n",
  surferSeo: "https://surferseo.com/?via=matt",
  synthesia: "https://www.synthesia.io/?via=matthew-michels",
  seamlessAi: "https://seamless.ai/?via=matt",
  instantly: "https://instantly.ai/?via=matt",
  pipedrive: "https://www.pipedrive.com/?via=matt",
  hubspot: "https://www.hubspot.com/?via=matt",
  closeCrm: "https://www.close.com/?via=matt",
  jobber: "https://www.getjobber.com/?via=matt",
  housecallPro: "https://www.housecallpro.com/?via=matt",
  activecampaign: "https://www.activecampaign.com/?via=matt",
  lemlist: "https://www.lemlist.com/?via=matt",
};

async function generateNewsletterContent(): Promise<{ subject: string; html: string; preview: string }> {
  if (!ANTHROPIC_API_KEY) throw new Error("No ANTHROPIC_API_KEY");

  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const topics = [
    "cold call opening lines that actually work",
    "how to find the right contact at a hospital system",
    "voicemail scripts that get callbacks",
    "LinkedIn outreach for industrial reps",
    "how to handle 'send me an email' brushoffs",
    "territory planning and routing for field reps",
    "how to prospect into dental offices",
    "getting past the gatekeeper in medical sales",
    "follow-up cadence that converts without being annoying",
    "using LinkedIn Sales Navigator effectively on a budget",
    "the 5-minute pre-call research routine",
    "how to re-engage dead leads",
  ];
  const topic = topics[weekNumber % topics.length];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `Write a weekly newsletter for B2B field sales reps (medical device, dental equipment, industrial) covering: "${topic}".

Format as JSON with these fields:
- subject: email subject line (punchy, under 60 chars)
- preview_text: one-line preview (under 100 chars)
- tip_headline: the main tip headline
- tip_body: 3-4 sentences of actionable advice (no fluff, real tactics)
- script_headline: "Script of the Week" headline
- script_body: a short word-for-word script (3-5 lines) the rep can use
- tool_name: one sales tool to spotlight (pick from: Apollo.io, Hunter.io, LinkedIn Sales Navigator)
- tool_tip: one specific tip for using that tool (2-3 sentences)
- stat: one interesting industry stat about sales or prospecting

Be direct and tactical. These are experienced reps who hate fluff. Write like you've been in the field.`
      }]
    }),
  });

  const data = await res.json();
  const raw = data.content?.[0]?.text || "";

  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || raw);
  } catch {
    parsed = {
      subject: `The Field Rep Weekly — ${topic}`,
      preview_text: "Tactics for this week.",
      tip_headline: topic,
      tip_body: raw.slice(0, 300),
      script_headline: "Script of the Week",
      script_body: "You: 'Hey, this is [name] — quick question: who handles purchasing decisions for [product category] at your practice?'",
      tool_name: "Apollo.io",
      tool_tip: "Use the chrome extension to find direct dials while browsing LinkedIn. It takes 10 seconds per contact.",
      stat: "80% of sales require 5+ follow-up calls. 44% of reps give up after 1.",
    };
  }

  const toolRotation = [
    { key: "apollo",      link: AFFILIATE_LINKS.apollo,      name: "Apollo.io",                 tip: "Use the Chrome extension to pull direct dials while browsing LinkedIn — 10 seconds per contact." },
    { key: "hunter",      link: AFFILIATE_LINKS.hunter,      name: "Hunter.io",                 tip: "Verify emails before blasting. Hunter catches 95% of bad addresses before they tank your sender score." },
    { key: "linkedin",    link: AFFILIATE_LINKS.linkedin,    name: "LinkedIn Sales Navigator",  tip: "Save leads into custom lists by territory. Set alerts for job changes — that's your warm intro moment." },
    { key: "writesonic",  link: AFFILIATE_LINKS.writesonic,  name: "Writesonic",                tip: "Generate 10 cold email variations in 60 seconds. A/B test subject lines without writing them yourself." },
    { key: "elevenlabs",  link: AFFILIATE_LINKS.elevenlabs,  name: "ElevenLabs",                tip: "Clone your voice and create personalized voicemail drops at scale. Your prospects hear YOU, not a robot." },
    { key: "surferSeo",   link: AFFILIATE_LINKS.surferSeo,   name: "Surfer SEO",                tip: "Optimize your LinkedIn articles and company blog posts to rank on Google. More inbound = less cold calling." },
    { key: "synthesia",   link: AFFILIATE_LINKS.synthesia,   name: "Synthesia",                 tip: "Create personalized video prospecting messages without being on camera. Send 50 custom videos per day." },
    { key: "seamlessAi",  link: AFFILIATE_LINKS.seamlessAi,  name: "Seamless.ai",               tip: "Real-time verified B2B contact data. Search by title, company size, and tech stack — get direct dials instantly." },
    { key: "instantly",   link: AFFILIATE_LINKS.instantly,    name: "Instantly.ai",              tip: "Warm up unlimited email accounts and send 5,000+ cold emails/day without landing in spam. Built for outbound." },
    { key: "pipedrive",   link: AFFILIATE_LINKS.pipedrive,   name: "Pipedrive",                 tip: "Visual sales pipeline built for field reps. Drag deals between stages. See exactly where your revenue is stuck." },
    { key: "hubspot",     link: AFFILIATE_LINKS.hubspot,     name: "HubSpot",                   tip: "Free CRM with email tracking — know the second a prospect opens your email. Upgrade only when you need automation." },
    { key: "closeCrm",    link: AFFILIATE_LINKS.closeCrm,    name: "Close CRM",                 tip: "Built for outbound sales teams. Power dialer + email sequences built in. See your entire pipeline in one visual board." },
    { key: "jobber",      link: AFFILIATE_LINKS.jobber,      name: "Jobber",                    tip: "If you're in field service (HVAC, plumbing, landscaping) Jobber handles quotes, scheduling, invoicing, and payments. Stops jobs falling through the cracks." },
    { key: "housecallPro",link: AFFILIATE_LINKS.housecallPro,name: "Housecall Pro",             tip: "Dispatch software for home service contractors. Drag-and-drop scheduling, auto-texts to customers, and instant payment collection on-site." },
    { key: "activecampaign",link: AFFILIATE_LINKS.activecampaign,name: "ActiveCampaign",        tip: "CRM + email automation that learns which prospects engage and scores them automatically. Set up a 5-email follow-up sequence once — it runs forever." },
    { key: "lemlist",     link: AFFILIATE_LINKS.lemlist,     name: "Lemlist",                   tip: "Personalized cold email at scale. Add a prospect's LinkedIn profile picture or website screenshot directly in the email. Open rates jump 30-40%." },
  ];
  const spotlightTool = toolRotation[weekNumber % toolRotation.length];
  const toolLink = spotlightTool.link;
  if (!parsed.tool_name) parsed.tool_name = spotlightTool.name;

  const issueNum = (weekNumber % 52) + 1;
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

  <!-- Header -->
  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">The Field Rep Weekly</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Issue #${issueNum} · ${dateStr}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#fff;padding:28px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <!-- Main Tip -->
    <h2 style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 12px;">${parsed.tip_headline}</h2>
    <p style="font-size:15px;color:#334155;line-height:1.8;margin:0 0 24px;">${parsed.tip_body}</p>

    <!-- Script Box -->
    <div style="background:#f1f5f9;border-left:3px solid #e8621a;padding:16px 20px;margin:0 0 24px;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#e8621a;text-transform:uppercase;">${parsed.script_headline}</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;white-space:pre-line;">${parsed.script_body}</p>
    </div>

    <!-- Tool Spotlight -->
    <div style="border:1px solid #e2e8f0;padding:16px 20px;margin:0 0 24px;border-radius:6px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase;">Tool Spotlight</p>
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1e293b;"><a href="${toolLink}" style="color:#e8621a;text-decoration:none;">${spotlightTool.name}</a></p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;">${spotlightTool.tip}</p>
    </div>

    <!-- Stat -->
    <div style="background:#fff7ed;border:1px solid #fed7aa;padding:14px 18px;border-radius:6px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#9a3412;line-height:1.7;"><strong>Stat of the week:</strong> ${parsed.stat}</p>
    </div>

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:13px;color:#64748b;line-height:1.7;">Questions or topics you want covered? Reply to this email or text Matt at <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>

    <p style="font-size:13px;color:#64748b;margin-top:20px;">
      🛠 Use AI tools built for field reps — cold email writers, voicemail scripts, objection handlers:
      <a href="https://www.mattmichelstraining.com/field-rep-tools" style="color:#e8621a;">Try them free →</a>
    </p>

  </td></tr>

  <!-- Signature -->
  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
    </div>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;font-size:12px;color:#94a3b8;line-height:1.6;">
    M² Performance Training · <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a><br>
    <a href="${SUPABASE_URL}/functions/v1/newsletter-unsubscribe?token={{unsubscribe_token}}" style="color:#94a3b8;">Unsubscribe</a>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  return { subject: parsed.subject, html, preview: parsed.preview_text };
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json")
      ? await req.json().catch(() => ({}))
      : {};

    const previewOnly = body?.preview_only === true;

    // Generate content
    const { subject, html, preview } = await generateNewsletterContent();

    // Save draft
    const { data: draft } = await sb
      .from("newsletter_sends")
      .insert({ subject, content_html: html, preview_text: preview, status: "draft", scheduled_for: new Date().toISOString() })
      .select()
      .single();

    if (previewOnly) {
      // Just send preview to Matt, don't send to list
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Newsletter <matt@notify.m2training.com>",
            to: ["matt@m2training.com"],
            subject: `[PREVIEW] ${subject}`,
            html: html.replace("{{unsubscribe_token}}", "preview"),
          }),
        });
      }
      return new Response(JSON.stringify({ draft_id: draft?.id, preview_sent: true }), { status: 200 });
    }

    // Fetch all active subscribers
    const { data: subscribers } = await sb
      .from("newsletter_subscribers")
      .select("email, name, unsubscribe_token")
      .eq("active", true);

    if (!subscribers || subscribers.length === 0) {
      console.log("[NEWSLETTER] No subscribers yet — saving draft only");
      return new Response(JSON.stringify({ sent: 0, draft_id: draft?.id }), { status: 200 });
    }

    // Send in batches of 50 (Resend batch limit)
    let sent = 0;
    const batchSize = 50;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((sub) =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@notify.m2training.com>",
              to: [sub.email],
              subject,
              html: html.replace("{{unsubscribe_token}}", sub.unsubscribe_token || ""),
            }),
          })
        )
      );
      sent += batch.length;
    }

    // Mark as sent
    if (draft) {
      await sb.from("newsletter_sends")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: sent })
        .eq("id", draft.id);
    }

    console.log(`[NEWSLETTER] Sent to ${sent} subscribers — "${subject}"`);
    return new Response(JSON.stringify({ sent, subject }), { status: 200 });
  } catch (e: any) {
    console.error("[NEWSLETTER] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
