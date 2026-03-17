import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) throw new Error("Admin only");

    const { month, year } = await req.json();
    if (!month || !year) throw new Error("month and year required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are Coach Matt Michels, a strength and conditioning coach with 20+ years of experience. You write in a direct, no-BS, passionate coaching voice. You're creating a Monthly Focus plan for your M² Training members.

The Monthly Focus is about teaching GYM SKILLS — not just exercises. Examples of focus areas:
- Bracing technique (how to properly brace your core every rep)
- Rolling out the psoas (Matt's favorite — the muscle everyone ignores)
- Rolling out calves
- Balance work: toes, heels, inside/outside foot, backwards
- Breathing patterns during lifts
- Grip strength and wrist positioning
- Hip hinge mechanics
- Shoulder mobility and scapular control
- Eccentric control (slow negatives)
- Mind-muscle connection
- Recovery protocols and listening to your body

Write in Matt's voice: passionate, direct, uses "we" and "our", occasionally uses caps for emphasis, references real training scenarios.`;

    const userPrompt = `Generate a Monthly Focus plan for ${getMonthName(month)} ${year}. Return a JSON object with these fields:
- title: A short catchy title (e.g., "Posterior Chain Month", "The Brace Reset")
- topic: The skill/area of focus in 2-3 words
- reasoning: 2-3 paragraphs explaining WHY this matters, written in Matt's coaching voice. Be specific about what we'll focus on and why it matters for longevity and performance.
- exercises: An array of 4-6 specific exercises or drills with sets/reps (e.g., "Dead Bug — 3×8 each side, hold 3 sec")
- matt_quote: A one-liner motivational quote from Matt about this focus area

Return ONLY valid JSON, no markdown.`;

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
        tools: [{
          type: "function",
          function: {
            name: "create_monthly_focus",
            description: "Create the monthly focus plan content",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                topic: { type: "string" },
                reasoning: { type: "string" },
                exercises: { type: "array", items: { type: "string" } },
                matt_quote: { type: "string" },
              },
              required: ["title", "topic", "reasoning", "exercises", "matt_quote"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_monthly_focus" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again in a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed. Add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response from AI");

    const focusContent = JSON.parse(toolCall.function.arguments);

    // Upsert into monthly_focus table as draft
    const { data: inserted, error: insertErr } = await supabase
      .from("monthly_focus")
      .upsert({
        month,
        year,
        title: focusContent.title,
        topic: focusContent.topic,
        reasoning: focusContent.reasoning,
        exercises: focusContent.exercises,
        matt_quote: focusContent.matt_quote,
        status: "draft",
      }, { onConflict: "month,year" })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, focus: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-monthly-focus error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getMonthName(m: number): string {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1] || "";
}
