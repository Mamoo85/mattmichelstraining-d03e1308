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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const userId = userData.user.id;
    const { type, context } = await req.json();

    // ── Fetch rich athlete context ──
    const [profileRes, recentLogsRes, recentPRsRes, programsRes, pointsRes] = await Promise.all([
      supabaseClient.from("profiles").select("full_name, athlete_name, subscription_tier, daily_calorie_goal, daily_protein_goal, auto_regulate, is_in_person").eq("user_id", userId).single(),
      supabaseClient.from("workout_logs").select("date, sleep_hours, sleep_quality, soreness, energy, session_notes, duration_minutes").eq("user_id", userId).order("date", { ascending: false }).limit(21),
      supabaseClient.from("progress_logs").select("exercise_name, weight, reps, estimated_1rm, logged_at").eq("user_id", userId).order("logged_at", { ascending: false }).limit(30),
      supabaseClient.from("purchased_programs").select("program_title, sport, is_active").eq("user_id", userId).eq("is_active", true).limit(5),
      supabaseClient.from("user_points").select("total_points, level, current_streak").eq("user_id", userId).single(),
    ]);

    const profile = profileRes.data;
    const athleteName = profile?.athlete_name || profile?.full_name || "Athlete";
    const tier = profile?.subscription_tier || "free";

    // Build athlete context string
    const recentLogs = (recentLogsRes.data || []);
    const recentPRs = (recentPRsRes.data || []);
    const activePrograms = (programsRes.data || []);
    const points = pointsRes.data;

    const athleteContext = `
ATHLETE PROFILE:
- Name: ${athleteName}
- Tier: ${tier}
- In-Person Client: ${profile?.is_in_person ? "Yes" : "No"}
- Auto-Regulate Enabled: ${profile?.auto_regulate ? "Yes" : "No"}
- Nutrition Goals: ${profile?.daily_calorie_goal ? `${profile.daily_calorie_goal} cal / ${profile.daily_protein_goal}g protein` : "Not set"}
- Level: ${points?.level || "rookie"} (${points?.total_points || 0} pts, ${points?.current_streak || 0}-day streak)

ACTIVE PROGRAMS: ${activePrograms.length > 0 ? activePrograms.map((p: any) => `${p.program_title}${p.sport ? ` (${p.sport})` : ""}`).join(", ") : "None"}

RECENT WORKOUT LOG (last 3 weeks):
${recentLogs.length > 0 ? recentLogs.map((l: any) => `${l.date}: Sleep ${l.sleep_hours || "?"}hrs (Q:${l.sleep_quality || "?"}), Soreness ${l.soreness || "?"}/10, Energy ${l.energy || "?"}/10, Duration ${l.duration_minutes || "?"}min${l.session_notes ? ` — "${l.session_notes}"` : ""}`).join("\n") : "No logs yet."}

RECENT LIFTS (last 30 entries):
${recentPRs.length > 0 ? recentPRs.map((p: any) => `${new Date(p.logged_at).toLocaleDateString()}: ${p.exercise_name} ${p.weight}lbs x ${p.reps} (est 1RM: ${p.estimated_1rm || "?"})`).join("\n") : "No lifts logged."}`;

    // Starting Strength / Rippetoe knowledge base — Coach Matt's foundational influences
    const strengthPhilosophy = `
BANNED EXERCISES — Coach Matt NEVER programs these. Do NOT recommend, suggest, or substitute with any of the following:
- Barbell Bent Over Row (any variation). Use Dumbbell Rows, Chest-Supported Rows, Cable Rows, or Seal Rows instead.

FOUNDATIONAL COACHING PHILOSOPHY (from Starting Strength by Mark Rippetoe — a core influence on Coach Matt's training):
- "Physical strength is the most important thing in life." Strength is the foundation of all athletic performance.
- Barbells > machines. "Properly performed, full-range-of-motion barbell exercises are essentially the functional expression of human skeletal and muscular anatomy under a load."
- The 5 core lifts: Squat, Deadlift, Press, Bench Press, Power Clean. These are the foundation of every program.
- Squat below parallel — always. "If it's too heavy to squat below parallel, it's too heavy to have on your back."
- Hip drive is everything. "Drive your hips up out of the bottom" — the posterior chain (glutes, hamstrings, adductors) is the engine.
- Bar path must be vertical over the mid-foot. Any deviation wastes force fighting a moment arm.
- Progressive overload: add weight every session as long as possible. "The program is simple, but not easy."
- Valsalva maneuver for heavy lifts: big breath, brace hard, hold through the rep.
- Soreness is normal; pain is a signal. "Training through soreness is expected. Training through injury is stupid."
- Eat to support training. "You cannot get strong on a calorie deficit." Protein: 1g per lb bodyweight minimum.
- Youth athletes can and should train with barbells when properly coached.
`;

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "recovery_advisor": {
        systemPrompt = `You are Coach Matt Michels' AI recovery advisor — direct, science-backed, and practical. You have access to this athlete's full training history below. Analyze their patterns (sleep trends, soreness trends, energy trends, training volume & frequency) to give PERSONALIZED recovery advice.

${strengthPhilosophy}

Key coaching principles:
- Never recommend skipping training — modify intensity instead
- Reference specific data points ("Your sleep dipped to 5hrs on 3 of the last 7 sessions…")
- Tie recovery advice to their active programs and lift numbers
- Include hydration, nutrition, sleep hygiene, and active recovery tips
- If soreness is consistently 7+/10, flag potential overtraining
- If sleep is consistently <7hrs, make that priority #1
- Consider their streak and level — don't burn out a dedicated athlete
- Quote Rippetoe when relevant — e.g. on soreness vs injury, or eating to recover

${athleteContext}`;
        userPrompt = `Analyze this athlete's recovery data and provide a personalized report:

1. **Recovery Score** — Rate their recovery status (🟢 Good / 🟡 Caution / 🔴 At Risk) based on the data
2. **Key Trends** — What patterns do you see in sleep, soreness, energy over the last 3 weeks?
3. **Top 3 Recommendations** — Specific, actionable recovery advice based on THEIR data
4. **Training Intensity Guidance** — Should they push, maintain, or dial back this week? Be specific about which lifts.
5. **One Habit to Focus On** — The single biggest lever for their recovery right now

Keep it under 300 words. Reference specific data points. Sound like Matt — direct, caring, no-BS.`;
        break;
      }

      case "exercise_substitution": {
        const { data: exercises } = await supabaseClient
          .from("exercise_library")
          .select("id, title, focus_area, sport, equipment_needed, the_why, level")
          .order("title");

        const exerciseList = (exercises || [])
          .map((e: any) => `- ${e.title} | Focus: ${e.focus_area?.join(", ")} | Equipment: ${e.equipment_needed} | Level: ${e.level}`)
          .join("\n");

        systemPrompt = `You are Coach Matt Michels' exercise substitution assistant — knowledgeable, specific, and practical. You know this athlete's training history, current programs, and recent lifts. Use that context to suggest substitutions that fit THEIR level and equipment.

Key principles:
- Preserve the movement pattern and training effect
- Consider the athlete's injury history if mentioned
- Match the difficulty to their level (check their recent lift numbers)
- Explain the biomechanical WHY for each substitution
- If they're in a specific program, keep the substitution aligned with the program's goals

${athleteContext}`;
        userPrompt = `The athlete needs a substitution:

Original Exercise: ${context.exerciseName}
Reason: ${context.reason}
Available Equipment: ${context.availableEquipment || "Not specified"}
${context.injuryNotes ? `Injury/Limitation: ${context.injuryNotes}` : ""}

EXERCISE LIBRARY:
${exerciseList}

Suggest 2-3 alternatives ranked by best fit. For each:
1. **Exercise name** (from the library above when possible)
2. **Why it works** — what movement pattern/muscle group it preserves
3. **Sets/Reps suggestion** — based on their current training level
4. **Coaching cue** — one key form tip

Keep it under 250 words. Be specific and practical.`;
        break;
      }

      case "ask_coach": {
        systemPrompt = `You are Coach Matt Michels' AI assistant. An athlete is asking a training question. You have access to their full profile and training data below. Give a helpful, specific answer using their data. If the question is about form, programming, or something that needs Matt's personal review, mention that you've flagged it for Matt to look at.

Coaching style: Direct, knowledgeable, encouraging. Reference biomechanics when relevant. Never give medical advice — defer to a professional for injury concerns. Keep answers practical and actionable. Quote Rippetoe's Starting Strength when relevant — it's a foundational text for Coach Matt's philosophy.

${strengthPhilosophy}

${athleteContext}`;
        userPrompt = `Athlete's question: "${context.message}"
${context.exerciseName ? `About exercise: ${context.exerciseName}` : ""}
${context.programTitle ? `In program: ${context.programTitle}` : ""}

Give a helpful, personalized answer based on their training data. Keep it under 200 words.`;
        break;
      }

      default:
        throw new Error(`Unknown stream type: ${type}`);
    }

    // Stream the response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed — please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI service unavailable");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-athlete-stream error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
