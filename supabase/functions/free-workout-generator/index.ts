import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildWorkoutPrompt(userText: string, hasImage: boolean, exerciseNames: string) {
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
- Each day follows 5 phases: 1. Rolling/Soft Tissue, 2. Dynamic Warmup, 3. Main Work, 4. Finisher/Conditioning, 5. Cooldown
- You must INFER the user's experience level, goals, training days per week, and available equipment strictly from their natural language input below.
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

AVAILABLE EXERCISES (use these names when possible):
${exerciseNames}

Return a JSON object with this structure:
{
  "title": "program name",
  "description": "one sentence overview${hasImage ? " — start with: Equipment detected: [list]" : ""}",
  "isTimedCircuit": false,
  "timerConfig": null,
  "days": [
    {
      "dayLabel": "Day 1 - Focus Area",
      "exercises": [
        { "title": "exercise name", "sets": "3", "reps": "10", "notes": "coaching cue", "phase": "Main Work" }
      ]
    }
  ]
}

Generate the appropriate number of training days. Keep each day to 6-8 exercises across all phases. Make it challenging but appropriate for the inferred experience level.`;
}

function buildFixitPrompt(userText: string, exerciseNames: string) {
  return `You are Coach Matt's Fix It Engine — a corrective exercise specialist following Becoming a Supple Leopard (Starrett) and Starting Strength (Rippetoe) principles.

The user is describing a pain point or movement dysfunction. Your job is to:
1. INFER the likely biomechanical issue from their natural language description.
2. Build a corrective protocol with 3 phases:
   - Phase 1: Tissue Release (lacrosse ball, foam roller, etc.)
   - Phase 2: Mobility (stretches, banded distractions, active ROM)
   - Phase 3: Isometric/Corrective Loading (light loading patterns to reinforce correct positions)

RULES:
- Each phase should have 2-3 exercises
- Focus on the ROOT CAUSE, not just the symptom
- Use exercises from the library when possible
- Be specific with coaching cues

USER INPUT: "${userText}"

AVAILABLE EXERCISES (use these names when possible):
${exerciseNames}

Return a JSON object with this structure:
{
  "title": "Protocol name (e.g., Anterior Shoulder Impingement Protocol)",
  "description": "One sentence explaining the likely issue and approach",
  "days": [
    {
      "dayLabel": "Phase 1 — Tissue Release",
      "exercises": [
        { "title": "exercise name", "sets": "2", "reps": "60 sec per side", "notes": "coaching cue", "phase": "Tissue Release" }
      ]
    },
    {
      "dayLabel": "Phase 2 — Mobility",
      "exercises": [...]
    },
    {
      "dayLabel": "Phase 3 — Isometric/Corrective Loading",
      "exercises": [...]
    }
  ]
}`;
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

    // --- Rate limiting ---
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const authHeader = req.headers.get("Authorization");
    let isAuthenticated = false;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== Deno.env.get("SUPABASE_ANON_KEY")) {
        const { data: userData } = await supabaseClient.auth.getUser(token);
        if (userData?.user) isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      const { count, error: countErr } = await supabaseClient
        .from("free_generation_log")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", clientIp);

      if (!countErr && (count ?? 0) >= 1) {
        return new Response(
          JSON.stringify({ error: "You've used your free generation. Create a free account to unlock more workouts!", limit_reached: true }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json();
    const { path, userText, gymImageBase64, experience, goal, daysPerWeek, equipment } = body;

    // Support both new (path + userText) and legacy (structured) inputs
    const isNewFormat = !!path && !!userText;
    if (!isNewFormat) {
      if (!experience || !goal || !daysPerWeek) {
        return new Response(JSON.stringify({ error: "Experience, goal, and days per week are required." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!equipment && !gymImageBase64) {
        return new Response(JSON.stringify({ error: "Provide equipment selection or a gym photo." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!userText.trim()) {
      return new Response(JSON.stringify({ error: "Please describe what you need." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get exercise library
    const { data: exercises } = await supabaseClient
      .from("exercise_library")
      .select("id, title, level, equipment_needed, focus_area")
      .limit(200);
    const exerciseNames = (exercises || []).map(e => `${e.title} (${e.level}, ${e.equipment_needed})`).join("\n");

    const hasImage = !!gymImageBase64;
    let systemPrompt: string;

    if (isNewFormat) {
      systemPrompt = path === "fixit"
        ? buildFixitPrompt(userText, exerciseNames)
        : buildWorkoutPrompt(userText, hasImage, exerciseNames);
    } else {
      // Legacy structured prompt
      const visionClause = hasImage
        ? `\n\nIMPORTANT — VISION MODE:\nThe user has provided a photograph of their workout environment. You MUST:\n1. Scan the image and identify ALL available fitness equipment visible.\n2. Build the workout program utilizing ONLY the equipment you can see in this image.\n3. Do NOT prescribe exercises requiring equipment that is NOT visible.\n4. If you cannot clearly identify equipment, default to bodyweight alternatives.\n5. List the equipment you detected in the workout description.`
        : `\n- Equipment: ${equipment}`;

      systemPrompt = `You are Coach Matt's workout builder. You follow Starting Strength (Rippetoe) and Becoming a Supple Leopard (Starrett) principles ONLY.\n\nRULES:\n- NO machines, NO Smith machine, NO leg press, NO isolation curls, NO lat raises, NO flyes\n- Focus on compound movements: squat, deadlift, press, bench press, power clean, rows\n- Each day follows 5 phases: 1. Rolling/Soft Tissue, 2. Dynamic Warmup, 3. Main Work, 4. Finisher/Conditioning, 5. Cooldown\n- Experience: ${experience}\n- Goal: ${goal}\n- Days per week: ${daysPerWeek}${visionClause}\n\nAVAILABLE EXERCISES (use these names when possible):\n${exerciseNames}\n\nReturn a JSON object with this structure:\n{\n  "title": "program name",\n  "description": "one sentence overview${hasImage ? " — start with: Equipment detected: [list]" : ""}",\n  "days": [\n    {\n      "dayLabel": "Day 1 - Focus Area",\n      "exercises": [\n        { "title": "exercise name", "sets": "3", "reps": "10", "notes": "coaching cue", "phase": "Main Work" }\n      ]\n    }\n  ]\n}\n\nGenerate exactly ${daysPerWeek} training days. Keep each day to 6-8 exercises across all phases. Make it challenging but appropriate for the experience level.`;
    }

    // Build messages
    const userContent: any[] = [];
    if (hasImage) {
      userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${gymImageBase64}` } });
    }

    const userMessage = isNewFormat
      ? userText
      : `Create a ${daysPerWeek}-day workout program for someone with ${experience} experience, goal: ${goal}${hasImage ? ". Use ONLY equipment visible in the photo." : `, equipment: ${equipment}.`}`;

    userContent.push({ type: "text", text: userMessage });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_program",
            description: "Create a multi-day workout program or corrective protocol",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                days: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      dayLabel: { type: "string" },
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
                    required: ["dayLabel", "exercises"],
                  },
                },
              },
              required: ["title", "description", "days"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_program" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "High demand — please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error("Generation failed");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No program generated");

    const program = JSON.parse(toolCall.function.arguments);

    if (!isAuthenticated) {
      await supabaseClient.from("free_generation_log").insert({ ip_address: clientIp });
    }

    return new Response(JSON.stringify(program), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("free-workout-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
