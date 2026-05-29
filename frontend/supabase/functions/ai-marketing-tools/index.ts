import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { tool, context } = await req.json();

    const systemPrompts: Record<string, string> = {
      social_post: `You are a social media copywriter for M2 Performance Training — a youth and adult athletic training brand run by Coach Matt Michels in Grosse Pointe Park, MI. Create engaging social media posts.
Rules:
- Write for Instagram/Facebook audiences (parents of athletes, athletes, coaches)
- Include relevant hashtags (5-8)
- Keep captions under 2200 characters
- Use the brand voice: confident, direct, results-driven, community-focused
- Reference real training concepts (not generic fitness fluff)
- Include a CTA when appropriate
- Output format: Caption text followed by a "---" separator then a "HASHTAGS:" section`,

      testimonial: `You are a copywriter for M2 Performance Training. Generate a realistic testimonial draft based on the athlete data provided.
Rules:
- Write in first person from the athlete/parent perspective
- Reference specific improvements (PRs, attendance, skills)
- Keep it authentic — not overly polished
- 3-5 sentences
- Include the athlete's first name if provided
- Mark it clearly as "AI-DRAFTED — NEEDS ATHLETE/PARENT APPROVAL"`,

      blog_seo: `You are an SEO content writer for M2 Performance Training's Learn Hub. Write training-focused articles optimized for search.
Rules:
- Target youth sports and athletic development keywords
- Include a compelling H1 title (under 60 chars)
- Write a meta description (under 160 chars)
- Structure with H2/H3 subheadings
- 800-1200 words
- Include internal CTAs to the platform
- Write in Coach Matt's authoritative but approachable voice
- Focus on education, not sales`,

      email_subjects: `You are an email marketing specialist for M2 Performance Training. Generate subject line variants for A/B testing.
Rules:
- Generate exactly 5 subject line options
- Each under 50 characters
- Mix styles: curiosity, urgency, benefit-driven, personal, question
- Label each with its style type
- Consider mobile preview (first 30 chars most important)
- No clickbait — deliver on the promise`,

      landing_copy: `You are a conversion copywriter for M2 Performance Training. Generate landing page copy for a specific audience segment.
Rules:
- Write hero headline (under 10 words), subheadline (1-2 sentences), and 3 value propositions
- Include a primary CTA and secondary CTA
- Tailor language to the target audience (parents, athletes, coaches)
- Emphasize outcomes over features
- Use social proof angles
- Keep it scannable — short paragraphs, bold key phrases`,

      faq: `You are a content strategist for M2 Performance Training. Generate FAQ entries based on common questions.
Rules:
- Generate 5-8 Q&A pairs
- Cover pricing, training approach, age requirements, results timeline, safety
- Answers should be concise (2-3 sentences each)
- Write in Coach Matt's voice
- Address objections naturally
- Include specifics when possible (e.g., "athletes ages 10-18")`,
    };

    const systemPrompt = systemPrompts[tool];
    if (!systemPrompt) throw new Error(`Unknown tool: ${tool}`);

    const userPrompt = buildUserPrompt(tool, context);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits needed — add funds in Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || {};

    return new Response(JSON.stringify({ result, tool, usage: { prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0, total_tokens: usage.total_tokens || 0, model: data.model || "google/gemini-3-flash-preview" } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-marketing-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildUserPrompt(tool: string, ctx: Record<string, any>): string {
  switch (tool) {
    case "social_post":
      return `Create a ${ctx.platform || "Instagram"} post about: ${ctx.topic || "training results"}.
Target audience: ${ctx.audience || "parents of youth athletes"}.
Tone: ${ctx.tone || "motivational"}.
${ctx.includeStats ? `Include these stats/results: ${ctx.includeStats}` : ""}`;

    case "testimonial":
      return `Draft a testimonial for athlete: ${ctx.athleteName || "an athlete"}.
Sport: ${ctx.sport || "general training"}.
Key improvements: ${ctx.improvements || "strength gains, better movement quality"}.
Training duration: ${ctx.duration || "6 months"}.
${ctx.prs ? `Recent PRs: ${ctx.prs}` : ""}`;

    case "blog_seo":
      return `Write an SEO article about: ${ctx.topic || "youth athletic development"}.
Primary keyword: ${ctx.keyword || ctx.topic || "youth training"}.
Target audience: ${ctx.audience || "parents and young athletes"}.
${ctx.outline ? `Follow this outline: ${ctx.outline}` : ""}`;

    case "email_subjects":
      return `Generate subject lines for an email about: ${ctx.topic || "new training program"}.
Email type: ${ctx.emailType || "promotional"}.
Target audience: ${ctx.audience || "current subscribers"}.
${ctx.urgency ? `Urgency level: ${ctx.urgency}` : ""}`;

    case "landing_copy":
      return `Write landing page copy for: ${ctx.page || "membership signup"}.
Target audience: ${ctx.audience || "parents of athletes ages 10-18"}.
Key offer: ${ctx.offer || "14-day free trial"}.
Differentiator: ${ctx.differentiator || "20+ years experience, zero injuries"}.`;

    case "faq":
      return `Generate FAQ content for: ${ctx.page || "the pricing page"}.
Common objections: ${ctx.objections || "price, time commitment, results timeline"}.
${ctx.existingFaqs ? `Don't repeat these existing FAQs: ${ctx.existingFaqs}` : ""}`;

    default:
      return JSON.stringify(ctx);
  }
}
