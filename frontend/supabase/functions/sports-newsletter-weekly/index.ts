// Sports Newsletter Weekly — "M² Brief"
// Triggered Mondays 8am ET via pg_cron (jobname: sports-newsletter-weekly).
//
// Hardening (Apr 2026):
//   1. Uses canonical Lovable AI Gateway URL (the previous two endpoints 404'd
//      silently, causing the same fallback body to ship 5 weeks in a row).
//   2. Recent-topics deny list — last 3 sent bodies are passed back into the
//      AI prompt with an explicit "do not repeat" instruction.
//   3. Rotating 8-slot fallback bank — even on a worst-case AI outage the
//      content still varies week to week.
//   4. Duplicate-body guard — MD5-equivalent body hash compared against the
//      last 4 issues; if matched, the send is BLOCKED, audit-logged, and
//      Matt is SMS'd via shared sendSMS().
//   5. error_logs trigger on AI failure -> existing autonomous fixer agent
//      picks it up and Matt is alerted.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[SPORTS-NEWSLETTER] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

// Rotating angle bank — used as a seed hook so the AI starts from a fresh
// premise each week instead of defaulting to "recovery".
const SEED_ANGLES = [
  "in-season strength maintenance for high school athletes",
  "deload weeks done right (and why most kids skip them)",
  "rotational power development for baseball/lacrosse/hockey",
  "Achilles tendon loading to prevent late-season injury",
  "sleep timing as a performance multiplier",
  "pre-game fueling: what to eat, when to eat it, and what to skip",
  "early-warning signs of overtraining in young athletes",
  "stride mechanics — the missing piece in speed work",
  "posterior chain strength for jumping athletes",
  "hip/ankle mobility windows that compound long-term",
  "mental load management during a competitive season",
  "hydration protocols for two-a-day practice blocks",
] as const;

