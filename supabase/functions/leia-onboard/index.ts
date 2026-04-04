// PRINCESS LEIA — New Subscriber Onboarding
// Runs daily at 9am ET. Finds new subscribers who haven't gotten their
// welcome sequence yet and sends the right email for where they are in the journey.
//
// Step 0 (immediate): "You're in. Here's what happens next."
// Step 1 (day 2): Quick win tip specific to their product
// Step 2 (day 7): Check-in + "here's what the best customers do"
// Step 3 (day 14): Ask for a referral / leave a review
//
// Leia knows that the first 14 days determine whether someone stays forever
// or churns at month 2. Onboarding isn't about being nice — it's about
// making them successful fast so they never want to cancel.
//
// Enhanced:
//   - Product-specific content for each subscription type
//   - Step 2 includes a "pro tip" that makes them feel smart for subscribing
//   - Step 3 asks for referrals (most businesses never ask)
//   - Creates onboarding record for new subscriptions automatically

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MATT = "matt@mattmichelstraining.com";

// Matt's own test emails — skip onboarding sequences for these
const TEST_EMAILS = ["matt@mattmichelstraining.com", "matthewmichels@gmail.com", "matthewmichels4@gmail.com"];

interface StepContent { subject: string; body: string; cta_text?: string; cta_url?: string }

