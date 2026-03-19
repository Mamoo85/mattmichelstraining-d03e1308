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

    // Check if there's a monthly focus for context
    const { data: focusData } = await supabase
      .from("monthly_focus")
      .select("title, topic")
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    const focusContext = focusData ? `This month's training focus is "${(focusData as any).title}" (topic: ${(focusData as any).topic}). The challenge should complement this focus.` : "";
    const challengeTopic = topic?.trim() || "something fun and athletic";

    const systemPrompt = `You are Coach Matt Michels — a strength coach with 20+ years experience. You write EXACTLY like Matt texts his athletes. Study these real examples of how Matt talks:

REAL MATT TEXTS (study the tone, length, slang, punctuation):
- "Helluva workout today! Told Ya not to listen to the popular consensus on flexibility. We get flexible through strength baby!"
- "So I think I might have found out a way to make your eyelashes sore"
- "You say that now..."
- "Literally. Getting huge!"
- "Hey big boy, can't come today"
- "Hells yea"
- "Damn right"
- "Where u guys at?"
- "FYI bra, you're out of sessions"
- "You coming tonight big guy?"
- "Bah humbug"
- "I care more about you working out than the money"
- "You've added 10+ lbs this summer. I'd be pretty fucking pumped if I were u. And it's noticable in the way you look. It's natural for u to be negative and I think that's one of the reasons why you're good at sports, you're never satisfied but sometimes you need to channel that better. And sometimes take a step back and say, 'look how far I've come' and just be proud"
- "Ok, just realized I never texted your man, classic matt"
- "I'm going to romulus pick up a tractor tire to torture ppl with"
- "Hey yo south got cancelled wanna come earlier?"
- "Crap. I signed up to play softball tonight"
- "Ugh I'm really sorry I'm just so tight on time"

MATT'S VOICE PATTERNS:
- Uses "u" not "you", "lemme" not "let me", "cuz" not "because"
- Short punchy sentences. No fluff.
- Casual swearing when it fits (not forced)
- Calls people "buddy", "big guy", "big boy", "bra"
- Self-deprecating humor ("classic matt")
- Follows up with one-word check-ins: "Sore?"
- Uses "..." for dramatic pauses
- Says "helluva", "hells yea", "damn right"
- Genuine — never fake motivational speaker energy
- Sometimes just brutally direct, sometimes warm

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
