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

    // Fetch all data in parallel
    const [logsRes, workoutLogsRes, loggedExRes, profileRes] = await Promise.all([
      supabaseClient
        .from("progress_logs")
        .select("exercise_name, weight, reps, estimated_1rm, logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: true }),
      supabaseClient
        .from("workout_logs")
        .select("id, date, session_notes, sleep_hours, sleep_quality, soreness, energy")
        .eq("user_id", userId)
        .order("date", { ascending: true }),
      supabaseClient
        .from("logged_exercises")
        .select("exercise_id, sets_reps_weight, client_notes, log_id, created_at, exercise_library(title, focus_area, equipment_needed)")
        .eq("log_id", userId), // This won't work directly; we need workout log IDs
      supabaseClient
        .from("profiles")
        .select("full_name, athlete_name, created_at")
        .eq("user_id", userId)
        .single(),
    ]);

    const progressLogs = logsRes.data || [];
    const workoutLogs = workoutLogsRes.data || [];
    const profile = profileRes.data;

    // Get logged_exercises via workout_log ids
    const workoutLogIds = workoutLogs.map((w: any) => w.id);
    let loggedExercises: any[] = [];
    if (workoutLogIds.length > 0) {
      // Batch in chunks of 100 to avoid query limits
      for (let i = 0; i < workoutLogIds.length; i += 100) {
        const chunk = workoutLogIds.slice(i, i + 100);
        const { data } = await supabaseClient
          .from("logged_exercises")
          .select("exercise_id, sets_reps_weight, client_notes, log_id, created_at, exercise_library(title, focus_area, equipment_needed)")
          .in("log_id", chunk);
        if (data) loggedExercises = loggedExercises.concat(data);
      }
    }

    // ── Compute raw stats ──
    // 1. PRs by exercise
    const prMap: Record<string, { maxWeight: number; maxReps: number; max1rm: number; count: number; firstDate: string; lastDate: string }> = {};
    for (const log of progressLogs) {
      const name = log.exercise_name;
      if (!prMap[name]) {
        prMap[name] = { maxWeight: 0, maxReps: 0, max1rm: 0, count: 0, firstDate: log.logged_at, lastDate: log.logged_at };
      }
      const entry = prMap[name];
      entry.count++;
      if (log.weight > entry.maxWeight) entry.maxWeight = log.weight;
      if (log.reps > entry.maxReps) entry.maxReps = log.reps;
      if (log.estimated_1rm && log.estimated_1rm > entry.max1rm) entry.max1rm = log.estimated_1rm;
      entry.lastDate = log.logged_at;
    }

    // 2. Total volume from logged_exercises
    let totalSets = 0;
    let totalReps = 0;
    let totalTonnage = 0;
    const focusAreaCount: Record<string, number> = {};

    for (const ex of loggedExercises) {
      const sets = Array.isArray(ex.sets_reps_weight) ? ex.sets_reps_weight : [];
      for (const s of sets) {
        totalSets++;
        const reps = Number(s.reps) || 0;
        const weight = Number(s.weight) || 0;
        totalReps += reps;
        totalTonnage += reps * weight;
      }
      // Focus area tracking
      const areas: string[] = (ex.exercise_library as any)?.focus_area || [];
      for (const area of areas) {
        focusAreaCount[area] = (focusAreaCount[area] || 0) + 1;
      }
    }

    // 3. Training frequency & streaks
    const workoutDates = workoutLogs.map((w: any) => w.date?.split("T")[0]).filter(Boolean);
    const uniqueDates = [...new Set(workoutDates)].sort();
    const totalWorkouts = uniqueDates.length;

    // Weekly frequency
    let weeksActive = 1;
    if (uniqueDates.length >= 2) {
      const first = new Date(uniqueDates[0]);
      const last = new Date(uniqueDates[uniqueDates.length - 1]);
      weeksActive = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    }
    const avgPerWeek = totalWorkouts / weeksActive;

    // Longest streak (consecutive days)
    let longestStreak = 0;
    let currentStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 1) {
        currentStreak++;
      } else {
        if (currentStreak > longestStreak) longestStreak = currentStreak;
        currentStreak = 1;
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    // Current streak (from today backwards)
    let currentActiveStreak = 0;
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
      currentActiveStreak = 1;
      const startIdx = uniqueDates.includes(today)
        ? uniqueDates.indexOf(today)
        : uniqueDates.indexOf(yesterday);
      for (let i = startIdx - 1; i >= 0; i--) {
        const curr = new Date(uniqueDates[i + 1]);
        const prev = new Date(uniqueDates[i]);
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diff <= 1) currentActiveStreak++;
        else break;
      }
    }

    // 4. Recovery averages
    const recoveryLogs = workoutLogs.filter((w: any) => w.sleep_hours || w.soreness || w.energy);
    const avgSleep = recoveryLogs.length > 0
      ? recoveryLogs.reduce((sum: number, w: any) => sum + (Number(w.sleep_hours) || 0), 0) / recoveryLogs.length
      : 0;
    const avgSoreness = recoveryLogs.length > 0
      ? recoveryLogs.reduce((sum: number, w: any) => sum + (Number(w.soreness) || 0), 0) / recoveryLogs.filter((w: any) => w.soreness).length
      : 0;
    const avgEnergy = recoveryLogs.length > 0
      ? recoveryLogs.reduce((sum: number, w: any) => sum + (Number(w.energy) || 0), 0) / recoveryLogs.filter((w: any) => w.energy).length
      : 0;

    // Build stats summary
    const stats = {
      totalWorkouts,
      totalSets,
      totalReps,
      totalTonnageLbs: Math.round(totalTonnage),
      avgSessionsPerWeek: Math.round(avgPerWeek * 10) / 10,
      longestStreak,
      currentStreak: currentActiveStreak,
      weeksActive,
      prs: Object.entries(prMap)
        .map(([name, data]) => ({ exercise: name, ...data }))
        .sort((a, b) => b.count - a.count),
      focusAreaDistribution: Object.entries(focusAreaCount)
        .map(([area, count]) => ({ area, count }))
        .sort((a, b) => b.count - a.count),
      recovery: {
        avgSleepHours: Math.round(avgSleep * 10) / 10,
        avgSoreness: Math.round(avgSoreness * 10) / 10,
        avgEnergy: Math.round(avgEnergy * 10) / 10,
        totalRecoveryLogs: recoveryLogs.length,
      },
      memberSince: profile?.created_at,
      athleteName: profile?.athlete_name || profile?.full_name || "Athlete",
    };

    // ── AI Analysis ──
    const topPRs = stats.prs.slice(0, 15).map(p =>
      `${p.exercise}: ${p.maxWeight}lbs x${p.maxReps} (est 1RM: ${Math.round(p.max1rm)}), ${p.count} sessions, first: ${p.firstDate?.split("T")[0]}, last: ${p.lastDate?.split("T")[0]}`
    ).join("\n");

    const focusStr = stats.focusAreaDistribution.slice(0, 10).map(f => `${f.area}: ${f.count} sets`).join(", ");

    const aiPrompt = `You are Coach Matt — an elite strength coach analyzing an athlete's complete training history. Be direct, data-driven, and actionable.

ATHLETE: ${stats.athleteName}
MEMBER SINCE: ${stats.memberSince?.split("T")[0] || "unknown"}
TOTAL WORKOUTS: ${stats.totalWorkouts} over ${stats.weeksActive} weeks (${stats.avgSessionsPerWeek}/week avg)
TOTAL VOLUME: ${stats.totalSets} sets, ${stats.totalReps} reps, ${stats.totalTonnageLbs.toLocaleString()} lbs total tonnage
CONSISTENCY: Longest streak ${stats.longestStreak} days, current streak ${stats.currentStreak} days
RECOVERY: Avg sleep ${stats.recovery.avgSleepHours}h, avg soreness ${stats.recovery.avgSoreness}/5, avg energy ${stats.recovery.avgEnergy}/5

TOP LIFTS & PROGRESSION:
${topPRs || "No lift data yet"}

BODY PART DISTRIBUTION:
${focusStr || "No focus area data"}

Provide a comprehensive analysis with these sections:
1. STRENGTH PROFILE — Where they stand, strongest lifts, weakest areas
2. PROGRESSION ANALYSIS — Rate of improvement, plateaus, breakthroughs
3. TRAINING BALANCE — Push/pull balance, upper vs lower, any imbalances
4. CONSISTENCY SCORE — Grade their adherence (A-F) with specific feedback
5. RECOVERY INSIGHTS — Sleep and recovery patterns affecting performance
6. TOP 3 PRIORITIES — The most impactful things they should focus on next

Be specific with numbers. Reference their actual data. If data is limited, say so and give recommendations for what to track.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are Coach Matt, an elite strength and conditioning coach. Analyze training data and provide actionable, data-driven insights. Use markdown formatting with ## headers, **bold** for emphasis, and bullet points. Keep it under 600 words." },
          { role: "user", content: aiPrompt },
        ],
      }),
    });

    let aiAnalysis = "";
    if (aiResponse.ok) {
      const aiResult = await aiResponse.json();
      aiAnalysis = aiResult.choices?.[0]?.message?.content || "";
    } else {
      console.error("AI analysis failed:", aiResponse.status);
      aiAnalysis = "AI analysis temporarily unavailable. Your raw stats are displayed above.";
    }

    return new Response(JSON.stringify({ stats, analysis: aiAnalysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-training-history error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
