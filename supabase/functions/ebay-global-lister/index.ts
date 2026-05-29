// ebay-global-lister — eBay global digital product listings
//
// Runs WEEKLY (Tuesdays 9am UTC) via cron.
// eBay: 190M active buyers globally · Extremely strong in UK, Germany, Australia, Canada
// Digital downloads can be listed in "Everything Else → Information Products"
// eBay's international reach is unmatched for physical/digital crossover buyers.
//
// SETUP (one-time, ~20 min):
//   1. Create eBay developer account at developer.ebay.com
//   2. Create production app → get App ID + Cert ID + Dev ID
//   3. Generate User token via OAuth (eBay's OAuth playground)
//   4. Set secrets: EBAY_APP_ID, EBAY_CERT_ID, EBAY_DEV_ID, EBAY_USER_TOKEN
//   5. Ensure eBay seller account has PayPal connected for payouts
//
// Revenue: $4.97–$12.97 per sale · 10% eBay final value fee on digital items
// Best markets: UK (ebay.co.uk), Germany (ebay.de), Australia (ebay.com.au)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const EBAY_APP_ID    = Deno.env.get("EBAY_APP_ID") || "";
const EBAY_CERT_ID   = Deno.env.get("EBAY_CERT_ID") || "";
const EBAY_DEV_ID    = Deno.env.get("EBAY_DEV_ID") || "";
const EBAY_TOKEN     = Deno.env.get("EBAY_USER_TOKEN") || "";
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY    = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY     = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL    = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[EBAY-LISTER] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string, maxTokens = 600): Promise<string> {
  for (const cfg of [
    { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_KEY,
      body: (p: string, t: number) => ({ model: "google/gemini-2.5-flash", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" } },
    { url: "https://api.anthropic.com/v1/messages", key: ANTHROPIC_KEY,
      body: (p: string, t: number) => ({ model: "claude-haiku-4-5-20251001", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } },
    { url: "https://api.openai.com/v1/chat/completions", key: OPENAI_KEY,
      body: (p: string, t: number) => ({ model: "gpt-4o-mini", max_completion_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" } },
  ]) {
    if (!cfg.key) continue;
    try {
      const r = await fetch(cfg.url, { method: "POST", headers: cfg.headers, body: JSON.stringify(cfg.body(prompt, maxTokens)), signal: AbortSignal.timeout(20_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch {}
  }
  return "";
}

// eBay Trading API XML for AddFixedPriceItem
function buildEbayListingXML(item: {
  title: string; description: string; price_usd: number; delivery_url: string;
}): string {
  const safeTitle = item.title.replace(/[<>&'"]/g, " ").slice(0, 80);
  const safeDesc = item.description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${safeTitle}</Title>
    <Description><![CDATA[${item.description}

INSTANT DIGITAL DOWNLOAD — Delivered to your eBay Messages within 1 hour of payment.
Includes full PDF guide, templates, and bonus resources.

© M2 Training — All rights reserved. Personal use license included.]]></Description>
    <PrimaryCategory><CategoryID>1469</CategoryID></PrimaryCategory>
    <StartPrice>${item.price_usd.toFixed(2)}</StartPrice>
    <CategoryMappingAllowed>true</CategoryMappingAllowed>
    <ConditionID>1000</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>1</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PaymentMethods>PayPal</PaymentMethods>
    <PayPalEmailAddress>matthewmichels4@gmail.com</PayPalEmailAddress>
    <PictureDetails>
      <GalleryType>Gallery</GalleryType>
    </PictureDetails>
    <Quantity>999</Quantity>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <RefundOption>MoneyBack</RefundOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
    </ReturnPolicy>
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>ElectronicDeliveryOffline</ShippingService>
        <ShippingServiceCost>0.00</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <Site>US</Site>
  </Item>
</AddFixedPriceItemRequest>`;
}

async function addEbayListing(item: { title: string; description: string; price_usd: number; delivery_url: string }): Promise<{ item_id: string; url: string }> {
  const xml = buildEbayListingXML(item);

  const r = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": "AddFixedPriceItem",
      "X-EBAY-API-APP-NAME": EBAY_APP_ID,
      "X-EBAY-API-CERT-NAME": EBAY_CERT_ID,
      "X-EBAY-API-DEV-NAME": EBAY_DEV_ID,
      "Content-Type": "text/xml",
    },
    body: xml,
    signal: AbortSignal.timeout(30_000),
  });

  const text = await r.text();
  const itemIdMatch = text.match(/<ItemID>(\d+)<\/ItemID>/);
  if (!itemIdMatch) throw new Error(`eBay listing failed: ${text.slice(0, 500)}`);
  const itemId = itemIdMatch[1];
  return { item_id: itemId, url: `https://www.ebay.com/itm/${itemId}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Start");

  if (!EBAY_APP_ID || !EBAY_TOKEN) {
    return new Response(JSON.stringify({
      skipped: true,
      reason: "EBAY_APP_ID or EBAY_USER_TOKEN not set",
      setup: [
        "1. developer.ebay.com → My Account → Create a production app",
        "2. Get App ID, Cert ID, Dev ID",
        "3. Generate User Token via eBay OAuth playground",
        "4. Set secrets: EBAY_APP_ID, EBAY_CERT_ID, EBAY_DEV_ID, EBAY_USER_TOKEN",
      ],
      market: "190M buyers · UK/Germany/Australia especially strong for digital products",
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  try {
    const { data: products } = await sb
      .from("gumroad_digital_products")
      .select("id, title, niche, price_cents, gumroad_url, product_type")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: alreadyListed } = await sb.from("ebay_listings" as any)
      .select("gumroad_product_id").limit(200);
    const listedIds = new Set((alreadyListed || []).map((e: any) => e.gumroad_product_id));

    const toLista = (products || []).filter((p: any) => !listedIds.has(p.id) && p.gumroad_url).slice(0, 3);

    if (toLista.length === 0) {
      return new Response(JSON.stringify({ success: true, listed: 0, message: "All products already on eBay" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const listed: string[] = [];
    const failed: string[] = [];

    for (const product of toLista) {
      try {
        const desc = await ai(`Write an eBay product description for a digital download called "${product.title}".
This is a ${product.niche || product.product_type} digital product (PDF guide/templates).
Write 3 short paragraphs. Emphasize: instant delivery, practical value, professional quality.
Max 200 words. No markdown. eBay buyers are practical shoppers.`);

        const priceUsd = (product.price_cents || 997) / 100;
        const result = await addEbayListing({
          title: product.title,
          description: desc || `Professional ${product.niche || "business"} digital download.`,
          price_usd: priceUsd,
          delivery_url: product.gumroad_url,
        });

        await sb.from("ebay_listings" as any).insert({
          gumroad_product_id: product.id,
          title: product.title,
          ebay_item_id: result.item_id,
          ebay_url: result.url,
          price_usd: priceUsd,
          status: "active",
        }).catch(() => {});

        listed.push(product.title);
        log(`Listed: ${product.title}`, result);
      } catch (err) {
        log(`Failed: ${product.title}`, String(err).slice(0, 200));
        failed.push(product.title);
      }
    }

    if (RESEND_KEY && listed.length > 0) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "eBay Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `🏪 ${listed.length} products listed on eBay (190M buyers)`,
          html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#f59e0b;">🏪 eBay Listings Live</h2>
<p>${listed.length} digital products now on eBay — 190M buyers globally:</p>
<ul>${listed.map(t => `<li>${t}</li>`).join("")}</ul>
<p style="color:#94a3b8;font-size:12px;">Strong reach in UK, Germany, Australia. Buyers in 190+ countries.</p>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "ebay-global-lister",
      last_run_at: new Date().toISOString(),
      last_status: listed.length > 0 ? "ok" : "idle",
      last_result: JSON.stringify({ listed: listed.length, failed: failed.length, titles: listed }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, listed: listed.length, failed: failed.length, titles: listed }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", String(err).slice(0, 300));
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
