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

    const { month, year, topic } = await req.json();
    if (!month || !year) throw new Error("month and year required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const focusTopic = topic?.trim() || `a gym skill appropriate for ${getMonthName(month)}`;

    const systemPrompt = `You are Coach Matt Michels, a strength and conditioning coach with 20+ years of experience. You're creating a Monthly Focus plan for your M² Training members. Your audience is ADULTS and PARENTS — keep it professional but with your natural humor and directness.

The Monthly Focus is about teaching GYM SKILLS — not just exercises. Examples of focus areas:
- Bracing technique, rolling out the psoas, balance work, breathing patterns during lifts
- Grip strength, hip hinge mechanics, shoulder mobility, eccentric control
- Recovery protocols, mind-muscle connection

Study Matt's real personality (notice the humor and genuine care — NOT the text shorthand):
- "Helluva workout today! Told you not to listen to the popular consensus on flexibility. We get flexible through strength, baby!"
- "You've added 10+ lbs this summer. I'd be pretty pumped if I were you. It's noticeable in the way you look."
- "Sometimes take a step back and say, 'Look how far I've come,' and just be proud."
- "I'm going to Romulus to pick up a tractor tire to torture people with."
- "I care more about you working out than the money."

MATT'S VOICE PATTERNS:
- Use proper grammar and spelling — NO text shortcuts like "u", "cuz", "ppl", "bra"
- Short punchy sentences. No fluff. No fake motivational speaker energy.
- Self-deprecating humor when it fits
- Uses "we" and "our" when talking about training
- Genuine and direct — sometimes warm, sometimes blunt
- Light swearing is fine when natural (not forced)
- References real gym scenarios and real athlete experiences
- The audience is adults and parents — keep it relatable to them`;

    const userPrompt = `Generate a Monthly Focus plan for ${getMonthName(month)} ${year} on the topic: "${focusTopic}".

Return a structured response using the tool provided. Keep ALL text SHORT and PUNCHY — no filler, no fluff.

Fields:
- title: 2-4 word punchy title (e.g., "Posterior Chain Month", "The Brace Reset", "Own the Hinge")
- topic: The skill/area in 2-3 words
- the_why: MAX 2 sentences. Direct. In Matt's voice. Why this matters for longevity and performance. Example tone: "Your posterior chain is the engine behind every athletic movement. If it's weak, everything else compensates — and that's where injuries start."
- biomechanics: 3-4 bullet points on perfect form. Each bullet MAX 12 words.
- common_mistakes: 3-4 bullet points on what to avoid. Each bullet MAX 12 words.
- exercises: 4-5 specific exercises with sets/reps (e.g., "Dead Bug — 3×8 each side, 3 sec hold")
- challenge_metric: One clear monthly goal in one sentence (e.g., "Accumulate 10 minutes total planks over 30 days")
- matt_quote: One punchy line from Matt. Conversational, real, like he'd say it in the gym. No motivational poster energy.`;

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
                the_why: { type: "string" },
                biomechanics: { type: "array", items: { type: "string" } },
                common_mistakes: { type: "array", items: { type: "string" } },
                exercises: { type: "array", items: { type: "string" } },
                challenge_metric: { type: "string" },
                matt_quote: { type: "string" },
              },
              required: ["title", "topic", "the_why", "biomechanics", "common_mistakes", "exercises", "challenge_metric", "matt_quote"],
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

    const fc = JSON.parse(toolCall.function.arguments);

    // Upsert into monthly_focus table as draft
    const { data: inserted, error: insertErr } = await supabase
      .from("monthly_focus")
      .upsert({
        month,
        year,
        title: fc.title,
        topic: fc.topic,
        reasoning: fc.the_why,
        biomechanics: fc.biomechanics || [],
        common_mistakes: fc.common_mistakes || [],
        exercises: fc.exercises,
        challenge_metric: fc.challenge_metric || "",
        matt_quote: fc.matt_quote,
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
