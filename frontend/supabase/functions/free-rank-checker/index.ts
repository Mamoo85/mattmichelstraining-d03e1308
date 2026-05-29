const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
import { createClient } from "npm:@supabase/supabase-js@2";

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN")!;
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { keyword, location, email } = await req.json();
    if (!keyword || !email) {
      return new Response(JSON.stringify({ error: "keyword and email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const creds = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
    const dfsRes = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/regular", {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
      body: JSON.stringify([{
        keyword,
        location_name: location || "United States",
        language_name: "English",
        depth: 10,
      }]),
    });
    const dfsData = await dfsRes.json();

    const items = dfsData?.tasks?.[0]?.result?.[0]?.items || [];
    const rankings = items
      .filter((i: any) => i.type === "organic")
      .slice(0, 10)
      .map((i: any) => ({
        position: i.rank_absolute,
        title: i.title,
        url: i.url,
        domain: i.domain,
        description: i.description?.slice(0, 150),
      }));

    const results = { keyword, location: location || "United States", rankings };

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await sb.from("free_tool_leads").insert({ email, tool_used: "rank-check", input_url: keyword, results_summary: results });

    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("free-rank-checker error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
