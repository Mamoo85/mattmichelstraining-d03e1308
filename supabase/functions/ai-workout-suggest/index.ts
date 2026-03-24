import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildDualPathWorkoutPrompt(userText: string, hasImage: boolean, exerciseNames: string) {
  const visionClause = hasImage
    ? `\n\nIMPORTANT — VISION MODE:
The user has provided a photograph of their workout environment. You MUST:
1. Scan the image and identify ALL available fitness equipment visible.
2. Build the workout program utilizing ONLY the equipment you can see in this image.
3. Do NOT prescribe exercises requiring equipment that is NOT visible.
4. If you cannot clearly identify equipment, default to bodyweight alternatives.
5. List the equipment you detected in the workout description.`
    : "";

  return `You are Coach Matt's workout builder. You follow Starting Strength (Rippetoe) and Becoming a Supple Leopard (Starrett) principles ONLY.

RULES:
- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes
- Focus on compound movements: squat, deadlift, press, bench press, power clean, rows
- The workout follows 5 phases: 1. Rolling/Soft Tissue, 2. Dynamic Warmup, 3. Main Work, 4. Finisher/Conditioning, 5. Cooldown
- You must INFER the user's experience level, goals, training days per week, and available equipment strictly from their natural language input.
- If the user doesn't mention how many days, default to 3.
- If the user doesn't mention equipment, assume full gym (barbell, rack, dumbbells).${visionClause}

TIMED CIRCUIT DETECTION:
If the user requests a "timed circuit", "AMRAP", "EMOM", mentions specific work/rest intervals (e.g. "45 on 15 off"), or asks for a time-based workout (e.g. "15 min circuit"), you MUST:
1. Set isTimedCircuit to true
2. Provide a timerConfig with work seconds, rest seconds, rounds, and prep (default 10)
3. Infer timing from their language: "Tabata" = 20/10/8, "EMOM" = 60/0/10, "45 on 15 off" = 45/15/rounds
4. If they mention total time (e.g. "15 min"), calculate rounds = totalMinutes * 60 / (work + rest)
5. Skip Rolling/Soft Tissue and Cooldown phases — circuit exercises only

USER INPUT: "${userText}"

AVAILABLE EXERCISES (use these exact names when possible):
${exerciseNames}

Keep each session to 6-10 exercises across all phases. Make it challenging but appropriate for the inferred experience level.`;
}

function buildDualPathFixitPrompt(userText: string, exerciseNames: string) {
  return `You are Coach Matt's Fix It Engine — a corrective exercise specialist following Becoming a Supple Leopard (Starrett) and Starting Strength (Rippetoe) principles.

The user is describing a pain point or movement dysfunction. Your job is to:
1. INFER the likely biomechanical issue from their natural language description.
2. Build a corrective protocol with exercises tagged by phase:
   - Phase: Tissue Release (lacrosse ball, foam roller, etc.)
   - Phase: Mobility (stretches, banded distractions, active ROM)
   - Phase: Isometric/Corrective Loading (light loading patterns to reinforce correct positions)

RULES:
- Each phase should have 2-3 exercises
- Focus on the ROOT CAUSE, not just the symptom
- Use exercises from the library when possible
- Be specific with coaching cues

USER INPUT: "${userText}"

AVAILABLE EXERCISES (use these names when possible):
${exerciseNames}

Title the protocol after the issue (e.g., "Anterior Shoulder Impingement Protocol").`;
}

function buildOpenWorkoutPrompt(userPrompt: string, exerciseNames: string) {
  return `You are Coach Matt — a strength and conditioning coach who follows Starting Strength (Rippetoe) and Becoming a Supple Leopard (Starrett) principles ONLY.

You are doing a quick pre-workout check-in. The athlete has told you how they feel today. Your job:
1. LISTEN to what they said — if something hurts or is tight, INCLUDE corrective work at the start.
2. Build a SINGLE training session tailored to right now.
3. Flow: Rolling/Soft Tissue → Dynamic Warmup → Main Work → Finisher → Cooldown
4. Keep it to 6-10 exercises total.

RULES:
- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes
- Compound movements: squat, deadlift, press, bench press, power clean, rows
- If they mention pain/tightness, address it with corrective work FIRST

ATHLETE CHECK-IN: "${userPrompt}"

AVAILABLE EXERCISES (use these exact names when possible):
${exerciseNames}

Make it feel personal — like Coach Matt actually heard them.`;
}

function buildStructuredPrompt(goal: string, audience: string, style: string, exerciseNames: string) {
  return `You are Coach Matt's workout builder. Starting Strength + Supple Leopard principles ONLY.
RULES:
- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes
- Include warmup, mobility, core work
- Audience: ${audience || "general fitness"} | Style: ${style || "balanced"} | Goal: ${goal || "general fitness"}

AVAILABLE EXERCISES (use ONLY these exact names):
${exerciseNames}

Keep it to 5-8 exercises. Fun and appropriate.`;
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
    const { goal, audience, style, prompt, mode, path, userText, gymImageBase64 } = body;

    const isDualPath = mode === "dual-path" && !!path && !!userText;
    const isOpenWorkout = mode === "open-workout" && !!prompt;

    const { data: exercises } = await supabaseClient
      .from("exercise_library")
      .select("id, title, level, equipment_needed, focus_area, sport, is_fix_it")
      .limit(200);

    const exerciseNames = (exercises || []).map(e => `${e.title} (${e.level}, ${e.equipment_needed}${e.is_fix_it ? ', fix-it' : ''})`).join("\n");

    const hasImage = !!gymImageBase64;
    let systemPrompt: string;
    let userMessage: string;

    if (isDualPath) {
      systemPrompt = path === "fixit"
        ? buildDualPathFixitPrompt(userText, exerciseNames)
        : buildDualPathWorkoutPrompt(userText, hasImage, exerciseNames);
      userMessage = userText;
    } else if (isOpenWorkout) {
      systemPrompt = buildOpenWorkoutPrompt(prompt, exerciseNames);
      userMessage = prompt;
    } else {
      systemPrompt = buildStructuredPrompt(goal, audience, style, exerciseNames);
      userMessage = `Create a ${style || "fun"} workout for ${audience || "general fitness"}. Goal: ${goal || "get stronger and have fun"}`;
    }

    // Build messages with optional image
    const userContent: any[] = [];
    if (hasImage) {
      userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${gymImageBase64}` } });
    }
    userContent.push({ type: "text", text: userMessage });

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
        tools: [
          {
            type: "function",
            function: {
              name: "create_workout",
              description: "Create a workout session or corrective protocol with exercises",
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
                        phase: { type: "string" },
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
        return new Response(JSON.stringify({ error: "High demand — please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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