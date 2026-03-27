import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildDualPathWorkoutPrompt(userText: string, hasImage: boolean, exerciseNames: string, clarifications?: Record<string, string[]>) {
  const visionClause = hasImage
    ? `\n\nIMPORTANT — VISION MODE:
The user has provided a photograph of their workout environment. You MUST:
1. Scan the image and identify ALL available fitness equipment visible.
2. Build the workout program utilizing ONLY the equipment you can see in this image.
3. Do NOT prescribe exercises requiring equipment that is NOT visible.
4. If you cannot clearly identify equipment, default to bodyweight alternatives.
5. List the equipment you detected in the workout description.`
    : "";

  let equipmentContext = "";
  if (clarifications) {
    const env = clarifications["environment"]?.[0] || "Gym";
    const equipment = clarifications["equipment"] || [];
    const experience = clarifications["experience"]?.[0] || "";
    const goals = clarifications["goals"] || [];
    const days = clarifications["days"]?.[0] || "";

    equipmentContext = `

ATHLETE CONTEXT:
Training environment: ${env}.
Available equipment: ${equipment.length > 0 ? equipment.join(", ") : "full gym assumed"}.
${experience ? `Experience level: ${experience}.` : ""}
${goals.length > 0 ? `Primary goals: ${goals.join(", ")}.` : ""}
${days ? `Training days per week: ${days}.` : ""}
ONLY prescribe exercises that match the listed equipment. If home with limited gear, focus on dumbbell, kettlebell, and bodyweight variations.
${env === "Home" && equipment.length === 0 ? "Focus on bodyweight-only exercises." : ""}
${env === "Travel" ? "Focus on bodyweight-only exercises that require no equipment and minimal space." : ""}
${equipment.includes("Dumbbells Only") ? "Use dumbbell variations instead of barbell movements." : ""}
${equipment.includes("Kettlebells") ? "Include kettlebell swings, Turkish get-ups, and goblet squats where appropriate." : ""}`;
  }

  return `You are Coach Matt's workout builder. You follow Starting Strength (Rippetoe) and Becoming a Supple Leopard (Starrett) principles ONLY.

LANGUAGE: ALL output MUST be in American English. Every exercise name, description, coaching cue, and instruction must be in English only. Never use any other language.

RULES:
- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes
- Do NOT include sled exercises (sled push, sled pull, sled drag, etc.) UNLESS the user specifically mentions or requests sleds in their input.
- Focus on compound movements: squat, deadlift, press, bench press, power clean, rows
- The workout follows 5 phases: 1. Rolling/Soft Tissue, 2. Dynamic Warmup, 3. Main Work, 4. Finisher/Conditioning, 5. Cooldown
- VARIETY IS CRITICAL: Never repeat the same exercise twice in a single workout. Each exercise must target a DIFFERENT movement pattern or muscle group than the previous one. Spread selections across the full exercise library — do not default to the same 10-15 "safe" exercises every time. Rotate between lesser-used compound variations (e.g. Zercher squat instead of always goblet squat, Z-press instead of always overhead press, single-leg RDL instead of always bilateral RDL). Surprise the athlete with variety while staying within the approved exercise library.
- You must INFER the user's experience level, goals, training days per week, and available equipment strictly from their natural language input.
- If the user doesn't mention how many days, default to 3.
- If the user doesn't mention equipment, assume full gym (barbell, rack, dumbbells).${visionClause}${equipmentContext}

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

VARIETY IS CRITICAL: Every exercise in the session must be unique — no duplicates. Rotate through different movement patterns and lesser-used exercises from the library instead of always picking the same familiar ones.

Keep each session to 6-10 exercises across all phases. Make it challenging but appropriate for the inferred experience level.`;
}

