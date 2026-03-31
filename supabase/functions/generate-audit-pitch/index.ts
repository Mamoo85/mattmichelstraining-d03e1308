import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { businessName, ownerName, city, industry, website, issues } = await req.json();
    if (!businessName || !industry) return new Response(JSON.stringify({ error: "businessName and industry are required" }), { status: 400, headers: corsHeaders });

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

    const issueList = (issues as string[])?.length
      ? (issues as string[]).map((i: string) => `- ${i}`).join("\n")
      : "- Weak online presence";

    const greeting = ownerName ? `Hi ${ownerName.split(" ")[0]},` : "Hi there,";
    const websiteLine = website ? `I came across ${website} while researching ${industry} businesses in ${city || "your area"}.` : `I was looking up ${industry} businesses in ${city || "your area"} and came across your listing.`;

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
- Return ONLY the email text, no subject line, no extra commentary`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const ai = await response.json();
    const email = ai.content?.[0]?.text?.trim() || "Could not generate email. Try again.";

    return new Response(JSON.stringify({ email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-audit-pitch]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
