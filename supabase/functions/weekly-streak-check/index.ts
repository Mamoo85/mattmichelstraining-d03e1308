import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WEEKLY-STREAK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate: only allow service-role key
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    logStep("Function started");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Current ISO week identifier (YYYY-WW)
    const now = new Date();
    const oneJan = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
    const currentWeek = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    logStep("Current week", { currentWeek });

    // Last week
    const lastWeekDate = new Date(now.getTime() - 7 * 86400000);
    const lastOneJan = new Date(lastWeekDate.getFullYear(), 0, 1);
    const lastWeekNum = Math.ceil(((lastWeekDate.getTime() - lastOneJan.getTime()) / 86400000 + lastOneJan.getDay() + 1) / 7);
    const lastWeek = `${lastWeekDate.getFullYear()}-W${String(lastWeekNum).padStart(2, "0")}`;

    // Find users who logged at least one activity this week (progress_logs or workout_logs)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    const { data: activeUsers } = await sb
      .from("progress_logs")
      .select("user_id")
      .gte("logged_at", weekStart.toISOString());

    const { data: workoutUsers } = await sb
      .from("workout_logs")
      .select("user_id")
      .gte("created_at", weekStart.toISOString());

    // Combine unique user IDs
    const userSet = new Set<string>();
    (activeUsers || []).forEach((r: any) => userSet.add(r.user_id));
    (workoutUsers || []).forEach((r: any) => userSet.add(r.user_id));

    logStep("Active users this week", { count: userSet.size });

    let awarded = 0;

    for (const userId of userSet) {
      // Get current user_points row
      const { data: up } = await sb
        .from("user_points")
        .select("last_streak_week, weekly_streak")
        .eq("user_id", userId)
        .maybeSingle();

      // Skip if already processed this week
      if (up?.last_streak_week === currentWeek) continue;

      // Check if streak continues (last_streak_week was last week)
      const wasConsecutive = up?.last_streak_week === lastWeek;
      const newStreak = wasConsecutive ? (up?.weekly_streak || 0) + 1 : 1;

      // Ensure row exists
      await sb.from("user_points").upsert(
        { user_id: userId, last_streak_week: currentWeek, weekly_streak: newStreak },
        { onConflict: "user_id" }
      );

      // Update streak fields
      await sb.from("user_points").update({
        last_streak_week: currentWeek,
        weekly_streak: newStreak,
      }).eq("user_id", userId);

      // Award streak bonus if 2+ consecutive weeks
      if (newStreak >= 2) {
        await sb.rpc("award_points", {
          _user_id: userId,
          _action: "weekly_streak",
          _points: 50,
          _description: `${newStreak}-week training streak 🔥`,
          _reference_id: currentWeek,
        });
        awarded++;
      }
    }

    // Reset streaks for users who were NOT active this week
    // (only if their last_streak_week was last week — meaning they broke it)
    await sb.from("user_points")
      .update({ weekly_streak: 0 })
      .eq("last_streak_week", lastWeek)
      .not("user_id", "in", `(${[...userSet].map(id => `"${id}"`).join(",")})`);

    logStep("Complete", { activeUsers: userSet.size, streakBonusesAwarded: awarded });

    return new Response(JSON.stringify({ success: true, active: userSet.size, awarded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
