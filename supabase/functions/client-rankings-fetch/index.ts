import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN");
    const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the authenticated user's client record
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if client has SEO Guard subscription
    const { data: client } = await supabase
      .from("seo_guard_clients")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .single();

    if (!client) {
      return new Response(JSON.stringify({ rankings: [], message: "No active subscription found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const keywords = client.tracked_keywords || [];
    const domain = (client.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

    if (!keywords.length || !domain) {
      return new Response(JSON.stringify({ rankings: [], message: "No keywords or domain configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rankings: any[] = [];

    if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
      const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

      for (const keyword of keywords.slice(0, 10)) {
        try {
          const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
            body: JSON.stringify([{ keyword, location_code: 1023191, language_code: "en", depth: 30 }]),
          });
          const data = await res.json();
          const items = data?.tasks?.[0]?.result?.[0]?.items || [];
          const match = items.find((i: any) => i.domain?.includes(domain));
          const localPack = items.some((i: any) => i.type === "local_pack" && i.items?.some((li: any) => li.domain?.includes(domain)));

          const snapshot = {
            client_id: client.id,
            keyword,
            position: match?.rank_absolute || 0,
            local_pack: localPack,
          };

          rankings.push({ ...snapshot, checked_at: new Date().toISOString() });
          await supabase.from("client_ranking_snapshots").insert(snapshot);
        } catch (e) {
          console.error(`Ranking check failed for "${keyword}":`, e);
        }
      }
    }

    return new Response(JSON.stringify({ rankings }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-rankings-fetch error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
