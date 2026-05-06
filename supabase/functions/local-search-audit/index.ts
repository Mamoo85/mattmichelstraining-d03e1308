import { createClient } from "npm:@supabase/supabase-js@2";

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { business_name, city, email } = await req.json();
    if (!business_name || !city) {
      return new Response(JSON.stringify({ error: "business_name and city required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log lead
    if (email) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("free_tool_leads").insert({ tool_name: "local_search_audit", email, company_name: business_name, input_data: { business_name, city } });
    }

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return new Response(JSON.stringify({ error: "DataForSEO not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
    const keyword = `${business_name} ${city}`;

    // Google Maps SERP
    const res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword, location_name: `${city}, Michigan, United States`, language_code: "en", depth: 10 }]),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await res.json();
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];

    const mapResults = items
      .filter((i: any) => i.type === "maps_search")
      .slice(0, 10)
      .map((i: any, idx: number) => ({
        position: idx + 1,
        title: i.title,
        rating: i.rating?.value ?? null,
        reviews: i.rating?.votes_count ?? null,
        address: i.address,
        phone: i.phone,
        url: i.url,
        is_target: (i.title || "").toLowerCase().includes(business_name.toLowerCase()),
      }));

    const targetResult = mapResults.find((r: any) => r.is_target);

    return new Response(JSON.stringify({
      success: true,
      keyword,
      target_found: !!targetResult,
      target_position: targetResult?.position ?? null,
      target_reviews: targetResult?.reviews ?? null,
      target_rating: targetResult?.rating ?? null,
      top_results: mapResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
