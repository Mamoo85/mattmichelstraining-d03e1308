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
    const { address, property_name, email } = await req.json();
    const query = address || property_name;
    if (!query) {
      return new Response(JSON.stringify({ error: "address or property_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (email) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("free_tool_leads").insert({ tool_name: "equipment_age_check", email, company_name: query, input_data: { address, property_name } });
    }

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Search engine not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://detroitwebagent.com",
        "X-Title": "Detroit Web Agency Equipment Check",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          { role: "system", content: "You are a commercial building infrastructure analyst. Search public records for building permits, HVAC installations, boiler permits, and mechanical system records. Return ONLY valid JSON." },
          { role: "user", content: `Search public municipal records, building permits, and property data for the commercial property at "${query}" in the Metro Detroit / Michigan area.

Find:
1. Date of last major HVAC or boiler permit pulled
2. Date of last roofing permit
3. Date of last electrical upgrade permit
4. Building age / year built
5. Any mechanical system installation records

Return ONLY valid JSON:
{
  "property_found": true/false,
  "property_name": "Name if found",
  "year_built": 1985,
  "equipment_records": [{"system": "Boiler/HVAC/Roof/Electrical", "last_permit_date": "YYYY or YYYY-MM", "estimated_age_years": 15, "typical_lifespan_years": 20, "replacement_urgency": "Overdue/Due Soon/OK"}],
  "overall_risk": "Critical/High/Moderate/Low",
  "estimated_replacement_cost": "$XX,XXX - $XXX,XXX",
  "summary": "Executive summary of equipment condition risks",
  "data_sources": ["sources checked"]
}

If property not found, return property_found: false with estimates based on building age.` },
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
      result = match ? JSON.parse(match[0]) : { property_found: false, summary: content.slice(0, 500) };
    } catch {
      result = { property_found: false, summary: content.slice(0, 500) };
    }

    return new Response(JSON.stringify({ success: true, query, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