function buildDualPathFixitPrompt(userText: string, exerciseNames: string, clarifications?: Record<string, string[]>) {
  let equipmentContext = "";
  if (clarifications) {
    const env = clarifications["environment"]?.[0] || "Gym";
    const equipment = clarifications["equipment"] || [];
    const frequency = clarifications["frequency"]?.[0] || "";
    const painLevel = clarifications["pain_level"]?.[0] || "";

    equipmentContext = `

EQUIPMENT CONTEXT:
The user will be doing this protocol at: ${env}.
Available equipment: ${equipment.length > 0 ? equipment.join(", ") : "bodyweight only"}.
ONLY prescribe exercises that use the listed equipment or bodyweight.
${equipment.includes("Swiss Ball") ? "Include Swiss ball mobilizations where appropriate (e.g. Swiss ball hip flexor stretch, Swiss ball thoracic extension)." : ""}
${equipment.includes("Resistance Bands") ? "Include banded distractions and band-assisted stretches where appropriate." : ""}
${equipment.includes("Foam Roller") ? "Include foam roller techniques for soft tissue work." : ""}
${equipment.includes("Lacrosse Ball") ? "Include lacrosse ball pin-and-floss techniques." : ""}
${equipment.includes("Pull-up Bar") ? "Include hanging decompression and dead hangs if relevant." : ""}
${env === "Home" && equipment.length === 0 ? "Focus on floor-based mobility, isometric holds, and bodyweight corrective exercises only." : ""}
${env === "Travel" ? "Focus on bodyweight-only exercises that require no equipment and minimal space." : ""}
${frequency ? `Frequency of issue: ${frequency}.` : ""}
${painLevel ? `Pain level: ${painLevel}/10.` : ""}`;
  }

  return `You are Coach Matt's Fix It Engine — a corrective exercise specialist following Becoming a Supple Leopard (Starrett) and Starting Strength (Rippetoe) principles.

LANGUAGE: ALL output MUST be in American English only. Never use any other language.

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
- Be specific with coaching cues${equipmentContext}

USER INPUT: "${userText}"

AVAILABLE EXERCISES (use these names when possible):
${exerciseNames}

Title the protocol after the issue (e.g., "Anterior Shoulder Impingement Protocol").`;
}

function buildOpenWorkoutPrompt(userPrompt: string, exerciseNames: string) {
  return `You are Coach Matt — a strength and conditioning coach who follows Starting Strength (Rippetoe) and Becoming a Supple Leopard (Starrett) principles ONLY.

LANGUAGE: ALL output MUST be in American English only. Never use any other language.

You are doing a quick pre-workout check-in. The athlete has told you how they feel today. Your job:
1. LISTEN to what they said — if something hurts or is tight, INCLUDE corrective work at the start.
2. Build a SINGLE training session tailored to right now.
3. Flow: Rolling/Soft Tissue → Dynamic Warmup → Main Work → Finisher → Cooldown
4. Keep it to 6-10 exercises total.

RULES:
- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes
- Compound movements: squat, deadlift, press, bench press, power clean, rows
- If they mention pain/tightness, address it with corrective work FIRST
- VARIETY IS CRITICAL: Never repeat an exercise. Rotate through different movements from the library — avoid defaulting to the same handful of exercises every time. Use creative compound variations.

ATHLETE CHECK-IN: "${userPrompt}"

AVAILABLE EXERCISES (use these exact names when possible):
${exerciseNames}

Make it feel personal — like Coach Matt actually heard them.`;
}

