import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, system_prompt, max_tokens } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (system_prompt) {
      messages.push({ role: "system", content: system_prompt });
    }
    messages.push({ role: "user", content: query });

    console.log(`[RESEARCH] Query: ${query.slice(0, 100)}...`);

    // Try Lovable AI Gateway first (reliable), fallback to OpenRouter
    let content = "";
    let citations: string[] = [];

    if (LOVABLE_API_KEY) {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          max_tokens: max_tokens || 1200,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        content = data?.choices?.[0]?.message?.content || "";
        console.log(`[RESEARCH] Lovable Gateway: ${content.length} chars`);
      } else {
        const errText = await res.text();
        console.error(`[RESEARCH] Gateway error [${res.status}]: ${errText.slice(0, 300)}`);
      }
    }

    // Fallback to OpenRouter sonar-pro if gateway failed
    if (!content && OPENROUTER_API_KEY) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mattmichelstraining.com",
          "X-Title": "M2 Development Research",
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages,
          max_tokens: max_tokens || 1200,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        content = data?.choices?.[0]?.message?.content || "";
        citations = data?.citations || [];
        console.log(`[RESEARCH] OpenRouter fallback: ${content.length} chars, ${citations.length} citations`);
      } else {
        const errText = await res.text();
        console.error(`[RESEARCH] OpenRouter error [${res.status}]: ${errText.slice(0, 300)}`);
      }
    }

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No API keys configured or all providers failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, content, citations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[RESEARCH] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
