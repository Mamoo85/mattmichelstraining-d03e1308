// Probes the connected Etsy OAuth token to detect missing scopes and the connected shop.
// Returns { ok, connected, shop_id, shop_name, scopes: { shops_r, listings_r, images_r }, needs_reauth, missing_scopes[] }
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function probe(url: string, apiKey: string, accessToken: string) {
  const r = await fetch(url, {
    headers: { "x-api-key": apiKey, Authorization: `Bearer ${accessToken}` },
  });
  const text = await r.text();
  return { status: r.status, ok: r.ok, body: text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const result: any = {
    ok: false,
    connected: false,
    shop_id: null,
    shop_name: null,
    scopes: { shops_r: false, listings_r: false, images_r: false },
    missing_scopes: [] as string[],
    needs_reauth: false,
    error: null as string | null,
  };

  try {
    const { apiKey, accessToken } = await getEtsyAuth(sb);
    result.connected = true;

    // 1) shops_r — auto-discover shop
    const me = await probe(
      "https://openapi.etsy.com/v3/application/users/me/shops",
      apiKey, accessToken,
    );
    if (me.ok) {
      result.scopes.shops_r = true;
      try {
        const j = JSON.parse(me.body);
        const shop = j?.shop_id ? j : (j?.results?.[0] ?? (Array.isArray(j) ? j[0] : null));
        if (shop) {
          result.shop_id = String(shop.shop_id);
          result.shop_name = shop.shop_name ?? null;
        }
      } catch { /* ignore */ }
    } else if (me.status === 401 || me.status === 403) {
      result.missing_scopes.push("shops_r");
    }

    // 2) listings_r — try active listings endpoint
    if (result.shop_id) {
      const listings = await probe(
        `https://openapi.etsy.com/v3/application/shops/${result.shop_id}/listings/active?limit=1`,
        apiKey, accessToken,
      );
      if (listings.ok) {
        result.scopes.listings_r = true;
        // 3) images — try fetching images of the first listing
        try {
          const j = JSON.parse(listings.body);
          const first = j?.results?.[0]?.listing_id;
          if (first) {
            const img = await probe(
              `https://openapi.etsy.com/v3/application/listings/${first}/images`,
              apiKey, accessToken,
            );
            if (img.ok) {
              result.scopes.images_r = true;
            } else if (img.status === 401 || img.status === 403 || img.status === 404) {
              // Etsy returns 404 when the token lacks listings_r for the images sub-resource
              result.missing_scopes.push("listings_r (images)");
            }
          } else {
            // No listings on the shop — can't fully verify images scope, treat as ok
            result.scopes.images_r = true;
          }
        } catch { /* ignore */ }
      } else if (listings.status === 401 || listings.status === 403) {
        result.missing_scopes.push("listings_r");
      }
    }

    result.needs_reauth = result.missing_scopes.length > 0 || !result.scopes.shops_r || !result.scopes.listings_r || !result.scopes.images_r;
    result.ok = true;
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    result.error = (e as Error).message;
    // If token isn't even present, surface as needs_reauth
    if (/no.*token|missing.*token|not.*connected/i.test(result.error || "")) {
      result.needs_reauth = true;
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
