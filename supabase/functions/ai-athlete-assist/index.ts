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

    // Auth check — must be logged in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const { type, context } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "intake_analyzer": {
        // Fetch available programs
        const { data: programs } = await supabaseClient
          .from("training_programs")
          .select("id, title, category, level, sport, description, price")
          .eq("is_active", true)
          .eq("status", "published")
          .order("title");

        const programList = (programs || [])
          .map((p: any) => `- "${p.title}" | Category: ${p.category} | Level: ${p.level} | Sport: ${p.sport || "General"} | $${p.price} | ${p.description}`)
          .join("\n");

        systemPrompt = `You are Coach Matt Michels' AI intake assistant. You analyze an athlete's questionnaire answers and recommend the best training program from the available catalog. Be direct, knowledgeable, and practical. Explain WHY each recommendation fits their specific needs. If their goals involve injury prevention, mention the Fix It library (available with Pro+ subscriptions).`;

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
1. Your #1 recommendation with a clear explanation
2. An alternative option
3. Any important considerations for their injury history or goals
4. Whether they should consider a subscription tier for ongoing coaching

Keep it under 250 words. Be specific about which program and why.`;
        break;
      }

      case "exercise_substitution": {
        // Fetch exercise library
        const { data: exercises } = await supabaseClient
          .from("exercise_library")
          .select("id, title, focus_area, sport, equipment_needed, the_why")
          .order("title");

        const exerciseList = (exercises || [])
          .map((e: any) => `- ${e.title} | Focus: ${e.focus_area?.join(", ")} | Equipment: ${e.equipment_needed}`)
          .join("\n");

        systemPrompt = `You are Coach Matt Michels' exercise substitution assistant. When an athlete can't do an exercise (missing equipment, injury limitation, etc.), you suggest the best alternatives from the M² exercise library. Always explain WHY the substitution works — what movement pattern, muscle group, or training effect is preserved. Be direct and practical.`;

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
- Any modifications needed

Keep it under 200 words.`;
        break;
      }

      case "recovery_advisor": {
        // Fetch recent recovery data
        const { data: recentLogs } = await supabaseClient
          .from("workout_logs")
          .select("date, sleep_hours, sleep_quality, soreness, energy, session_notes")
          .eq("user_id", userData.user.id)
          .order("date", { ascending: false })
          .limit(14);

        const logSummary = (recentLogs || [])
          .map((l: any) => `${l.date}: Sleep ${l.sleep_hours || "?"}hrs (quality: ${l.sleep_quality || "?"}), Soreness: ${l.soreness || "?"}/10, Energy: ${l.energy || "?"}/10${l.session_notes ? ` — "${l.session_notes}"` : ""}`)
          .join("\n");

        systemPrompt = `You are Coach Matt Michels' AI recovery advisor. Analyze an athlete's recent sleep, soreness, and energy data to provide actionable recovery recommendations. Be direct, science-backed, and practical. Reference trends you see in the data. Never recommend skipping training entirely — instead suggest modifications. Include hydration, nutrition, and sleep hygiene tips when relevant.`;

        userPrompt = `Analyze this athlete's last 14 sessions of recovery data and provide recommendations:

${logSummary || "No recovery data logged yet."}

Provide:
1. Key trends you notice (improving, declining, inconsistent?)
2. Top 2-3 actionable recommendations
3. Whether they should modify their training intensity this week
4. One recovery habit to focus on

Keep it under 200 words. Be specific about what the data shows.`;
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

    return new Response(JSON.stringify({ result: content }), {
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
