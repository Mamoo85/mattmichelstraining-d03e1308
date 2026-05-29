import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a data extractor for a fitness workout logger. Parse the user's raw text and extract structured set data. ALL output must be in American English only. Never use any other language for exercise names. The user may log one or multiple sets in a single message. Common patterns: '225 for 8', 'bench 225x8', 'squat 315 5 reps RPE 9', 'set 1 185 for 10, set 2 205 for 8'.",
          },
          { role: "user", content: text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_sets",
              description: "Extract structured workout set data from free-form text.",
              parameters: {
                type: "object",
                properties: {
                  sets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        exercise_name: {
                          type: "string",
                          description:
                            "Name of the exercise if mentioned (e.g. 'Bench Press', 'Squat'). Use empty string if not mentioned.",
                        },
                        weight_lbs: {
                          type: "number",
                          description: "Weight in pounds. 0 if not mentioned.",
                        },
                        reps: {
                          type: "number",
                          description: "Number of reps. 0 if not mentioned.",
                        },
                        rpe: {
                          type: "number",
                          description: "Rate of perceived exertion (1-10). Use 0 if not mentioned.",
                        },
                      },
                      required: ["exercise_name", "weight_lbs", "reps", "rpe"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["sets"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_sets" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-workout-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