// 8-slot fallback bank. Every Brief that ships when AI is fully down will at
// least rotate through one of these — never the same one twice in 8 weeks.
const FALLBACK_BANK: string[] = [
  // 0 — Recovery
  `## This Week's Training Truth
Your body adapts during recovery, not during training. If your athlete is in three sports plus club practice, the missing input isn't another rep — it's a real off-day.

## The Weekly Drill
Box Jump → Stick the Landing — 4 sets of 4. Focus on the LANDING: soft, quiet, knees tracking over toes. Common mistake: chasing height instead of clean mechanics. The landing is what builds resilient knees.

## Nutrition for Athletes
Within 30 minutes of practice, get 20g of protein in. Chocolate milk works. Greek yogurt works. The window matters more than the source.

## Matt's Take
Parents ask me how to get their kid more playing time. My answer: keep them healthy. The best ability is availability — coaches play kids who show up healthy every week.

## This Week's Challenge Spotlight
Our active challenge is about consistency, not intensity. Pick one thing — sleep, hydration, or mobility — and hit it 7 days straight. Report back Friday.`,

  // 1 — Rotational power
  `## This Week's Training Truth
Most field-sport athletes train in straight lines but compete in rotation. If your kid throws, swings, or shoots — they need rotational power work, not just squats.

## The Weekly Drill
Half-Kneeling Cable Chop — 3 sets of 8/side. Drive through the hips, NOT the arms. Common mistake: arm-throwing the cable. The hips initiate, the core transfers, the arms finish.

## Nutrition for Athletes
Carbs aren't the enemy — they're the fuel. A youth athlete training 5+ days a week needs roughly 3-5 grams of carbs per kg of body weight on hard days. Rice, oats, fruit, potatoes.

## Matt's Take
Specialization too early kills more careers than injuries do. Multi-sport athletes outperform single-sport peers in the long run — and they have less burnout by 16.

## This Week's Challenge Spotlight
Track your training week on paper. You can't fix what you can't see. One sheet, one week, real numbers.`,

  // 2 — Posterior chain
  `## This Week's Training Truth
Quad-dominant athletes get hurt more often. The posterior chain (hamstrings, glutes, low back) is what protects the knees and produces the speed.

## The Weekly Drill
Romanian Deadlift — 3 sets of 6 with a moderate weight. Hinge at the hips, not the knees. Common mistake: rounding the back to chase a deeper stretch. Stop where the form breaks.

## Nutrition for Athletes
Eggs are underrated for athletes. Two whole eggs at breakfast = 12g of high-quality protein, plus choline (brain) and creatine precursors. Cheap and effective.

## Matt's Take
Pretty muscles in the mirror don't win games. Strong hamstrings, healthy ankles, and a thick mid-back do. Train the back of your body.

## This Week's Challenge Spotlight
Our active challenge rewards the boring work. Show up, log it, do it again. That's the entire formula.`,

  // 3 — Sleep
  `## This Week's Training Truth
Studies on teen athletes show that going from 6 hours to 8 hours of sleep cuts injury risk roughly in half. No supplement, drill, or coach can match that ROI.

## The Weekly Drill
Single-Leg Glute Bridge — 3 sets of 10/side. Hold the top for 2 seconds. Common mistake: arching the low back instead of squeezing the glute. If you feel it in your back, drop the hips lower.

## Nutrition for Athletes
A late-night snack with protein (cottage cheese, Greek yogurt) helps overnight muscle repair. Skip the chips and ice cream — they spike sugar and crash sleep quality.

## Matt's Take
Phones in bedrooms are sabotaging youth sports performance more than bad coaching. Charge it in the kitchen. End of debate.

## This Week's Challenge Spotlight
The best challenge metric is "did you sleep 8 hours last night?" Track yes/no for the week. Aim for 6 of 7.`,

  // 4 — In-season strength
  `## This Week's Training Truth
Most athletes detrain during their season because they stop lifting. You don't need 90 minutes — two 30-minute sessions a week of heavy, low-volume work maintains strength all season.

## The Weekly Drill
Trap Bar Deadlift — 3 sets of 3 at 80% of max. Heavy, clean, no grinding reps. Common mistake: chasing volume in-season. Volume is for off-season; intensity is for in-season.

## Nutrition for Athletes
On a game day, eat your biggest meal 3-4 hours pre-game (rice, lean protein, fruit). Within 60 minutes of game time, only fast-digesting carbs (banana, applesauce, sports drink).

## Matt's Take
Coaches who tell kids "lifting will make you slow" haven't read a single study from the last 20 years. Strength is the floor that speed and power are built on.

## This Week's Challenge Spotlight
Don't break the streak. Whatever the metric is, hit it today. Tomorrow you worry about tomorrow.`,

  // 5 — Mobility / ankles
  `## This Week's Training Truth
Tight ankles cause knee pain, hip pain, and slower sprint times. If your athlete can't drop into a deep squat without their heels lifting, that's the first thing to fix.

## The Weekly Drill
Wall Ankle Mobilization — 3 sets of 8/side. Knee tracks straight over the second toe, heel stays planted, drive the knee toward the wall. Common mistake: collapsing the arch to fake more range.

## Nutrition for Athletes
Hydration starts the day before, not the morning of. Half your body weight in ounces of water as a baseline, more on training days. Add a pinch of salt if it's a hot practice.

## Matt's Take
Stretching for 30 seconds after practice doesn't fix mobility. You need loaded range-of-motion work — squats to depth, lunges with a reach, controlled tempos. Tissue adapts to the load you give it.

## This Week's Challenge Spotlight
Pair the active challenge with one mobility drill per day. Two minutes. That's it. Compound interest works in fitness too.`,

  // 6 — Mental load
  `## This Week's Training Truth
Youth athletes don't burn out from practice — they burn out from pressure. The kids who quit at 14 almost always describe the same thing: it stopped being fun.

## The Weekly Drill
Skipping for Speed — 3 sets of 30 seconds, max effort. Old-school but underrated. Builds calf elasticity, ankle stiffness, and rhythm. Common mistake: dragging the feet. Bounce, don't shuffle.

## Nutrition for Athletes
Caffeine for athletes under 16 is a hard no from me. Their nervous systems are still developing. Sleep, food, and hydration cover the same need without the cost.

## Matt's Take
Ask your athlete every week: "are you still having fun?" If the answer is no two weeks in a row, something needs to change. Not the kid — the schedule.

## This Week's Challenge Spotlight
The point of the monthly challenge isn't perfection. It's showing up imperfectly, consistently. That's what builds the athlete.`,

  // 7 — Stride / speed
  `## This Week's Training Truth
Speed is mostly mechanics — not effort. The fastest kids in any class aren't trying harder; they're putting force into the ground more efficiently.

## The Weekly Drill
A-Skip — 3 sets of 20 yards. Drive the knee up, foot flexed, step over the opposite knee. Common mistake: leaning back. Stay tall, drive the ground behind you, not below you.

## Nutrition for Athletes
Pre-practice fuel matters less than people think — what matters more is what you ate 12 hours earlier. Dinner the night before is the practice you actually train on.

## Matt's Take
"Speed" is the most coachable thing in sports if you start before puberty. After 16, you're refining what's there. Before 14, you're building it.

## This Week's Challenge Spotlight
The best way to win the challenge is to make it boring. Same time, same place, same effort. Boredom is the price of progress.`,
];

