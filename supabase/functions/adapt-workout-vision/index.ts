import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Auth failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, workout } = await req.json();
    if (!imageBase64) throw new Error("No image provided");
    if (!workout || !Array.isArray(workout)) throw new Error("No workout exercises provided");

    const systemPrompt = `You are an elite strength & conditioning coach. You will receive:
1. A photo of a gym environment
2. A JSON array of exercises the athlete planned to do

BANNED EXERCISES — Coach Matt NEVER programs these. Do NOT suggest as substitutes:
- Barbell Bent Over Row (any variation). Use Dumbbell Rows, Chest-Supported Rows, Cable Rows, or Seal Rows instead.
- ALL bodybuilding isolation exercises (curls, kickbacks, lateral raises, leg extensions, machine flyes, etc.) and machine-based isolation work.
- Substitute with compound movements only: chin-ups, dips, DB rows, lunges, RDLs, push-ups, carries. Conditioning = burpees, box jumps, KB swings, sled work, sprints.

Your job:
- Analyze the image and identify ALL available gym equipment visible
- Compare against the exercises in the workout
- For any exercise that requires equipment NOT visible in the image, swap it with a biomechanically equivalent exercise using ONLY equipment you can see
- Maintain the original intended stimulus (muscle groups, movement pattern, rep scheme)
- Keep exercises that CAN be done with visible equipment unchanged
- If you cannot identify specific equipment, err on the side of bodyweight/minimal equipment alternatives

Return the adapted workout using the provided tool.`;

    const userContent = [
      {
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
      },
      {
        type: "text",
        text: `Here is the current workout plan:\n\n${JSON.stringify(workout, null, 2)}\n\nAnalyze the gym equipment visible in the photo and adapt any exercises that cannot be performed with the available equipment.`,
      },
    ];

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
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "deliver_adapted_workout",
            description: "Return the adapted workout exercises",
            parameters: {
              type: "object",
              properties: {
                equipment_detected: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of equipment visible in the image",
                },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      original_title: { type: "string" },
                      adapted_title: { type: "string" },
                      was_swapped: { type: "boolean" },
                      swap_reason: { type: "string" },
                      sets: { type: "number" },
                      reps: { type: "number" },
                      notes: { type: "string" },
                    },
                    required: ["original_title", "adapted_title", "was_swapped", "sets", "reps"],
                  },
                },
                summary: { type: "string", description: "Brief summary of changes made" },
              },
              required: ["equipment_detected", "exercises", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "deliver_adapted_workout" } },
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
    let result: Record<string, unknown> = {};
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        const content = data.choices?.[0]?.message?.content || "";
        try { result = JSON.parse(content); } catch { result = { error: "Failed to parse AI response" }; }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("adapt-workout-vision error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
