// Sync Matt's Etsy active listings → public.etsy_products + etsy_product_images.
// Cron: hourly. Manual: POST { shop_id?, limit? }.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// shop_id is auto-discovered via /v3/application/users/me/shops (no hardcoded default)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function etsyFetch(url: string, apiKey: string, accessToken: string) {
  const r = await fetch(url, {
    headers: { "x-api-key": apiKey, Authorization: `Bearer ${accessToken}` },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`etsy_${r.status}: ${t.slice(0, 250)}`);
  return JSON.parse(t);
}

function extractShop(payload: any) {
  return payload?.shop_id ? payload : (payload?.results?.[0] ?? (Array.isArray(payload) ? payload[0] : null));
}

async function discoverConnectedShop(apiKey: string, accessToken: string) {
  try {
    const me = await etsyFetch("https://openapi.etsy.com/v3/application/users/me/shops", apiKey, accessToken);
    const shop = extractShop(me);
    if (shop?.shop_id) return shop;
  } catch (e) {
    console.warn("users/me/shops failed; falling back to token user id", (e as Error).message);
  }
  const userId = accessToken.split(".")[0];
  if (!/^\d+$/.test(userId)) throw new Error("shop_discovery_failed: unable to derive Etsy user id from token");
  const byId = await etsyFetch(`https://openapi.etsy.com/v3/application/users/${userId}/shops`, apiKey, accessToken);
  const shop = extractShop(byId);
  if (!shop?.shop_id) throw new Error(`shop_discovery_failed: ${JSON.stringify(byId).slice(0, 300)}`);
  return shop;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const hardLimit = Number(body.limit ?? 500);

    const { apiKey, accessToken } = await getEtsyAuth(sb);

    // Auto-discover shop_id from the OAuth-authorized account.
    // Override only if explicitly passed in the body.
    let shopId: string;
    if (body.shop_id) {
      shopId = String(body.shop_id);
    } else {
      const shop = await discoverConnectedShop(apiKey, accessToken);
      shopId = String(shop.shop_id);
      await sb.from("etsy_oauth_tokens").update({ shop_id: shopId, updated_at: new Date().toISOString() }).eq("key", "default");
      console.log("auto-discovered shop_id:", shopId, "name:", shop.shop_name);
    }

    const seen = new Set<number>();
    let upserted = 0, imagesUpserted = 0, offset = 0;
    const pageSize = 100;

    while (offset < hardLimit) {
      const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active?limit=${pageSize}&offset=${offset}&includes=Images`;
      const page = await etsyFetch(url, apiKey, accessToken);
      const results: any[] = page.results ?? [];
      if (!results.length) break;

      for (const l of results) {
        const listingId = Number(l.listing_id);
        if (!listingId) continue;
        seen.add(listingId);

        const priceCents = l.price?.amount && l.price?.divisor
          ? Math.round((l.price.amount / l.price.divisor) * 100)
          : null;

        const { error: upErr } = await sb.from("etsy_products").upsert({
          listing_id: listingId,
          shop_id: Number(shopId),
          title: l.title ?? "Untitled",
          description: l.description ?? "",
          price_cents: priceCents,
          currency: l.price?.currency_code ?? "USD",
          url: l.url ?? `https://www.etsy.com/listing/${listingId}`,
          state: l.state ?? "active",
          tags: Array.isArray(l.tags) ? l.tags : [],
          materials: Array.isArray(l.materials) ? l.materials : [],
          quantity: l.quantity ?? null,
          etsy_created_ts: l.created_timestamp ?? l.original_creation_timestamp ?? null,
          etsy_updated_ts: l.updated_timestamp ?? l.last_modified_timestamp ?? null,
          last_synced_at: new Date().toISOString(),
          raw: l,
        }, { onConflict: "listing_id" });
        if (upErr) { console.error("upsert listing failed", listingId, upErr.message); continue; }
        upserted++;

        // Images (included via ?includes=Images)
        let images: any[] = Array.isArray(l.images) ? l.images : [];
        if (!images.length) {
          try {
            const imgPage = await etsyFetch(
              `https://openapi.etsy.com/v3/application/listings/${listingId}/images`,
              apiKey, accessToken,
            );
            images = imgPage.results ?? [];
            await sleep(120);
          } catch (e) { console.error("img fetch failed", listingId, (e as Error).message); }
        }
        if (images.length) {
          const rows = images.map((img: any, idx: number) => ({
            listing_id: listingId,
            image_id: Number(img.listing_image_id ?? img.image_id ?? idx + 1),
            rank: img.rank ?? idx + 1,
            url_570xn: img.url_570xN ?? img.url_570xn ?? null,
            url_fullxfull: img.url_fullxfull ?? null,
            url_75x75: img.url_75x75 ?? null,
            alt_text: img.alt_text ?? null,
          }));
          const { error: imgErr } = await sb.from("etsy_product_images").upsert(rows, { onConflict: "listing_id,image_id" });
          if (imgErr) console.error("img upsert failed", listingId, imgErr.message);
          else imagesUpserted += rows.length;
        }
      }

      if (results.length < pageSize) break;
      offset += pageSize;
      await sleep(150);
    }

    // Soft-delete: mark listings that disappeared from active feed as 'removed'
    let removed = 0;
    if (seen.size > 0) {
      const seenArr = Array.from(seen);
      const { data: existing } = await sb.from("etsy_products")
        .select("listing_id").eq("shop_id", Number(shopId)).eq("state", "active");
      const toRemove = (existing ?? []).map((r: any) => r.listing_id).filter((id: number) => !seen.has(Number(id)));
      if (toRemove.length) {
        const { error } = await sb.from("etsy_products").update({ state: "removed", last_synced_at: new Date().toISOString() }).in("listing_id", toRemove);
        if (!error) removed = toRemove.length;
      }
    }

    return new Response(JSON.stringify({ ok: true, shop_id: shopId, upserted, images_upserted: imagesUpserted, removed, scanned: seen.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
