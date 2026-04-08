import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "DataForSEO credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyword = `${industry} in ${location}`;
    console.log(`[DATAFORSEO-MAPS] Searching: "${keyword}", limit: ${limit}`);

    const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

    const response = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword,
          location_name: location,
          language_code: "en",
          depth: Math.min(limit, 100),
        },
      ]),
    });

    const raw = await response.json();

    if (!response.ok || raw.status_code !== 20000) {
      console.error("[DATAFORSEO-MAPS] API error:", JSON.stringify(raw).slice(0, 500));
      return new Response(
        JSON.stringify({ error: raw.status_message || "DataForSEO request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const task = raw.tasks?.[0];
    const items = task?.result?.[0]?.items || [];

    const results = items
      .filter((item: any) => item.type === "maps_search")
      .slice(0, limit)
      .map((item: any) => ({
        title: item.title || "",
        rating: item.rating?.value ?? null,
        reviews: item.rating?.votes_count ?? 0,
        address: item.address || "",
        phone: item.phone || null,
        website: item.url || item.domain || null,
        category: item.category || "",
        place_id: item.place_id || null,
        claimed: item.is_claimed ?? null,
      }));

    console.log(`[DATAFORSEO-MAPS] Found ${results.length} results for "${keyword}"`);

    return new Response(
      JSON.stringify({ success: true, results, total: results.length }),
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
