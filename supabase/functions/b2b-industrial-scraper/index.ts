// B2B Industrial Database Scraper
// Called weekly by cron — scrapes Google Maps Places API for industrial suppliers
// rotating through Midwest cities, deduplicates, stores in b2b_contacts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

// Major Midwest industrial cities
const INDUSTRIAL_CITIES = [
  // Michigan
  "Detroit MI", "Grand Rapids MI", "Warren MI", "Sterling Heights MI", "Flint MI",
  // Ohio
  "Cleveland OH", "Cincinnati OH", "Columbus OH", "Toledo OH", "Akron OH",
  // Indiana
  "Indianapolis IN", "Fort Wayne IN", "South Bend IN", "Elkhart IN",
  // Illinois
  "Chicago IL", "Rockford IL", "Peoria IL", "Aurora IL",
  // Wisconsin
  "Milwaukee WI", "Madison WI", "Green Bay WI",
  // Minnesota
  "Minneapolis MN", "Saint Paul MN",
];

const INDUSTRIAL_TYPES = [
  { query: "metal fabrication shop", industry: "metal_fabrication" },
  { query: "CNC machining service", industry: "cnc_machining" },
  { query: "injection molding company", industry: "injection_molding" },
  { query: "tool and die maker", industry: "tool_and_die" },
  { query: "welding supply", industry: "welding_supply" },
  { query: "industrial equipment supplier", industry: "industrial_equipment" },
  { query: "machine shop", industry: "machine_shop" },
  { query: "powder coating service", industry: "powder_coating" },
  { query: "sheet metal fabrication", industry: "sheet_metal" },
  { query: "contract manufacturing", industry: "contract_manufacturing" },
];

serve(async (req) => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log("[INDUSTRIAL-SCRAPER] No Google Maps API key — skipping");
    return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), { status: 200 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Rotate through industries weekly
  const weekOfYear = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const industryIndex = weekOfYear % INDUSTRIAL_TYPES.length;
  const { query: searchQuery, industry } = INDUSTRIAL_TYPES[industryIndex];

  // Rotate through cities daily within the week
  const dayOfWeek = new Date().getDay();
  const city = INDUSTRIAL_CITIES[dayOfWeek % INDUSTRIAL_CITIES.length];

  console.log(`[INDUSTRIAL-SCRAPER] Scraping ${searchQuery} in ${city}`);

  let inserted = 0;
  let nextPageToken: string | null = null;
  let page = 0;
  const maxPages = 3; // Top 60 results per city

  do {
    const params = new URLSearchParams({
      query: `${searchQuery} in ${city}`,
      key: GOOGLE_MAPS_API_KEY,
      ...(nextPageToken ? { pagetoken: nextPageToken } : {}),
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[INDUSTRIAL-SCRAPER] API error:", data.status, data.error_message);
      break;
    }

    for (const place of data.results || []) {
      // Get place details for phone + website
      let phone = null;
      let website = null;
      try {
        const detailParams = new URLSearchParams({
          place_id: place.place_id,
          fields: "formatted_phone_number,website",
          key: GOOGLE_MAPS_API_KEY,
        });
        const detailRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${detailParams}`);
        const detailData = await detailRes.json();
        if (detailData.status === "OK" && detailData.result) {
          phone = detailData.result.formatted_phone_number || null;
          website = detailData.result.website || null;
        }
      } catch (e) {
        console.error("[INDUSTRIAL-SCRAPER] Detail fetch error:", e);
      }

      const addressParts = (place.formatted_address || "").split(", ");
      const state = addressParts[addressParts.length - 2]?.split(" ")[0] || null;
      const cityName = addressParts[0] || null;
      const zip = addressParts[addressParts.length - 2]?.split(" ")[1] || null;

      const contact = {
        industry,
        business_name: place.name,
        owner_name: null,
        phone,
        email: null,
        website,
        address: place.formatted_address,
        city: cityName,
        state,
        zip,
        google_place_id: place.place_id,
        rating: place.rating || null,
        review_count: place.user_ratings_total || null,
        source: "google_maps",
      };

      const { error } = await sb.from("b2b_contacts").upsert(contact, {
        onConflict: "google_place_id",
        ignoreDuplicates: true,
      });

      if (!error) inserted++;
    }

    nextPageToken = data.next_page_token || null;
    page++;

    // Wait 2 seconds before next page (Google requires delay)
    if (nextPageToken && page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } while (nextPageToken && page < maxPages);

  console.log(`[INDUSTRIAL-SCRAPER] Inserted ${inserted} contacts for ${industry} in ${city}`);

  return new Response(
    JSON.stringify({
      success: true,
      city,
      industry,
      searchQuery,
      inserted,
      pages: page,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
