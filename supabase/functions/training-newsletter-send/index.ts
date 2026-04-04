// Training Newsletter Send — M2 Development
// Monthly newsletter for gym clients: high schoolers, college athletes, moms, dads
// Supports two AI providers: "anthropic" (now via Lovable gateway with different model) or "lovable" (Gemini via Lovable gateway)
// POST with { provider: "anthropic"|"lovable", topic?: string, preview_only?: true, custom_content?: string }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MATT_SYSTEM_PROMPT = `You write the monthly training newsletter for M2 Development. Your author is Matt Michels — Grosse Pointe, MI. 10+ years B2B field sales, now running a performance training business.

AUDIENCE: High schoolers, college athletes, moms, dads. NOT professional athletes. Real people who want to do this right.

MATT'S VOICE:
- Direct. No warmup. No fluff. Say the thing.
- Raw truth. Says what most coaches won't.
- Short punchy sentences. Occasional fragments for emphasis.
- Michigan local. Not coastal. Not fancy.
- Earned authority — confidence from 10+ years of reps, not a certification wall.
- Never uses: "journey", "transform", "unlock your potential", "amazing"
- No exclamation points unless he'd actually say it that way.

MATT'S TRAINING PHILOSOPHY (always reflected in content):
- Nobody's perfect and that's OK. But some mistakes cost you 20 years.
- Instagram is a lie. Mirror muscles ≠ fitness. Core stability = fitness.
- Progressive overload works 100% of the time. Add weight, add reps, be consistent. It's physics.
- Exercise + sleep tied as the #1 health hack. Not supplements. Not smoothies. Move correctly. Sleep 7-8 hours.
- Most people are doing it wrong. Too much, too little, or the wrong exercises.
- The main lifts (squat, hinge, push, pull, carry) — if you're doing these, you're covered. The rest barely matters.
- Skip the basics and only do curls and bench? Better than nothing. But in 20 years: bad knees, aching back, wrecked shoulders. All that time wasted.
- He has never met a single person without a coach who was actually doing it right.
- He always teases "next month we talk about foam rolling" — include this tease at the end.`;

const MONTHLY_TOPICS = [
  "progressive overload — the only thing that actually works",
  "core stability vs mirror muscles — why Instagram is lying to you",
  "the main lifts and why nothing else matters as much",
  "sleep: the free performance drug everyone ignores",
  "why most people are doing too much (and destroying themselves)",
  "why most people are doing too little (and wondering why nothing changes)",
  "the squat — most important movement you're probably doing wrong",
  "what a real warm-up looks like vs what you see at Planet Fitness",
  "foam rolling — the power of 10 minutes you're skipping",
  "the hinge — deadlifts, RDLs, and why your back pain starts here",
  "protein: how much you actually need (hint: less than the gym bros say)",
  "training for high schoolers — what matters, what doesn't",
];

interface NewsletterContent {
  subject: string;
  preview_text: string;
  headline: string;
  opening: string;
  body: string;
  truth_of_the_month: string;
  cta_text: string;
  next_month_tease: string;
}

const JSON_PROMPT_SUFFIX = `

