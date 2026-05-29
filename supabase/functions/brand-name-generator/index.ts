// brand-name-generator — AI business name + slogan generator
//
// POST: { "industry": "coffee shop", "vibe": "modern and playful", "keywords": ["community", "artisan", "local"] }
//
// Response: { success: true, names: [...], slogans: [...], domain_tips: "..." }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateJSON } from "./_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[BRAND-NAMES] ${step}${data ? " -- " + JSON.stringify(data) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: { industry?: string; vibe?: string; keywords?: string[]; order_id?: string };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { industry, vibe, keywords = [], order_id } = body;
  if (!industry) {
    return new Response(JSON.stringify({ error: "Provide industry" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("Generating names", { industry, vibe, keywords });

  const keywordContext = keywords.length > 0 ? `Keywords to consider: ${keywords.join(", ")}.` : "";
  const vibeContext = vibe ? `Brand vibe/personality: ${vibe}.` : "";

  const prompt = `Generate creative business names and slogans for a ${industry} business.
${vibeContext}
${keywordContext}

Requirements:
- Names should be memorable, easy to spell, and domain-friendly
- Mix of different styles: one-word, compound, invented words, descriptive
- Avoid generic or overused business name patterns
- Slogans should be punchy, 5 words or less

Return a JSON object with this exact structure:
{
  "names": ["Name1", "Name2", "Name3", "Name4", "Name5", "Name6", "Name7", "Name8", "Name9", "Name10"],
  "slogans": ["Slogan for Name1", "Slogan for Name2", "Slogan for Name3", "Slogan for Name4", "Slogan for Name5"],
  "domain_tips": "Brief advice on checking domain availability for these names (2 sentences max)"
}`;

  const result = await generateJSON<{ names: string[]; slogans: string[]; domain_tips: string }>(
    prompt,
    { names: [], slogans: [], domain_tips: "Check namecheap.com or godaddy.com for .com availability." },
    800,
  );

  if (!result.names.length) {
    return new Response(JSON.stringify({ error: "Generation failed — all AI providers unavailable" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("Done", { nameCount: result.names.length, order_id });

  return new Response(JSON.stringify({
    success: true,
    order_id: order_id || null,
    names: result.names,
    slogans: result.slogans,
    domain_tips: result.domain_tips,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
