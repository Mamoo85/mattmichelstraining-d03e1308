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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const {
      calories = 2500,
      proteinG = 180,
      carbsG = 280,
      fatG = 80,
      meals = 4,
      dietaryRestrictions = "none",
      preferences = "",
      athleteGoal = "muscle gain",
      budget = "moderate",
    } = await req.json();

    const systemPrompt = `You are an elite Sports Nutrition Coach creating a weekly meal prep plan for an athlete.

MACRO TARGETS (daily):
- Calories: ${calories} kcal
- Protein: ${proteinG}g
- Carbs: ${carbsG}g
- Fat: ${fatG}g
- Meals per day: ${meals}
- Dietary restrictions: ${dietaryRestrictions}
- Preferences: ${preferences || "none specified"}
- Goal: ${athleteGoal}
- Budget: ${budget}

RULES:
1. Create a 7-day meal plan with ${meals} meals per day
2. Each meal must list: meal name, ingredients with quantities, approximate macros (cal/protein/carbs/fat)
3. Daily totals must be within ±5% of targets
4. Include a consolidated GROCERY LIST at the end organized by category (Proteins, Produce, Grains, Dairy, Pantry)
5. Include MEAL PREP INSTRUCTIONS — what can be batch-cooked on Sunday
6. Prioritize whole foods, simple recipes, and athlete-friendly portions
7. Meals should be practical — no exotic ingredients, minimal cooking time on weekdays
8. Include estimated weekly grocery cost

Format the output cleanly with clear headers for each day.`;

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
          { role: "user", content: `Generate a complete 7-day meal prep plan for an athlete targeting ${calories} calories, ${proteinG}g protein, ${carbsG}g carbs, ${fatG}g fat across ${meals} meals per day. Goal: ${athleteGoal}. Restrictions: ${dietaryRestrictions}. Include grocery list and prep instructions.` },
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
    const mealPlan = aiData.choices?.[0]?.message?.content || "No plan generated";

    return new Response(JSON.stringify({ mealPlan, macros: { calories, proteinG, carbsG, fatG, meals } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-meal-prep error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
