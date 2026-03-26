import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Auth check — must be logged in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const userId = userData.user.id;
    const { type, context } = await req.json();

    // ── Fetch rich athlete context for all types ──
    const [profileRes, recentLogsRes, recentPRsRes, programsRes] = await Promise.all([
      supabaseClient.from("profiles").select("full_name, athlete_name, subscription_tier, daily_calorie_goal, daily_protein_goal, auto_regulate, is_in_person").eq("user_id", userId).single(),
      supabaseClient.from("workout_logs").select("date, sleep_hours, sleep_quality, soreness, energy, session_notes, duration_minutes").eq("user_id", userId).order("date", { ascending: false }).limit(14),
      supabaseClient.from("progress_logs").select("exercise_name, weight, reps, estimated_1rm, logged_at").eq("user_id", userId).order("logged_at", { ascending: false }).limit(20),
      supabaseClient.from("purchased_programs").select("program_title, sport, is_active").eq("user_id", userId).eq("is_active", true).limit(5),
    ]);

    const profile = profileRes.data;
    const athleteName = profile?.athlete_name || profile?.full_name || "Athlete";
    const recentLogs = recentLogsRes.data || [];
    const recentPRs = recentPRsRes.data || [];
    const activePrograms = programsRes.data || [];

    const athleteContext = `
ATHLETE: ${athleteName} | Tier: ${profile?.subscription_tier || "free"} | In-Person: ${profile?.is_in_person ? "Yes" : "No"}
Active Programs: ${activePrograms.length > 0 ? activePrograms.map((p: any) => p.program_title).join(", ") : "None"}
Recent Logs (${recentLogs.length}): ${recentLogs.slice(0, 7).map((l: any) => `${l.date}: Sleep ${l.sleep_hours || "?"}hrs, Soreness ${l.soreness || "?"}/10, Energy ${l.energy || "?"}/10`).join(" | ")}
Recent Lifts: ${recentPRs.slice(0, 10).map((p: any) => `${p.exercise_name} ${p.weight}lbs x${p.reps}`).join(", ") || "None logged"}`;

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "intake_analyzer": {
        const { data: programs } = await supabaseClient
          .from("training_programs")
          .select("id, title, category, level, sport, description, price")
          .eq("is_active", true)
          .eq("status", "published")
          .order("title");

        const programList = (programs || [])
          .map((p: any) => `- "${p.title}" | Category: ${p.category} | Level: ${p.level} | Sport: ${p.sport || "General"} | $${p.price} | ${p.description}`)
          .join("\n");

        systemPrompt = `You are Coach Matt Michels' AI intake assistant. You analyze an athlete's questionnaire answers and recommend the best training program from the available catalog. Be direct, knowledgeable, and practical. Explain WHY each recommendation fits their specific needs. Consider the athlete's existing training data below when making recommendations.

${athleteContext}`;
        userPrompt = `Analyze this athlete's intake and recommend the best program(s):

Age: ${context.age}
Sport: ${context.sport || "General fitness"}
Experience Level: ${context.experience}
Goals: ${context.goals}
Available Equipment: ${context.equipment}
Injury History: ${context.injuries || "None reported"}
Training Days Available: ${context.daysPerWeek || "3-4"}
${context.additionalNotes ? `Additional Notes: ${context.additionalNotes}` : ""}

AVAILABLE PROGRAMS:
${programList}

Provide:
1. Your #1 recommendation with a clear explanation tied to their goals and data
2. An alternative option
3. Important considerations for their injury history, current training load, or recovery patterns
4. Whether they should consider a subscription tier for ongoing coaching

Keep it under 300 words. Be specific about which program and why.`;
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

        systemPrompt = `You are Coach Matt Michels' exercise substitution assistant. When an athlete can't do an exercise, suggest the best alternatives from the M² exercise library. Always explain WHY the substitution works — what movement pattern, muscle group, or training effect is preserved. Consider this athlete's training level and recent lifts.

${athleteContext}`;
        userPrompt = `The athlete needs a substitution:

Original Exercise: ${context.exerciseName}
Reason: ${context.reason}
Available Equipment: ${context.availableEquipment || "Bodyweight only"}
${context.injuryNotes ? `Injury/Limitation: ${context.injuryNotes}` : ""}

EXERCISE LIBRARY:
${exerciseList}

Suggest 2-3 alternatives ranked by best fit. For each:
- Exercise name (must be from the library above)
- Why it's a good substitute (what movement pattern/muscle group it preserves)
- Sets/reps recommendation based on their training level
- Any modifications needed

Keep it under 250 words.`;
        break;
      }

      case "recovery_advisor": {
        systemPrompt = `You are Coach Matt Michels' AI recovery advisor. Analyze an athlete's recent sleep, soreness, and energy data to provide actionable recovery recommendations. Be direct, science-backed, and practical. Reference SPECIFIC trends and data points you see. Never recommend skipping training — instead suggest modifications. Consider their active programs and recent lift numbers.

${athleteContext}`;
        userPrompt = `Analyze this athlete's recovery data and provide personalized recommendations:

DETAILED RECOVERY LOG:
${recentLogs.length > 0 ? recentLogs.map((l: any) => `${l.date}: Sleep ${l.sleep_hours || "?"}hrs (quality: ${l.sleep_quality || "?"}), Soreness: ${l.soreness || "?"}/10, Energy: ${l.energy || "?"}/10, Duration: ${l.duration_minutes || "?"}min${l.session_notes ? ` — "${l.session_notes}"` : ""}`).join("\n") : "No recovery data logged yet."}

Provide:
1. **Recovery Score** — 🟢 Good / 🟡 Caution / 🔴 At Risk
2. Key trends (improving, declining, inconsistent?)
3. Top 3 actionable recommendations specific to their data
4. Training intensity guidance for this week (reference specific lifts)
5. One recovery habit to focus on

Keep it under 300 words. Reference specific data points.`;
        break;
      }

      default:
        throw new Error(`Unknown assist type: ${type}`);
    }

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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Queue the result for admin approval
    const { error: queueError } = await supabaseClient
      .from("ai_action_queue")
      .insert({
        action_type: type,
        target_user_id: userId,
        context: { ...context, _targetUserId: userId },
        ai_result: content,
        status: "pending",
      });

    if (queueError) {
      console.error("Failed to queue AI action:", queueError);
      return new Response(JSON.stringify({ result: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ queued: true, message: "Your request has been submitted for Coach Matt's review. You'll get a notification when it's ready." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-athlete-assist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
