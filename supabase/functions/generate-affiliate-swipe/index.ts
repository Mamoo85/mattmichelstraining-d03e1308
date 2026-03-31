import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { trade } = await req.json();
    if (!trade) return new Response(JSON.stringify({ error: "trade is required" }), { status: 400, headers: corsHeaders });

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

    const prompt = `You are a B2B sales copywriter helping a digital marketing agency recruit referral partners.

A referral partner is a ${trade} contractor who will refer OTHER local businesses to the agency.

Generate affiliate outreach swipe files so the ${trade} contractor can easily promote the agency to their network.

Return ONLY valid JSON in this exact format:
{
  "emails": [
    "Full cold email 1 (subject line + body, ~120 words, conversational, peer-to-peer tone)",
    "Full cold email 2 (different angle, ~120 words)",
    "Full cold email 3 (different angle, ~120 words)"
  ],
  "linkedin": [
    "LinkedIn post 1 (~80 words, first-person from the ${trade} contractor recommending the agency to their connections)",
    "LinkedIn post 2 (~80 words, different angle)",
    "LinkedIn post 3 (~80 words, different angle)"
  ],
  "sms": [
    "SMS script 1 (under 160 chars, casual, peer referral tone)",
    "SMS script 2 (under 160 chars, different hook)",
    "SMS script 3 (under 160 chars, different hook)"
  ]
}

The agency being referred is M2 Performance Training / Matt Michels (Grosse Pointe, MI). They offer web design, AI phone answering, text marketing, reputation management, Google Business Profile automation, and 50+ done-for-you digital services for local businesses. Website: mattmichelstraining.com

Make the copy feel natural, like one contractor genuinely recommending a vendor to a peer — not corporate spam.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const ai = await response.json();
    const raw = ai.content?.[0]?.text || "";

    let parsed: { emails: string[]; linkedin: string[]; sms: string[] };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      parsed = {
        emails: ["Could not parse AI response. Try again.", "", ""],
        linkedin: ["Could not parse AI response. Try again.", "", ""],
        sms: ["Could not parse AI response.", "", ""],
      };
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-affiliate-swipe]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
