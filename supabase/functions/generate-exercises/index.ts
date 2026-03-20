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

    const {
      quantity = 5,
      category = "strength",
      equipment = "Full Gym",
      level = "intermediate",
      focusAreas = [],
      movementPattern = "all",
      coachingDetail = "detailed",
      creativityLevel = "high",
      sport = "",
      ageGroup = "adult",
      includeProgressions = true,
      includeRegressions = true,
      includeCommonMistakes = true,
      isFixIt = false,
      fixItProtocol = "",
    } = await req.json();

    // Fetch existing exercises to avoid duplicates and for context
    const { data: existingExercises } = await supabaseClient
      .from("exercise_library")
      .select("title, focus_area, equipment_needed, level, is_fix_it, fix_it_protocol, sport, client_type")
      .order("title");

    const existingNames = (existingExercises || []).map((e: any) => e.title.toLowerCase());
    const existingContext = (existingExercises || []).slice(0, 100).map((e: any) =>
      `- ${e.title} [${e.level}] | Focus: ${(e.focus_area || []).join(", ")} | Equipment: ${e.equipment_needed}`
    ).join("\n");

    const detailMap: Record<string, string> = {
      brief: "1-line 'the_why'. Keep it punchy.",
      standard: "2-3 sentence 'the_why' covering purpose, muscles, and benefit.",
      detailed: "Full coaching breakdown for 'the_why': biomechanical purpose, muscles trained, sport transfer, why Coach Matt programs it, common mistakes, and a coaching cue. Reference SS or BASL when applicable.",
    };
    const detailInstruction = detailMap[coachingDetail] || detailMap.detailed;

    const focusStr = focusAreas.length > 0 ? `\nPRIMARY FOCUS AREAS: ${focusAreas.join(", ")}. Bias exercise selection toward these muscle groups and movement patterns.` : "";
    const sportStr = sport ? `\nSPORT CONTEXT: "${sport}". Generate exercises that have direct transfer to this sport's movement demands.` : "";
    const fixItStr = isFixIt ? `\nFIX-IT MODE: Generate corrective/prehab/rehab exercises. These should address movement dysfunctions, mobility restrictions, and injury prevention.${fixItProtocol ? ` Protocol focus: ${fixItProtocol}` : ""}` : "";

    const creativityMap: Record<string, string> = {
      standard: "Stick to well-known, proven exercises. Classic SS and BASL movements.",
      high: "Include lesser-known but effective variations. Think about unique loading positions, tempo manipulations, paused reps, 1.5 reps, banded variations, and complexes. Every exercise should have a clear purpose.",
      experimental: "Push boundaries — hybrid movements, novel loading strategies, unique movement combinations, unconventional implements. Think like a coach who has 20 years of experimentation. Barbell-in-the-rack creativity, landmine variations, band-assisted/resisted compounds, positional isometrics.",
    };
    const creativityInstruction = creativityMap[creativityLevel] || creativityMap.high;

    const systemPrompt = `You are Coach Matt Michels — 20+ years of strength & conditioning experience, owner of M² Performance Training. Your exercise programming is rooted in two foundational texts: Mark Rippetoe's "Starting Strength" and Kelly Starrett's "Becoming a Supple Leopard". You create exercises that belong in a REAL training facility, not a magazine workout.

═══════════════════════════════════════════
STARTING STRENGTH EXERCISE PHILOSOPHY
═══════════════════════════════════════════

CORE LIFTS — The Foundation:
- Back Squat (low bar): The king. Trains the entire posterior chain under load. Every athlete squats. (SS Ch. 2)
- Deadlift: The most functional movement — picking heavy things off the floor. Trains grip, back, hips, hamstrings. (SS Ch. 4)
- Press (Overhead): Standing barbell press. The real test of upper body strength. No back support, no machines. (SS Ch. 3)
- Bench Press: Horizontal pressing strength. 5 points of contact, bar path slightly diagonal. (SS Ch. 5)
- Power Clean: Explosive hip extension. The bridge between strength and athleticism. (SS Ch. 7)

APPROVED COMPOUND ACCESSORIES:
- Front Squat, Safety Bar Squat, Pause Squats, Pin Squats, Box Squats
- Deficit Deadlifts, Block Pulls, Pause Deadlifts, Snatch-Grip Deadlifts, Trap Bar Deadlifts
- Push Press, Strict Press, Z-Press, Landmine Press, Floor Press, Close-Grip Bench
- Chin-ups, Pull-ups, Weighted Dips, DB Rows, Chest-Supported Rows, Seal Rows, Pendlay Rows
- RDLs, Good Mornings, Hip Thrusts, Bulgarian Split Squats, Walking Lunges, Step-Ups
- Farmer Carries, Suitcase Carries, Overhead Carries, Yoke Walks
- Power Clean variations, Hang Cleans, Clean Pulls, High Pulls

CONDITIONING (Full-Body Functional Only):
- Burpees, Box Jumps, Med Ball Slams, Sled Push/Pull, KB Swings, KB Snatches
- Jump Rope, Sprints, Hill Runs, Assault Bike, Rower
- Battle Ropes, Tire Flips, Sandbag Work, Carries for distance/time

═══════════════════════════════════════════
BECOMING A SUPPLE LEOPARD — MOBILITY & CORRECTIVE
═══════════════════════════════════════════

MOBILITY EXERCISES (for fix-it/corrective work):
- Foam Rolling: Tack and floss technique, pressure wave, contract-relax (BASL)
- Banded Joint Distractions: Hip, ankle, shoulder, wrist (BASL)
- Lacrosse Ball Work: Posterior shoulder, pec minor, glute medius, plantar fascia (BASL)
- Barbell Smash: Quad, IT band, forearm (BASL)
- Couch Stretch: Gold standard hip flexor mobilization (BASL)
- T-Spine Extension over Roller (BASL)
- Super Front Rack Stretch (BASL)
- Voodoo Floss / Compression Banding (BASL)
- Banded Ankle Distraction (BASL)

MOVEMENT ARCHETYPES (BASL):
- Squat: External rotation torque, braced neutral spine, break at hips and knees simultaneously
- Hinge: Neutral spine, load hamstrings, back is a rigid lever
- Press: External rotation at shoulder before pressing, armpits forward
- Pull: Set scapulae down and back before pulling, engage lats first
- Overhead: Full lockout = armpits forward, elbows locked, bar over mid-foot

MCGILL BIG 3 (for core/stability correctives):
- Curl-Up: Not a crunch — one leg bent, hands under low back, lift head/shoulders only
- Side Plank: Build lateral stability, anti-lateral flexion
- Bird Dog: Anti-extension + anti-rotation, contralateral limb extension

═══════════════════════════════════════════
BANNED — NEVER GENERATE THESE
═══════════════════════════════════════════
- Barbell Bent Over Row (any variation)
- ALL bodybuilding isolation: bicep curls, tricep kickbacks, lateral raises, leg extensions, leg curls (machine), cable flyes, pec deck, preacher curls, concentration curls, skull crushers, tricep pushdowns, calf raises (machine), shrugs, front raises, rear delt flyes on machine
- ALL machine-based isolation: Smith machine, leg press, hack squat, chest press machine, shoulder press machine, cable crossovers
- Exception: corrective/prehab movements (band pull-aparts, face pulls, McGill Big 3) ARE allowed

═══════════════════════════════════════════
EXERCISE GENERATION RULES
═══════════════════════════════════════════

For EACH exercise you generate, you MUST provide:
1. "title" — Clear, specific exercise name (e.g., "Paused Back Squat (3-count)" not just "Squat")
2. "the_why" — ${detailInstruction}
3. "focus_area" — Array of muscle groups / movement patterns (e.g., ["Posterior Chain", "Hip Extension", "Core"])
4. "equipment_needed" — Specific equipment required
5. "level" — "beginner", "intermediate", or "advanced"
6. "coaching_cues" — Array of 3-5 specific coaching cues referencing SS or BASL. These should sound like a coach yelling from across the gym — direct, specific, actionable. NOT generic internet advice.
7. "common_mistakes" — Array of 2-3 mistakes athletes make on this exercise and how to fix them
8. "progressions" — Array of 1-3 harder variations or ways to progress this exercise
9. "regressions" — Array of 1-3 easier variations for athletes who aren't ready
10. "sport_transfer" — Array of sports/activities this exercise benefits and why
11. "sets_reps_guidance" — Typical programming recommendation (e.g., "3x5 @ RPE 7-8 for strength, 5x3 for power")
12. "tempo_recommendation" — Recommended tempo if applicable (e.g., "3-1-2-0 for hypertrophy emphasis")
13. "video_search_term" — Best YouTube/search term to find a demo of this exact exercise
14. "coaching_reference" — "Starting Strength", "Becoming a Supple Leopard", "McGill", or "Coach Matt"
15. "is_fix_it" — boolean, true if this is a corrective/mobility/prehab exercise
16. "fix_it_protocol" — Array of protocols this belongs to (e.g., ["Hip Mobility", "Squat Prep"])
17. "client_type" — Array of client types: ["youth", "adult", "athlete", "senior", "rehab"]
18. "sport" — Array of sports this exercise particularly benefits

CREATIVITY: ${creativityInstruction}

PARAMETERS:
- CATEGORY: ${category}
- EQUIPMENT AVAILABLE: ${equipment}
- EXPERIENCE LEVEL: ${level}
- AGE GROUP: ${ageGroup}
- MOVEMENT PATTERN FOCUS: ${movementPattern}${focusStr}${sportStr}${fixItStr}

EXISTING EXERCISES IN LIBRARY (avoid exact duplicates):
${existingContext}

IMPORTANT:
- Generate exercises that DON'T already exist in the library (avoid: ${existingNames.slice(0, 50).join(", ")})
- Every exercise must have a clear, specific purpose — no filler
- Coaching cues must sound like Rippetoe or Starrett, not generic fitness advice
- If generating corrective/fix-it exercises, they must address specific movement dysfunctions
- Include the EXACT coaching cue language from SS and BASL where applicable
- Sets/reps guidance should reflect the exercise's purpose (strength = lower reps, power = explosive, mobility = time-based)
- Think about exercises a 20-year veteran coach would know but a personal trainer certification wouldn't cover`;

    const userPrompt = `Generate exactly ${quantity} unique, high-quality exercises for the M² Performance Training exercise library. ${isFixIt ? "These should be corrective/mobility/fix-it exercises." : "These should be training exercises."} Make them diverse — vary movement patterns, loading strategies, and purposes. Each exercise must be something Coach Matt would actually program and be proud of.${includeProgressions ? " Include progressions for each." : ""}${includeRegressions ? " Include regressions for each." : ""}${includeCommonMistakes ? " Include common mistakes for each." : ""}`;

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
              name: "create_exercises",
              description: "Create an array of exercises for the exercise library",
              parameters: {
                type: "object",
                properties: {
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Clear, specific exercise name" },
                        the_why: { type: "string", description: "Why Coach Matt programs this — biomechanical purpose, muscles trained, sport transfer" },
                        focus_area: { type: "array", items: { type: "string" }, description: "Movement patterns and muscle groups" },
                        equipment_needed: { type: "string", description: "Equipment required" },
                        level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                        coaching_cues: { type: "array", items: { type: "string" }, description: "3-5 specific coaching cues referencing SS/BASL" },
                        common_mistakes: { type: "array", items: { type: "string" }, description: "2-3 common mistakes and fixes" },
                        progressions: { type: "array", items: { type: "string" }, description: "1-3 harder variations" },
                        regressions: { type: "array", items: { type: "string" }, description: "1-3 easier variations" },
                        sport_transfer: { type: "array", items: { type: "string" }, description: "Sports this benefits" },
                        sets_reps_guidance: { type: "string", description: "Typical programming recommendation" },
                        tempo_recommendation: { type: "string", description: "Recommended tempo notation" },
                        video_search_term: { type: "string", description: "Best search term for video demo" },
                        coaching_reference: { type: "string", enum: ["Starting Strength", "Becoming a Supple Leopard", "McGill", "Coach Matt"] },
                        is_fix_it: { type: "boolean", description: "True if corrective/mobility exercise" },
                        fix_it_protocol: { type: "array", items: { type: "string" }, description: "Protocols this belongs to" },
                        client_type: { type: "array", items: { type: "string" }, description: "Client types suited for" },
                        sport: { type: "array", items: { type: "string" }, description: "Sports this benefits" },
                      },
                      required: ["title", "the_why", "focus_area", "equipment_needed", "level", "coaching_cues", "common_mistakes", "progressions", "regressions", "sport_transfer", "sets_reps_guidance", "coaching_reference", "is_fix_it", "fix_it_protocol", "client_type", "sport"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["exercises"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_exercises" } },
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

    return new Response(JSON.stringify({ exercises: parsed.exercises || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-exercises error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
