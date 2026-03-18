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

    // Accept optional programId to generate for a single program
    const body = await req.json().catch(() => ({}));
    const targetProgramId = body.programId || null;

    // Fetch exercise library — include ALL fields for context
    const { data: exercises } = await supabaseClient
      .from("exercise_library")
      .select("id, title, focus_area, sport, client_type, equipment_needed, level, is_fix_it, fix_it_protocol, the_why")
      .order("title");

    if (!exercises || exercises.length === 0) throw new Error("No exercises in library");

    const exerciseIds = new Set(exercises.map((e: any) => e.id));

    // Separate exercises into categories for richer AI context
    const mainExercises = exercises.filter((e: any) => !e.is_fix_it);
    const fixItExercises = exercises.filter((e: any) => e.is_fix_it);
    const rollingExercises = fixItExercises.filter((e: any) =>
      (e.fix_it_protocol || []).some((p: string) => p === "Soft Tissue & Recovery")
    );
    const rehabExercises = fixItExercises.filter((e: any) =>
      !(e.fix_it_protocol || []).some((p: string) => p === "Soft Tissue & Recovery")
    );

    const formatEx = (e: any) =>
      `${e.id}: ${e.title} [${e.level}] (${(e.focus_area || []).join(", ")})${e.fix_it_protocol?.length ? ` — Protocol: ${e.fix_it_protocol.join(", ")}` : ""}`;

    const exerciseList = `=== MAIN EXERCISES ===\n${mainExercises.map(formatEx).join("\n")}\n\n=== ROLLING & SOFT TISSUE TECHNIQUES ===\n${rollingExercises.map(formatEx).join("\n")}\n\n=== FIX IT / REHAB EXERCISES ===\n${rehabExercises.map(formatEx).join("\n")}`;

    // Get target program(s)
    let query = supabaseClient
      .from("training_programs")
      .select("id, title, category, level, sport, description");
    
    if (targetProgramId) {
      query = query.eq("id", targetProgramId);
    }
    
    const { data: allPrograms } = await query.order("title");

    if (!allPrograms || allPrograms.length === 0) {
      return new Response(JSON.stringify({ message: "No programs found", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to only programs without workouts
    const programsToGenerate: any[] = [];
    for (const program of allPrograms) {
      const { count } = await supabaseClient
        .from("program_workouts")
        .select("id", { count: "exact", head: true })
        .eq("program_id", program.id);

      if ((count ?? 0) === 0) {
        programsToGenerate.push(program);
      }
    }

    if (programsToGenerate.length === 0) {
      return new Response(JSON.stringify({ message: "All programs already have workouts", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process just ONE program per call to avoid timeouts
    const program = programsToGenerate[0];
    console.log(`Generating workouts for: ${program.title}`);

    const isFoundation = (program.category || "").toLowerCase() === "foundation";

    const systemPrompt = isFoundation
      ? `You are Matt Michels' AI assistant for M² Performance Training youth foundation programs. These are AGE-APPROPRIATE programs for young athletes. RULES:
- ONLY use exercise IDs from the provided library
- Structure as 4 weeks, 3 days/week with 5-7 exercises per day
- Be specific with sets/reps (e.g. "2x10", "3x8")
- Include coach instructions in Matt's voice — encouraging, safety-first, technique-focused
- Progressive overload across weeks but NEVER heavy loading for younger ages
- Every day: warmup/mobility, core stability, strength, coordination/balance, cooldown
- For ages 11-13: focus on movement quality, bodyweight, coordination, NO heavy loads
- For ages 14-15: joint/tendon strengthening, connective tissue, moderate loads
- For ages 16-17: progressive overload, sport-specific power, advanced mobility
- For ages 18+: college-prep conditioning, peak performance, durability under volume`
      : `You are Matt Michels' AI assistant. Draft a 4-week, 3-day/week training program using ONLY exercise IDs from the library. Each day should have 5-6 exercises. Be specific with sets/reps (e.g. "3x12", "4x8"). Include brief coach instructions. Use ONLY the exercise IDs provided.`;

    const userPrompt = `Program: "${program.title}" (${program.category}, ${program.level}${program.sport ? `, ${program.sport}` : ""}${program.description ? `\nDescription: ${program.description}` : ""})
Available exercises (ID: Name):
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
              name: "create_workouts",
              description: "Create structured workouts for a training program",
              parameters: {
                type: "object",
                properties: {
                  workouts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        week_number: { type: "number" },
                        day_number: { type: "number" },
                        exercise_id: { type: "string" },
                        prescribed_sets_reps: { type: "string" },
                        coach_instructions: { type: "string" },
                        sort_order: { type: "number" },
                      },
                      required: ["week_number", "day_number", "exercise_id", "prescribed_sets_reps", "coach_instructions", "sort_order"],
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
        tool_choice: { type: "function", function: { name: "create_workouts" } },
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
    const validWorkouts = (parsed.workouts || []).filter((w: any) => exerciseIds.has(w.exercise_id));

    if (validWorkouts.length === 0) {
      return new Response(JSON.stringify({
        program: program.title,
        status: "failed",
        reason: "No valid exercises generated",
        remaining: programsToGenerate.length - 1,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert workouts
    const workoutRows = validWorkouts.map((w: any) => ({
      program_id: program.id,
      exercise_id: w.exercise_id,
      week_number: w.week_number,
      day_number: w.day_number,
      prescribed_sets_reps: w.prescribed_sets_reps,
      coach_instructions: w.coach_instructions,
      sort_order: w.sort_order,
    }));

    const { error: insertError } = await supabaseClient.from("program_workouts").insert(workoutRows);
    if (insertError) throw new Error(insertError.message);

    console.log(`Success: ${program.title} — ${validWorkouts.length} exercises`);

    return new Response(JSON.stringify({
      program: program.title,
      status: "success",
      workouts: validWorkouts.length,
      remaining: programsToGenerate.length - 1,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("batch-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
