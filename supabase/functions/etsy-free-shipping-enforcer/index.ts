// etsy-free-shipping-enforcer — One-shot + weekly maintenance
//
// Etsy's search algorithm gives a ranking boost to listings with free US shipping.
// This function ensures ALL active listings have a free-shipping profile.
//
// Strategy:
//   1. Fetch all active shop listings
//   2. Check shipping profiles — identify any with non-zero US shipping cost
//   3. Find or create a free shipping profile (name: "Free Shipping US")
//   4. Patch all affected listings to use the free shipping profile
//
// Run: POST {} — audits + fixes. Idempotent.
// Cron: weekly Monday 8am UTC (after pod-new-products runs)

import { createClient } from "npm:@supabase/supabase-js@2";

const ETSY_API_KEY = (Deno.env.get("ETSY_API_KEY") ?? "").trim();
const ETSY_SHARED_SECRET = (Deno.env.get("ETSY_SHARED_SECRET") ?? "").trim();
const ETSY_HEADER_KEY = ETSY_SHARED_SECRET ? `${ETSY_API_KEY}:${ETSY_SHARED_SECRET}` : ETSY_API_KEY;
const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[FREE-SHIPPING] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

async function etsyGet(path: string): Promise<Response> {
  return fetch(`https://openapi.etsy.com/v3/application${path}`, {
    headers: { "x-api-key": ETSY_HEADER_KEY },
    signal: AbortSignal.timeout(15_000),
  });
}

async function fetchAllListings(shopId: string): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  let offset = 0;
  while (true) {
    const res = await etsyGet(`/shops/${shopId}/listings?state=active&limit=100&offset=${offset}&includes=shipping`);
    if (!res.ok) break;
    const data = await res.json() as Record<string, unknown>;
    const items = Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : [];
    all.push(...items);
    if (items.length < 100) break;
    offset += 100;
    await new Promise(r => setTimeout(r, 500));
  }
  return all;
}

async function fetchShippingProfiles(shopId: string): Promise<Array<Record<string, unknown>>> {
  const res = await etsyGet(`/shops/${shopId}/shipping-profiles`);
  if (!res.ok) return [];
  const data = await res.json() as Record<string, unknown>;
  return Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!ETSY_API_KEY || !ETSY_SHOP_ID) {
    return new Response(JSON.stringify({
      error: "ETSY_API_KEY and ETSY_SHOP_ID required",
      setup: "Get API key at etsy.com/developers → Register App. Shop ID from Seller Hub → Settings."
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  log("Starting free shipping audit", { shopId: ETSY_SHOP_ID });

  try {
    const [listings, profiles] = await Promise.all([
      fetchAllListings(ETSY_SHOP_ID),
      fetchShippingProfiles(ETSY_SHOP_ID),
    ]);

    log("Fetched data", { listings: listings.length, shipping_profiles: profiles.length });

    // Find a profile that offers free shipping to US
    const freeProfile = profiles.find((p) => {
      const destinations = (p.shipping_profile_destinations as Array<Record<string, unknown>>) || [];
      return destinations.some((d) =>
        (d.destination_country_iso === "US" || d.destination_region === "none") &&
        Number(d.primary_cost?.amount ?? 1) === 0
      );
    });

    const freeProfileId = freeProfile ? String((freeProfile as Record<string, unknown>).shipping_profile_id) : null;

    if (!freeProfileId) {
      return new Response(JSON.stringify({
        status: "no_free_profile",
        message: "No free shipping profile found. Create one in Etsy Seller Hub → Shipping settings → Add a shipping profile → set US cost to $0.",
        listings_checked: listings.length,
        profiles_found: profiles.map((p) => ({ id: (p as any).shipping_profile_id, title: (p as any).title })),
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    log("Found free shipping profile", { id: freeProfileId, title: (freeProfile as any)?.title });

    // Find listings not using the free shipping profile
    const needsFix = listings.filter((l) =>
      String((l as any).shipping_profile_id) !== freeProfileId
    );

    log("Listings needing free shipping", { count: needsFix.length, total: listings.length });

    // Patch up to 50 per run (rate limit safety)
    let fixed = 0;
    let errors = 0;
    for (const listing of needsFix.slice(0, 50)) {
      const listingId = (listing as any).listing_id;
      try {
        const res = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}`,
          {
            method: "PATCH",
            headers: { "x-api-key": ETSY_HEADER_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ shipping_profile_id: Number(freeProfileId) }),
            signal: AbortSignal.timeout(10_000),
          }
        );
        if (res.ok) { fixed++; } else { errors++; log("Patch failed", { listingId, status: res.status }); }
        await new Promise(r => setTimeout(r, 200));
      } catch (e) { errors++; log("Patch error", { listingId, error: String(e).slice(0, 80) }); }
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "etsy-free-shipping-enforcer",
      last_run_at: new Date().toISOString(),
      last_status: fixed > 0 || needsFix.length === 0 ? "ok" : "partial",
      last_result: JSON.stringify({ checked: listings.length, needs_fix: needsFix.length, fixed, errors }),
    }, { onConflict: "agent_name" }).catch(() => {});

    return new Response(JSON.stringify({
      status: "ok",
      listings_checked: listings.length,
      free_profile_id: freeProfileId,
      needed_fix: needsFix.length,
      fixed,
      errors,
      remaining: Math.max(0, needsFix.length - 50),
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    log(`Fatal: ${err}`);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
