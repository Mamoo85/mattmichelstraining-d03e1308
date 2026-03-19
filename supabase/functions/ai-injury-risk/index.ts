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

    const { clientUserId } = await req.json();
    if (!clientUserId) {
      return new Response(JSON.stringify({ error: "clientUserId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Gather 30 days of training data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [logsRes, readinessRes, workoutLogsRes, profileRes] = await Promise.all([
      supabaseAdmin.from("progress_logs").select("*").eq("user_id", clientUserId).gte("logged_at", thirtyDaysAgo).order("logged_at", { ascending: false }),
      supabaseAdmin.from("readiness_checks").select("*").eq("user_id", clientUserId).gte("checked_at", thirtyDaysAgo).order("checked_at", { ascending: false }),
      supabaseAdmin.from("workout_logs").select("*").eq("user_id", clientUserId).gte("started_at", thirtyDaysAgo).order("started_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("full_name, athlete_name").eq("user_id", clientUserId).single(),
    ]);

    const athleteName = profileRes.data?.athlete_name || profileRes.data?.full_name || "Athlete";

    const context = {
      athlete: athleteName,
      progressLogs: logsRes.data || [],
      readinessChecks: readinessRes.data || [],
      workoutLogs: workoutLogsRes.data || [],
    };

    const systemPrompt = `You are an elite Sports Science & Injury Prevention AI. Analyze the following 30-day training data for an athlete and produce a comprehensive injury risk assessment.

Your analysis must include:
1. **Volume Load Trends** — Are they ramping too fast (>10% weekly increase)? Monotony score?
2. **Recovery Indicators** — Sleep patterns from readiness checks, weight adjustment trends
3. **Movement Pattern Imbalances** — Are they neglecting muscle groups? Push/pull ratio issues?
4. **Overtraining Signals** — Declining performance (lower weights, fewer reps), increased RPE
5. **Specific Injury Risk Flags** — Based on exercise selection and volume, flag likely injury sites (e.g., shoulder impingement from excessive pressing without pulling)

For each risk, assign a severity: 🟢 Low, 🟡 Moderate, 🔴 High

End with actionable recommendations: deload protocols, exercise swaps, recovery priorities.`;

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
          { role: "user", content: `Here is the 30-day training data for ${athleteName}:\n\n${JSON.stringify(context, null, 2)}` },
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
    const analysis = aiData.choices?.[0]?.message?.content || "No analysis generated";
    const usage = aiData.usage || {};

    return new Response(JSON.stringify({ analysis, athlete: athleteName, usage: { prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0, total_tokens: usage.total_tokens || 0, model: aiData.model || "google/gemini-2.5-flash" } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-injury-risk error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
