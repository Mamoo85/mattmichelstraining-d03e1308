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

    // Auth check — admin only
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

    const {
      category,
      level,
      sport,
      weeks,
      daysPerWeek,
      description,
      exercisesPerDay,
      explanationDetail,
      includeFixIt,
      focusAreas,
    } = await req.json();

    // Fetch exercise library — ALWAYS include all exercises for full context
    const { data: exercises } = await supabaseClient
      .from("exercise_library")
      .select("id, title, focus_area, sport, client_type, equipment_needed, the_why, is_fix_it, fix_it_protocol, level")
      .order("title");

    // Separate into categories for structured AI context
    const allExercises = exercises || [];
    const mainExercises = allExercises.filter((e: any) => !e.is_fix_it);
    const rollingExercises = allExercises.filter((e: any) =>
      e.is_fix_it && (e.fix_it_protocol || []).some((p: string) => p === "Soft Tissue & Recovery")
    );
    const rehabExercises = allExercises.filter((e: any) =>
      e.is_fix_it && !(e.fix_it_protocol || []).some((p: string) => p === "Soft Tissue & Recovery")
    );

    const formatEx = (e: any) => {
      let line = `- ${e.title} (ID: ${e.id}) [${e.level}] | Focus: ${e.focus_area?.join(", ")} | Sport: ${e.sport?.join(", ")} | Equipment: ${e.equipment_needed}`;
      if (e.is_fix_it) line += ` | Protocol: ${e.fix_it_protocol?.join(", ")}`;
      line += ` | Why: ${e.the_why}`;
      return line;
    };

    const exerciseList = `=== MAIN EXERCISES (${mainExercises.length}) ===\n${mainExercises.map(formatEx).join("\n")}\n\n=== ROLLING & SOFT TISSUE TECHNIQUES (${rollingExercises.length}) ===\n${rollingExercises.map(formatEx).join("\n")}\n\n=== FIX IT / REHAB EXERCISES (${rehabExercises.length}) ===\n${rehabExercises.map(formatEx).join("\n")}`;

    // Build detail instructions based on explanationDetail setting
    const detailMap: Record<string, string> = {
      brief: "Keep coach instructions to 1 short sentence each — just the key cue.",
      standard: "Write 1-2 sentence coach instructions with the main coaching cue and one technique tip.",
      detailed: "Write 2-3 sentence coach instructions covering the coaching cue, common mistakes to avoid, and a progression tip. Sound like Matt — direct, knowledgeable, encouraging.",
    };
    const detailInstruction = detailMap[explanationDetail] || detailMap.standard;

    // Build focus area instructions
    let focusInstruction = "";
    if (focusAreas && focusAreas.length > 0) {
      focusInstruction = `\n- Prioritize exercises tagged with these focus areas: ${focusAreas.join(", ")}`;
    }

    // Fix It / rehab instructions
    let fixItInstruction = "";
    if (includeFixIt) {
      fixItInstruction = `\n- Include Fix It / rehab exercises from the FIX IT section as corrective blocks, warm-up, or cooldown — especially exercises matching the program's sport (e.g. ACL Prevention for hockey/soccer, Rotator Cuff for baseball, Knee Pain for jumping sports)`;
    }

    const rollingInstruction = `\n- ALWAYS include 1-2 rolling/soft tissue techniques from the ROLLING & SOFT TISSUE section at the start or end of each training day. Match them to the muscles being trained (e.g. hip flexor release on squat days, posterior shoulder smash on pressing days)`;

    const exerciseCount = exercisesPerDay || 8;

    const systemPrompt = `You are Matt Michels' AI assistant for M² Performance Training. You draft training programs using ONLY exercises from Matt's exercise library. The library has THREE sections: Main Exercises, Rolling & Soft Tissue Techniques, and Fix It / Rehab Exercises. Matt is a master of movement science — every program must include: custom warmup, corrective exercises, strength, balance, coordination, core stability, integrity, endurance, and targeted rolling/mobility.

FOUNDATIONAL PHILOSOPHY (Starting Strength by Mark Rippetoe — Coach Matt's core influence):
- Build programs around the barbell: squat, deadlift, press, bench, and clean variations are the foundation
- Progressive overload across weeks — add weight or volume systematically
- Squat below parallel. Always. "If it's too heavy to squat below parallel, it's too heavy to have on your back."
- Hip drive and posterior chain are the engine of all lower body movements
- Bar path stays vertical over mid-foot for all standing barbell movements
- Full range of motion in every exercise — partial reps build partial strength

BANNED EXERCISES — Coach Matt NEVER programs these:
- Barbell Bent Over Row (any variation). Use Dumbbell Rows, Chest-Supported Rows, Cable Rows, or Seal Rows instead.
- ALL traditional bodybuilding isolation exercises: bicep curls, tricep kickbacks, lateral raises, leg extensions, leg curls (machine), cable flyes, pec deck, preacher curls, concentration curls, skull crushers, tricep pushdowns, calf raises (machine), shrugs, front raises, etc.
- ALL machine-based isolation work: Smith machine, leg press, hack squat machine, chest press machine, shoulder press machine, cable crossovers, etc.
- Only acceptable "isolation" = corrective/prehab (band pull-aparts, face pulls, McGill Big 3) or Fix It / Rehab library exercises.

EXERCISE PHILOSOPHY — Powerlifting & Full-Body Functional:
- Core lifts: Squat, Deadlift, Press, Bench Press, Power Clean.
- Accessories = compound: chin-ups, dips, DB rows, lunges, RDLs, front squats, push-ups, farmer carries.
- Conditioning = full-body: burpees, box jumps, med ball slams, sled work, KB swings, sprints, carries.
- Arms = chin-ups and dips, not curls.

RULES:
- ONLY use exercise IDs from the provided library
- Structure as weeks and days with specific exercises, sets, reps, and coach instructions
- Be specific with sets/reps (e.g., "3x12", "4x8 @RPE 7")
- ${detailInstruction}
- Progressive overload across weeks
- Every day should have ${exerciseCount} exercises covering the full spectrum${rollingInstruction}${fixItInstruction}${focusInstruction}

Return a JSON object using this tool.`;

    const userPrompt = `Create a ${weeks || 8}-week, ${daysPerWeek || 3}-day/week training program.
Category: ${category}
Level: ${level}
${sport ? `Sport: ${sport}` : ""}
${description ? `Additional notes: ${description}` : ""}
Target exercises per day: ${exerciseCount}

EXERCISE LIBRARY (${allExercises.length} total — ${mainExercises.length} main, ${rollingExercises.length} rolling/soft tissue, ${rehabExercises.length} fix it/rehab):
${exerciseList}`;

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
              name: "create_program",
              description: "Create a structured training program",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Program title" },
                  description: { type: "string", description: "2-3 sentence program description for the store" },
                  workouts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        week_number: { type: "number" },
                        day_number: { type: "number" },
                        exercise_id: { type: "string", description: "UUID from exercise library" },
                        prescribed_sets_reps: { type: "string", description: "e.g. 3x10, 4x8 @RPE 7" },
                        coach_instructions: { type: "string", description: "Coach Matt style instructions" },
                        sort_order: { type: "number" },
                      },
                      required: ["week_number", "day_number", "exercise_id", "prescribed_sets_reps", "coach_instructions", "sort_order"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "description", "workouts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_program" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed — add funds in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured output");

    const program = JSON.parse(toolCall.function.arguments);

    // Validate exercise IDs exist
    const exerciseIds = new Set(allExercises.map((e: any) => e.id));
    const validWorkouts = program.workouts.filter((w: any) => exerciseIds.has(w.exercise_id));
    const invalidCount = program.workouts.length - validWorkouts.length;

    return new Response(
      JSON.stringify({
        title: program.title,
        description: program.description,
        workouts: validWorkouts,
        total_exercises: program.workouts.length,
        valid_exercises: validWorkouts.length,
        invalid_exercises: invalidCount,
        category,
        level,
        sport: sport || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-program error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