async function md5Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-1", data); // SHA-1 is fine for change-detection
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

    <tr><td style="padding:24px;background:#0f0f1a;color:#cbd5e1;font-size:14px;line-height:1.8;">
      ${htmlBody}
    </td></tr>

    <tr><td style="padding:16px 24px 24px;background:#0f0f1a;text-align:center;border-top:1px solid #1e1e2e;">
      <a href="https://www.mattmichelstraining.com/auth" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:6px;">Train Smarter — Join M² Free →</a>
    </td></tr>

    <tr><td style="background:#060610;padding:16px 24px;text-align:center;border-top:1px solid #0f0f1a;">
      <div style="font-size:10px;color:#334155;">
        M² Training · Real Training, Real Results · Grosse Pointe, MI<br>
        <a href="https://www.mattmichelstraining.com" style="color:#475569;">mattmichelstraining.com</a>
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 992-1219</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>
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

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Optional admin gate for browser-triggered runs
    const authHeader = req.headers.get("Authorization");
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

    // Pull current focus + active challenge + issue counter + last 3 sent bodies
    const [focusRes, challengeRes, sendCountRes, recentSendsRes] = await Promise.all([
      serviceClient.from("monthly_focus").select("title, topic, matt_quote").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      serviceClient.from("monthly_challenges").select("title, description, metric_label").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      serviceClient.from("newsletter_sends").select("id", { count: "exact", head: true }).like("template_name", "sports_weekly_%"),
      serviceClient.from("newsletter_sends").select("body, template_name").like("template_name", "sports_weekly_%").order("sent_at", { ascending: false }).limit(4),
    ]);

    const focus = focusRes.data;
    const challenge = challengeRes.data;
    const issueNumber = (sendCountRes.count ?? 0) + 1;
    const recentSends = recentSendsRes.data ?? [];

    // Pull recent topic headlines for the deny list
    const recentTopics = recentSends
      .map((r) => {
        const m = (r.body || "").match(/## This Week's Training Truth\s*\n([^\n]+)/);
        return m ? m[1].slice(0, 140) : null;
      })
      .filter(Boolean)
      .slice(0, 3);

    // Hash the most recent body so we can compare against whatever we generate
    const recentHashes = await Promise.all(
      recentSends.slice(0, 4).map((r) => md5Hex(r.body || ""))
    );

    const weekOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });
    const seedAngle = SEED_ANGLES[issueNumber % SEED_ANGLES.length];

    const aiPayload = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are Matt Michels, strength coach with 20+ years experience in Grosse Pointe, MI. You write a weekly performance newsletter called "The M² Brief" for athletes, parents, and coaches. Your voice is direct, knowledgeable, no-BS, and genuinely cares about helping youth athletes develop safely. You write in short paragraphs, use real coaching knowledge, and always end with an actionable takeaway.

CRITICAL RULES:
- This week's seed angle: ${seedAngle}. Build the newsletter around this angle.
- Do NOT repeat any of these recent topics: ${recentTopics.length ? recentTopics.map((t) => `"${t}"`).join("; ") : "(none yet)"}.
- Each section must contain SPECIFIC, NEW content — no boilerplate.`,
        },
        {
          role: "user",
          content: `Write this week's M² Brief newsletter for the week of ${weekOf}.

${focus ? `This month's training focus: ${focus.topic} — "${focus.matt_quote}"` : ""}
${challenge ? `Active challenge: ${challenge.title} — ${challenge.description}` : ""}

