// Printify outbound webhook receiver.
// Configure in Printify dashboard → Settings → Webhooks → POST to:
//   https://<project>.supabase.co/functions/v1/printify-webhook
// Subscribe to: product:publish:started, product:publish:succeeded,
// product:publish:failed, shop:disconnected.
//
// When Etsy publish succeeds Printify POSTs:
//   {
//     "id": "<event_id>",
//     "type": "product:publish:succeeded",
//     "resource": {
//       "id": "<printify_product_id>",
//       "data": {
//         "shop_id": 2890106,
//         "external": { "id": "<etsy_listing_id>", "handle": "https://www.etsy.com/listing/..." }
//       }
//     }
//   }
//
// We persist external.id into pod_listings.etsy_listing_id so the dashboard
// + sales-sync can stitch Printify products to live Etsy listings.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return ok({ error: "invalid_json" }, 400);
  }

  const eventType: string = payload?.type ?? "";
  const resource = payload?.resource ?? {};
  const printifyId: string | undefined = resource?.id ?? resource?.data?.id;
  const externalIdRaw = resource?.data?.external?.id;
  const externalHandle: string | undefined = resource?.data?.external?.handle;

  // Log every event for audit.
  await sb.from("pod_publish_logs").insert({
    listing_id: null,
    product_name: `webhook:${printifyId ?? "?"}`,
    niche: "webhook",
    stage: eventType || "unknown",
    attempt: 1,
    ok: !eventType.endsWith(":failed"),
    duration_ms: 0,
    meta: { printifyId, externalIdRaw, externalHandle, raw: payload },
  }).then(() => {}, () => {});

  if (!printifyId) return ok({ ok: true, skipped: "no_printify_id" });

  if (eventType === "product:publish:succeeded") {
    // Etsy listing ids are numeric — extract from external.id or handle URL.
    let etsyListingId: number | null = null;
    if (externalIdRaw) {
      const n = Number(String(externalIdRaw).replace(/\D/g, ""));
      if (Number.isFinite(n) && n > 0) etsyListingId = n;
    }
    if (!etsyListingId && externalHandle) {
      const m = externalHandle.match(/listing\/(\d+)/);
      if (m) etsyListingId = Number(m[1]);
    }

    const update: Record<string, unknown> = {
      status: "published",
      last_synced_at: new Date().toISOString(),
    };
    if (etsyListingId) update.etsy_listing_id = etsyListingId;
    if (externalHandle) update.etsy_url = externalHandle;

    const { error } = await sb
      .from("pod_listings")
      .update(update)
      .eq("printify_id", printifyId);

    if (error) return ok({ ok: false, error: error.message }, 500);
    return ok({ ok: true, printifyId, etsyListingId });
  }

  if (eventType === "product:publish:failed") {
    await sb.from("pod_listings")
      .update({ status: "publish_failed" })
      .eq("printify_id", printifyId);
    return ok({ ok: true, printifyId, marked: "publish_failed" });
  }

  if (eventType === "product:publish:started") {
    await sb.from("pod_listings")
      .update({ status: "publishing" })
      .eq("printify_id", printifyId);
    return ok({ ok: true, printifyId, marked: "publishing" });
  }

  return ok({ ok: true, ignored: eventType });
});
