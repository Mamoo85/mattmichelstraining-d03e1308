import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(experienceLevel: string, programDuration: string, primaryFocus: string, equipment: string[]) {
  const equipmentStr = equipment.join(", ");

  let levelDirective = "";
  switch (experienceLevel) {
    case "Beginner":
    case "Intermediate":
      levelDirective = `The athlete is ${experienceLevel}. Prioritize motor control and linear progression. Use simple progressions with consistent volume increases. Keep intensity moderate (≤75% 1RM for compound lifts).`;
      break;
    case "Experienced":
      levelDirective = `The athlete is Experienced. Prioritize sub-maximal accumulation, wave loading, and tempos to challenge the athlete without CNS burnout. Cap absolute intensity at 85% 1RM. Use techniques like 3-1-3 tempos and paused reps.`;
      break;
    case "Advanced":
      levelDirective = `The athlete is Advanced. Utilize heavy Russian volume principles (e.g., Sheiko/Smolov high-frequency accumulation) and peaking phases up to 95%+ 1RM. Program complex wave periodization and heavy singles/doubles where appropriate.`;
      break;
  }

  return `You are an elite Strength and Conditioning Coach and Biomechanics Expert. Do NOT provide medical diagnoses. Analyze the provided media for postural deviations and kinetic chain compensations (e.g., anterior pelvic tilt, knee valgus, rounded shoulders, asymmetrical weight shifts).

STRICT PROGRAMMING DIRECTIVES:

Rule 1 — Mobility & Autogenic Inhibition: For every 'overactive' muscle identified in the visual scan, you MUST prescribe specific Autogenic Inhibition techniques (e.g., prolonged PNF stretching, heavy ischemic compression, foam rolling with sustained pressure) in the daily prep section of EVERY phase.

Rule 2 — The Ground-Up Protocol: Every protocol MUST include intrinsic foot and ankle health work (short-foot holds, towel scrunches, loaded dorsiflexion PAILs/RAILs, single-leg balance progressions) regardless of whether upper or lower body findings are present.

Rule 3 — Experience Level Logic: ${levelDirective}

Rule 4 — The Math: You MUST output the exact week-by-week progressive overload math for every exercise. For example: "Week 1: 6×6 @ 70%, Week 2: 7×5 @ 75%, Week 3: 5×4 @ 80%". Every set/rep scheme must include an intensity percentage where applicable.

PARAMETERS:
- Experience Level: ${experienceLevel}
- Program Duration: ${programDuration}
- Primary Focus: ${primaryFocus}
- Available Equipment: ${equipmentStr}

First, provide a bulleted list of your visual findings. Second, generate a structured corrective exercise program matching the specified duration and focus. Format the output cleanly.`;
}

const toolSchema = {
  type: "function",
  function: {
    name: "biomechanics_assessment",
    description: "Return structured biomechanics assessment with findings and a periodized corrective program.",
    parameters: {
      type: "object",
      properties: {
        findings: {
          type: "array",
          items: { type: "string" },
          description: "Array of biomechanical findings, postural deviations, overactive/underactive muscles, and kinetic chain compensations",
        },
        program: {
          type: "object",
          properties: {
            title: { type: "string" },
            phases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  phase_name: { type: "string", description: "e.g. 'Phase 1: Mobility & Activation'" },
                  duration: { type: "string", description: "e.g. '2 Weeks'" },
                  focus: { type: "string" },
                  weekly_progression: {
                    type: "array",
                    items: { type: "string" },
                    description: "Week-by-week overload math, e.g. ['Week 1: 4x8 @ 60%', 'Week 2: 4x8 @ 65%']",
                  },
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        sets: { type: "number" },
                        reps: { type: "string" },
                        intensity_percent: { type: "string", description: "e.g. '70%' or 'bodyweight'" },
                        tempo: { type: "string", description: "e.g. '3-1-3-0' or 'controlled'" },
                        notes: { type: "string" },
                      },
                      required: ["name", "sets", "reps"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["phase_name", "duration", "focus", "exercises"],
                additionalProperties: false,
              },
              description: "Program phases matching the selected duration",
            },
          },
          required: ["title", "phases"],
          additionalProperties: false,
        },
      },
      required: ["findings", "program"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: isAdmin, error: roleError } = await supabaseUser.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      mediaUrl,
      mediaUrls,
      clientUserId,
      experienceLevel = "Intermediate",
      programDuration = "8-Week Full Mesocycle",
      primaryFocus = "Corrective/Mobility",
      equipment = ["Full Gym"],
    } = await req.json();

    if (!mediaUrl || !clientUserId) {
      return new Response(JSON.stringify({ error: "mediaUrl and clientUserId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = buildSystemPrompt(experienceLevel, programDuration, primaryFocus, equipment);

    const allUrls: string[] = mediaUrls?.length ? mediaUrls : [mediaUrl];
    const imageContent = allUrls.map((url: string) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

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
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this athlete's biomechanics and posture from the uploaded media (${allUrls.length} angle(s)). Experience: ${experienceLevel}. Duration: ${programDuration}. Focus: ${primaryFocus}. Equipment: ${equipment.join(", ")}. Provide detailed findings and a structured periodized corrective program with exact weekly progressive overload math.`,
              },
              ...imageContent,
            ],
          },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "biomechanics_assessment" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured tool call output");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const { findings, program } = parsed;

    // Attach generation parameters as metadata inside draft_program
    const programWithMeta = {
      ...program,
      _meta: { experienceLevel, programDuration, primaryFocus, equipment },
    };

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: assessment, error: insertError } = await supabaseAdmin
      .from("client_assessments")
      .insert({
        client_user_id: clientUserId,
        admin_user_id: userId,
        media_url: mediaUrl,
        ai_findings: findings,
        draft_program: programWithMeta,
        status: "draft",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save assessment draft");
    }

    return new Response(JSON.stringify(assessment), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-biomechanics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