function buildStructuredPrompt(goal: string, audience: string, style: string, exerciseNames: string) {
  return `You are Coach Matt's workout builder. Starting Strength + Supple Leopard principles ONLY.
LANGUAGE: ALL output MUST be in American English only. Never use any other language.
RULES:
- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes
- Include warmup, mobility, core work
- VARIETY IS CRITICAL: Every exercise must be unique. Rotate through different movements from the library — do not default to the same exercises every time.
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
    const { goal, audience, style, prompt, mode, path, userText, gymImageBase64, clarifications } = body;

    // === CLARIFY MODE (both paths) ===
    if ((mode === "fixit-clarify" || mode === "workout-clarify") && userText) {
      const isFixit = mode === "fixit-clarify";
      const systemContent = isFixit
        ? `You are Coach Matt's Fix It intake system. The user described a pain point. Generate 3-4 follow-up questions to help build a better corrective protocol. Return structured JSON via the tool call.

Questions should cover:
1. WHERE they'll be doing the protocol (home, gym, travel)
2. WHAT EQUIPMENT they have available (if home/travel)
3. HOW OFTEN the issue bothers them
4. PAIN LEVEL on a 1-10 scale

Make questions conversational and empathetic.`
        : `You are Coach Matt's workout intake system. The user described their training goals. Generate 3-4 follow-up questions to help build a perfectly tailored workout. Return structured JSON via the tool call.

Questions should cover:
1. WHERE they'll be training (home, gym, travel)
2. WHAT EQUIPMENT they have access to (e.g. full gym, dumbbells only, kettlebells, bands, bodyweight only)
3. Their EXPERIENCE LEVEL (beginner, intermediate, advanced)
4. Their PRIMARY GOALS (e.g. strength, muscle building, fat loss, athletic performance, general fitness)

If the user already mentioned some of these details in their description, skip those questions and ask about what's missing. Keep it conversational and encouraging.`;

      const questionIds = isFixit
        ? "Unique ID like 'environment', 'equipment', 'frequency', 'pain_level'"
        : "Unique ID like 'environment', 'equipment', 'experience', 'goals', 'days'";

      const clarifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userText },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "ask_clarifying_questions",
                description: "Ask the user follow-up questions before building their program.",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", description: questionIds },
                          question: { type: "string" },
                          options: { type: "array", items: { type: "string" } },
                          multiSelect: { type: "boolean", description: "True if user can select multiple options" },
                        },
                        required: ["id", "question", "options"],
                      },
                    },
                  },
                  required: ["questions"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "ask_clarifying_questions" } },
        }),
      });

      if (!clarifyResponse.ok) {
        const text = await clarifyResponse.text();
        console.error("Clarify AI error:", clarifyResponse.status, text);
        throw new Error("Failed to generate questions");
      }

      const clarifyResult = await clarifyResponse.json();
      const toolCall = clarifyResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No questions generated");

      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        ? buildDualPathFixitPrompt(userText, exerciseNames, clarifications)
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
              description: "Create a workout session or corrective protocol with exercises. If the user requests a timed circuit, set isTimedCircuit=true and provide timerConfig.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  isTimedCircuit: { type: "boolean", description: "True if this is a timed interval/circuit workout" },
                  timerConfig: {
                    type: "object",
                    description: "Timer configuration for timed circuits. Only include when isTimedCircuit is true.",
                    properties: {
                      work: { type: "number", description: "Work interval in seconds" },
                      rest: { type: "number", description: "Rest interval in seconds" },
                      rounds: { type: "number", description: "Number of rounds" },
                      prep: { type: "number", description: "Prep countdown in seconds, default 10" },
                    },
                    required: ["work", "rest", "rounds", "prep"],
                  },
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

    // Notify all admins about the generated workout (non-blocking)
    const exerciseSummary = workout.exercises.map((ex: any, i: number) =>
      `${i + 1}. ${ex.title} — ${ex.sets}×${ex.reps}${ex.notes ? ` (${ex.notes})` : ""}`
    ).join("\n");

    const userName = userData.user.email || "Unknown user";

    const { data: adminRoles } = await supabaseClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles && adminRoles.length > 0) {
      const notifications = adminRoles.map((r: any) => ({
        user_id: r.user_id,
        type: "ai_workout_generated",
        title: `AI Workout: ${workout.title}`,
        body: `${userName} generated:\n${exerciseSummary}`,
        link: "/admin",
      }));
      try { await supabaseClient.from("notifications").insert(notifications); } catch { /* non-blocking */ }
    }

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
