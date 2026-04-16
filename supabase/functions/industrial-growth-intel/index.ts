// industrial-growth-intel — Sonar-powered Metro Detroit manufacturing expansion scanner
// The industrial equivalent of medicare-staffing-intel.
// Finds companies expanding, acquiring machinery, or awarding large contracts.
// NEVER on any cron job — manual invoke only.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

function extractJSON(raw: string): string {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[1] : cleaned.trim();
}

interface IndustrialLead {
  company_name: string;
  location: string;
  expansion_type: string;
  details: string;
  news_date: string | null;
  source_url: string | null;
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prompt = `Search for recent news about Metro Detroit area manufacturing and industrial activity from the past 90 days. Find companies that are:

1. Expanding manufacturing facilities or opening new plants — classify as "New Plant"
2. Acquiring new CNC machinery, industrial equipment, or production lines — classify as "Equipment Acquisition"
3. Awarded large commercial HVAC, plumbing, or boiler contracts — classify as "Contract Award"
4. Hiring for skilled trades positions (welders, machinists, boiler operators, electricians) — classify as "Workforce Expansion"
5. Upgrading existing facilities with new infrastructure — classify as "Facility Upgrade"

Focus on Wayne County, Oakland County, Macomb County, and Washtenaw County Michigan.

IMPORTANT: Use the EXACT expansion_type labels listed above. Do NOT default everything to "Facility Upgrade" — differentiate based on what the company is actually doing. A new building is "New Plant", buying machinery is "Equipment Acquisition", winning a bid is "Contract Award", posting jobs is "Workforce Expansion".

Return ONLY a JSON array (no markdown, no explanation) of up to 15 results:
[
  {
    "company_name": "Company Name",
    "location": "City, MI",
    "expansion_type": "New Plant | Equipment Acquisition | Contract Award | Workforce Expansion | Facility Upgrade",
    "details": "Brief description of the expansion or acquisition",
    "news_date": "2026-04-01" or null,
    "source_url": "https://..." or null
  }
]

If no results found, return an empty array: []`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: `Sonar ${res.status}`, detail: t.slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "[]";
    const jsonStr = extractJSON(raw);
    let leads: IndustrialLead[] = [];

    try {
      const parsed = JSON.parse(jsonStr);
      leads = Array.isArray(parsed) ? parsed : [];
    } catch {
      console.error("[industrial-growth-intel] JSON parse failed, raw:", raw.slice(0, 500));
      leads = [];
    }

    // Sort by date (newest first), nulls last
    leads.sort((a, b) => {
      if (!a.news_date && !b.news_date) return 0;
      if (!a.news_date) return 1;
      if (!b.news_date) return -1;
      return b.news_date.localeCompare(a.news_date);
    });

    return new Response(JSON.stringify({
      leads,
      total: leads.length,
      scanned_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industrial-growth-intel] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
