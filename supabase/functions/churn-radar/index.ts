import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get all paying users (non-basic tier)
    const { data: payingUsers, error: usersErr } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, subscription_tier")
      .neq("subscription_tier", "basic");

    if (usersErr) throw usersErr;
    if (!payingUsers || payingUsers.length === 0) {
      return new Response(JSON.stringify({ flagged: 0, message: "No paying users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let flaggedCount = 0;

    for (const user of payingUsers) {
      const uid = user.user_id;

      // 2. Get logs from last 30 days (progress_logs + workout_logs)
      const [progressRes, workoutRes] = await Promise.all([
        supabase
          .from("progress_logs")
          .select("logged_at")
          .eq("user_id", uid)
          .gte("logged_at", thirtyDaysAgo),
        supabase
          .from("workout_logs")
          .select("logged_at")
          .eq("user_id", uid)
          .gte("logged_at", thirtyDaysAgo),
      ]);

      const allLogs = [
        ...(progressRes.data || []),
        ...(workoutRes.data || []),
      ];

      // Calculate avg weekly logs over 30 days (~4.3 weeks)
      const avgWeeklyLogs = allLogs.length / 4.3;

      // 3. Count logs in last 7 days
      const recentLogs = allLogs.filter(
        (l) => new Date(l.logged_at).getTime() >= new Date(sevenDaysAgo).getTime()
      );

      // 4. Flag if avg >= 3/week historically AND 0 in last 7 days
      if (avgWeeklyLogs >= 3 && recentLogs.length === 0) {
        // Find days since last log
        const allDates = allLogs.map((l) => new Date(l.logged_at).getTime());
        const lastLogDate = allDates.length > 0 ? Math.max(...allDates) : 0;
        const daysSinceLastLog = lastLogDate
          ? Math.floor((now.getTime() - lastLogDate) / (24 * 60 * 60 * 1000))
          : 30;

        // 5. Upsert - only if no active alert exists (unique index handles this)
        const { error: upsertErr } = await supabase
          .from("retention_alerts")
          .upsert(
            {
              user_id: uid,
              alert_type: "velocity_drop",
              avg_weekly_logs: Math.round(avgWeeklyLogs * 10) / 10,
              days_since_last_log: daysSinceLastLog,
              status: "active",
              created_at: now.toISOString(),
            },
            { onConflict: "user_id", ignoreDuplicates: true }
          );

        if (!upsertErr) flaggedCount++;
      }
    }

    return new Response(
      JSON.stringify({ flagged: flaggedCount, total_checked: payingUsers.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
