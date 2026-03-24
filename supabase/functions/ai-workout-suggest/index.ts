import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildOpenWorkoutPrompt(userPrompt: string, exerciseNames: string) {
  return `You are Coach Matt — a strength and conditioning coach who follows Starting Strength (Rippetoe) and Becoming a Supple Leopard (Starrett) principles ONLY.

You are doing a quick pre-workout check-in, just like you would in person. The athlete has told you how they feel today. Your job:

1. LISTEN to what they said — if something hurts or is tight, INCLUDE corrective work (rolling, mobility) at the start of the workout.
2. Build a SINGLE training session (not a program) tailored to right now.
3. The workout should follow this flow:
   - Phase 1: Rolling/Soft Tissue (if needed based on their check-in)
   - Phase 2: Dynamic Warmup / Mobility
   - Phase 3: Main Work (compound movements)
   - Phase 4: Finisher / Conditioning
   - Phase 5: Cooldown
4. Keep it to 6-10 exercises total across all phases.
5. If they mention time constraints, respect them.

RULES:
- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes
- Focus on compound movements: squat, deadlift, press, bench press, power clean, rows
- If they mention pain/tightness, address it with corrective work FIRST
- Infer experience level, goals, and equipment from their message
- Default to barbell + rack + dumbbells if not mentioned

ATHLETE CHECK-IN: "${userPrompt}"

AVAILABLE EXERCISES (use these exact names when possible):
${exerciseNames}

Return a JSON object with this exact structure:
{
  "title": "workout name",
  "description": "one sentence overview addressing their check-in",
  "exercises": [
    { "title": "exact exercise name from library", "sets": "3", "reps": "10", "notes": "brief coaching cue" }
  ]
}

Make it feel personal — like Coach Matt actually heard them and built this just for them.`;
}

function buildStructuredPrompt(goal: string, audience: string, style: string, exerciseNames: string) {
  return `You are Coach Matt's workout builder assistant. You follow Starting Strength (Rippetoe) and Becoming a Supple Leopard (Starrett) principles ONLY.

RULES:
- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes
- Focus on compound movements: squat, deadlift, press, bench press, power clean, rows (pendlay only)
- Include warmup, mobility work, and core work
- Keep it simple and fun for ${audience || "general fitness"}
- Style: ${style || "balanced strength and conditioning"}
- Goal: ${goal || "general fitness"}

AVAILABLE EXERCISES (use ONLY these exact names):
${exerciseNames}

Return a JSON object with this exact structure:
{
  "title": "workout name",
  "description": "one sentence description",
  "exercises": [
    { "title": "exact exercise name from library", "sets": "3", "reps": "10", "notes": "brief coaching cue" }
  ]
}

Keep it to 5-8 exercises. Make it fun and appropriate for the audience. Include a mix of strength and conditioning.`;
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    // Check subscription
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_tier, is_in_person")
      .eq("user_id", userData.user.id)
      .single();

    const { data: isAdmin } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });

    if (!isAdmin && !profile?.subscription_tier && !profile?.is_in_person) {
      return new Response(JSON.stringify({ error: "Subscription required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { goal, audience, style, prompt, mode } = body;
    const isOpenWorkout = mode === "open-workout" && !!prompt;

    // Get exercise library for context
    const { data: exercises } = await supabaseClient
      .from("exercise_library")
      .select("id, title, level, equipment_needed, focus_area, sport, is_fix_it")
      .limit(200);

    const exerciseNames = (exercises || []).map(e => `${e.title} (${e.level}, ${e.equipment_needed}${e.is_fix_it ? ', fix-it' : ''})`).join("\n");

    const systemPrompt = isOpenWorkout
      ? buildOpenWorkoutPrompt(prompt, exerciseNames)
      : buildStructuredPrompt(goal, audience, style, exerciseNames);

    const userMessage = isOpenWorkout
      ? prompt
      : `Create a ${style || "fun"} workout for ${audience || "general fitness"}. Goal: ${goal || "get stronger and have fun"}`;

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
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_workout",
              description: "Create a single workout session with exercises",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        sets: { type: "string" },
                        reps: { type: "string" },
                        notes: { type: "string" },
                      },
                      required: ["title", "sets", "reps"],
                    },
                  },
                },
                required: ["title", "description", "exercises"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_workout" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error("AI generation failed");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No workout generated");

    const workout = JSON.parse(toolCall.function.arguments);

    // Match exercise titles to library IDs
    const exerciseMap = new Map((exercises || []).map(e => [e.title.toLowerCase(), e.id]));
    workout.exercises = workout.exercises.map((ex: any) => ({
      ...ex,
      exerciseId: exerciseMap.get(ex.title.toLowerCase()) || "",
    }));

    return new Response(JSON.stringify(workout), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-workout-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
