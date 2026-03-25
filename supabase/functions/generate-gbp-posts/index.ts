import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRAINING_PROMPT = `Generate 4 Google Business Profile posts for Matt Michels, a personal trainer in Grosse Pointe Park MI who runs M² Training and built an AI-powered fitness app. Each post: under 300 words, includes a local Metro Detroit keyword naturally, ends with a CTA, sounds like a real person not a corporate brand.
Week 1: strength training tip. Week 2: feature of the AI coaching app. Week 3: a client transformation story (fictional but realistic). Week 4: local community shoutout.
Return ONLY valid JSON — an array of 4 objects, no markdown, no fences:
[{"week":1,"title":"string","body":"string","cta":"string"}]`;

const WEBDESIGN_PROMPT = `Generate 4 Google Business Profile posts for Matt Michels, a local web designer in Grosse Pointe Park MI who builds websites for Metro Detroit trades businesses. Price: $499 to build, $49/month to maintain. He is NOT an agency — just a local guy who also runs a training business.
Each post: under 300 words, local keyword, sounds human and direct.
Week 1: why local businesses lose jobs without a website. Week 2: before/after comparison of a contractor's web presence. Week 3: transparent pricing comparison vs agencies. Week 4: spotlight on a type of local business that needs a website.
Return ONLY valid JSON, no markdown, no fences:
[{"week":1,"title":"string","body":"string","cta":"string"}]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode } = await req.json();
    const systemPrompt = mode === "webdesign" ? WEBDESIGN_PROMPT : TRAINING_PROMPT;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the 4 posts now. Return only the JSON array." },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    // Strip potential markdown fences
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let posts;
    try {
      posts = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON", raw: cleaned }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ posts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-gbp-posts error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
