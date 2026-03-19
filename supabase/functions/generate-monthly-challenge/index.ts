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

    const challengeTopic = topic?.trim() || "something fun and athletic";

    const systemPrompt = `You are Coach Matt Michels — a strength coach with 20+ years experience. You're writing for an ADULT and PARENT audience, so keep it professional but with your natural humor and directness.

Study Matt's real personality from these examples (notice the humor, directness, and genuine care — NOT the text shorthand):
- "Helluva workout today! Told you not to listen to the popular consensus on flexibility. We get flexible through strength, baby!"
- "So I think I might have found a way to make your eyelashes sore."
- "I care more about you working out than the money."
- "You've added 10+ lbs this summer. I'd be pretty pumped if I were you. It's natural to be negative, and I think that's one of the reasons you're good at sports — you're never satisfied. But sometimes you need to take a step back and say, 'Look how far I've come,' and just be proud."
- "I'm going to Romulus to pick up a tractor tire to torture people with."
- "Just realized I never texted your guy. Classic Matt."

MATT'S VOICE PATTERNS:
- Use proper grammar and spelling — NO text shortcuts like "u", "cuz", "ppl", "bra"
- Short punchy sentences. No fluff. No fake motivational speaker energy.
- Self-deprecating humor when it fits
- Genuinely warm but also brutally direct
- Light swearing is fine when it lands naturally (not forced)
- Uses "..." for dramatic pauses
- Says things like "helluva", "damn right"
- Always sounds like a real person, never corporate or generic
- The audience is adults and parents — keep it relatable to them

Your job: create a monthly community challenge. Match the energy to the topic.`;

    const userPrompt = `Generate a Monthly Challenge for ${getMonthName(month)} ${year} around: "${challengeTopic}".
${focusContext}

Return structured data via the tool. The description should be 2-3 SHORT punchy sentences in Matt's REAL texting voice — not generic coach speak.`;

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
            name: "create_monthly_challenge",
            description: "Create the monthly challenge content",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Catchy challenge title" },
                description: { type: "string", description: "2-3 funny encouraging sentences" },
                metric_label: { type: "string", description: "What we're counting (reps, minutes, miles, etc.)" },
              },
              required: ["title", "description", "metric_label"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_monthly_challenge" } },
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

    // Return preview only — admin saves manually from the UI
    return new Response(JSON.stringify({
      success: true,
      preview: {
        title: fc.title,
        description: fc.description,
        metric_label: fc.metric_label,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-monthly-challenge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getMonthName(m: number): string {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1] || "";
}