Return JSON with these fields:
- subject: email subject (punchy, under 55 chars, no hype)
- preview_text: one-line preview under 90 chars
- headline: the main article headline
- opening: 2-3 sentence opener that hooks immediately
- body: 3-4 paragraphs of the main content (Matt's raw truth)
- truth_of_the_month: one bold truth statement, 1-2 sentences max
- cta_text: call to action (direct, specific, not generic)
- next_month_tease: always ends with something about foam rolling next month`;

async function generateWithGateway(model: string, topic: string, customContent?: string): Promise<NewsletterContent> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

  const userPrompt = customContent
    ? `Matt just wrote this raw newsletter draft. Enhance it into a full newsletter while keeping 100% of his voice, opinions, and specific points. Do NOT water it down. Make it punchy and direct. Here's his draft:\n\n${customContent}`
    : `Write this month's M² training newsletter covering: "${topic}". Make it feel like Matt sat down and just wrote it — raw, direct, real.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: "system",
        content: MATT_SYSTEM_PROMPT,
      }, {
        role: "user",
        content: userPrompt + JSON_PROMPT_SUFFIX,
      }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI gateway error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch?.[0] || raw);
}

// "Claude" side now uses GPT-5 via gateway; "Lovable" side uses Gemini
async function generateWithAnthropic(topic: string, customContent?: string): Promise<NewsletterContent> {
  return generateWithGateway("openai/gpt-5-mini", topic, customContent);
}

async function generateWithLovable(topic: string, customContent?: string): Promise<NewsletterContent> {
  return generateWithGateway("google/gemini-2.5-flash-lite", topic, customContent);
}

function buildEmailHtml(content: NewsletterContent, issueNum: number, dateStr: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

  <!-- Header -->
  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M2 Development</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Issue #${issueNum} · ${dateStr} · Real Training. Real Results.</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#fff;padding:28px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <!-- Headline -->
    <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin:0 0 16px;line-height:1.3;">${content.headline}</h2>

    <!-- Opening -->
    <p style="font-size:16px;color:#334155;line-height:1.8;margin:0 0 20px;font-style:italic;border-left:3px solid #e8621a;padding-left:16px;">${content.opening}</p>

    <!-- Body -->
    <div style="font-size:15px;color:#334155;line-height:1.9;margin:0 0 24px;">
      ${content.body.split("\n\n").map(p => `<p style="margin:0 0 16px;">${p}</p>`).join("")}
    </div>

    <!-- Truth of the Month -->
    <div style="background:#1e293b;padding:20px 24px;border-radius:8px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#e8621a;text-transform:uppercase;">Truth of the Month</p>
      <p style="margin:0;font-size:16px;color:#f1f5f9;line-height:1.7;font-weight:600;">${content.truth_of_the_month}</p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:0 0 24px;">
      <a href="https://www.mattmichelstraining.com" style="display:inline-block;background:#e8621a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;">${content.cta_text}</a>
    </div>

    <!-- Next Month Tease -->
    <div style="background:#f1f5f9;padding:14px 18px;border-radius:6px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.7;font-style:italic;">${content.next_month_tease}</p>
    </div>

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:13px;color:#64748b;line-height:1.7;">Questions? Reply to this email or text Matt directly at <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>

  </td></tr>

  <!-- Signature -->
  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M2 Development · Grosse Pointe, MI<br><span style="color:#64748b;">(313) 806-4952</span></div>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;font-size:12px;color:#94a3b8;line-height:1.6;">
    M2 Development · <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;">matt@mattmichelstraining.com</a><br>
    <a href="${SUPABASE_URL}/functions/v1/newsletter-unsubscribe?token={{unsubscribe_token}}" style="color:#94a3b8;">Unsubscribe</a>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json")
      ? await req.json().catch(() => ({}))
      : {};

    const provider: "anthropic" | "lovable" = body?.provider === "lovable" ? "lovable" : "anthropic";
    const previewOnly: boolean = body?.preview_only === true;
    const compareMode: boolean = body?.compare === true;
    const customContent: string | undefined = body?.custom_content;

    const monthIndex = new Date().getMonth();
    const topic = body?.topic || MONTHLY_TOPICS[monthIndex % MONTHLY_TOPICS.length];

    const issueNum = (Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000)) % 120) + 1;
    const dateStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Compare mode: generate both and return without sending
    if (compareMode) {
      const [anthropicResult, lovableResult] = await Promise.allSettled([
        generateWithAnthropic(topic, customContent),
        generateWithLovable(topic, customContent),
      ]);

      return new Response(JSON.stringify({
        topic,
        anthropic: anthropicResult.status === "fulfilled"
          ? { content: anthropicResult.value, html: buildEmailHtml(anthropicResult.value, issueNum, dateStr) }
          : { error: (anthropicResult.reason as Error).message },
        lovable: lovableResult.status === "fulfilled"
          ? { content: lovableResult.value, html: buildEmailHtml(lovableResult.value, issueNum, dateStr) }
          : { error: (lovableResult.reason as Error).message },
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Single provider generation
    const content = provider === "lovable"
      ? await generateWithLovable(topic, customContent)
      : await generateWithAnthropic(topic, customContent);

    const html = buildEmailHtml(content, issueNum, dateStr);

    // Save draft
    const { data: draft } = await sb
      .from("training_newsletter_sends")
      .insert({
        subject: content.subject,
        content_html: html,
        preview_text: content.preview_text,
        topic,
        provider,
        status: "draft",
        scheduled_for: new Date().toISOString(),
      })
      .select()
      .single();

    if (previewOnly) {
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Training <matt@mattmichelstraining.com>",
            to: ["matt@mattmichelstraining.com"],
            subject: `[PREVIEW — ${provider.toUpperCase()}] ${content.subject}`,
            html: html.replace("{{unsubscribe_token}}", "preview"),
          }),
        });
      }
      return new Response(JSON.stringify({ draft_id: draft?.id, preview_sent: true, provider, content }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Fetch training newsletter subscribers
    const { data: subscribers } = await sb
      .from("newsletter_subscribers")
      .select("email, name, unsubscribe_token")
      .eq("active", true)
      .or("source.is.null,source.not.ilike.waitlist_%,source.eq.training_newsletter");

    if (!subscribers || subscribers.length === 0) {
      console.log("[TRAINING-NEWSLETTER] No subscribers — saving draft only");
      return new Response(JSON.stringify({ sent: 0, draft_id: draft?.id }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

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
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [sub.email],
              subject: content.subject,
              html: html.replace("{{unsubscribe_token}}", sub.unsubscribe_token || ""),
            }),
          })
        )
      );
      sent += batch.length;
    }

    if (draft) {
      await sb.from("training_newsletter_sends")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: sent })
        .eq("id", draft.id);
    }

    console.log(`[TRAINING-NEWSLETTER] Sent to ${sent} subscribers via ${provider} — "${content.subject}"`);
    return new Response(JSON.stringify({ sent, subject: content.subject, provider }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[TRAINING-NEWSLETTER]", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
