import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { facility_name, state, email } = await req.json();
    if (!facility_name) {
      return new Response(JSON.stringify({ error: "facility_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log lead
    if (email) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("free_tool_leads").insert({ tool_name: "medicare_staffing", email, company_name: facility_name, input_data: { facility_name, state } });
    }

    // Query CMS Medicare Care Compare
    const cmsUrl = "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0";
    const searchState = state || "MI";

    const res = await fetch(cmsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conditions: [{ property: "state", value: searchState, operator: "=" }],
        limit: 500,
        offset: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "CMS API error", status: res.status }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const rows = data?.results || [];

    // Fuzzy match facility name
    const searchLower = facility_name.toLowerCase().trim();
    const matches = rows
      .filter((r: any) => {
        const name = (r.provider_name || "").toLowerCase();
        return name.includes(searchLower) || searchLower.includes(name) ||
          searchLower.split(" ").every((w: string) => name.includes(w));
      })
      .map((r: any) => ({
        provider_name: r.provider_name,
        address: r.provider_address,
        city: r.provider_city,
        state: r.provider_state,
        zip: r.provider_zip_code,
        phone: r.provider_phone_number,
        overall_rating: r.overall_rating ? Number(r.overall_rating) : null,
        staffing_rating: r.staffing_rating ? Number(r.staffing_rating) : null,
        rn_staffing_rating: r.rn_staffing_rating ? Number(r.rn_staffing_rating) : null,
        quality_rating: r.quality_rating ? Number(r.quality_rating) : null,
        number_of_beds: r.number_of_certified_beds ? Number(r.number_of_certified_beds) : null,
        ownership_type: r.ownership_type,
        abuse_icon: r.abuse_icon,
        number_of_fines: r.total_number_of_penalties ? Number(r.total_number_of_penalties) : null,
        fine_total: r.total_amount_of_fines_in_dollars ? Number(r.total_amount_of_fines_in_dollars) : null,
      }))
      .slice(0, 5);

    return new Response(JSON.stringify({ success: true, facilities: matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