const ONBOARDING_CONTENT: Record<string, Record<number, StepContent>> = {
  gbp_saas: {
    0: {
      subject: "You're set up — here's what happens next",
      body: `You're now on M² GBP automation. Starting Monday, Wednesday, and Friday, Google Business Profile posts go out for your business automatically.\n\nYou don't have to do a single thing. It just runs.\n\nIf anything looks off in the first week, reply here or text me directly at (313) 806-4952. I'll fix it.`,
      cta_text: "See Your Google Profile →",
      cta_url: "https://www.google.com/maps",
    },
    1: {
      subject: "Your first posts are scheduled",
      body: `Your first Google posts are queued and ready to go.\n\nOne thing most businesses don't know: Google weighs recency heavily. A business that posted 3 days ago shows up higher than one that posted 3 months ago — even with fewer reviews. That's exactly what we're fixing for you.\n\nYou'll start seeing the difference in profile views within 2-3 weeks.`,
    },
    2: {
      subject: "How our best GBP clients get the most out of this",
      body: `One thing I've noticed with the businesses seeing the best results: they add photos. Our AI writes the posts — but businesses that also add 2-3 new photos per month to their Google profile see 2x the engagement.\n\nYou can add photos directly in Google Maps on your phone. Takes 2 minutes. Not required — but it compounds what we're already doing for you.`,
    },
    3: {
      subject: "Quick favor — and a thank you",
      body: `You've been with us for two weeks. Appreciate it.\n\nIf this has been useful — and I hope it has — the best thing you can do for me is mention it to another local business you know. Word of mouth is still how I grow this.\n\nAnd if anything at all isn't working the way you expected, reply here. I'd rather know and fix it than lose you.`,
    },
  },
  social_media_ai: {
    0: {
      subject: "Social media is handled — here's what to expect",
      body: `You're on M² Social Media AI. Three posts per week — Facebook, Instagram, LinkedIn — written in your brand voice and posted automatically.\n\nFirst posts go live within 48 hours. You'll get a preview email before we go live the first time so you can confirm the voice is right.\n\nAny changes to tone or focus — just reply here. We'll dial it in.`,
      cta_text: "See Pricing Details →",
      cta_url: "https://www.mattmichelstraining.com/social-media-ai",
    },
    1: {
      subject: "Your first posts are live (or scheduled)",
      body: `Your first social posts should be live or scheduled. Check your pages and make sure the voice feels right.\n\nIf anything sounds off, reply here with a note on what to change. The first week is the calibration period — the more feedback you give me now, the better everything runs going forward.\n\nIf it looks great — then we're done. It just runs from here.`,
    },
    2: {
      subject: "The one thing that separates growing accounts from stagnant ones",
      body: `Consistency wins on social. That's the whole game.\n\nMost businesses post 3 times, get busy, disappear for 6 weeks, post once, disappear again. The algorithm punishes this. We're fixing that permanently for you.\n\nThe pro move: when you see a post go live, spend 60 seconds engaging with it from your personal profile. Comment, share it to your story. That first-hour engagement tells the algorithm "this matters" and it pushes it further. Takes a minute, doubles the reach.`,
    },
    3: {
      subject: "Two weeks in — any feedback?",
      body: `You've been with us for two weeks. I want to make sure it's earning its keep.\n\nIf there's a direction you want to go with the content — more education, more promotion, more behind-the-scenes — just tell me. We can pivot anytime.\n\nAnd if you know another business owner who'd benefit from this, I'd love an introduction.`,
    },
  },
  field_rep_tools: {
    0: {
      subject: "Your AI sales tools are live",
      body: `You're in. Your M² Field Rep AI tools are active — cold email writer, voicemail script generator, objection handler, and prospecting assistant.\n\nAll powered by Claude AI. All built for reps who hate fluff and need things that actually work.\n\nStart with the cold email writer. Put in a target business type, your product, and watch it generate 5 variations in 30 seconds. Pick one, tweak it, send it.`,
      cta_text: "Open Your Tools →",
      cta_url: "https://www.mattmichelstraining.com/field-rep-tools",
    },
    1: {
      subject: "The tool our reps use most (and why)",
      body: `The objection handler gets used more than anything else.\n\nPut in a common objection — "we're happy with our current vendor", "now's not a good time", "send me some information" — and it gives you 3 word-for-word responses. Different angles. You pick the one that fits your style.\n\nMost reps practice objections for years and still freeze. This ends that. Try it this week on the objection you hate most.`,
    },
    2: {
      subject: "How to get 10x more out of these tools",
      body: `The reps who get the most out of this tool do one thing differently: they use it before every call block, not after they already blew the call.\n\n5 minutes before you start dialing — pull up the prospecting assistant, put in your territory and product, and get a list of angles to use today. It takes the mental load off and lets you focus on the conversation.\n\nAlso: the voicemail script generator + the email follow-up is a killer combo. Leave the voicemail, send the email 2 minutes later referencing it. Open rates double.`,
    },
    3: {
      subject: "Who else on your team should have this?",
      body: `Two weeks in — hope it's been useful.\n\nIf you're on a team, this costs $29/mo per rep. If there's 3 of you, that's less than one lost deal a year to cover it.\n\nI'll give you a referral link that gives your teammate 30 days free. Just reply and I'll send it over.\n\n— Matt`,
    },
  },
  // Default for any product not listed above
  default: {
    0: {
      subject: "You're set up with M²",
      body: `You're in. Everything is set up on our end and running.\n\nIf anything isn't working the way you expected in the first 48 hours, reply here or text me at (313) 806-4952. I respond fast.\n\nAppreciate the business.`,
    },
    1: {
      subject: "Quick check-in — everything running?",
      body: `Just checking in to make sure everything's working the way it should.\n\nIf you have any questions or want to make any changes, just reply here. That goes directly to me.`,
    },
    2: {
      subject: "Getting the most out of your M² subscription",
      body: `Wanted to share one thing that our best customers do consistently: they reply to these emails. Seriously.\n\nEvery time someone tells me "here's what I'd love to see", I actually change it. That's the advantage of being a small operation — when you talk, it moves.\n\nWhat would make this more valuable for you?`,
    },
    3: {
      subject: "Two weeks in — thank you",
      body: `You've been a customer for two weeks. Appreciate it.\n\nIf this has been useful, the best thing you can do for me is tell someone else about it. Word of mouth is everything for a small business.\n\nAnd if anything at all isn't working — tell me. I'd rather fix it than lose you.`,
    },
  },
};