Structure the newsletter with these exact sections (use ## for headers):

## This Week's Training Truth
[1-2 paragraphs — one specific, actionable training insight tied to the seed angle. Something most coaches don't tell you.]

## The Weekly Drill
[One specific drill or exercise with: name, sets/reps, why it matters for athletes, common mistake to avoid]

## Nutrition for Athletes
[1 paragraph — one practical nutrition tip for youth athletes]

## Matt's Take
[1 paragraph — direct coach commentary tied to the seed angle. Honest perspective.]

## This Week's Challenge Spotlight
[Mention the active challenge, encourage participation, give a tip to do better at it]

Keep it under 450 words total. Write like you're talking to a parent driving their kid to practice. No fluff.`,
        },
      ],
      temperature: 0.85,
      max_tokens: 1100,
    };

    let newsletterBody = "";
    let aiError = "";

    if (LOVABLE_API_KEY) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify(aiPayload),
        });

        if (!aiRes.ok) {
          aiError = `AI gateway returned ${aiRes.status}: ${(await aiRes.text()).slice(0, 400)}`;
        } else {
          const aiData = await aiRes.json();
          newsletterBody = aiData.choices?.[0]?.message?.content?.trim() || "";
          if (!newsletterBody) aiError = "AI gateway returned empty content";
          else log("AI generation succeeded", { len: newsletterBody.length });
        }
      } catch (err) {
        aiError = `AI fetch threw: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      aiError = "LOVABLE_API_KEY not set";
    }

    if (aiError) {
      log("AI generation failed — using rotating fallback bank", { aiError });
      // Log so the autonomous fixer agent picks it up + Matt is alerted
      await logError({
        source: "ai",
        function_name: "sports-newsletter-weekly",
        severity: "error",
        error_message: aiError,
        payload: { issueNumber, weekOf, seedAngle },
      }).catch(() => {});
    }

    if (!newsletterBody) {
      // Rotating fallback bank — use issueNumber so consecutive failures still
      // produce different content. Avoid any slot whose hash matches the most
      // recent send.
      const startIdx = issueNumber % FALLBACK_BANK.length;
      let pickedIdx = startIdx;
      for (let offset = 0; offset < FALLBACK_BANK.length; offset++) {
        const candidateIdx = (startIdx + offset) % FALLBACK_BANK.length;
        const candidateHash = await md5Hex(FALLBACK_BANK[candidateIdx]);
        if (!recentHashes.includes(candidateHash)) {
          pickedIdx = candidateIdx;
          break;
        }
      }
      newsletterBody = FALLBACK_BANK[pickedIdx];
      log("Fallback bank slot picked", { pickedIdx });
    }

    // Hard duplicate guard — refuse to ship the same body twice
    const newHash = await md5Hex(newsletterBody);
    if (recentHashes.includes(newHash)) {
      const dupeMsg = `M² Brief #${issueNumber} blocked: body matches a recent issue. Check sports-newsletter-weekly.`;
      log("Duplicate body detected — blocking send", { newHash });

      await serviceClient.from("newsletter_sends").insert({
        subject: `[BLOCKED-DUPE] M² Brief #${issueNumber} — ${weekOf}`,
        body: newsletterBody,
        recipient_count: 0,
        template_name: `sports_weekly_blocked_dupe_${issueNumber}`,
      });

      await logError({
        source: "edge_function",
        function_name: "sports-newsletter-weekly",
        severity: "critical",
        error_message: dupeMsg,
        payload: { issueNumber, weekOf, newHash, recentHashes },
      }).catch(() => {});

      await sendSMS(ADMIN_PHONE, TWILIO_FROM, dupeMsg, "ops_alert").catch((err) => {
        console.error("[SPORTS-NEWSLETTER] SMS alert failed", err);
      });

      return new Response(JSON.stringify({
        blocked: true,
        reason: "duplicate_body",
        issue: issueNumber,
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = `M² Brief #${issueNumber} — Week of ${weekOf}`;
    const html = buildNewsletterHtml(subject, newsletterBody, issueNumber);

    log("Newsletter generated", { subject, wordCount: newsletterBody.split(/\s+/).length });

    if (dryRun) {
      return new Response(JSON.stringify({
        dry_run: true,
        subject,
        body: newsletterBody,
        html,
        seed_angle: seedAngle,
        ai_error: aiError || null,
        body_hash: newHash,
        recent_hashes: recentHashes,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active subscribers
    const { data: subscribers, error: subErr } = await serviceClient
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true);

    if (subErr) throw subErr;

    const emails = (subscribers || []).map((s: { email: string }) => s.email).filter(Boolean);
    log("Sending to subscribers", { count: emails.length });

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No active subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Issue-number dedup (independent of body hash)
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

    // Batch send via Resend
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
      else log("Batch send error", { status: res.status, text: (await res.text()).slice(0, 200) });

      await new Promise((r) => setTimeout(r, 300));
    }

    await serviceClient.from("newsletter_sends").insert({
      subject,
      body: newsletterBody,
      recipient_count: sentCount,
      template_name: `sports_weekly_${issueNumber}`,
    });

    log("Newsletter sent", { sentCount, issueNumber });

    // Confirmation SMS to Matt — so he sees what shipped without checking inbox
    const previewLine = newsletterBody.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.slice(0, 100) || "";
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_FROM,
      `M² Brief #${issueNumber} sent to ${sentCount} subs.\nSubject: ${subject}\nPreview: ${previewLine}`,
      "ops_alert"
    ).catch((err) => console.error("[SPORTS-NEWSLETTER] confirmation SMS failed", err));

    return new Response(
      JSON.stringify({ sent: sentCount, total: emails.length, issue: issueNumber, subject, body_hash: newHash }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    await logError({
      source: "edge_function",
      function_name: "sports-newsletter-weekly",
      severity: "critical",
      error_message: msg,
    }).catch(() => {});
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
