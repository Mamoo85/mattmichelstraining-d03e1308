// Daily Etsy sales sync — pulls views/favorites/sales for every pod_listings row
// that has an etsy_listing_id. Also tries to backfill etsy_listing_id by searching
// the shop's active listings for the matching printify-injected title.
//
// Requires: ETSY_API_KEY (x-api-key), ETSY_ACCESS_TOKEN (Bearer), ETSY_SHOP_ID.
//
// Scheduled daily at 14:00 UTC via pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY");
const ETSY_ACCESS_TOKEN = Deno.env.get("ETSY_ACCESS_TOKEN");
const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID");

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function etsyFetch(path: string): Promise<any> {
  const resp = await fetch(`https://openapi.etsy.com/v3${path}`, {
    headers: {
      "x-api-key": ETSY_API_KEY!,
      Authorization: `Bearer ${ETSY_ACCESS_TOKEN}`,
    },
  });
  if (!resp.ok) {
    throw new Error(`Etsy ${resp.status} ${path}: ${(await resp.text()).slice(0, 300)}`);
  }
  return resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!ETSY_API_KEY || !ETSY_ACCESS_TOKEN || !ETSY_SHOP_ID) {
    return new Response(JSON.stringify({
      ok: false, skipped: true, reason: "etsy_credentials_missing",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const today = new Date().toISOString().slice(0, 10);
  const results = { matched: 0, synced: 0, errors: [] as any[] };

  try {
    // Step 1: pull active shop listings (paginate up to 500)
    const listingsByTitle = new Map<string, any>();
    let offset = 0;
    while (offset < 500) {
      const page = await etsyFetch(
        `/application/shops/${ETSY_SHOP_ID}/listings/active?limit=100&offset=${offset}`,
      );
      const items = page?.results ?? [];
      for (const item of items) {
        const t = (item.title || "").toLowerCase().trim();
        if (t) listingsByTitle.set(t, item);
      }
      if (items.length < 100) break;
      offset += 100;
    }

    // Step 2: load our pod_listings, match by title
    const { data: pod } = await sb
      .from("pod_listings")
      .select("id, printify_id, etsy_listing_id, product_name, title");

    for (const row of pod ?? []) {
      try {
        let listingId = row.etsy_listing_id as number | null;
        if (!listingId) {
          const k1 = (row.title || "").toLowerCase().trim();
          const k2 = (row.product_name || "").toLowerCase().trim();
          const m = listingsByTitle.get(k1) || listingsByTitle.get(k2)
            || [...listingsByTitle.values()].find((e: any) =>
              (e.title || "").toLowerCase().includes(k2.slice(0, 30)),
            );
          if (m) {
            listingId = m.listing_id;
            await sb.from("pod_listings").update({
              etsy_listing_id: listingId,
              last_synced_at: new Date().toISOString(),
            }).eq("id", row.id);
            results.matched++;
          }
        }
        if (!listingId) continue;

        // Step 3: fetch stats — views/favorites are on the listing object
        const listing = await etsyFetch(`/application/listings/${listingId}`);
        const views = listing?.views ?? 0;
        const fav = listing?.num_favorers ?? 0;

        // Sales: pull receipts in last 30 days (best-effort; many shops gate this scope)
        let sales = 0;
        let revenueCents = 0;
        try {
          const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
          const tx = await etsyFetch(
            `/application/shops/${ETSY_SHOP_ID}/receipts?min_created=${since}&was_paid=true&limit=100`,
          );
          for (const r of tx?.results ?? []) {
            for (const tr of r.transactions ?? []) {
              if (tr.listing_id === listingId) {
                sales += tr.quantity ?? 1;
                revenueCents += Math.round(((tr.price?.amount ?? 0) / (tr.price?.divisor || 1)) * 100) * (tr.quantity || 1);
              }
            }
          }
        } catch (_) { /* transactions scope optional */ }

        await sb.from("pod_listing_stats").upsert({
          listing_id: row.id,
          snapshot_date: today,
          views, num_favorers: fav,
          sales_count: sales, revenue_cents: revenueCents,
        }, { onConflict: "listing_id,snapshot_date" });

        await sb.from("pod_listings").update({
          last_synced_at: new Date().toISOString(),
        }).eq("id", row.id);

        results.synced++;
      } catch (e: any) {
        results.errors.push({ listing: row.printify_id, error: e?.message || String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, date: today, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e), partial: results }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
