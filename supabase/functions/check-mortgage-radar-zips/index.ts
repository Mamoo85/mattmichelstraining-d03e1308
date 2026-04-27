// Mortgage Radar — ZIP availability check (territory exclusivity)
// Public read, no auth required. Returns which of the requested ZIPs are already
// claimed by an active client.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { zip_codes } = await req.json();
    const zips: string[] = Array.isArray(zip_codes)
      ? zip_codes.map((z: unknown) => String(z).trim()).filter((z) => /^\d{5}$/.test(z))
      : [];

    if (zips.length === 0) {
      return json({ taken_zips: [], available_zips: [] });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data, error } = await (sb.from as any)("mortgage_radar_clients")
      .select("zip_codes")
      .eq("active", true);

    if (error) throw error;

    const claimed = new Set<string>();
    for (const row of (data || []) as Array<{ zip_codes: string[] | null }>) {
      for (const z of row.zip_codes || []) {
        if (typeof z === "string") claimed.add(z);
      }
    }

    const taken = zips.filter((z) => claimed.has(z));
    const available = zips.filter((z) => !claimed.has(z));

    return json({ taken_zips: taken, available_zips: available });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[check-mortgage-radar-zips]", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
