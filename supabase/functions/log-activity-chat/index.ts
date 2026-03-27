import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Coach Matt's AI training assistant. Your job is to help athletes quickly log non-lift workouts via natural conversation.

RULES:
1. When the user describes an activity, classify it into one of: endurance, cardio, power, strength, mobility, mixed.
2. You need TWO pieces of info at minimum: what they did + intensity. Duration is nice to have.
3. IMPORTANT: If the user already mentions intensity words (hard, easy, tough, light, moderate, crushed it, killed it, brutal, chill, etc.), do NOT ask about intensity again. Map their words:
   - "hard", "tough", "brutal", "killed it", "crushed it", "intense", "really hard" → hard
   - "easy", "light", "chill", "relaxed", "recovery" → easy  
   - "moderate", "medium", "decent", "solid", "good" → moderate
   - "all-out", "max effort", "PR attempt" → max
4. If the user already mentions duration or time (e.g. "30 minute run", "about an hour"), do NOT ask about duration again.
5. If intensity is unclear, ask ONE question: "How hard was that?" (the UI will show Easy/Moderate/Hard buttons).
6. If duration is unclear after intensity is known, ask ONE question: "How long did that take?" (the UI will show 20/30/45/60+ min buttons).
7. MAXIMUM of 2 follow-up questions total. After that, generate the summary with whatever info you have.
8. Keep follow-ups very short — one sentence max.
9. When you have enough info (activity + intensity at minimum), respond with a JSON block wrapped in \`\`\`json ... \`\`\` containing:
   {
     "ready": true,
     "summary": {
       "description": "brief summary of what they did",
       "activity_type": "endurance|cardio|power|strength|mobility|mixed",
       "intensity": "easy|moderate|hard|max",
       "weight_level": "none|light|medium|heavy" or null,
       "duration_minutes": number or null,
       "exercises_mentioned": ["exercise1", "exercise2"],
       "ai_summary": "one-line coaching note",
       "ai_recovery_tips": "brief recovery recommendation"
     }
   }
10. Always be encouraging but brief. Sound like a real coach, not a robot.
11. If the user says something unrelated, gently redirect to logging their workout.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed — please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("log-activity-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
