// local-citations-builder — generates a checklist + pre-filled URLs for 10 free directories
// Contractor self-submits via the URLs (zero API cost). Logs to admin so Matt can verify.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIRECTORIES = [
  { name: "Yelp", url: "https://biz.yelp.com/signup", priority: 1 },
  { name: "Bing Places", url: "https://www.bingplaces.com/", priority: 1 },
  { name: "Apple Maps Connect", url: "https://mapsconnect.apple.com/", priority: 1 },
  { name: "BBB", url: "https://www.bbb.org/get-listed", priority: 2 },
  { name: "Angi (free profile)", url: "https://pro.angi.com/", priority: 2 },
  { name: "HomeAdvisor (free)", url: "https://pro.homeadvisor.com/", priority: 2 },
  { name: "Nextdoor Business", url: "https://business.nextdoor.com/", priority: 2 },
  { name: "Foursquare", url: "https://business.foursquare.com/", priority: 3 },
  { name: "Yellow Pages", url: "https://accounts.yellowpages.com/register", priority: 3 },
  { name: "Manta", url: "https://www.manta.com/", priority: 3 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contractor_id } = await req.json();
    if (!contractor_id) {
      return new Response(JSON.stringify({ error: "contractor_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: c } = await sb
      .from("contractor_clients" as any)
      .select("business_name, email, phone, trade, city, state")
      .eq("id", contractor_id)
      .maybeSingle();

    if (!c) {
      return new Response(JSON.stringify({ error: "contractor not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      business: c,
      directories: DIRECTORIES,
      copy_paste_block: {
        business_name: (c as any).business_name,
        category: (c as any).trade,
        city: (c as any).city,
        state: (c as any).state || "MI",
        phone: (c as any).phone,
        email: (c as any).email,
        description: `Local ${((c as any).trade || "").toLowerCase()} contractor serving ${(c as any).city || "Metro Detroit"} area. Licensed, insured, fast response.`,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[local-citations-builder] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
