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
  etsy_listing_id?: number;
  etsy_url?: string;
  error?: string;
}

async function logStage(listingId: string, ok: boolean, meta: Record<string, unknown>, error?: string) {
  await primary.from("pod_publish_logs").insert({
    listing_id: listingId,
    stage: "etsy_publish",
    attempt: 1,
    ok,
    error: error ?? null,
    meta,
  });
}

async function publishOne(row: {
  id: string;
  printify_id: string;
  title: string;
}): Promise<Result> {
  try {
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
      const err = `publish ${pubRes.status}: ${text.slice(0, 300)}`;
      await logStage(row.id, false, { printifyId: row.printify_id }, err);
      return { ...row, ok: false, error: err };
    }

    // Poll Printify for up to 5 minutes — Etsy mint times are often 1-3 min,
    // and occasionally longer. Previous 30s window was logging false failures.
    let etsyListingId: number | undefined;
    let etsyUrl: string | undefined;
    const MAX_POLLS = 60;        // 60 * 5s = 5 minutes
    const POLL_INTERVAL_MS = 5000;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const get = await fetch(
        `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/products/${row.printify_id}.json`,
        { headers: { Authorization: `Bearer ${PRINTIFY_TOKEN}` } },
      );
      if (!get.ok) continue;
      const json = await get.json();
      const extId = json?.external?.id;
      if (extId) {
        etsyListingId = Number(extId);
        etsyUrl = json.external.handle ?? `https://www.etsy.com/listing/${etsyListingId}`;
        break;
      }
    }

    if (!etsyListingId) {
      // Not a hard failure — Printify accepted publish, Etsy is just slow.
      // Mark "pending" so the next sweep can pick it up without alerting.
      const note = `Publish accepted; Etsy listing id not returned within ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s — will retry next sweep`;
      await logStage(row.id, true, {
        printifyId: row.printify_id,
        pending: true,
      }, note);
      return { ...row, ok: false, error: note };
    }

    const { error } = await primary
      .from("pod_listings")
      .update({
        etsy_listing_id: etsyListingId,
        published_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      await logStage(row.id, false, { printifyId: row.printify_id, etsyListingId }, `db update: ${error.message}`);
      return { ...row, ok: false, error: `db update: ${error.message}` };
    }

    await logStage(row.id, true, {
      printifyId: row.printify_id,
      etsy_listing_id: etsyListingId,
      etsy_url: etsyUrl,
    });

    return { ...row, ok: true, etsy_listing_id: etsyListingId, etsy_url: etsyUrl };
  } catch (e) {
    const err = String((e as Error)?.message ?? e);
    await logStage(row.id, false, { printifyId: row.printify_id }, err);
    return { ...row, ok: false, error: err };
  }
}

async function runBatch(rows: { id: string; printify_id: string; title: string }[]) {
  for (const r of rows) {
    await publishOne(r);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!PRINTIFY_TOKEN || !PRINTIFY_SHOP_ID) {
    return new Response(
      JSON.stringify({
        error: "Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID secret on this project.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

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

  const queued = (rows ?? []) as { id: string; printify_id: string; title: string }[];

  // Run in background so the HTTP response returns immediately. Polling +
  // multi-listing processing can exceed ~30s easily; client checks DB after.
  // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime
  EdgeRuntime.waitUntil(runBatch(queued));

  return new Response(
    JSON.stringify({
      queued: queued.length,
      ids: queued.map((r) => r.id),
      note: "Publishing in background. Poll pod_listings.etsy_listing_id in ~1-3 min.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
