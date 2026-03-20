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
    const body = await req.json();

    // Handle point awarding for sharing (server-side only)
    if (body.action === "award_share_points") {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseAdmin.rpc("award_points", {
        _user_id: body.userId,
        _action: "share_workout",
        _points: 25,
        _description: "Shared workout to community",
        _reference_id: body.workoutLogId || null,
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AI workout analysis
    const { exercises, duration, recovery, sessionNotes, workoutTitle } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const totalVolume = (exercises || []).reduce(
      (sum: number, ex: any) =>
        sum +
        (ex.sets || []).reduce(
          (s: number, set: any) => s + (set.weight || 0) * (set.reps || 0),
          0
        ),
      0
    );

    const totalSets = (exercises || []).reduce(
      (sum: number, ex: any) => sum + (ex.sets || []).length,
      0
    );

    const durationMin = Math.floor((duration || 0) / 60);

    const exerciseSummary = (exercises || [])
      .map(
        (ex: any) =>
          `- ${ex.title}: ${(ex.sets || []).length} sets (${(ex.sets || [])
            .map((s: any) => `${s.weight}lbs × ${s.reps}`)
            .join(", ")})${ex.flagged ? " [FLAGGED FOR COACH]" : ""}${
            ex.notes ? ` Notes: ${ex.notes}` : ""
          }`
      )
      .join("\n");

    const prompt = `You are Coach Matt's AI assistant analyzing a post-workout session. Be encouraging, specific, and actionable. Keep it to 3-4 sentences.

Workout: ${workoutTitle || "Training Session"}
Duration: ${durationMin} minutes
Total Volume: ${totalVolume} lbs across ${totalSets} sets
${recovery?.sleepHours ? `Sleep: ${recovery.sleepHours} hours` : ""}
${recovery?.energy ? `Energy level: ${recovery.energy}/5` : ""}
${recovery?.soreness ? `Soreness: ${recovery.soreness}/5` : ""}
${sessionNotes ? `Athlete notes: ${sessionNotes}` : ""}

Exercises:
${exerciseSummary}

Provide a brief, motivating analysis covering:
1. What went well
2. One area to focus on next session
3. Recovery recommendation based on the data`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a strength & conditioning coach AI. Brief, motivating, actionable. BANNED EXERCISES — never recommend Barbell Bent Over Row, or ANY bodybuilding isolation exercises (curls, kickbacks, lateral raises, leg extensions, machine work, etc.). Stick to powerlifting compounds (Squat, Deadlift, Press, Bench, Power Clean), compound accessories (chin-ups, dips, rows, lunges, RDLs, carries), and full-body conditioning (burpees, KB swings, box jumps, sled, sprints). Only corrective/prehab isolation is acceptable." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ analysis: "Great workout! Keep pushing and stay consistent. 💪" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Solid session! Keep it up. 💪";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-workout-analysis error:", e);
    return new Response(
      JSON.stringify({ analysis: "Nice work today! Every rep counts. 💪" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
