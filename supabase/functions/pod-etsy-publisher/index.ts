// Publishes SEO-optimized Printify products to Etsy and backfills the primary
// project's pod_listings rows with etsy_listing_id + etsy_url.
//
// Deploys to the SECONDARY Supabase project (zmyczlfuufhngzovkjdh) which holds
// PRINTIFY_API_TOKEN + PRINTIFY_SHOP_ID. Writes back to the PRIMARY project DB
// using PRIMARY_SUPABASE_URL + PRIMARY_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRINTIFY_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const PRINTIFY_SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
const PRIMARY_URL =
  Deno.env.get("PRIMARY_SUPABASE_URL") ??
  Deno.env.get("SUPABASE_URL") ??
  "https://eauvubfpanpeuxsrqesu.supabase.co";
const PRIMARY_KEY =
  Deno.env.get("PRIMARY_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

const primary = createClient(PRIMARY_URL, PRIMARY_KEY, {
  auth: { persistSession: false },
});

interface Result {
  id: string;
  printify_id: string;
  title: string;
  ok: boolean;
  etsy_listing_id?: string;
  etsy_url?: string;
  error?: string;
}

async function publishOne(row: {
  id: string;
  printify_id: string;
  title: string;
}): Promise<Result> {
  try {
    // 1) Tell Printify to publish to Etsy (sales channel external publish).
    const pubRes = await fetch(
      `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${row.printify_id}/publish.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PRINTIFY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
          keyFeatures: true,
          shipping_template: true,
        }),
      },
    );

    if (!pubRes.ok) {
      const text = await pubRes.text();
      return { ...row, ok: false, error: `publish ${pubRes.status}: ${text.slice(0, 300)}` };
    }

    // 2) Poll product until external.id (etsy listing) appears (max ~30s).
    let etsyListingId: string | undefined;
    let etsyUrl: string | undefined;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const get = await fetch(
        `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${row.printify_id}.json`,
        { headers: { Authorization: `Bearer ${PRINTIFY_TOKEN}` } },
      );
      if (!get.ok) continue;
      const json = await get.json();
      if (json?.external?.id) {
        etsyListingId = String(json.external.id);
        etsyUrl = json.external.handle ?? undefined;
        break;
      }
      // Mark publishing as succeeded so Printify finalizes the listing.
      await fetch(
        `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${row.printify_id}/publishing_succeeded.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PRINTIFY_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            external: { id: "", handle: "" },
          }),
        },
      ).catch(() => {});
    }

    if (!etsyListingId) {
      return {
        ...row,
        ok: false,
        error: "Publish accepted but Etsy listing id not returned within 30s",
      };
    }

    // 3) Backfill primary DB.
    const { error } = await primary
      .from("pod_listings")
      .update({
        etsy_listing_id: etsyListingId,
        etsy_url: etsyUrl ?? `https://www.etsy.com/listing/${etsyListingId}`,
        status: "published_to_etsy",
      })
      .eq("id", row.id);

    if (error) {
      return { ...row, ok: false, error: `db update: ${error.message}` };
    }

    await primary.from("pod_publish_logs").insert({
      listing_id: row.id,
      stage: "etsy_publish",
      status: "ok",
      detail: { etsy_listing_id: etsyListingId, etsy_url: etsyUrl },
    });

    return {
      ...row,
      ok: true,
      etsy_listing_id: etsyListingId,
      etsy_url: etsyUrl ?? `https://www.etsy.com/listing/${etsyListingId}`,
    };
  } catch (e) {
    return { ...row, ok: false, error: String(e?.message ?? e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Find all SEO-optimized listings that never made it to Etsy.
  const { data: rows, error } = await primary
    .from("pod_listings")
    .select("id, printify_id, title")
    .not("seo_optimized_at", "is", null)
    .is("etsy_listing_id", null)
    .not("printify_id", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Result[] = [];
  for (const r of rows ?? []) {
    results.push(await publishOne(r as any));
  }

  return new Response(
    JSON.stringify({
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
