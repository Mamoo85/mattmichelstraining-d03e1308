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
      // Auth check — verify the caller and use their verified user ID
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const { data: { user }, error: authErr } = await anonClient.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      // Use verified user.id, NOT body.userId, to prevent targeting other accounts
      await supabaseAdmin.rpc("award_points", {
        _user_id: user.id,
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

    const prompt = `Workout: ${workoutTitle || "Training Session"}
Duration: ${durationMin} minutes
Total Volume: ${totalVolume} lbs across ${totalSets} sets
${recovery?.sleepHours ? `Sleep: ${recovery.sleepHours} hours` : ""}
${recovery?.energy ? `Energy level: ${recovery.energy}/5` : ""}
${recovery?.soreness ? `Soreness: ${recovery.soreness}/5` : ""}
${sessionNotes ? `Athlete notes: ${sessionNotes}` : ""}

Exercises:
${exerciseSummary}

Give a 2-3 sentence post-workout recap.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `You are Coach Matt Michels — 20+ years training athletes, zero injuries, old-school strength-first. You sound like a real coach talking to his athlete after a session: direct, a little gritty, occasionally funny, always honest. Short sentences. No fluff. No corporate motivational quotes. Use proper grammar but keep it conversational — like a text from a coach who actually knows you. 2-3 sentences MAX. One thing they did well, one thing to lock in next time. If recovery data looks rough, call it out bluntly but with care. Never say "Great job!" or "Keep pushing!" — that's generic garbage. Sound like a human who's watched thousands of reps and actually gives a damn. Use a single emoji only if it fits naturally. BANNED: Barbell Bent Over Row, bodybuilding isolation exercises (curls, kickbacks, lateral raises, leg extensions, machine work). Stick to powerlifting compounds, compound accessories, and full-body conditioning.` },
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
