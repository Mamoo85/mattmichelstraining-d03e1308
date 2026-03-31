import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { businessName, ownerName, city, industry, website, issues, leadId } = await req.json();
    if (!businessName || !industry) {
      return new Response(JSON.stringify({ error: "businessName and industry are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const issueList = (issues as string[])?.length
      ? (issues as string[]).map((i: string) => `- ${i}`).join("\n")
      : "- Weak online presence";

    const greeting = ownerName ? `Hi ${ownerName.split(" ")[0]},` : "Hi there,";
    const websiteLine = website
      ? `I came across ${website} while researching ${industry} businesses in ${city || "your area"}.`
      : `I was looking up ${industry} businesses in ${city || "your area"} and came across your listing.`;

    const prompt = `You are a direct-response copywriter writing a cold outreach email for a digital marketing agency.

Write a personalized cold email from Matt Michels (M2 Performance Training, Grosse Pointe MI) to a prospect.

Business: ${businessName}
Owner: ${ownerName || "the owner"}
Industry: ${industry}
City: ${city || ""}
Website: ${website || "none found"}

Specific issues found with their web presence:
${issueList}

Requirements:
- Start with: ${greeting}
- Second sentence: ${websiteLine}
- 150-200 words total
- Mention 2-3 of the specific issues naturally in the body (not as a list)
- Offer a free audit or quick call
- Sign off as Matt Michels, mattmichelstraining.com, (313) 806-4952
- Conversational, direct, NOT salesy or corporate
- Do NOT use buzzwords like "synergy", "leverage", "game-changer"

Return a JSON object with two keys:
- "subject": a compelling email subject line (under 50 chars)
- "body": the full email text

Return ONLY valid JSON, no markdown fences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
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

    // If leadId provided, save to DB and set status
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
