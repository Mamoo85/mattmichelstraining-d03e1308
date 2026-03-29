// B2B Dental Database Scraper
// Called daily by cron — scrapes Google Maps Places API for dental offices
// rotating through 60 Midwest cities, deduplicates, stores in b2b_contacts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

// 60 Midwest cities — rotate by day of month
const MIDWEST_CITIES = [
  // Michigan
  "Detroit MI", "Grand Rapids MI", "Ann Arbor MI", "Lansing MI", "Flint MI",
  "Sterling Heights MI", "Warren MI", "Troy MI", "Livonia MI", "Dearborn MI",
  "Kalamazoo MI", "Traverse City MI", "Saginaw MI", "Pontiac MI", "Southfield MI",
  // Ohio
  "Columbus OH", "Cleveland OH", "Cincinnati OH", "Toledo OH", "Akron OH",
  "Dayton OH", "Youngstown OH", "Canton OH", "Lorain OH", "Hamilton OH",
  // Indiana
  "Indianapolis IN", "Fort Wayne IN", "Evansville IN", "South Bend IN", "Carmel IN",
  "Fishers IN", "Bloomington IN", "Hammond IN", "Gary IN", "Muncie IN",
  // Illinois
  "Chicago IL", "Aurora IL", "Rockford IL", "Joliet IL", "Naperville IL",
  "Springfield IL", "Peoria IL", "Elgin IL", "Waukegan IL", "Champaign IL",
  // Wisconsin
  "Milwaukee WI", "Madison WI", "Green Bay WI", "Kenosha WI", "Racine WI",
  "Appleton WI", "Waukesha WI", "Oshkosh WI", "Eau Claire WI", "Janesville WI",
  // Minnesota
  "Minneapolis MN", "Saint Paul MN", "Rochester MN", "Duluth MN", "Bloomington MN",
  "Brooklyn Park MN", "Plymouth MN", "Saint Cloud MN", "Eagan MN", "Woodbury MN",
];

const SEARCH_TYPES = ["dentist", "dental office", "orthodontist", "oral surgeon", "dental clinic"];

serve(async (req) => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log("[B2B-SCRAPER] No Google Maps API key — skipping");
    return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), { status: 200 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const dayOfMonth = new Date().getDate() - 1; // 0-indexed
  const city = MIDWEST_CITIES[dayOfMonth % MIDWEST_CITIES.length];
  const searchType = SEARCH_TYPES[Math.floor(Date.now() / 86400000) % SEARCH_TYPES.length];

  console.log(`[B2B-SCRAPER] Scraping ${searchType} in ${city}`);

  let inserted = 0;
  let nextPageToken: string | null = null;
  let page = 0;

  do {
    const params = new URLSearchParams({
      query: `${searchType} in ${city}`,
      key: GOOGLE_MAPS_API_KEY,
      ...(nextPageToken ? { pagetoken: nextPageToken } : {}),
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[B2B-SCRAPER] API error:", data.status, data.error_message);
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
        const detail = await detailRes.json();
        phone = detail.result?.formatted_phone_number || null;
        website = detail.result?.website || null;
      } catch (_) {}

      // Parse city/state from address
      const addressParts = (place.formatted_address || "").split(",");
      const placeCity = addressParts[1]?.trim() || city.split(" ")[0];
      const stateZip = addressParts[2]?.trim() || "";
      const placeState = stateZip.split(" ")[0] || city.split(" ").pop() || "MI";

      const { error } = await sb.from("b2b_contacts").insert({
        industry: "dental",
        business_name: place.name,
        phone,
        website,
        address: addressParts[0]?.trim() || null,
        city: placeCity,
        state: placeState,
        google_place_id: place.place_id,
        rating: place.rating || null,
        review_count: place.user_ratings_total || null,
        source: "google_maps",
      });

      if (!error) inserted++;
    }

    nextPageToken = data.next_page_token || null;
    page++;

    // Max 2 pages (40 results) to stay within free tier budget
    if (page >= 2) break;
    if (nextPageToken) await new Promise(r => setTimeout(r, 2000)); // Required delay between pages

  } while (nextPageToken);

  console.log(`[B2B-SCRAPER] Inserted ${inserted} new dental contacts from ${city}`);
  return new Response(JSON.stringify({ inserted, city, search_type: searchType }), { status: 200 });
});
