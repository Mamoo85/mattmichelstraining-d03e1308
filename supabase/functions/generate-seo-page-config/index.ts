import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { trade, city } = await req.json();
    if (!trade || !city) return new Response(JSON.stringify({ error: "trade and city are required" }), { status: 400, headers: corsHeaders });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!ANTHROPIC_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const slug = `${trade.toLowerCase().replace(/\s+/g, "-")}-${city.toLowerCase().replace(/[\s,]+/g, "-")}`;

    const prompt = `You are an expert local SEO copywriter. Generate a complete landing page configuration for a web design agency targeting local businesses.

Target: ${trade} businesses in ${city}
Agency: M2 Performance Training / Matt Michels — web design, AI marketing, digital services for local businesses

Return ONLY valid JSON:
{
  "slug": "${slug}",
  "title": "SEO page title (55-60 chars, include trade + city + 'Web Design')",
  "metaDescription": "Meta description (150-160 chars, include trade, city, strong CTA)",
  "heroHeadline": "Hero headline (6-10 words, punchy, benefit-focused)",
  "heroSubtext": "Hero subtext (1-2 sentences, 25-35 words, pain point + solution)",
  "serviceBullets": [
    "Service bullet 1 (specific benefit for ${trade} businesses)",
    "Service bullet 2",
    "Service bullet 3",
    "Service bullet 4",
    "Service bullet 5"
  ],
  "faqs": [
    { "q": "FAQ question 1 relevant to ${trade} in ${city}", "a": "Answer (2-3 sentences)" },
    { "q": "FAQ question 2", "a": "Answer (2-3 sentences)" },
    { "q": "FAQ question 3", "a": "Answer (2-3 sentences)" }
  ],
  "ctaText": "CTA button text (3-6 words, action-oriented)"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const ai = await response.json();
    const raw = ai.content?.[0]?.text || "";

    let pageData: Record<string, unknown>;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      pageData = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      throw new Error("AI returned unparseable JSON. Try again.");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb
      .from("seo_page_configs")
      .insert({ trade, city, slug, page_data: pageData })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-seo-page-config]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
