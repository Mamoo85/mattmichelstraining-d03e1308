import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Sonar fallback: live web search for local businesses ──
async function sonarSearch(industry: string, location: string, limit: number) {
  if (!OPENROUTER_API_KEY) throw new Error("No OPENROUTER_API_KEY configured");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://detroitwebagent.com",
      "X-Title": "Detroit Web Agency Prospector",
    },
    body: JSON.stringify({
      model: "perplexity/sonar-pro",
      messages: [
        {
          role: "system",
          content: `You are a local business research tool. Return ONLY valid JSON — no markdown, no code fences, no explanation. The JSON must be an array of business objects.`,
        },
        {
          role: "user",
          content: `Search the web for ${limit} real "${industry}" businesses in or near "${location}". For each business, find their name, phone number, website URL, street address, and Google star rating if available.

Return ONLY a JSON array (no markdown, no code blocks). Each object must have these exact keys:
{"title":"Business Name","phone":"555-123-4567","website":"https://example.com","address":"123 Main St, City, ST","rating":4.5,"reviews":42,"category":"${industry}","claimed":null}

If you can't find a field, use null. Return up to ${limit} businesses.`,
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[DATAFORSEO-MAPS] Sonar error: ${res.status} ${errText.slice(0, 300)}`);
    throw new Error(`Sonar returned ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "[]";

  // Extract JSON from the response (handle markdown fences)
  let jsonStr = content;
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();
  // Also try to find array directly
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonStr = arrayMatch[0];

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    console.error("[DATAFORSEO-MAPS] Sonar JSON parse failed:", jsonStr.slice(0, 300));
    parsed = [];
  }

  return parsed.slice(0, limit).map((item: any) => ({
    title: item.title || item.name || "",
    rating: item.rating ?? null,
    reviews: item.reviews ?? 0,
    address: item.address || "",
    phone: item.phone || null,
    website: item.website || item.url || null,
    category: item.category || industry,
    place_id: null,
    claimed: null,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { industry, location, limit = 20 } = await req.json();

    if (!industry || !location) {
      return new Response(
        JSON.stringify({ error: "industry and location are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyword = `${industry} in ${location}`;
    let results: any[] = [];
    let source = "sonar";

    // ── Try DataForSEO first (if credentials exist) ──
    if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
      console.log(`[DATAFORSEO-MAPS] Trying DataForSEO: "${keyword}", limit: ${limit}`);
      const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

      try {
        const response = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            { keyword, location_name: location, language_code: "en", depth: Math.min(limit, 100) },
          ]),
        });

        const raw = await response.json();
        const taskStatus = raw.tasks?.[0]?.status_code;
        console.log(`[DATAFORSEO-MAPS] DataForSEO response: status=${raw.status_code}, task_status=${taskStatus}`);

        if (response.ok && raw.status_code === 20000 && taskStatus === 20000) {
          const items = raw.tasks?.[0]?.result?.[0]?.items || [];
          results = items
            .filter((item: any) => item.type === "maps_search" || item.type === "maps_paid" || item.type === "organic")
            .slice(0, limit)
            .map((item: any) => ({
              title: item.title || "",
              rating: item.rating?.value ?? null,
              reviews: item.rating?.votes_count ?? 0,
              address: item.address || item.address_info?.address || "",
              phone: item.phone || null,
              website: item.url || item.domain || null,
              category: item.category || "",
              place_id: item.place_id || null,
              claimed: item.is_claimed ?? null,
            }));
          source = "dataforseo";
          console.log(`[DATAFORSEO-MAPS] DataForSEO returned ${results.length} results`);
        } else {
          console.warn(`[DATAFORSEO-MAPS] DataForSEO failed (task_status=${taskStatus}), falling back to Sonar`);
        }
      } catch (dfErr) {
        console.warn(`[DATAFORSEO-MAPS] DataForSEO error, falling back to Sonar:`, dfErr);
      }
    }

    // ── Fallback to Sonar if DataForSEO returned nothing ──
    if (results.length === 0) {
      if (!OPENROUTER_API_KEY) {
        return new Response(
          JSON.stringify({ error: "DataForSEO returned no results and no OPENROUTER_API_KEY is configured for fallback. Your DataForSEO plan may not include the Google Maps SERP API (error 40501)." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[DATAFORSEO-MAPS] Using Sonar fallback for "${keyword}"`);
      results = await sonarSearch(industry, location, Math.min(limit, 20));
      source = "sonar";
      console.log(`[DATAFORSEO-MAPS] Sonar returned ${results.length} results`);
    }

    return new Response(
      JSON.stringify({ success: true, results, total: results.length, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[DATAFORSEO-MAPS] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
