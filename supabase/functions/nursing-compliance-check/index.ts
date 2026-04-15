import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { license_numbers, state, email } = await req.json();
    if (!license_numbers || !Array.isArray(license_numbers) || license_numbers.length === 0) {
      return new Response(JSON.stringify({ error: "license_numbers array required (up to 5)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const licenses = license_numbers.slice(0, 5).map((l: string) => l.trim()).filter(Boolean);
    if (licenses.length === 0) {
      return new Response(JSON.stringify({ error: "At least one valid license number required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (email) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("free_tool_leads").insert({ tool_name: "nursing_compliance", email, input_data: { license_numbers: licenses, state } });
    }

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Search engine not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const searchState = state || "Michigan";

    // Use Sonar to search for each license
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://detroitwebagent.com",
        "X-Title": "Detroit Web Agency Compliance Check",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          { role: "system", content: "You are a nursing license compliance verification tool. Search public nursing license databases (LARA, Nursys, state boards) for license status and disciplinary actions. Return ONLY valid JSON." },
          { role: "user", content: `Check the following nursing license numbers in ${searchState} for compliance status, expiration, and any disciplinary actions:

${licenses.map((l: string, i: number) => `${i + 1}. License #${l}`).join("\n")}

Search LARA (Michigan Department of Licensing and Regulatory Affairs), Nursys, and any public state nursing board databases.

Return ONLY valid JSON:
{
  "results": [
    {
      "license_number": "LICENSE_NUM",
      "holder_name": "Name if found or null",
      "license_type": "RN/LPN/CNA/Unknown",
      "status": "Active/Expired/Revoked/Suspended/Not Found",
      "expiration_date": "YYYY-MM-DD or null",
      "disciplinary_actions": [{"date": "YYYY-MM-DD", "action": "Description"}],
      "multi_state_privilege": true/false,
      "risk_flag": "Clear/Warning/Critical"
    }
  ],
  "overall_risk": "Critical/Warning/Clear",
  "summary": "Executive summary of compliance risks found"
}` },
        ],
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Search failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    let result: any;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { results: [], summary: content.slice(0, 500) };
    } catch {
      result = { results: [], summary: content.slice(0, 500) };
    }

    return new Response(JSON.stringify({ success: true, state: searchState, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
