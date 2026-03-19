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
      .select("user_id, full_name, athlete_name, email, subscription_tier, trial_path, created_at, account_role, is_in_person")
      .gte("created_at", yesterday);

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
      const isParent = user.account_role === "parent";
      const isInPerson = user.is_in_person;

      const prompt = `Write a personalized welcome message for a new M² Training member:

Name: ${name}
Email: ${user.email}
Subscription: ${user.subscription_tier}
Trial Path: ${user.trial_path || "standard"}
Account Type: ${isParent ? "Parent account" : "Athlete"}
In-Person Client: ${isInPerson ? "Yes — they train at the studio" : "No — online only"}
Signed Up: ${user.created_at}

Write a warm, direct, personal welcome from Coach Matt. Personalize based on their context:
${isParent ? "- Address them as a parent, mention you'll take care of their kid's training\n- Highlight the parent portal where they can monitor progress" : ""}
${isInPerson ? "- Welcome them to the studio, mention check-in and scheduling features" : "- Highlight the online portal, workout logging, and program features"}
- What to do first (check out their program or log a workout)
- That Matt personally reviews all training questions
- The portal features available to them at the ${user.subscription_tier} tier
- Encourage them to reach out with questions

Keep it under 150 words. Sound like Matt — genuine, practical, not corporate. Sign off as Coach Matt.`;

      const content = await callAI(LOVABLE_API_KEY, prompt);
      if (content) {
        await supabase.from("ai_action_queue").insert({
          action_type: "welcome_drip",
          target_user_id: user.user_id,
          context: { name, email: user.email, tier: user.subscription_tier, trialPath: user.trial_path, accountRole: user.account_role, isInPerson },
          ai_result: content,
          status: "pending",
        });
        results.push(`Welcome drip queued for ${name}`);
      }
    }

    // ─── 2. WEEKLY RECAP — Active users who logged workouts this week ───
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) {
      const { data: activeWorkouts } = await supabase
        .from("workout_logs")
        .select("user_id, date, sleep_hours, soreness, energy, duration_minutes")
        .gte("date", weekAgo);

      const userWorkouts: Record<string, any[]> = {};
      (activeWorkouts || []).forEach(w => {
        if (!userWorkouts[w.user_id]) userWorkouts[w.user_id] = [];
        userWorkouts[w.user_id].push(w);
      });

      const { data: weeklyLogs } = await supabase
        .from("progress_logs")
        .select("user_id, exercise_name, weight, reps, estimated_1rm")
        .gte("logged_at", weekAgo);

      const userPRs: Record<string, any[]> = {};
      (weeklyLogs || []).forEach(l => {
        if (!userPRs[l.user_id]) userPRs[l.user_id] = [];
        userPRs[l.user_id].push(l);
      });

      // Check for PRs — compare to previous best
      const { data: allTimePRs } = await supabase
        .from("progress_logs")
        .select("user_id, exercise_name, weight")
        .lt("logged_at", weekAgo);

      const prMap: Record<string, Record<string, number>> = {};
      (allTimePRs || []).forEach((l: any) => {
        if (!prMap[l.user_id]) prMap[l.user_id] = {};
        if (!prMap[l.user_id][l.exercise_name] || l.weight > prMap[l.user_id][l.exercise_name]) {
          prMap[l.user_id][l.exercise_name] = l.weight;
        }
      });

      const { data: existingRecaps } = await supabase
        .from("ai_action_queue")
        .select("target_user_id")
        .eq("action_type", "weekly_recap")
        .gte("created_at", weekAgo);
      const existingRecapSet = new Set((existingRecaps || []).map(e => e.target_user_id));

      const activeUserIds = Object.keys(userWorkouts);
      if (activeUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, athlete_name, subscription_tier")
          .in("user_id", activeUserIds);

        // Get points/streaks
        const { data: userPointsData } = await supabase
          .from("user_points")
          .select("user_id, total_points, level, current_streak")
          .in("user_id", activeUserIds);
        const pointsMap: Record<string, any> = {};
        (userPointsData || []).forEach((p: any) => { pointsMap[p.user_id] = p; });

        for (const profileItem of (profiles || [])) {
          if (existingRecapSet.has(profileItem.user_id)) continue;

          const workouts = userWorkouts[profileItem.user_id] || [];
          const prs = userPRs[profileItem.user_id] || [];
          const name = profileItem.athlete_name || profileItem.full_name || "Athlete";
          const pts = pointsMap[profileItem.user_id];

          const avgSleep = workouts.filter(w => w.sleep_hours).length > 0
            ? (workouts.reduce((sum, w) => sum + (w.sleep_hours || 0), 0) / workouts.filter(w => w.sleep_hours).length).toFixed(1)
            : "not tracked";
          const avgSoreness = workouts.filter(w => w.soreness).length > 0
            ? (workouts.reduce((sum, w) => sum + (w.soreness || 0), 0) / workouts.filter(w => w.soreness).length).toFixed(1)
            : "not tracked";
          const totalDuration = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);

          // Identify actual PRs this week
          const newPRs = prs.filter((p: any) => {
            const prevBest = prMap[profileItem.user_id]?.[p.exercise_name] || 0;
            return p.weight > prevBest;
          });

          const prSummary = newPRs.length > 0
            ? `🏆 NEW PRs: ${newPRs.map((p: any) => `${p.exercise_name} ${p.weight}lbs`).join(", ")}`
            : "No new PRs this week";

          const liftSummary = prs.length > 0
            ? prs.map((p: any) => `${p.exercise_name}: ${p.weight}lbs x ${p.reps}`).join(", ")
            : "No lifts logged";

          const prompt = `Write a weekly training recap for this athlete:

Name: ${name}
Tier: ${profileItem.subscription_tier}
Level: ${pts?.level || "rookie"} | Points: ${pts?.total_points || 0} | Streak: ${pts?.current_streak || 0} days
Workouts This Week: ${workouts.length}
Total Training Time: ${totalDuration} minutes
Avg Sleep: ${avgSleep} hrs
Avg Soreness: ${avgSoreness}/10
${prSummary}
All Lifts: ${liftSummary}

Write a brief, motivating weekly recap from Coach Matt:
1. Acknowledge their specific effort (reference numbers — workouts, training time, streak)
2. Call out any PRs with enthusiasm, or encourage them to push for one next week
3. If sleep or soreness data suggests recovery issues, mention it briefly
4. One specific thing to focus on next week based on their data
5. Motivational close that references their level/streak

Keep it under 150 words. Direct, personal, encouraging. Sign off as Coach Matt.`;

          const content = await callAI(LOVABLE_API_KEY, prompt);
          if (content) {
            await supabase.from("ai_action_queue").insert({
              action_type: "weekly_recap",
              target_user_id: profileItem.user_id,
              context: { name, tier: profileItem.subscription_tier, workoutCount: workouts.length, avgSleep, avgSoreness, lifts: liftSummary, prs: prSummary, streak: pts?.current_streak || 0, level: pts?.level },
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

    // Fetch service catalog for accurate pricing
    const { data: catalog } = await supabase
      .from("service_catalog")
      .select("item_name, exact_price, category")
      .eq("is_active", true)
      .eq("category", "membership");

    const tierPricing = catalog && catalog.length > 0
      ? catalog.map((c: any) => `- ${c.item_name}: $${c.exact_price}/mo`).join("\n")
      : "- Pro: $49.99/mo\n- Elite: $69.99/mo\n- Team: $89.99/mo";

    const { data: basicUsers } = await supabase
      .from("profiles")
      .select("user_id, full_name, athlete_name, email, subscription_tier")
      .in("subscription_tier", ["basic", "free"]);

    if (basicUsers && basicUsers.length > 0) {
      const { data: recentUpsells } = await supabase
        .from("ai_action_queue")
        .select("target_user_id")
        .eq("action_type", "upsell_nudge")
        .gte("created_at", thirtyDaysAgo);
      const recentUpsellSet = new Set((recentUpsells || []).map(e => e.target_user_id));

      const basicIds = basicUsers.map(u => u.user_id);
      const { data: workoutCounts } = await supabase
        .from("workout_logs")
        .select("user_id")
        .in("user_id", basicIds);

      const countMap: Record<string, number> = {};
      (workoutCounts || []).forEach(w => {
        countMap[w.user_id] = (countMap[w.user_id] || 0) + 1;
      });

      // Get points for engagement context
      const { data: basicPoints } = await supabase
        .from("user_points")
        .select("user_id, total_points, level, current_streak")
        .in("user_id", basicIds);
      const basicPointsMap: Record<string, any> = {};
      (basicPoints || []).forEach((p: any) => { basicPointsMap[p.user_id] = p; });

      for (const user of basicUsers) {
        const count = countMap[user.user_id] || 0;
        if (count < 10 || recentUpsellSet.has(user.user_id)) continue;

        const name = user.athlete_name || user.full_name || "there";
        const pts = basicPointsMap[user.user_id];

        const prompt = `Write a personalized upgrade pitch for a Basic-tier member of M² Training:

Name: ${name}
Current Tier: ${user.subscription_tier}
Total Workouts Logged: ${count}
Level: ${pts?.level || "rookie"} | Points: ${pts?.total_points || 0} | Streak: ${pts?.current_streak || 0} days

Available Upgrades (EXACT PRICING — do not change these numbers):
${tierPricing}

Key upgrade benefits:
- Pro: Custom programming, Fix It injury library, Ask Coach Matt direct messaging, exercise substitutions
- Elite: Everything in Pro + priority coaching responses, in-person session credit, biomechanics assessment
- Team: Everything in Elite + family accounts, team features

This athlete has been consistently training (${count}+ workouts, ${pts?.current_streak || 0}-day streak). Write a personal, non-pushy upgrade message from Coach Matt:
1. Acknowledge their dedication — reference specific numbers (workouts, streak, level)
2. Identify what they're missing that would accelerate their progress
3. Recommend the specific tier that makes sense for their engagement level
4. Keep it casual, not salesy — sound like a coach who genuinely wants them to improve

Keep it under 120 words. Sound like Matt — real talk, no marketing fluff.`;

        const content = await callAI(LOVABLE_API_KEY, prompt);
        if (content) {
          await supabase.from("ai_action_queue").insert({
            action_type: "upsell_nudge",
            target_user_id: user.user_id,
            context: { name, email: user.email, tier: user.subscription_tier, workoutCount: count, level: pts?.level, streak: pts?.current_streak },
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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are Coach Matt Michels — direct, knowledgeable, 20+ years of strength & conditioning experience. Write personalized, no-BS communications for athletes. Always sound human, never corporate. Reference specific data points when provided. Use proper grammar — no text slang." },
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
