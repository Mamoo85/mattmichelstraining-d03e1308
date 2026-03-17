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

    // Fetch exercise library
    const { data: exercises } = await supabaseClient
      .from("exercise_library")
      .select("id, title, focus_area, sport, client_type, equipment_needed, the_why")
      .order("title");

    if (!exercises || exercises.length === 0) throw new Error("No exercises in library");

    const exerciseIds = new Set(exercises.map((e: any) => e.id));
    const exerciseList = exercises
      .map((e: any) => `- ${e.title} (ID: ${e.id}) | Focus: ${e.focus_area?.join(", ")} | Sport: ${e.sport?.join(", ")} | Equipment: ${e.equipment_needed}`)
      .join("\n");

    // Get programs without workouts
    const { data: allPrograms } = await supabaseClient
      .from("training_programs")
      .select("id, title, category, level, sport, description")
      .order("title");

    if (!allPrograms || allPrograms.length === 0) {
      return new Response(JSON.stringify({ message: "No programs found", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which have workouts
    const results: any[] = [];

    for (const program of allPrograms) {
      const { count } = await supabaseClient
        .from("program_workouts")
        .select("id", { count: "exact", head: true })
        .eq("program_id", program.id);

      if ((count ?? 0) > 0) {
        results.push({ id: program.id, title: program.title, status: "skipped", reason: "already has workouts" });
        continue;
      }

      // Generate workouts for this program
      try {
        const systemPrompt = `You are Matt Michels' AI assistant for M² Performance Training. Draft an 8-week, 3-day/week training program using ONLY exercise IDs from the library below. Every day should have 6-10 exercises. Include progressive overload across weeks. Be specific with sets/reps (e.g., "3x12", "4x8 @RPE 7"). Include coach instructions in Matt's voice — direct, knowledgeable, encouraging.`;

        const userPrompt = `Create workouts for: "${program.title}"
Category: ${program.category}
Level: ${program.level}
${program.sport ? `Sports: ${program.sport}` : "General fitness"}
Description: ${program.description}

EXERCISE LIBRARY:
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
            // Rate limited — wait and note it
            results.push({ id: program.id, title: program.title, status: "rate_limited" });
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          results.push({ id: program.id, title: program.title, status: "ai_error", reason: `HTTP ${status}` });
          continue;
        }

        const aiData = await response.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          results.push({ id: program.id, title: program.title, status: "ai_error", reason: "No structured output" });
          continue;
        }

        const parsed = JSON.parse(toolCall.function.arguments);
        const validWorkouts = (parsed.workouts || []).filter((w: any) => exerciseIds.has(w.exercise_id));

        if (validWorkouts.length === 0) {
          results.push({ id: program.id, title: program.title, status: "failed", reason: "No valid exercises generated" });
          continue;
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
        if (insertError) {
          results.push({ id: program.id, title: program.title, status: "db_error", reason: insertError.message });
        } else {
          results.push({ id: program.id, title: program.title, status: "success", workouts: validWorkouts.length });
        }

        // Small delay between AI calls to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
      } catch (e: any) {
        results.push({ id: program.id, title: program.title, status: "error", reason: e.message });
      }
    }

    return new Response(JSON.stringify({ message: "Batch complete", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("batch-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
