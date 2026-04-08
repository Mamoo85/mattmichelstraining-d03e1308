import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

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

    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (system_prompt) {
      messages.push({ role: "system", content: system_prompt });
    }
    messages.push({ role: "user", content: query });

    console.log(`[OPENROUTER-RESEARCH] Query: ${query.slice(0, 100)}...`);

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mattmichelstraining.com",
        "X-Title": "M2 Development Research",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-reasoning",
        messages,
        max_tokens: max_tokens || 1200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[OPENROUTER-RESEARCH] API error [${res.status}]: ${errText.slice(0, 300)}`);
      return new Response(
        JSON.stringify({ error: `OpenRouter returned ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const citations = data?.citations || [];

    console.log(`[OPENROUTER-RESEARCH] Got ${content.length} chars, ${citations.length} citations`);

    return new Response(
      JSON.stringify({ success: true, content, citations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[OPENROUTER-RESEARCH] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
