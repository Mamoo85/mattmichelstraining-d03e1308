// medicare-staffing-intel — queries CMS Medicare Care Compare API
// Finds Metro Detroit nursing homes with 1-Star or 2-Star Staffing Ratings.
// Free federal API, no auth required.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Metro Detroit zip prefixes
const METRO_DETROIT_ZIPS = ["480", "481", "482", "483"];

interface FacilityResult {
  provider_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  overall_rating: number | null;
  staffing_rating: number | null;
  rn_staffing_hours: number | null;
  ownership_type: string | null;
  number_of_beds: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // CMS Nursing Home Provider Info dataset
    // Using the data.cms.gov CKAN API
    const cmsUrl = "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0";

    const body = {
      conditions: [
        { property: "state", value: "MI", operator: "=" },
      ],
      limit: 500,
      offset: 0,
      sort: [{ property: "overall_rating", order: "ASC" }],
    };

    const res = await fetch(cmsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    let facilities: FacilityResult[] = [];

    if (res.ok) {
      const data = await res.json();
      const rows = data?.results || [];

      facilities = rows
        .filter((r: any) => {
          const zip = (r.zip || r.provider_zip_code || "").toString();
          const isMetroDetroit = METRO_DETROIT_ZIPS.some(prefix => zip.startsWith(prefix));
          const staffingRating = parseInt(r.staffing_rating || r.staff_rating || "0", 10);
          return isMetroDetroit && staffingRating >= 1 && staffingRating <= 2;
        })
        .map((r: any) => ({
          provider_name: r.provider_name || r.facility_name || "Unknown",
          address: r.provider_address || r.address || "",
          city: r.provider_city || r.city || "",
          state: r.provider_state || r.state || "MI",
          zip: (r.provider_zip_code || r.zip || "").toString(),
          phone: r.provider_phone_number || r.phone || "",
          overall_rating: parseInt(r.overall_rating || "0", 10) || null,
          staffing_rating: parseInt(r.staffing_rating || r.staff_rating || "0", 10) || null,
          rn_staffing_hours: parseFloat(r.reported_nurse_aide_staffing_hours_per_resident_per_day || "0") || null,
          ownership_type: r.ownership_type || null,
          number_of_beds: parseInt(r.number_of_certified_beds || "0", 10) || null,
        }));
    } else {
      // Fallback: try the alternative API endpoint
      const altUrl = `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/4pq5-n9py?show-reference-ids=false`;
      const altRes = await fetch(altUrl, { signal: AbortSignal.timeout(10_000) });
      const altText = await altRes.text();
      console.log("[medicare] Primary API failed, alt metadata:", altText.slice(0, 500));
    }

    // Sort by staffing rating ASC (worst first), then by overall rating ASC
    facilities.sort((a, b) => {
      const sa = a.staffing_rating || 99;
      const sb = b.staffing_rating || 99;
      if (sa !== sb) return sa - sb;
      return (a.overall_rating || 99) - (b.overall_rating || 99);
    });

    return new Response(JSON.stringify({
      total: facilities.length,
      metro_area: "Metro Detroit",
      filter: "Staffing Rating 1-2 Stars",
      facilities,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[medicare-staffing-intel] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
