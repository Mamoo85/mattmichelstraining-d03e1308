import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { industry, client_id } = await req.json().catch(() => ({ industry: null, client_id: null }));
    const targetIndustry = industry || "general_contractor";

    const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
    const apiUrl = LOVABLE_API_KEY
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No AI API key configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiRes = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "perplexity/sonar-reasoning",
        messages: [{
          role: "user",
          content: `You are a hyper-local content strategist for Metro Detroit and Grosse Pointe, Michigan. Research the latest zoning changes, building code updates, permit requirements, or industry news relevant to the "${targetIndustry}" trade in the Metro Detroit area for 2026.

Write a professional, SEO-optimized blog post (600-800 words) that a local ${targetIndustry} business could publish on their website to establish local authority. The post should:
1. Reference specific Michigan or Metro Detroit regulations, codes, or news
2. Be written in plain language for business owners (not lawyers)
3. Include practical implications for local ${targetIndustry} businesses
4. Have a compelling title

Return as JSON: { "title": "...", "body": "..." }`,
        }],
      }),
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let title = "Local Industry Update";
    let body = content;

    try {
      const parsed = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      title = parsed.title || title;
      body = parsed.body || body;
    } catch {
      // Use raw content as body
    }

    // Save draft
    const { data: draft } = await supabase.from("generated_content_drafts").insert({
      industry: targetIndustry,
      title,
      body,
      status: "draft",
      client_id: client_id || null,
    }).select().single();

    return new Response(JSON.stringify({ success: true, draft }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("local-content-generator error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
