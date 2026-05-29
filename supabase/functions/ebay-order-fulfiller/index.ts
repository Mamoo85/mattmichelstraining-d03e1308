/**
 * ebay-order-fulfiller
 * Polls eBay for new orders and handles fulfillment:
 *  - Physical POD: creates Printify order
 *  - Digital / Books: sends download link via eBay message
 *
 * Runs every 30 minutes via pg_cron.
 * Also handles POST {"mode":"check"} for manual trigger.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID   = Deno.env.get("EBAY_APP_ID")!;
const DEV_ID   = Deno.env.get("EBAY_DEV_ID")!;
const CERT_ID  = Deno.env.get("EBAY_CERT_ID")!;
const TRADING_API = "https://api.ebay.com/ws/api.dll";
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_KEY")!;
const PRINTIFY_SHOP = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getToken(): Promise<string> {
  const { data } = await supabase
    .from("ebay_oauth_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("account_id", "gngstore")
    .single();
  if (!data) throw new Error("No eBay token");
  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() > expiresAt - 600_000) {
    const creds = btoa(`${APP_ID}:${CERT_ID}`);
    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${creds}` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: data.refresh_token, scope: "https://api.ebay.com/oauth/api_scope" }),
    });
    const d = await res.json();
    if (d.access_token) {
      await supabase.from("ebay_oauth_tokens").update({ access_token: d.access_token, expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString() }).eq("account_id", "gngstore");
      return d.access_token;
    }
  }
  return data.access_token;
}

async function tradingCall(callName: string, xmlBody: string, token: string): Promise<string> {
  const res = await fetch(TRADING_API, {
    method: "POST",
    headers: {
      "Content-Type":          "text/xml",
      "X-EBAY-API-CALL-NAME":  callName,
      "X-EBAY-API-APP-NAME":   APP_ID,
      "X-EBAY-API-DEV-NAME":   DEV_ID,
      "X-EBAY-API-CERT-NAME":  CERT_ID,
      "X-EBAY-API-SITEID":     "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1113",
    },
    body: `<?xml version="1.0" encoding="utf-8"?><${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>${xmlBody}</${callName}Request>`,
  });
  return await res.text();
}

function extractXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "s"));
  return m?.[1]?.trim() ?? "";
}

function extractAll(xml: string, tag: string): string[] {
  const matches = [...xml.matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, "gs"))];
  return matches.map(m => m[1].trim());
}

// ── Fetch new eBay orders ─────────────────────────────────────────────────────

async function fetchNewOrders(token: string): Promise<object[]> {
  const fromDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last hour
  const xml = `
<CreateTimeFrom>${fromDate}</CreateTimeFrom>
<CreateTimeTo>${new Date().toISOString()}</CreateTimeTo>
<OrderStatus>Completed</OrderStatus>`;

  const response = await tradingCall("GetOrders", xml, token);
  const orderXmls = [...response.matchAll(/<Order>(.*?)<\/Order>/gs)].map(m => m[1]);

  return orderXmls.map(o => ({
    orderId:    extractXml(o, "OrderID"),
    buyerUser:  extractXml(o, "UserID"),
    itemId:     extractXml(o, "ItemID"),
    totalPrice: parseFloat(extractXml(o, "Total") || "0"),
    name:       extractXml(o, "Name"),
    street1:    extractXml(o, "Street1"),
    street2:    extractXml(o, "Street2"),
    city:       extractXml(o, "CityName"),
    state:      extractXml(o, "StateOrProvince"),
    zip:        extractXml(o, "PostalCode"),
    country:    extractXml(o, "CountryName"),
    email:      extractXml(o, "Email"),
  }));
}

// ── Identify what was sold ────────────────────────────────────────────────────

async function identifyOrder(itemId: string): Promise<{ type: string; record: Record<string, unknown> | null }> {
  // Physical POD?
  const { data: pod } = await supabase
    .from("pod_product_queue")
    .select("*")
    .eq("ebay_item_id", itemId)
    .single();
  if (pod) return { type: "physical", record: pod };

  // Digital?
  const { data: dig } = await supabase
    .from("etsy_digital_listings")
    .select("*")
    .eq("ebay_item_id", itemId)
    .single();
  if (dig) return { type: "digital", record: dig };

  // KDP book?
  const { data: book } = await supabase
    .from("kdp_books")
    .select("*")
    .eq("ebay_item_id", itemId)
    .single();
  if (book) return { type: "book", record: book };

  return { type: "unknown", record: null };
}

// ── Printify order for physical POD ──────────────────────────────────────────

async function fulfillPhysical(order: Record<string, unknown>, pod: Record<string, unknown>): Promise<string | null> {
  if (!PRINTIFY_SHOP || !pod.printify_id) return null;

  const shopId = PRINTIFY_SHOP;
  const body = {
    external_id:  String(order.orderId),
    label:        `eBay Order ${order.orderId}`,
    line_items:   [{ product_id: pod.printify_id, variant_id: null, quantity: 1 }],
    shipping_method: 1,
    address_to: {
      first_name: String(order.name ?? "").split(" ")[0],
      last_name:  String(order.name ?? "").split(" ").slice(1).join(" "),
      address1:   String(order.street1 ?? ""),
      address2:   String(order.street2 ?? ""),
      city:       String(order.city ?? ""),
      region:     String(order.state ?? ""),
      zip:        String(order.zip ?? ""),
      country:    "US",
      email:      String(order.email ?? ""),
    },
  };

  const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/orders.json`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${PRINTIFY_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.id ?? null;
}

// ── Send download link for digital items ─────────────────────────────────────

async function sendDownloadLink(order: Record<string, unknown>, record: Record<string, unknown>, token: string): Promise<boolean> {
  const filePath = String(record.file_path ?? record.gumroad_url ?? "");
  if (!filePath) return false;

  // Get a signed URL from Supabase Storage if it's a storage path
  let downloadUrl = filePath;
  if (filePath.startsWith("digital-products/") || filePath.startsWith("books/")) {
    const { data } = await supabase.storage
      .from("digital-products")
      .createSignedUrl(filePath.replace("digital-products/", ""), 60 * 60 * 24 * 30); // 30 days
    if (data?.signedUrl) downloadUrl = data.signedUrl;
  }

  // Send eBay message
  const messageXml = `
<ItemID>${order.itemId}</ItemID>
<MemberMessage>
  <Body>Thank you for your purchase! 🎉 Here is your download link (valid 30 days):

${downloadUrl}

Please download your files promptly. If you have any issues, message me and I'll resend immediately.

Thank you for shopping with us!</Body>
  <RecipientID>${order.buyerUser}</RecipientID>
  <Subject>Your Digital Download is Ready!</Subject>
  <MessageType>ContactTransactionSeller</MessageType>
</MemberMessage>`;

  const response = await tradingCall("AddMemberMessageAAQToPartner", messageXml, token);
  return extractXml(response, "Ack").includes("Success");
}

// ── Process orders ────────────────────────────────────────────────────────────

async function processOrders(): Promise<object> {
  const token = await getToken();
  const orders = await fetchNewOrders(token);

  if (!orders.length) return { processed: 0, message: "No new orders in last hour" };

  const results = [];
  for (const order of orders as Record<string, unknown>[]) {
    // Skip already processed
    const { data: existing } = await supabase
      .from("ebay_orders")
      .select("id")
      .eq("ebay_order_id", order.orderId)
      .single();
    if (existing) continue;

    const { type, record } = await identifyOrder(String(order.itemId));

    let printifyOrderId = null;
    let downloadSent = false;

    if (type === "physical" && record) {
      printifyOrderId = await fulfillPhysical(order, record);
    } else if ((type === "digital" || type === "book") && record) {
      downloadSent = await sendDownloadLink(order, record, token);
    }

    // Log to DB
    await supabase.from("ebay_orders").insert({
      ebay_order_id:      String(order.orderId),
      ebay_item_id:       String(order.itemId),
      queue_id:           type === "physical" ? record?.id as number : null,
      digital_listing_id: type === "digital"  ? record?.id as number : null,
      kdp_book_id:        type === "book"      ? record?.id as number : null,
      order_type:         type,
      buyer_username:     String(order.buyerUser),
      buyer_email:        String(order.email),
      shipping_name:      String(order.name),
      shipping_address:   { street1: order.street1, city: order.city, state: order.state, zip: order.zip },
      sale_price_cents:   Math.round(Number(order.totalPrice) * 100),
      printify_order_id:  printifyOrderId,
      fulfilled_at:       printifyOrderId ? new Date().toISOString() : null,
      download_sent_at:   downloadSent    ? new Date().toISOString() : null,
      status:             printifyOrderId || downloadSent ? "fulfilled" : "pending",
    });

    results.push({
      orderId: order.orderId,
      type,
      status: printifyOrderId ? `printify:${printifyOrderId}` : downloadSent ? "download_sent" : "pending_manual",
    });
  }

  return { processed: results.length, results };
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  if (body.mode === "check" || req.method === "POST") {
    try {
      const result = await processOrders();
      return new Response(JSON.stringify(result, null, 2), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
  }
  return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
});
