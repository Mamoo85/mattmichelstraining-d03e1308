import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseUser.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { childUserId, month, year } = await req.json();
    if (!childUserId) {
      return new Response(JSON.stringify({ error: "childUserId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reportMonth = month || new Date().getMonth() + 1;
    const reportYear = year || new Date().getFullYear();
    const startDate = new Date(reportYear, reportMonth - 1, 1).toISOString();
    const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59).toISOString();

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const [profileRes, logsRes, workoutLogsRes, pointsRes, coachNotesRes, challengeRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, athlete_name").eq("user_id", childUserId).single(),
      supabaseAdmin.from("progress_logs").select("*").eq("user_id", childUserId).gte("logged_at", startDate).lte("logged_at", endDate).order("logged_at"),
      supabaseAdmin.from("workout_logs").select("*").eq("user_id", childUserId).gte("started_at", startDate).lte("started_at", endDate),
      supabaseAdmin.from("user_points").select("total_points, level").eq("user_id", childUserId).single(),
      supabaseAdmin.from("coach_notes").select("note, created_at").eq("user_id", childUserId).gte("created_at", startDate).lte("created_at", endDate).order("created_at"),
      supabaseAdmin.from("challenge_participants").select("current_value, challenge_id").eq("user_id", childUserId),
    ]);

    const athleteName = profileRes.data?.athlete_name || profileRes.data?.full_name || "Athlete";
    const monthName = new Date(reportYear, reportMonth - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

    const context = {
      athlete: athleteName,
      month: monthName,
      progressLogs: logsRes.data || [],
      workoutSessions: workoutLogsRes.data?.length || 0,
      totalPoints: pointsRes.data?.total_points || 0,
      level: pointsRes.data?.level || "rookie",
      coachNotes: coachNotesRes.data || [],
      challengeParticipation: challengeRes.data || [],
    };

    // Find PRs this month
    const prs: Record<string, { weight: number; reps: number }> = {};
    for (const log of context.progressLogs) {
      const key = log.exercise_name;
      if (!prs[key] || log.weight > prs[key].weight) {
        prs[key] = { weight: log.weight, reps: log.reps };
      }
    }

    const systemPrompt = `You are writing a monthly progress report for a youth athlete's parent. The tone should be warm, professional, and encouraging — like a coach writing a report card.

Structure the report as:
1. **Monthly Summary** — 2-3 sentences overview of the month
2. **Attendance & Consistency** — How many sessions, training frequency
3. **Personal Records (PRs)** — Highlight any new bests with specific numbers
4. **Effort & Attitude** — Based on coach notes, describe work ethic
5. **Areas of Growth** — What improved this month
6. **Focus Areas** — What to work on next month (positive framing)
7. **Coach's Note** — A personal closing note from "Coach Matt"

Use specific numbers and exercise names. Keep it positive but honest. Parents want to see their investment is paying off.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a parent progress report for ${athleteName} for ${monthName}.\n\nData:\n${JSON.stringify({ ...context, prs }, null, 2)}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const report = aiData.choices?.[0]?.message?.content || "No report generated";

    return new Response(JSON.stringify({
      report,
      athlete: athleteName,
      month: monthName,
      stats: {
        sessions: context.workoutSessions,
        totalLogs: context.progressLogs.length,
        points: context.totalPoints,
        level: context.level,
        prs,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-parent-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
