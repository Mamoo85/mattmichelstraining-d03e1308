// generate-dead-lead-campaign — HBS-level ad campaign generator for Dead Lead Reactivation
// Accepts trade, geography, pain_angle — returns full creative package via Opus 4.7

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { generateWithOpus } from "../_shared/opus.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trade-specific math for ROI anchoring
const TRADE_MATH: Record<string, { contacts: number; reply_rate: number; avg_job: number; unit: string }> = {
  "Roofing":            { contacts: 400, reply_rate: 0.05, avg_job: 12000, unit: "roof" },
  "HVAC":               { contacts: 350, reply_rate: 0.06, avg_job: 4500,  unit: "HVAC job" },
  "Plumbing":           { contacts: 300, reply_rate: 0.06, avg_job: 3800,  unit: "plumbing job" },
  "Electrical":         { contacts: 280, reply_rate: 0.05, avg_job: 5200,  unit: "electrical job" },
  "Solar":              { contacts: 500, reply_rate: 0.04, avg_job: 28000, unit: "solar install" },
  "General Contractor": { contacts: 450, reply_rate: 0.05, avg_job: 18000, unit: "project" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { trade = "Roofing", geography = "Texas", pain_angle = "Money left behind" } = await req.json();

    const m = TRADE_MATH[trade] || TRADE_MATH["Roofing"];
    const replies = Math.round(m.contacts * m.reply_rate);
    const potential = replies * m.avg_job;
    const cost = replies * 50;
    const roi = Math.round(potential / cost);

    const roiMath = `${m.contacts} avg contacts → ${replies} replies (${(m.reply_rate * 100).toFixed(0)}%) → $${potential.toLocaleString()} potential revenue → $${cost.toLocaleString()} cost → ${roi}x ROI`;

    const prompt = `You are a Harvard Business School marketing professor writing a complete ad campaign for a B2B SaaS product called "Dead Lead Reactivation" by Detroit Web Agency.

PRODUCT: We text a contractor's old, unresponsive leads via SMS. The contractor pays $0 unless someone replies. When they reply, the contractor pays $50/reply. The contractor can start for just $1 to test it.

TARGET: ${trade} contractors in ${geography}
PRIMARY PAIN ANGLE: ${pain_angle}
ROI MATH: ${roiMath} (use these exact numbers)

HBS COPYWRITING PRINCIPLES YOU MUST FOLLOW:
1. Lead with money/loss, not features ("$180,000 in your old leads" not "our platform texts your leads")
2. Use specificity over vague claims (exact numbers convert 3x better than ranges)
3. Eliminate risk with performance pricing language ("$0 unless it works", "prove it for $1")
4. Create loss aversion ("your competitor just hired us", "they're buying from someone else")
5. Never use corporate jargon — write like a sharp contractor friend, not a software company
6. The $1 trial is the CTA — not "learn more", not "book a demo"

Generate a complete JSON response with EXACTLY these keys:
{
  "headlines": [array of exactly 5 Facebook/Instagram headline variants, each 40 chars max, A/B testable],
  "bodies": {
    "short": "50-word Facebook ad body — mobile feed — one pain punch + one proof number + one CTA",
    "medium": "150-word Facebook ad body — desktop feed — pain, math, how it works (3 sentences), CTA",
    "long": "300-word Facebook ad body — detailed Facebook post format — story, math proof, objection handling, CTA"
  },
  "instagram_caption": "Instagram caption with hook, 2 proof lines, CTA, and 5 relevant hashtags",
  "targeting_notes": "Plain text targeting notes for Meta Ads Manager: age, interests, behaviors, placements, bid strategy, budget",
  "roi_math": "${roiMath}",
  "postcard_headline": "Single headline for a Lob.com physical postcard — 12 words max — matches the top Facebook headline",
  "email_subject": "Cold email subject line — 8 words max — for follow-up sequence after ad click",
  "email_body": "150-word follow-up email body sent 3 days after ad click if no conversion — plain text, no HTML",
  "podcast_pitch": "3-paragraph guest pitch email to a trades contractor podcast (Owned & Operated, Service MVP, or Successful Contractor) — from Matt Michels — explain why his story about building AI that reactivates dead leads is compelling for their audience",
  "linkedin_post": "LinkedIn post from Matt Michels — 200 words — story about a ${trade} contractor in ${geography} who recovered $X from old leads — professional but personal tone — ends with soft CTA to try it"
}

Output ONLY valid JSON. No markdown, no explanation, no code fences.`;

    const raw = await generateWithOpus(prompt, 1800);

    // Parse the JSON — Opus occasionally wraps in code fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, return structured fallback with the raw text for debugging
      result = {
        headlines: [
          `$${Math.round(potential / 1000)}K in Your Old ${trade} Leads. We'll Prove It for $1.`,
          `Your Competitor Just Hired Us. They're Texting Your Old Leads.`,
          `300 ${trade} Leads. 22 Replied. They Paid $1,100. You Paid $0 to Try.`,
          `That Customer Who Got 3 Quotes and Went Quiet? We Found Them.`,
          `${geography} ${trade} Contractors: Your CRM Is a Gold Mine You Forgot About.`,
        ],
        bodies: {
          short: `You have ~${m.contacts} old ${trade} leads who never said no — they just went quiet. We text all of them. You pay $50 when someone replies. Prove it works for $1. Reply rate averages ${(m.reply_rate * 100).toFixed(0)}%.`,
          medium: raw.slice(0, 600),
          long: raw,
        },
        instagram_caption: `${m.contacts} old ${trade} leads. ${replies} replies on average. $${(replies * m.avg_job).toLocaleString()} in recovered revenue. You pay $50 per reply — $0 if nobody responds. Start for $1. Link in bio. #${trade.replace(" ", "")} #ContractorLife #${geography}Contractors #DeadLeadReactivation #BusinessGrowth`,
        targeting_notes: `Age 35-60, ${geography}, interests: ${trade} associations + contractor magazines, behaviors: small business owners, placements: Facebook + Instagram Feed only, budget: $30/day`,
        roi_math: roiMath,
        postcard_headline: `Your Old ${trade} Leads Are Worth $${Math.round(potential / 1000)}K. We'll Prove It.`,
        email_subject: `Re: the ${trade} leads you stopped following up on`,
        email_body: `Hey,\n\nYou clicked our ad a few days ago but didn't pull the trigger — totally fair.\n\nOne thing worth knowing: the average ${trade} contractor in ${geography} has ${m.contacts} old leads sitting in their CRM. ${(m.reply_rate * 100).toFixed(0)}% of them reply when we text. That's ${replies} real conversations you didn't have.\n\nAt $${m.avg_job.toLocaleString()} average per job, that's $${potential.toLocaleString()} still on the table.\n\nThe $1 offer is real — one reply, we prove it works, then you decide.\n\nWorth a shot? — Matt (313) 992-1219`,
        podcast_pitch: `Hi [Host],\n\nI'm Matt Michels, a Detroit-based developer who built an AI system that texts contractors' old, dead leads and charges $50 only when someone replies.\n\nThe story that would resonate with your audience: a ${geography} ${trade} contractor came to me with 400 old quotes that went cold. We texted all of them. 22 replied. He made $${Math.round(replies * m.avg_job * 0.4).toLocaleString()} in 30 days from leads he'd written off. He paid $1,100.\n\nI'd love to talk about what that means for every contractor sitting on a dead CRM — and how AI outreach is changing the economics of trades sales in 2026.\n\n— Matt Michels, Detroit Web Agency | matt@detroitwebagent.com | (313) 992-1219`,
        linkedin_post: `A ${trade} contractor in ${geography} called me last month, frustrated.\n\nHe'd spent $40K on ads over the past 3 years. Got 400+ leads. Closed maybe 15% of them. The other 340 "just went cold."\n\nI asked him: did you ever follow up after the quote?\n\nHe said he tried calling twice but stopped after no answer.\n\nWe texted all 340 of them.\n\n${replies} replied.\n\nHe made $${Math.round(replies * m.avg_job * 0.4).toLocaleString()} from leads he'd written off as dead.\n\nHe paid $${replies * 50}.\n\nThe math on "dead" leads is almost always wrong. They're not dead — they just need a different channel at a different time.\n\nIf you're a ${trade} contractor with a pile of old quotes, I'll prove this works for $1.\n\nDetails in comments. — Matt`,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
