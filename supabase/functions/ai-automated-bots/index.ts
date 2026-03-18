import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const results: string[] = [];

    // ─── 1. WELCOME DRIP — New signups from last 24h without a welcome in queue ───
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: newUsers } = await supabase
      .from("profiles")
      .select("user_id, full_name, athlete_name, email, subscription_tier, trial_path, created_at")
      .gte("created_at", yesterday);

    // Check which users already have a welcome_drip queued
    const newUserIds = (newUsers || []).map(u => u.user_id);
    let existingWelcomes = new Set<string>();
    if (newUserIds.length > 0) {
      const { data: existing } = await supabase
        .from("ai_action_queue")
        .select("target_user_id")
        .eq("action_type", "welcome_drip")
        .in("target_user_id", newUserIds);
      existingWelcomes = new Set((existing || []).map(e => e.target_user_id));
    }

    for (const user of (newUsers || [])) {
      if (existingWelcomes.has(user.user_id)) continue;

      const name = user.athlete_name || user.full_name || "there";
      const prompt = `Write a personalized welcome message for a new M² Training member:

Name: ${name}
Email: ${user.email}
Subscription: ${user.subscription_tier}
Trial Path: ${user.trial_path || "standard"}
Signed Up: ${user.created_at}

Write a warm, direct, personal welcome from Coach Matt. Mention:
1. What to do first (check out their program or log a workout)
2. That Matt personally reviews all training questions
3. The portal features available to them
4. Encourage them to reach out with questions

Keep it under 150 words. Sound like Matt — genuine, practical, not corporate. Sign off as Coach Matt.`;

      const content = await callAI(LOVABLE_API_KEY, prompt);
      if (content) {
        await supabase.from("ai_action_queue").insert({
          action_type: "welcome_drip",
          target_user_id: user.user_id,
          context: { name, email: user.email, tier: user.subscription_tier, trialPath: user.trial_path },
          ai_result: content,
          status: "pending",
        });
        results.push(`Welcome drip queued for ${name}`);
      }
    }

    // ─── 2. WEEKLY RECAP — Active users who logged workouts this week ───
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().split("T")[0];

    // Only run recaps on Sundays (day 0)
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) {
      const { data: activeWorkouts } = await supabase
        .from("workout_logs")
        .select("user_id, date, sleep_hours, soreness, energy")
        .gte("date", weekAgo);

      // Group by user
      const userWorkouts: Record<string, any[]> = {};
      (activeWorkouts || []).forEach(w => {
        if (!userWorkouts[w.user_id]) userWorkouts[w.user_id] = [];
        userWorkouts[w.user_id].push(w);
      });

      // Get PRs this week
      const { data: weeklyLogs } = await supabase
        .from("progress_logs")
        .select("user_id, exercise_name, weight, reps")
        .gte("logged_at", weekAgo);

      const userPRs: Record<string, any[]> = {};
      (weeklyLogs || []).forEach(l => {
        if (!userPRs[l.user_id]) userPRs[l.user_id] = [];
        userPRs[l.user_id].push(l);
      });

      // Check existing recaps this week
      const { data: existingRecaps } = await supabase
        .from("ai_action_queue")
        .select("target_user_id")
        .eq("action_type", "weekly_recap")
        .gte("created_at", weekAgo);
      const existingRecapSet = new Set((existingRecaps || []).map(e => e.target_user_id));

      // Get profiles for active users
      const activeUserIds = Object.keys(userWorkouts);
      if (activeUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, athlete_name, subscription_tier")
          .in("user_id", activeUserIds);

        for (const profile of (profiles || [])) {
          if (existingRecapSet.has(profile.user_id)) continue;

          const workouts = userWorkouts[profile.user_id] || [];
          const prs = userPRs[profile.user_id] || [];
          const name = profile.athlete_name || profile.full_name || "Athlete";

          const avgSleep = workouts.filter(w => w.sleep_hours).length > 0
            ? (workouts.reduce((sum, w) => sum + (w.sleep_hours || 0), 0) / workouts.filter(w => w.sleep_hours).length).toFixed(1)
            : "not tracked";
          const avgSoreness = workouts.filter(w => w.soreness).length > 0
            ? (workouts.reduce((sum, w) => sum + (w.soreness || 0), 0) / workouts.filter(w => w.soreness).length).toFixed(1)
            : "not tracked";

          const prSummary = prs.length > 0
            ? prs.map(p => `${p.exercise_name}: ${p.weight}lbs x ${p.reps}`).join(", ")
            : "No lifts logged";

          const prompt = `Write a weekly training recap for this athlete:

Name: ${name}
Tier: ${profile.subscription_tier}
Workouts This Week: ${workouts.length}
Avg Sleep: ${avgSleep} hrs
Avg Soreness: ${avgSoreness}/10
Lifts Logged: ${prSummary}

Write a brief, motivating weekly recap from Coach Matt:
1. Acknowledge their effort (specific numbers)
2. Highlight any PRs or standout sessions
3. One thing to focus on next week
4. Motivational nudge

Keep it under 120 words. Direct, personal, encouraging. Sign off as Coach Matt.`;

          const content = await callAI(LOVABLE_API_KEY, prompt);
          if (content) {
            await supabase.from("ai_action_queue").insert({
              action_type: "weekly_recap",
              target_user_id: profile.user_id,
              context: { name, tier: profile.subscription_tier, workoutCount: workouts.length, avgSleep, avgSoreness, lifts: prSummary },
              ai_result: content,
              status: "pending",
            });
            results.push(`Weekly recap queued for ${name}`);
          }
        }
      }
    }

    // ─── 3. UPSELL NUDGE — Basic users with 10+ workouts, no upsell in last 30 days ───
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: basicUsers } = await supabase
      .from("profiles")
      .select("user_id, full_name, athlete_name, email, subscription_tier")
      .in("subscription_tier", ["basic", "free"]);

    if (basicUsers && basicUsers.length > 0) {
      // Check existing recent upsells
      const { data: recentUpsells } = await supabase
        .from("ai_action_queue")
        .select("target_user_id")
        .eq("action_type", "upsell_nudge")
        .gte("created_at", thirtyDaysAgo);
      const recentUpsellSet = new Set((recentUpsells || []).map(e => e.target_user_id));

      // Count workouts per user
      const basicIds = basicUsers.map(u => u.user_id);
      const { data: workoutCounts } = await supabase
        .from("workout_logs")
        .select("user_id")
        .in("user_id", basicIds);

      const countMap: Record<string, number> = {};
      (workoutCounts || []).forEach(w => {
        countMap[w.user_id] = (countMap[w.user_id] || 0) + 1;
      });

      for (const user of basicUsers) {
        const count = countMap[user.user_id] || 0;
        if (count < 10 || recentUpsellSet.has(user.user_id)) continue;

        const name = user.athlete_name || user.full_name || "there";
        const prompt = `Write a personalized upgrade pitch for a Basic-tier member of M² Training:

Name: ${name}
Current Tier: ${user.subscription_tier} ($15.99/mo)
Total Workouts Logged: ${count}
Available Upgrades:
- Pro ($49.99/mo): Custom programming, Fix It injury library, Ask Coach Matt
- Elite ($69.99/mo): Everything in Pro + priority coaching, in-person session credit
- Team ($89.99/mo): Everything in Elite + family accounts, team features

This athlete has been consistently training (${count}+ workouts). Write a personal, non-pushy upgrade message from Coach Matt:
1. Acknowledge their dedication and consistency
2. Identify what they're missing that would help them (custom programming, injury prevention)
3. Recommend the Pro tier specifically with 1-2 concrete benefits
4. Keep it casual, not salesy

Keep it under 120 words. Sound like Matt — real talk, no marketing fluff.`;

        const content = await callAI(LOVABLE_API_KEY, prompt);
        if (content) {
          await supabase.from("ai_action_queue").insert({
            action_type: "upsell_nudge",
            target_user_id: user.user_id,
            context: { name, email: user.email, tier: user.subscription_tier, workoutCount: count },
            ai_result: content,
            status: "pending",
          });
          results.push(`Upsell nudge queued for ${name} (${count} workouts)`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-automated-bots error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAI(apiKey: string, userPrompt: string): Promise<string | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are Coach Matt Michels — direct, knowledgeable, 20+ years of strength & conditioning experience. Write personalized, no-BS communications for athletes. Always sound human, never corporate." },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI call failed:", response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("AI call error:", e);
    return null;
  }
}
