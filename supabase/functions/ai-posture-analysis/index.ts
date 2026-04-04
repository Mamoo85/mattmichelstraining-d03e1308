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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Auth failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { frontImageBase64, sideImageBase64, subjectName } = await req.json();
    if (!frontImageBase64 || !sideImageBase64) {
      return new Response(JSON.stringify({ error: "Both front and side images are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch available programs for upsell recommendations
    const { data: programs } = await supabaseClient
      .from("training_programs")
      .select("id, title, category, level, sport, price, description")
      .eq("is_active", true)
      .order("title");

    const programList = (programs || [])
      .map((p: any) => `- "${p.title}" | ${p.category} | ${p.level} | $${p.price}`)
      .join("\n");

    const systemPrompt = `You are an expert posture and biomechanics analyst for M2 Development, coached by Matt Michels.

Analyze the two photos (front view and side view) for postural deviations and movement dysfunctions.

Your analysis MUST include these sections:

## Overall Posture Score
Rate 1-100 with a quick summary.

## Findings (Front View)
- Head position (forward head posture, tilt)
- Shoulder symmetry (elevation, protraction)
- Hip alignment (lateral tilt, rotation)
- Knee alignment (valgus/varus)
- Foot position (pronation/supination)

## Findings (Side View)
- Cervical spine position
- Thoracic kyphosis
- Lumbar lordosis / anterior pelvic tilt
- Knee hyperextension
- Ankle position

## Risk Areas
Flag any areas with 🟢 Low, 🟡 Moderate, or 🔴 High risk of pain or injury.

## Corrective Action Plan
For each finding, prescribe 2-3 specific exercises with sets/reps. Group by priority:
1. **Immediate** — do these daily
2. **Short-term** — add within 2 weeks
3. **Long-term** — integrate into training

## Recommended M² Programs
Based on the findings, recommend the most relevant training programs from the catalog below. Explain WHY each addresses their specific postural needs.

AVAILABLE PROGRAMS:
${programList}

## Coach Matt's Note
End with a brief, encouraging note in Coach Matt's voice — direct, practical, motivating. Mention that for a deeper dive with progressive programming, they can book a session or grab one of the recommended programs.

Be specific and actionable. Never diagnose medical conditions — stick to movement and posture analysis.`;

    const imageContent = [
      { type: "text" as const, text: `Analyze the posture of ${subjectName || "this person"} from these two photos. First image is the FRONT view, second is the SIDE view.` },
      { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${frontImageBase64}` } },
      { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${sideImageBase64}` } },
    ];

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
          { role: "user", content: imageContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || "No analysis generated";

    return new Response(JSON.stringify({
      analysis,
      subjectName: subjectName || "Self",
      analyzedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-posture-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
