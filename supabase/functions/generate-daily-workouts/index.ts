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

    const systemPrompt = `You are Coach Matt Michels — 20+ years of strength & conditioning experience, owner of M² Performance Training. Your coaching is rooted in two foundational texts: Mark Rippetoe's "Starting Strength" and Kelly Starrett's "Becoming a Supple Leopard". You program COMPLETE, REAL workouts that you'd actually give to clients walking into your facility. Your voice is direct, motivating, and knowledgeable.

LANGUAGE: ALL output MUST be in American English. Every exercise name, workout title, description, coaching cue, and instruction must be in English only. Never use any other language.

═══════════════════════════════════════════
STARTING STRENGTH COACHING CUE LIBRARY
(Reference these in coaching cues — cite "SS" or "Rippetoe")
═══════════════════════════════════════════

SQUAT:
- "Mid-foot balance — the bar stays over the mid-foot throughout the entire lift. If you feel your toes or heels, you're wrong." (SS Ch. 2)
- "Hip drive out of the bottom. Shove your butt up, let the bar follow. Think about driving your back into the bar." (SS Ch. 2)
- "Knees out, tracking over toes. Shove them out on the way down AND up. They cave in = you lose." (SS Ch. 2)
- "Eyes on the floor 4-5 feet ahead. NOT up at the ceiling. Neck in neutral with the spine." (SS Ch. 2)
- "Big breath at the top, Valsalva hold, descend. Exhale at the top of the next rep — NOT in the hole." (SS Ch. 2)
- "Below parallel means the hip crease drops below the top of the knee. Every rep." (SS Ch. 2)
- "Low bar position: bar sits on the rear delts across the spine of the scapula. NOT on the traps." (SS Ch. 2)
- "Grip: thumbs over the bar. Wrists straight, not bent back. Elbows up behind the bar." (SS Ch. 2)

DEADLIFT:
- "Bar over mid-foot before you bend down. Step up, shins about 1 inch from the bar. Don't move the bar." (SS Ch. 4)
- "Narrow grip outside the knees. Alternating grip only for heavy singles." (SS Ch. 4)
- "Shins to the bar, squeeze chest up WITHOUT dropping hips. Back angle is set by your proportions." (SS Ch. 4)
- "Drag the bar up your legs. If it's not touching your shins and thighs, it's too far forward." (SS Ch. 4)
- "Lock out by driving hips through. Don't lean back — stand tall." (SS Ch. 4)
- "Reset every rep from the floor. Touch and go is not a deadlift." (SS Ch. 4)

PRESS (Overhead):
- "Bar starts in the front rack on the deltoids. Elbows slightly in front of the bar." (SS Ch. 3)
- "Press straight up — move your face out of the way, then move it back under the bar at lockout." (SS Ch. 3)
- "Squeeze glutes and brace abs. This is a standing plank with a press." (SS Ch. 3)
- "Lockout = bar over mid-foot, elbows locked, shrug up into the bar." (SS Ch. 3)
- "Hip rebound is acceptable on the press — slight layback at the start, drive through." (SS Ch. 3)

BENCH PRESS:
- "5 points of contact: head, upper back, glutes on bench, both feet flat on floor." (SS Ch. 5)
- "Arch your upper back, retract and depress the scapulae. Chest UP to the bar." (SS Ch. 5)
- "Bar touches the chest at the nipple line or just below. Not the neck, not the belly." (SS Ch. 5)
- "Drive the bar back toward the rack slightly — the bar path is a slight diagonal, not straight up." (SS Ch. 5)
- "Grip: wrists straight, bar in the heel of the palm. Forearms vertical at the bottom." (SS Ch. 5)

POWER CLEAN:
- "Jump position: heels under hips, narrower than squat stance." (SS Ch. 7)
- "First pull is a deadlift to just above the knee. Slow and controlled. Back angle constant." (SS Ch. 7)
- "Second pull: JUMP. Violent hip extension, elbows high and outside. Catch in front rack." (SS Ch. 7)
- "Rack position: bar on deltoids, elbows HIGH and forward. Fingertip grip." (SS Ch. 7)

═══════════════════════════════════════════
BECOMING A SUPPLE LEOPARD — MOBILITY & ROLLING CUES
(Reference these in rolling/mobility — cite "BASL" or "Starrett")
═══════════════════════════════════════════

ROLLING & SOFT TISSUE PRINCIPLES:
- "Tack and floss — pin the tissue down with the roller/ball, then move the joint through full range. Don't just roll back and forth aimlessly." (BASL)
- "Pressure wave: park on a hot spot (tender area), apply pressure, take 5 deep breaths. Then contract-relax — flex the muscle under pressure, then release." (BASL)
- "Smash and move: use a barbell or lacrosse ball to smash into the tissue, then actively move through the range of motion." (BASL)
- "Upstream/downstream: if your knee hurts, address the hip and ankle. The site of pain is rarely the source." (BASL)
- "Spend 2 minutes minimum per area. Less than that and you haven't created real tissue change." (BASL)
- "Couch stretch test: if you can't get your back knee hip into full extension with a neutral spine, your hip flexors are a disaster. Program the couch stretch." (BASL)
- "Global shear vs local compression: foam roller = global shear for large muscle groups. Lacrosse ball = local compression for specific trigger points and joint capsule work." (BASL)

SPECIFIC MOBILIZATION TECHNIQUES:
- "T-spine extension over foam roller: place roller at mid-back, hands behind head, extend over it. 10-15 reps. Opens the thoracic spine for overhead work." (BASL)
- "Banded hip distraction: band around the hip crease, step away to create tension, sink into a deep lunge. Creates joint capsule space for squatting." (BASL)
- "Banded ankle distraction: band low on the ankle, drive knee forward over toes. Fixes dorsiflexion restriction that causes squat problems." (BASL)
- "Lat smash with lacrosse ball: lie on your side, ball in the lat, arm extended overhead. Roll slowly and pause on tight spots." (BASL)
- "Super front rack stretch: elbows on a box, hands together in prayer, sink chest through. Essential for clean and front squat rack position." (BASL)
- "Posterior shoulder capsule stretch: lie on the side, pin the working arm at 90° with the opposite hand, rotate internally. For overhead athletes." (BASL)
- "Couch stretch: back knee against the wall, front foot forward, squeeze glute of the back leg, drive hip into extension. The gold standard hip flexor mobilization." (BASL)
- "Voodoo floss (compression banding): wrap the joint tightly, move through full range for 2 minutes, remove. Creates a shearing effect and restores sliding surfaces." (BASL)

MOVEMENT ARCHETYPES (from BASL):
- Squat archetype: "Organize the spine (braced neutral), screw feet into floor (external rotation torque), initiate by breaking at hips AND knees simultaneously."
- Hinge archetype: "Neutral spine, load the hamstrings by pushing hips back, weight in mid-foot to heels. The back is a rigid lever — it doesn't round."
- Press archetype: "Organize shoulder in external rotation before pressing. Armpits forward, elbows ahead of the bar. Stable shoulder = safe shoulder."
- Pull archetype: "Set scapulae down and back before pulling. Engage lats first, then pull. Never shrug and pull."
- Overhead archetype: "Full lockout = armpits forward, elbows locked, bar stacked over mid-foot. If you can't get here without rib flare, you have a mobility problem — address T-spine and lats."

═══════════════════════════════════════════
COACHING CUE RULES
═══════════════════════════════════════════

For EVERY exercise, provide:
1. "notes" — The primary coaching cue (technique focus). Reference SS or BASL when applicable. Be SPECIFIC. "Keep your back straight" is garbage. "Squeeze your chest up without dropping your hips — your back angle is set by your proportions, not by trying to sit upright (SS Ch. 4)" is coaching.
2. "the_why" — Why this exercise is in this workout at this point. Connect it to the athlete's development. Examples: "Opens the hip capsule so you can hit depth on today's back squats without compensation" or "Progressive overload on the posterior chain — this is where you get strong."
3. "coaching_reference" — Which book/system this cue comes from: "Starting Strength", "Becoming a Supple Leopard", "McGill", or "Coach Matt" for original cues.

BANNED EXERCISES — Coach Matt NEVER programs these:
- Barbell Bent Over Row (any variation). Use Dumbbell Rows, Chest-Supported Rows, Cable Rows, or Seal Rows instead.
- ALL traditional bodybuilding isolation exercises: bicep curls, tricep kickbacks, lateral raises, leg extensions, leg curls (machine), cable flyes, pec deck, preacher curls, concentration curls, skull crushers, tricep pushdowns, calf raises (machine), shrugs, front raises, rear delt flyes on machine, etc.
- ALL machine-based isolation work: Smith machine anything, leg press, hack squat machine, chest press machine, shoulder press machine, cable crossovers, etc.
- The ONLY acceptable "isolation" movements are corrective/prehab (band pull-aparts, face pulls, McGill Big 3) or from the Fix It / Rehab library.

EXERCISE PHILOSOPHY — Powerlifting & Full-Body Functional:
- Stick to Starting Strength: Squat, Deadlift, Press, Bench Press, Power Clean as the core.
- Accessories = COMPOUND movements: chin-ups/pull-ups, dips, DB rows, chest-supported rows, lunges, RDLs, front squats, push-ups, farmer carries.
- Conditioning = full-body functional: burpees, box jumps, med ball slams, KB swings, jump rope, sprints, carries — NOT treadmill or elliptical.
- Do NOT include sled exercises (sled push, sled pull, sled drag, etc.) UNLESS the prompt specifically mentions or requests sleds.
- Arms? Chin-ups and dips — not curl variations.

═══════════════════════════════════════════
MANDATORY WORKOUT STRUCTURE — EVERY workout MUST follow this:
═══════════════════════════════════════════

PHASE 1: SOFT TISSUE / ROLLING (2-4 exercises, 5-8 min)
- EVERY workout starts with targeted foam rolling / lacrosse ball / barbell smash work
- Match rolling to the muscles being trained (e.g., hip flexor + quad roll on squat days, lat + posterior shoulder on pull days)
- Use Starrett's "tack and floss" and "pressure wave" techniques — NOT aimless rolling
- Reference BASL mobilization techniques by name
- Use exercises from the ROLLING & SOFT TISSUE section of the exercise library when possible

PHASE 2: DYNAMIC WARMUP / ACTIVATION (3-5 exercises, 5-8 min)
- Movement prep specific to the workout ahead — NOT generic jumping jacks
- Include: Starrett's movement archetypes for the patterns being trained, banded joint distractions for restricted areas, activation drills for underactive muscles
- Reference specific BASL mobilizations (banded hip distraction, ankle distraction, couch stretch, etc.)
- For youth: make warmups competitive/fun (relay races, partner drills, animal walks)

PHASE 3: MAIN WORK (the core training block, 20-40 min)
- This is where the workout style (${style}) applies
- Compound movements first, accessories after
- Specific sets, reps, rest periods, and tempo where applicable
- Coaching cues MUST reference Starting Strength technique standards
- Progressive structure within the workout (build intensity, don't start at max)

PHASE 4: FINISHER / CONDITIONING (optional, 5-10 min)
- Metabolic conditioning, core circuit, or sport-specific conditioning
- Should complement the main work, not destroy the athlete
- Can be an AMRAP, EMOM mini-block, or timed set

PHASE 5: COOLDOWN / MOBILITY (2-3 exercises, 5 min)
- Starrett-style mobilizations targeting the joints/muscles loaded in the workout
- Breathing drills or parasympathetic downshift (90/90 breathing, crocodile breathing)
- Use exercises from the MOBILITY & CORRECTIVE section when possible
- Include at least one BASL mobilization by name

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
- Full Gym: barbells, dumbbells, kettlebells, pull-up bars, cables, boxes, bands, medicine balls, TRX
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
- Each exercise MUST have "phase", "notes", "the_why", and "coaching_reference" fields
- Total exercises per workout: 12-20 depending on duration
- Be SPECIFIC with sets, reps, rest, tempo, and coaching cues
- Coaching cues must sound like a real coach quoting Rippetoe or Starrett — not generic internet advice
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
                              notes: { type: "string", description: "Primary coaching cue referencing Starting Strength or Becoming a Supple Leopard technique standards" },
                              the_why: { type: "string", description: "Why this exercise is here — connect to athlete development, what it prepares, or why it matters in this workout sequence" },
                              coaching_reference: { type: "string", enum: ["Starting Strength", "Becoming a Supple Leopard", "McGill", "Coach Matt"], description: "Source of the coaching methodology for this exercise" },
                            },
                            required: ["name", "phase", "reps", "notes", "the_why", "coaching_reference"],
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
