import { createClient } from "npm:@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { company_name, state, email } = await req.json();
    if (!company_name) {
      return new Response(JSON.stringify({ error: "company_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (email) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("free_tool_leads").insert({ tool_name: "osha_safety_check", email, company_name, input_data: { company_name, state } });
    }

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Search engine not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const searchState = state || "Michigan";

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://detroitwebagent.com",
        "X-Title": "Detroit Web Agency OSHA Check",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          { role: "system", content: "You are a workplace safety compliance research tool. Search OSHA and MIOSHA public databases for safety violations, citations, and workplace incidents. Return ONLY valid JSON." },
          { role: "user", content: `Search for any OSHA, MIOSHA, or workplace safety violations, citations, fines, or workplace injury reports for the company "${company_name}" in ${searchState}.

Check OSHA public enforcement database, MIOSHA records, and any public safety incident reports.

Return ONLY valid JSON:
{
  "violations_found": true/false,
  "violations": [{"date": "YYYY-MM-DD", "type": "Citation/Fine/Incident", "description": "Description", "penalty_amount": "$X,XXX", "severity": "Serious/Willful/Repeat/Other", "standard_violated": "OSHA standard number if available"}],
  "total_penalties": "$X,XXX",
  "risk_level": "Critical/High/Moderate/Low/Clean",
  "summary": "Executive summary",
  "data_sources": ["List of sources checked"]
}

If no violations found, return violations_found: false with an empty violations array and risk_level: "Clean".` },
        ],
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Search failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    let result: any;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { violations_found: false, violations: [], summary: content.slice(0, 500) };
    } catch {
      result = { violations_found: false, violations: [], summary: content.slice(0, 500) };
    }

    return new Response(JSON.stringify({ success: true, company_name, state: searchState, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
