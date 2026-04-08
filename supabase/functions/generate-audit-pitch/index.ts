import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { businessName, ownerName, city, industry, website, issues, leadId, gapAnalysis } = await req.json();
    if (!businessName || !industry) {
      return new Response(JSON.stringify({ error: "businessName and industry are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Quality Control: If no gap analysis, flag for manual review ──
    if (!gapAnalysis || gapAnalysis.trim() === "" || gapAnalysis === "Analysis failed — site may be blocking requests") {
      if (leadId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from("outreach_leads")
          .update({ status: "needs_manual_review" })
          .eq("id", leadId);
      }

      return new Response(JSON.stringify({
        error: "no_gap_analysis",
        message: "Gap analysis missing or failed — lead flagged for manual review. No generic email sent.",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const firstName = ownerName ? ownerName.split(" ")[0] : "there";

    const prompt = `You are a cold outreach copywriter for Detroit Web Agency — a no-nonsense digital systems shop in Grosse Pointe, MI.

Write a hyper-personalized cold email from Matt Michels (Lead Web Agent, Detroit Web Agency) to a local business prospect.

CONTEXT:
Business: ${businessName}
Owner: ${ownerName || "the owner"}
Industry: ${industry}
City: ${city || "Metro Detroit"}
Website: ${website || "none found"}

LIVE GAP ANALYSIS (from automated site audit):
"${gapAnalysis}"

STRICT RULES:
1. NO GENERIC INTROS. Never say "Hope this finds you well" or "Dear Business Owner." Start immediately with the business name and a specific observation from the gap analysis above.
2. THE AUDIT HOOK: The first sentence MUST reference the specific technical gap found. Example: "I was looking at the ${businessName} site today and noticed you don't have a way to capture leads after hours."
3. THE PRE-BUILT DEMO PITCH: Instead of asking for a meeting, offer a custom asset. Include a line like: "I actually went ahead and built a quick demo of what an Automated Lead System looks like specifically for ${businessName}. Do you have 2 minutes for me to send the link over?"
4. ZERO BUZZWORDS: Do NOT use "AI", "Synergy", "Algorithm", "Digital Transformation", "Leverage", "Game-Changer", or "Cutting-Edge." Talk like a local Detroit contractor talking to another local business owner.
5. Keep it under 4 sentences total.
6. Sign off: Matt Michels | Lead Web Agent | Detroit Web Agency | (313) 806-4952

Return a JSON object with two keys:
- "subject": a compelling email subject line (under 50 chars, reference the specific gap)
- "body": the full email text

Return ONLY valid JSON, no markdown fences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const ai = await response.json();
    const raw = ai.choices?.[0]?.message?.content?.trim() || "";

    let subject = `Quick question about ${businessName}`;
    let body = raw;

    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.subject) subject = parsed.subject;
      if (parsed.body) body = parsed.body;
    } catch {
      // If JSON parse fails, use raw as body
    }

    // Save to DB and set status
    if (leadId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from("outreach_leads")
        .update({
          ai_drafted_subject: subject,
          ai_drafted_pitch: body,
          ai_drafted_at: new Date().toISOString(),
          status: "awaiting_approval",
        })
        .eq("id", leadId);

      if (updateError) {
        console.error("Failed to save draft to DB:", updateError);
        throw new Error(updateError.message || "Failed to save draft");
      }
    }

    return new Response(JSON.stringify({ subject, email: body }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-audit-pitch]", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
