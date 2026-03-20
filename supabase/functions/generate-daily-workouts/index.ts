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
      style = "Traditional Strength",
      equipment = "Full Gym",
      audience = "Youth Athlete",
      duration = "45-60 min",
      intensity = "Moderate",
      focusAreas = [],
      ageRange = "",
      coachingDetail = "standard",
      theme = "",
      includeTimeDomains = false,
      creativityLevel = "high",
    } = await req.json();

    // Fetch exercise library for context
    const { data: exercises } = await supabaseClient
      .from("exercise_library")
      .select("id, title, focus_area, equipment_needed, is_fix_it, fix_it_protocol, level")
      .order("title");

    const mainExercises = (exercises || []).filter((e: any) => !e.is_fix_it);
    const rollingExercises = (exercises || []).filter((e: any) =>
      e.is_fix_it && (e.fix_it_protocol || []).some((p: string) => p === "Soft Tissue & Recovery")
    );
    const mobilityExercises = (exercises || []).filter((e: any) =>
      e.is_fix_it && !(e.fix_it_protocol || []).some((p: string) => p === "Soft Tissue & Recovery")
    );

    const formatEx = (e: any) => `- ${e.title} [${e.level}] | Focus: ${(e.focus_area || []).join(", ")} | Equipment: ${e.equipment_needed}${e.fix_it_protocol?.length ? ` | Protocol: ${e.fix_it_protocol.join(", ")}` : ""}`;

    const exerciseContext = `
=== MAIN EXERCISES (${mainExercises.length}) ===
${mainExercises.map(formatEx).join("\n")}

=== ROLLING & SOFT TISSUE TECHNIQUES (${rollingExercises.length}) ===
${rollingExercises.map(formatEx).join("\n")}

=== MOBILITY & CORRECTIVE EXERCISES (${mobilityExercises.length}) ===
${mobilityExercises.map(formatEx).join("\n")}`;

    const detailMap: Record<string, string> = {
      brief: "Keep coaching cues to 1 short sentence — the key thing to focus on.",
      standard: "Write 1-2 sentence coaching cues covering the main technique point and one common mistake to avoid.",
      detailed: "Write 2-3 sentence coaching cues covering technique, common mistakes, tempo/breathing cues, and a progression tip. Sound like Matt — direct, knowledgeable, no-BS.",
    };
    const detailInstruction = detailMap[coachingDetail] || detailMap.standard;

    const focusStr = focusAreas.length > 0 ? `\nPRIMARY FOCUS AREAS: ${focusAreas.join(", ")}. Bias exercise selection toward these muscle groups and movement patterns.` : "";
    const ageStr = ageRange ? `\nAGE RANGE: ${ageRange}. Adjust loading, complexity, and exercise selection to be developmentally appropriate.` : "";
    const themeStr = theme ? `\nWORKOUT THEME/INSPIRATION: "${theme}". Use this to inspire creative workout names, structure, and flow — but keep it practical and coach-approved.` : "";

    const creativityMap: Record<string, string> = {
      standard: "Use proven, classic workout structures. Reliable and effective.",
      high: "Be creative with workout names, exercise pairings, and flow. Think outside the box — superset antagonists, use complexes, tri-sets, mechanical drop sets, cluster sets, density blocks. Make workouts that athletes REMEMBER and talk about. Avoid cookie-cutter templates.",
      experimental: "Push boundaries. Invent unique workout formats — positional complexes, EMOM ladders, wave-loaded supersets, movement flow sequences, partner challenges, timed density blocks with progressive overload built in. Every workout should feel like Matt designed it specifically for this group.",
    };
    const creativityInstruction = creativityMap[creativityLevel] || creativityMap.high;

    const systemPrompt = `You are Coach Matt Michels — 20+ years of strength & conditioning experience, owner of M² Performance Training. You program COMPLETE, REAL workouts that you'd actually give to clients walking into your facility. Your voice is direct, motivating, and knowledgeable.

BANNED EXERCISES — Coach Matt NEVER programs these:
- Barbell Bent Over Row (any variation). Use Dumbbell Rows, Chest-Supported Rows, Cable Rows, or Seal Rows instead.
- ALL traditional bodybuilding isolation exercises: bicep curls, tricep kickbacks, lateral raises, leg extensions, leg curls (machine), cable flyes, pec deck, preacher curls, concentration curls, skull crushers, tricep pushdowns, calf raises (machine), shrugs, front raises, rear delt flyes on machine, etc.
- ALL machine-based isolation work: Smith machine anything, leg press, hack squat machine, chest press machine, shoulder press machine, cable crossovers, etc.
- The ONLY acceptable "isolation" movements are corrective/prehab (band pull-aparts, face pulls, McGill Big 3) or from the Fix It / Rehab library.

EXERCISE PHILOSOPHY — Powerlifting & Full-Body Functional:
- Stick to Starting Strength: Squat, Deadlift, Press, Bench Press, Power Clean as the core.
- Accessories = COMPOUND movements: chin-ups/pull-ups, dips, DB rows, chest-supported rows, lunges, RDLs, front squats, push-ups, farmer carries, sled work.
- Conditioning = full-body functional: burpees, box jumps, med ball slams, sled pushes/pulls, KB swings, jump rope, sprints, carries — NOT treadmill or elliptical.
- Arms? Chin-ups and dips — not curl variations.

═══════════════════════════════════════════
MANDATORY WORKOUT STRUCTURE — EVERY workout MUST follow this:
═══════════════════════════════════════════

PHASE 1: SOFT TISSUE / ROLLING (2-4 exercises, 5-8 min)
- EVERY workout starts with targeted foam rolling / lacrosse ball / barbell smash work
- Match rolling to the muscles being trained (e.g., hip flexor + quad roll on squat days, lat + posterior shoulder on pull days)
- Use exercises from the ROLLING & SOFT TISSUE section of the exercise library when possible

PHASE 2: DYNAMIC WARMUP / ACTIVATION (3-5 exercises, 5-8 min)
- Movement prep specific to the workout ahead — NOT generic jumping jacks
- Include: joint circles/CARs for the joints being loaded, activation drills for underactive muscles (glute bridges before squats, band pull-aparts before pressing), dynamic stretches matching the movement patterns
- For youth: make warmups competitive/fun (relay races, partner drills, animal walks)

PHASE 3: MAIN WORK (the core training block, 20-40 min)
- This is where the workout style (${style}) applies
- Compound movements first, accessories after
- Specific sets, reps, rest periods, and tempo where applicable
- Progressive structure within the workout (build intensity, don't start at max)

PHASE 4: FINISHER / CONDITIONING (optional, 5-10 min)
- Metabolic conditioning, core circuit, or sport-specific conditioning
- Should complement the main work, not destroy the athlete
- Can be an AMRAP, EMOM mini-block, or timed set

PHASE 5: COOLDOWN / MOBILITY (2-3 exercises, 5 min)
- Static stretching for the muscles trained
- Breathing drills or parasympathetic downshift (90/90 breathing, crocodile breathing)
- Use exercises from the MOBILITY & CORRECTIVE section when possible

═══════════════════════════════════════════

PARAMETERS:
- WORKOUT STYLE: ${style}
- EQUIPMENT: ${equipment}
- TARGET AUDIENCE: ${audience}
- DURATION: ${duration}
- INTENSITY: ${intensity}
- COACHING DETAIL: ${detailInstruction}${focusStr}${ageStr}${themeStr}

CREATIVITY LEVEL: ${creativityInstruction}

STYLE-SPECIFIC GUIDANCE:
- EMOM: Every Minute on the Minute, 12-24 min. Alternate 2-4 movements. Specify exact work per minute.
- AMRAP: As Many Rounds As Possible, 12-20 min. 4-6 movements per round with specific reps.
- HIIT: Work/rest intervals with specific times (e.g., 40s on/20s off). 8-12 exercises, 2-3 rounds.
- Core Circuit: 6-10 core/stability exercises, 3-4 rounds. Include anti-extension, anti-rotation, anti-lateral flexion, and hip flexion.
- CrossFit/Metcon: Mixed modality — barbell, gymnastics, conditioning. Time-capped or for-time with specific standards.
- Active Recovery: Mobility flow, foam rolling circuit, light movement, yoga-inspired. Low intensity, high quality movement.
- Traditional Strength: Compound lifts with accessories. Specific sets × reps × load guidance (RPE or % 1RM). Superset accessories.
- Complexes: Barbell/DB complexes where the implement doesn't leave your hands. 4-6 movements, 3-5 rounds.
- Contrast Training: Heavy compound lift paired with explosive/plyometric movement (e.g., heavy squat → box jump). Great for athletes.
- Density Block: Fixed time block, max quality reps. Track total volume. Great for hypertrophy.

EQUIPMENT CONSTRAINTS:
- Full Gym: barbells, dumbbells, kettlebells, pull-up bars, cables, boxes, bands, medicine balls, sleds, TRX
- Dumbbells/Kettlebells Only: DB/KB movements only — get creative with loading positions and complexes
- Bodyweight Only: no equipment — use tempo manipulation, isometric holds, unilateral progressions, and plyometrics to create challenge
- Barbell + Rack: barbell, squat rack, bench — classic strength setup
- Resistance Bands: band-only training — accommodating resistance, banded exercises, assisted movements
- Minimal (DB + Band): dumbbells and resistance bands — home gym setup

AUDIENCE GUIDELINES:
- Youth Athlete (11-13): Movement quality, coordination, fun/competitive elements, bodyweight emphasis, NO heavy loading
- Youth Athlete (14-15): Joint/tendon strengthening, moderate loads, technique mastery, sport-specific movement patterns
- Youth Athlete (16-17): Progressive overload, sport-specific power, advanced mobility, competition prep
- Adult/Parent Foundation: Practical fitness, injury prevention, time-efficient, sustainable habits
- Competitive Athlete: Sport-specific power/speed/agility, periodized loading, position-specific demands
- General Fitness: Balanced programming, health-focused, maintainable intensity

EXERCISE LIBRARY (use these when possible for consistency):
${exerciseContext}

IMPORTANT:
- Each exercise MUST have a "phase" field: "rolling", "warmup", "main", "finisher", or "cooldown"
- Total exercises per workout: 12-20 depending on duration
- Be SPECIFIC with sets, reps, rest, tempo, and coaching cues
- Workouts should feel COMPLETE — an athlete should be able to walk in, follow this, and walk out having had a full session
- Creative, memorable workout names — not generic "Upper Body Day A"`;

    const userPrompt = `Generate exactly ${quantity} COMPLETE workouts. Each must include ALL 5 phases (rolling → warmup → main → finisher/conditioning → cooldown). Make them diverse — vary the movement patterns, energy systems, and exercise selection across the batch. ${quantity > 3 ? "Ensure no two workouts feel the same." : ""}`;

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
              description: "Create an array of complete daily workouts with all phases",
              parameters: {
                type: "object",
                properties: {
                  workouts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Creative, memorable workout name" },
                        description: { type: "string", description: "2-3 sentence description in Coach Matt's voice explaining the workout's purpose and what to expect" },
                        target_audience: { type: "string", enum: ["youth", "adult", "all"] },
                        estimated_duration: { type: "string", description: "Estimated total time e.g. '45 min', '60 min'" },
                        intensity_level: { type: "string", enum: ["low", "moderate", "high", "max"] },
                        exercises: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string", description: "Exercise name" },
                              phase: { type: "string", enum: ["rolling", "warmup", "main", "finisher", "cooldown"], description: "Which phase of the workout" },
                              sets: { type: "number", description: "Number of sets (omit for timed work)" },
                              reps: { type: "string", description: "Reps, time, distance, or format (e.g. '12', '30s each side', '400m', 'AMRAP 3 min')" },
                              rest: { type: "string", description: "Rest period (e.g. '60s', '90s', 'none')" },
                              tempo: { type: "string", description: "Tempo notation if applicable (e.g. '3-1-2-0')" },
                              notes: { type: "string", description: "Coaching cue in Matt's voice" },
                            },
                            required: ["name", "phase", "reps"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["title", "description", "target_audience", "estimated_duration", "intensity_level", "exercises"],
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