const STEP_DELAYS = [0, 2, 7, 14]; // days after signup

function getStepContent(product: string, step: number): StepContent | null {
  const productContent = ONBOARDING_CONTENT[product] || ONBOARDING_CONTENT["default"];
  return productContent[step] || null;
}

function buildOnboardingEmail(content: StepContent, product: string): string {
  const ctaHtml = content.cta_text && content.cta_url ? `
    <div style="text-align:center;margin:20px 0;">
      <a href="${content.cta_url}" style="display:inline-block;background:#e8621a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;font-size:14px;">${content.cta_text}</a>
    </div>` : "";

  return `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
  <tr><td style="background:#1e293b;padding:14px 24px;border-radius:8px 8px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">M2 Development</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    ${content.body.split("\n\n").map(p => `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.8;">${p.replace(/\n/g, "<br>")}</p>`).join("")}
    ${ctaHtml}
    <hr style="border:1px solid #e2e8f0;margin:20px 0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a></div>
    </div>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:10px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;font-size:11px;color:#94a3b8;">
    M2 Development · Reply to this email to reach Matt directly.
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json") ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dry_run === true;

    // First: seed new subscribers into onboarding if they don't have a sequence yet
    // Check each subscription table for recent signups
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const subTables: [string, string][] = [
      ["gbp_saas_clients", "gbp_saas"],
      ["social_media_clients", "social_media_ai"],
      ["b2b_subscribers", "field_rep_tools"],
    ];

    for (const [table, product] of subTables) {
      try {
        const { data: newSubs } = await sb.from(table).select("email").gte("created_at", oneDayAgo).limit(50);
        for (const sub of newSubs || []) {
          if (!sub.email || TEST_EMAILS.includes(sub.email)) continue; // skip test accounts
          const { count } = await sb.from("onboarding_sequences").select("*", { count: "exact", head: true }).eq("email", sub.email).eq("product", product);
          if (!count) {
            await sb.from("onboarding_sequences").insert({ email: sub.email, product, current_step: 0, status: "active" });
          }
        }
      } catch { /* table may not exist or have different schema */ }
    }

    // Now: send emails for sequences that are due
    let sent = 0;
    const results: { email: string; product: string; step: number }[] = [];

    for (let step = 0; step <= 3; step++) {
      const daysDelay = STEP_DELAYS[step];
      const targetDate = new Date(Date.now() - daysDelay * 24 * 60 * 60 * 1000);
      const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

      const { data: sequences } = await sb
        .from("onboarding_sequences")
        .select("id, email, product, current_step")
        .eq("current_step", step)
        .eq("status", "active")
        .gte("created_at", dayStart.toISOString())
        .lte("created_at", dayEnd.toISOString())
        .limit(30);

      for (const seq of sequences || []) {
        if (sent >= 50) break;
        const content = getStepContent(seq.product, seq.step || step);
        if (!content) continue;

        const html = buildOnboardingEmail(content, seq.product);

        if (!dryRun && RESEND_API_KEY) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: `Matt Michels <${MATT}>`, to: [seq.email], subject: content.subject, html }),
          });
          if (res.ok) {
            const nextStep = step < 3 ? step + 1 : step;
            const newStatus = step >= 3 ? "completed" : "active";
            await sb.from("onboarding_sequences").update({ current_step: nextStep, status: newStatus, last_sent_at: new Date().toISOString() }).eq("id", seq.id);
          }
        }

        results.push({ email: seq.email, product: seq.product, step });
        sent++;
        await new Promise(r => setTimeout(r, 150));
      }
    }

    console.log(`[LEIA] Sent ${sent} onboarding emails (${dryRun ? "DRY RUN" : "LIVE"})`);
    return new Response(JSON.stringify({ sent, dry_run: dryRun, results }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[LEIA]", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
