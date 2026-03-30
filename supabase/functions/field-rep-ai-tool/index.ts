import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildPrompt(tool: string, inputs: Record<string, string>): string {
  switch (tool) {
    case "cold_email": {
      const { prospect_name, company, role, pain_point } = inputs;
      return `Write a 5-sentence personalized cold email from Matt Michels to ${prospect_name} at ${company}, who is a ${role}.${pain_point ? ` Their likely pain point: ${pain_point}.` : ""}

Requirements:
- First line must be the subject line formatted exactly as: Subject: [subject here]
- Professional tone, not salesy — focus on value and curiosity
- Reference their company and role naturally
- End with a low-friction call to action (e.g., a 15-minute call)
- Signed from Matt Michels`;
    }

    case "voicemail": {
      const { prospect_name, company, your_name, your_product } = inputs;
      return `Write a 20-second voicemail script for ${your_name} to leave for ${prospect_name} at ${company} about ${your_product}.

Requirements:
- Natural, conversational tone — sounds like a real person, not a script
- Creates genuine curiosity without over-explaining
- Includes a clear, specific callback ask with a suggested time window
- Under 50 words total
- Format: just the spoken words, no stage directions`;
    }

    case "objection": {
      const { objection, product } = inputs;
      return `Give 3 different responses to this sales objection: "${objection}" for the product/service: ${product}.

Requirements:
- Each response is 1-2 sentences max
- Confident but not pushy — acknowledge the concern first
- Each response uses a different approach: (1) reframe, (2) social proof / ask a question, (3) reduce risk
- Label each response as Option 1, Option 2, Option 3
- No fluff, no filler`;
    }

    case "territory": {
      const { zip_code, territory_description, days_available } = inputs;
      return `Create a weekly field sales routing plan for a rep covering ZIP code ${zip_code}. Territory description: ${territory_description}. Days available: ${days_available}.

Requirements:
- Organize each available day with a geographic focus zone to minimize backtracking
- Suggest call density targets per day (number of stops)
- Include best times of day for cold drops vs. scheduled appointments
- Note any routing logic (e.g., start farthest point, work back toward home base)
- Keep it practical and scannable — bullet points by day`;
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tool, inputs, user_email } = await req.json();

    if (!tool || !inputs || !user_email) {
      return new Response(
        JSON.stringify({ error: "tool, inputs, and user_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check active subscription
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: subscriber, error: subError } = await sb
      .from("b2b_subscribers")
      .select("id, active")
      .eq("email", user_email)
      .eq("niche", "field_rep_tools")
      .eq("active", true)
      .maybeSingle();

    if (subError) {
      console.error("[FIELD-REP-AI-TOOL] Subscription check error:", subError);
      return new Response(
        JSON.stringify({ error: "subscription_check_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriber) {
      return new Response(
        JSON.stringify({ error: "subscription_required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for the requested tool
    const prompt = buildPrompt(tool, inputs);

    // Call Claude Haiku
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("[FIELD-REP-AI-TOOL] Anthropic error:", anthropicRes.status, errText);
      throw new Error("AI generation failed");
    }

    const anthropicData = await anthropicRes.json();
    const result = anthropicData.content?.[0]?.text || "";

    return new Response(
      JSON.stringify({ result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[FIELD-REP-AI-TOOL] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
