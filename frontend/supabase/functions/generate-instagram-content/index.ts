import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string | ((inputs: any) => string)> = {
  authority: `You are Matt Michels, a strength coach with 20 years experience in Grosse Pointe MI. Write an Instagram caption that teaches ONE specific strength training principle that most people get wrong. Start with a bold statement that stops the scroll. Use short punchy sentences. End with: 'Full programming in the M² app. Link in bio.' Add 10 relevant hashtags at the end including #grossepointetrainer #strengthcoach #m2training. Do NOT use emojis except 1-2 max.`,

  client_win: (inputs: any) =>
    `Write a brief Instagram post celebrating a client PR. Client type: ${inputs.clientType || "Youth"}. Exercise: ${inputs.exercise || "Squat"}. Went from ${inputs.before || "135lbs"} to ${inputs.after || "225lbs"} in ${inputs.weeks || "8"} weeks. Keep it factual and coach-voiced, not hype-y. End with a subtle CTA to DM or try the app. Include 8 hashtags.`,

  youth_athlete: `Write an Instagram post targeting parents of high school athletes in Metro Detroit / Grosse Pointe. The post should address one common parent concern about youth strength training and position Matt Michels as the trusted expert. Include #grossepointesports #youthathlete #michiganathletes and 7 other relevant hashtags.`,

  app_feature: (inputs: any) =>
    `Write an Instagram post showcasing the ${inputs.featureName || "AI Generator"} of the M² Training app. Focus on the problem it solves, not the feature itself. Keep it under 150 words. End with '14-day free trial. Link in bio.' Include 8 hashtags including #fitnessapp #onlinecoaching.`,

  studio_community: `Write a casual, behind-the-scenes Instagram caption for a strength training studio in Grosse Pointe Park MI. Mention the community feel, the professional equipment, and subtly mention that trainer rentals are available. Keep it under 100 words. Human, not corporate. Include 6 hashtags.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content_type, inputs } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const promptDef = SYSTEM_PROMPTS[content_type];
    if (!promptDef) throw new Error("Invalid content_type: " + content_type);

    const systemPrompt = typeof promptDef === "function" ? promptDef(inputs || {}) : promptDef;

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
          { role: "user", content: "Generate the Instagram caption now." },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const fullText = data.choices?.[0]?.message?.content || "";

    // Split caption from hashtags
    const hashtagMatch = fullText.match(/(#\w+[\s]*)+$/);
    const hashtags = hashtagMatch ? hashtagMatch[0].trim() : "";
    const caption = hashtags ? fullText.replace(hashtags, "").trim() : fullText.trim();

    return new Response(JSON.stringify({ caption, hashtags }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-instagram-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
