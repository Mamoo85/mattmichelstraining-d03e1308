import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const { data: roleCheck } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!roleCheck) throw new Error("Admin access required");

    const { quantity = 5, style = "Traditional Strength", equipment = "Full Gym", audience = "Youth Athlete" } = await req.json();

    const systemPrompt = `You are Coach Matt Michels' AI assistant for M² Performance Training. Generate ${quantity} unique daily workouts.

WORKOUT STYLE: ${style}
EQUIPMENT AVAILABLE: ${equipment}
TARGET AUDIENCE: ${audience}

Each workout must be practical, coach-approved quality. Use Matt's direct, motivating voice in descriptions.

STYLE GUIDELINES:
- EMOM: "Every Minute on the Minute" format, 12-20 min, alternating movements
- AMRAP: "As Many Rounds As Possible", 10-20 min, 3-5 movements per round
- HIIT: Work/rest intervals (e.g. 40s on/20s off), 6-10 exercises
- Core Circuit: 6-8 core/stability exercises, 3 rounds
- CrossFit/Metcon: Mixed modality, time-capped or for-time
- Active Recovery: Mobility, foam rolling, light movement, yoga-inspired
- Traditional Strength: Compound lifts with accessories, sets x reps format

EQUIPMENT CONSTRAINTS:
- Full Gym: barbells, dumbbells, kettlebells, pull-up bars, cables, boxes, bands
- Dumbbells/Kettlebells Only: limit to DB/KB movements
- Bodyweight Only: no equipment at all

AUDIENCE:
- Youth Athlete: age-appropriate loading, technique focus, fun/competitive elements
- Adult/Parent Foundation: practical fitness, injury prevention, time-efficient`;

    const userPrompt = `Generate exactly ${quantity} workouts. Each must have a creative title, a 1-2 sentence description in Coach Matt's voice, and a detailed exercises array.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_daily_workouts",
              description: "Create an array of daily workouts",
              parameters: {
                type: "object",
                properties: {
                  workouts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Creative workout name" },
                        description: { type: "string", description: "1-2 sentence description in Coach Matt's voice" },
                        target_audience: { type: "string", enum: ["youth", "adult", "all"] },
                        exercises: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              sets: { type: "number" },
                              reps: { type: "string", description: "Reps, time, or distance (e.g. '12', '30s', '400m')" },
                              notes: { type: "string", description: "Brief coaching cue" },
                            },
                            required: ["name", "reps"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["title", "description", "target_audience", "exercises"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["workouts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_daily_workouts" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway HTTP ${status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured output");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ workouts: parsed.workouts || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-daily-workouts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
