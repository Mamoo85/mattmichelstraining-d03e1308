import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Auth failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { imageBase64, exerciseLibrary } = await req.json();
    if (!imageBase64) throw new Error("No image provided");

    // Build exercise list for matching context
    const exerciseNames = (exerciseLibrary || []).map((e: any) => `${e.title} (ID: ${e.id})`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a workout card OCR specialist for M² Training. Your job is to read images of gym whiteboards, workout cards, or handwritten training logs and extract the exercises, sets, reps, and weights.

IMPORTANT RULES:
1. Extract ALL exercises visible in the image
2. For each exercise, identify sets, reps, and weight (if visible)
3. Map each exercise to the CLOSEST match from the exercise library below. Use fuzzy matching — e.g. "Goblet Squat" matches "Goblet Squat", "DB Bench" matches "Dumbbell Bench Press", etc.
4. If no close match exists, use the exercise name as-is and set matchedId to null
5. Always return valid JSON

EXERCISE LIBRARY (use these IDs when matching):
${exerciseNames}

Return ONLY valid JSON (no markdown, no code fences):
{
  "exercises": [
    {
      "name": "exercise name as written on card",
      "matchedTitle": "closest library exercise title",
      "matchedId": "uuid or null if no match",
      "sets": [
        { "set": 1, "reps": 10, "weight": 135 }
      ]
    }
  ],
  "notes": "any additional context from the image (e.g. date, team name, coach notes)"
}

If the image is not a workout card/whiteboard, return:
{ "exercises": [], "notes": "Could not identify workout content in this image." }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read this workout card/whiteboard image and extract all exercises, sets, reps, and weights. Match them to the exercise library."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Vision AI error:", response.status, t);
      throw new Error("Vision AI service unavailable");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    // Parse the JSON from the response
    let parsed;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { exercises: [], notes: "Failed to parse AI response" };
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-workout error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
