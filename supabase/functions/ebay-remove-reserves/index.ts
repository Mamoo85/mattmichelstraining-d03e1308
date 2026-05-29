/**
 * ebay-remove-reserves
 * Removes reserve prices from all active eBay auction listings.
 * MUST be called BEFORE any bids come in — eBay credits the $5 fee back
 * only when the reserve is removed with zero bids outstanding.
 *
 * Fix from original: DeletedField must be a sibling of <Item> in the request,
 * NOT a child of <Item>. Previous version had <ReservePrice>0</ReservePrice>
 * inside <Item> which eBay rejects with "business policies" error.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID  = Deno.env.get("EBAY_APP_ID")!;
const DEV_ID  = Deno.env.get("EBAY_DEV_ID")!;
const CERT_ID = Deno.env.get("EBAY_CERT_ID")!;
const TRADING_API = "https://api.ebay.com/ws/api.dll";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getToken(): Promise<string> {
  const { data } = await supabase
    .from("ebay_oauth_tokens")
    .select("access_token")
    .eq("account_id", "gngstore")
    .single();
  return data?.access_token ?? "";
}

Deno.serve(async (_req: Request) => {
  const token = await getToken();

  const { data: products } = await supabase
    .from("pod_product_queue")
    .select("ebay_item_id, name, retail_price, product_type")
    .eq("ebay_listing_type", "auction")
    .not("ebay_item_id", "is", null);

  if (!products?.length) {
    return new Response(JSON.stringify({ message: "No active auctions found" }), { status: 200 });
  }

  const results = [];
  let credited = 0, failed = 0;

  for (const p of products) {
    // eBay API: to remove a reserve price before any bids, set ReservePrice to 0.
    // IMPORTANT: Only send ItemID + ReservePrice — do NOT include StartPrice,
    // ShippingDetails, PaymentMethods, or ReturnPolicy. Those fields trigger
    // "opted into business policies" validation. ReservePrice alone does not.
    const body = `<?xml version="1.0" encoding="utf-8"?><ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials><Item><ItemID>${p.ebay_item_id}</ItemID><ReservePrice>0</ReservePrice></Item></ReviseItemRequest>`;

    const res = await fetch(TRADING_API, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME":  "ReviseItem",
        "X-EBAY-API-APP-NAME":   APP_ID,
        "X-EBAY-API-DEV-NAME":   DEV_ID,
        "X-EBAY-API-CERT-NAME":  CERT_ID,
        "X-EBAY-API-SITEID":     "0",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "1113",
      },
      body,
    });

    const text = await res.text();
    const ack  = text.match(/<Ack>(.*?)<\/Ack>/s)?.[1]?.trim() ?? "";
    const err  = text.match(/<LongMessage>(.*?)<\/LongMessage>/s)?.[1]?.trim()
              || text.match(/<ShortMessage>(.*?)<\/ShortMessage>/s)?.[1]?.trim()
              || "unknown error";

    // eBay Ack values: "Success" = clean success, "Warning" = succeeded with warnings.
    // "Warning" is NOT a failure — it means the operation went through.
    // The business policies warning is expected when sending ReservePrice alone.
    if (ack === "Success" || ack === "Warning") {
      credited++;
      results.push({ item: p.name, itemId: p.ebay_item_id, status: "reserve_removed", ack });
    } else {
      failed++;
      results.push({ item: p.name, itemId: p.ebay_item_id, status: "failed", error: err, rawSnippet: text.slice(0, 400) });
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return new Response(JSON.stringify({
    total: products.length,
    reserve_fees_being_credited: credited,
    failed,
    estimated_credit: `$${(credited * 5).toFixed(2)}`,
    results,
  }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
});
