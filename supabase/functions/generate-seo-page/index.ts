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
    const { slug, keyword, location, service_type } = await req.json();

    if (!slug || !keyword || !location) {
      return new Response(JSON.stringify({ error: "slug, keyword, and location are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a local SEO content writer for a personal training business called Matt Michels Training based in Grosse Pointe Park, MI. Write complete inner HTML (no html/body/head tags — just inner content starting with a <p> tag) for a page targeting the keyword "${keyword}" in "${location}".

Structure:
- Opening paragraph (2-3 sentences, include keyword naturally)
- 3 H2 sections with 2 paragraphs each covering: training approach, what clients get, local community
- A <ul> with 5 bullet points of benefits
- Closing CTA paragraph mentioning Matt Michels Training and linking to the app

Tone: confident, direct, human — like a coach talking to a client, not a brochure.
Return ONLY raw HTML. No markdown. No fences. No commentary.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the page for keyword: "${keyword}" in "${location}". Service type: ${service_type || "personal training"}.` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    const cleanContent = raw
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const textOnly = cleanContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const metaDescription = textOnly.slice(0, 155).trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("seo_landing_pages").upsert(
      {
        slug,
        page_title: `${keyword} | Matt Michels Training`,
        meta_description: metaDescription,
        h1_heading: keyword,
        main_content: cleanContent,
        target_audience: service_type || "general",
      },
      { onConflict: "slug" }
    );

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, slug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-seo-page error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
