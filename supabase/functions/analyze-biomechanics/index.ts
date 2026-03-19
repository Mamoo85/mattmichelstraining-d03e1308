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
    // 1. Auth check
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
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // 2. Admin check via has_role RPC
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

    // 3. Parse input
    const { mediaUrl, clientUserId } = await req.json();
    if (!mediaUrl || !clientUserId) {
      return new Response(JSON.stringify({ error: "mediaUrl and clientUserId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Call Lovable AI Gateway with vision + tool calling for structured output
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert sports biomechanics and posture analyst for a strength & conditioning coach. Analyze the provided image/video of an athlete's movement or posture. Identify biomechanical issues, compensations, and asymmetries. Then create a corrective 8-week program block. Use the provided tool to return structured data.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this athlete's biomechanics and posture from the uploaded media. Provide detailed findings and a structured 8-week corrective program.",
              },
              {
                type: "image_url",
                image_url: { url: mediaUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "biomechanics_assessment",
              description: "Return structured biomechanics assessment with findings and an 8-week corrective program.",
              parameters: {
                type: "object",
                properties: {
                  findings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of biomechanical findings, compensations, and observations",
                  },
                  program: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      duration_weeks: { type: "number" },
                      weeks: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            week: { type: "number" },
                            focus: { type: "string" },
                            exercises: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  name: { type: "string" },
                                  sets: { type: "number" },
                                  reps: { type: "string" },
                                  notes: { type: "string" },
                                },
                                required: ["name", "sets", "reps"],
                                additionalProperties: false,
                              },
                            },
                          },
                          required: ["week", "focus", "exercises"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["title", "duration_weeks", "weeks"],
                    additionalProperties: false,
                  },
                },
                required: ["findings", "program"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "biomechanics_assessment" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // 5. Save draft to client_assessments using service role (to bypass RLS cleanly)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: assessment, error: insertError } = await supabaseAdmin
      .from("client_assessments")
      .insert({
        client_user_id: clientUserId,
        admin_user_id: userId,
        media_url: mediaUrl,
        ai_findings: findings,
        draft_program: program,
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
