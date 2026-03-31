import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[SPORTS-NEWSLETTER] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

function buildNewsletterHtml(subject: string, body: string, issueNumber: number): string {
  const htmlBody = body
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:800;color:#f97316;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.05em;">$1</h2>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;color:#cbd5e1;">$1</li>')
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

    <!-- Header -->
    <tr><td style="background:#f97316;padding:3px 0;border-radius:4px 4px 0 0;"></td></tr>
    <tr><td style="background:#0f0f1a;padding:20px 24px 16px;border-bottom:1px solid #1e1e2e;">
      <table width="100%"><tr>
        <td>
          <div style="font-size:24px;font-weight:900;color:#f97316;letter-spacing:2px;">M² BRIEF</div>
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:4px;margin-top:2px;">The Weekly Sports Performance Newsletter</div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="font-size:10px;color:#475569;">Issue #${issueNumber}</div>
          <div style="font-size:10px;color:#475569;">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
        </td>
      </tr></table>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:24px;background:#0f0f1a;color:#cbd5e1;font-size:14px;line-height:1.8;">
      ${htmlBody}
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:16px 24px 24px;background:#0f0f1a;text-align:center;border-top:1px solid #1e1e2e;">
      <a href="https://www.mattmichelstraining.com/auth" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:6px;">Train Smarter — Join M² Free →</a>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#060610;padding:16px 24px;text-align:center;border-top:1px solid #0f0f1a;">
      <div style="font-size:10px;color:#334155;">
        M² Training · Real Training, Real Results · Grosse Pointe, MI<br>
        <a href="https://www.mattmichelstraining.com" style="color:#475569;">mattmichelstraining.com</a>
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "API keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow admin-triggered or cron (no auth for service-role cron calls)
    const authHeader = req.headers.get("Authorization");
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run === true;

    // Get current monthly focus + active challenge for context
    const [focusRes, challengeRes, sendCountRes] = await Promise.all([
      serviceClient.from("monthly_focus").select("title, topic, matt_quote").order("created_at", { ascending: false }).limit(1).single(),
      serviceClient.from("monthly_challenges").select("title, description, metric_label").eq("is_active", true).limit(1).single(),
      serviceClient.from("newsletter_sends").select("id", { count: "exact", head: true }).like("template_name", "sports_weekly_%"),
    ]);

    const focus = focusRes.data;
    const challenge = challengeRes.data;
    const issueNumber = (sendCountRes.count ?? 0) + 1;

    // Generate newsletter content via AI (with endpoint fallback + safe fallback body)
    const weekOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

    const aiPayload = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are Matt Michels, strength coach with 20+ years experience in Grosse Pointe, MI. You write a weekly performance newsletter called "The M² Brief" for athletes, parents, and coaches. Your voice is direct, knowledgeable, no-BS, and genuinely cares about helping youth athletes develop safely. You write in short paragraphs, use real coaching knowledge, and always end with an actionable takeaway.`,
        },
        {
          role: "user",
          content: `Write this week's M² Brief newsletter for the week of ${weekOf}.

${focus ? `This month's training focus: ${focus.topic} — "${focus.matt_quote}"` : ""}
${challenge ? `Active challenge: ${challenge.title} — ${challenge.description}` : ""}

Structure the newsletter with these exact sections (use ## for headers):

## This Week's Training Truth
[1-2 paragraphs — one specific, actionable training insight for athletes or parents. Something most coaches don't tell you.]

## The Weekly Drill
[One specific drill or exercise with: name, sets/reps, why it matters for athletes, common mistake to avoid]

## Nutrition for Athletes
[1 paragraph — one practical nutrition tip for youth athletes (protein, hydration, pre-game fuel, etc.)]

## Matt's Take
[1 paragraph — direct coach commentary on youth sports culture, pressure, overtraining, or athlete development. Honest perspective.]

## This Week's Challenge Spotlight
[Mention the active challenge, encourage participation, give a tip to do better at it]

Keep it under 400 words total. Write like you're talking to a parent driving their kid to practice. No fluff.`,
        },
      ],
      temperature: 0.72,
      max_tokens: 700,
    };

    const aiEndpoints = [
      "https://api.lovable.dev/v1/chat/completions",
      "https://api.lovable.ai/openai/v1/chat/completions",
    ];

    let newsletterBody = "";
    let lastAiError = "";

    for (const endpoint of aiEndpoints) {
      try {
        const aiRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify(aiPayload),
        });

        if (!aiRes.ok) {
          const errorText = await aiRes.text();
          lastAiError = `${endpoint} returned ${aiRes.status}: ${errorText}`;
          continue;
        }

        const aiData = await aiRes.json();
        newsletterBody = aiData.choices?.[0]?.message?.content?.trim() || "";

        if (newsletterBody) {
          log("AI generation succeeded", { endpoint });
          break;
        }

        lastAiError = `${endpoint} returned empty content`;
      } catch (error) {
        lastAiError = `${endpoint} failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (!newsletterBody) {
      log("AI generation failed — using fallback newsletter template", { lastAiError });
      newsletterBody = [
        "## This Week's Training Truth",
        "Most youth athletes aren’t limited by talent — they’re limited by recovery. If your athlete is dragging into practice, the first fix is sleep and hydration before adding extra work.",
        "",
        "## The Weekly Drill",
        "Split-Stance Med Ball Rotational Throw — 3 sets of 6 reps/side. This builds game-speed rotational power and teaches force transfer from the ground up. Common mistake: throwing with only the arms instead of driving through the hips.",
        "",
        "## Nutrition for Athletes",
        "A simple pre-practice win: 25–40g carbs + 15–20g protein 60–90 minutes before training (like a banana and Greek yogurt). Better energy in session = better reps and better adaptation.",
        "",
        "## Matt's Take",
        "Year-round sport pressure is real. What separates long-term athletes isn’t constant intensity — it’s consistency, smart deloads, and coaching that respects development timelines.",
        "",
        "## This Week's Challenge Spotlight",
        challenge
          ? `${challenge.title}: ${challenge.description}. My tip: set one measurable daily target so progress is obvious by Friday.`
          : "No active challenge this week — set a 5-day consistency streak (sleep, fuel, and 30+ quality training minutes) and hold yourself to it.",
      ].join("\n");
    }

    const subject = `M² Brief #${issueNumber} — Week of ${weekOf}`;
    const html = buildNewsletterHtml(subject, newsletterBody, issueNumber);

    log("Newsletter generated", { subject, wordCount: newsletterBody.split(" ").length });

    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, subject, body: newsletterBody, html }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all active newsletter subscribers
    const { data: subscribers, error: subErr } = await serviceClient
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true);

    if (subErr) throw subErr;

    const emails = (subscribers || []).map((s: any) => s.email).filter(Boolean);
    log("Sending to subscribers", { count: emails.length });

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No active subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedup check — don't resend this issue
    const { data: alreadySent } = await serviceClient
      .from("newsletter_sends")
      .select("id")
      .eq("template_name", `sports_weekly_${issueNumber}`)
      .limit(1);

    if (alreadySent && alreadySent.length > 0) {
      return new Response(JSON.stringify({ error: `Issue #${issueNumber} already sent` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send in batches of 50
    let sentCount = 0;
    const batchSize = 50;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch.map((email: string) => ({
          from: "Matt Michels · M² Training <matt@mattmichelstraining.com>",
          to: [email], bcc: ["matthewmichels4@gmail.com"],
          subject,
          html,
        }))),
      });

      if (res.ok) sentCount += batch.length;
      else log("Batch send error", { status: res.status });

      await new Promise(r => setTimeout(r, 300));
    }

    // Log the send
    await serviceClient.from("newsletter_sends").insert({
      subject,
      body: newsletterBody,
      recipient_count: sentCount,
      template_name: `sports_weekly_${issueNumber}`,
    });

    log("Newsletter sent", { sentCount, issueNumber });

    return new Response(
      JSON.stringify({ sent: sentCount, total: emails.length, issue: issueNumber, subject }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
