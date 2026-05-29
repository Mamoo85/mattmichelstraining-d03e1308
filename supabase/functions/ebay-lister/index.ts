/**
 * ebay-lister
 * Lists all product types on eBay.
 *
 * Modes:
 *   POST {"mode":"auctions"}          — create 7-day $0.99 auctions for top POD physical products
 *   POST {"mode":"physical"}          — fixed-price listings for all published POD products
 *   POST {"mode":"digital"}           — fixed-price listings for Etsy digital downloads
 *   POST {"mode":"books"}             — fixed-price listings for KDP books
 *   POST {"mode":"whop"}              — fixed-price listings for Whop digital products
 *   POST {"mode":"all"}               — run all modes sequentially
 *   POST {"mode":"status"}            — show what's listed vs unlisted
 *   POST {"mode":"refresh_token"}     — refresh the eBay access token
 *   POST {"mode":"reset_vero"}        — clear ebay_item_id from VeRO-removed listings so they relist with sanitized titles
 *   POST {"mode":"reset_vero","target":"whop"}  — reset only whop (or "digital", "books", "all")
 *
 * Auction modes (digital products — $0 cost, start at $0.99 + BIN at retail):
 *   POST {"mode":"auction_digital"}          — 7-day auctions w/BIN for all unlisted digital (whop+etsy+books)
 *   POST {"mode":"auction_digital","limit":5} — limit per source
 *   POST {"mode":"relist_digital"}           — clear expired auction IDs (>7d old) and relist fresh
 *   POST {"mode":"convert_to_auction"}       — end existing fixed-price digital listings, relist as auctions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID       = Deno.env.get("EBAY_APP_ID")!;
const DEV_ID       = Deno.env.get("EBAY_DEV_ID")!;
const CERT_ID      = Deno.env.get("EBAY_CERT_ID")!;
const RU_NAME      = "Matthew_Michels-MatthewM-Gngsto-lxningvnx";
const TRADING_API  = "https://api.ebay.com/ws/api.dll";
const SITE_ID      = "0"; // US
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? Deno.env.get("PRINTIFY_API_KEY") ?? "";
const PRINTIFY_API_BASE = "https://api.printify.com/v1";
const PRINTIFY_SHOP_ID  = Deno.env.get("PRINTIFY_SHOP_ID") ?? "2890106";

// eBay category IDs (US site — verified working)
const CATEGORIES: Record<string, number> = {
  // Apparel
  mug:          46290,   // Pottery & Glass > Novelty, Souvenir & Specialty Mugs
  tshirt:       15687,   // Clothing > Men's > T-Shirts
  hoodie:       57988,   // Clothing > Men's > Hoodies & Sweatshirts
  sweatshirt:   57988,
  longsleeve:   15687,
  sock:         11554,   // Clothing > Men's > Socks
  hat:          163550,  // Clothing > Men's Accessories > Hats
  truckercap:   163550,
  onesie:       15687,   // 100984 restricted; using T-Shirts (confirmed leaf) as fallback
  // Home & Drinkware
  tumbler:      46290,   // Novelty, Souvenir & Specialty Mugs (proven working; 20628=cookware)
  tumbler40:    46290,
  travelmug:    46290,
  pintglass:    46290,   // Same proven mug category for all novelty drinkware
  shotglass:    46290,
  wineglass:    46290,
  coaster:      156778,  // 550 is a parent; using Ornaments (confirmed leaf under Collectibles)
  candle:       46290,   // Novelty, Souvenir & Specialty (28098/3187 both invalid; using proven mug cat)
  // Art & Print
  poster_v:     156778,  // 184638 is a parent; using Ornaments leaf (confirmed working)
  poster_h:     156778,
  sticker:      717,     // Stickers
  // Home Goods
  blanket:      46290,   // 156477/156778 both invalid/rejected; using proven mug/novelty category
  pillow:       46290,   // 20595 unverified; using proven mug/novelty category
  mousepad:     46290,   // 3676/156778 both invalid; using proven mug/novelty category
  laptopsleeve: 46290,   // 3973 unverified; using proven mug/novelty category
  puzzle:       180250,  // Toys & Hobbies > Puzzles > Jigsaw Puzzles
  // Accessories
  phonecase_slim:  9394, // Cell Phones & Accessories
  phonecase_tough: 9394,
  petbandana:   46352,   // Pet Supplies > Dogs > Clothing
  ornament:     156778,  // Collectibles > Holiday > Christmas > Ornaments
  // Books & Paper
  journal:      29223,   // Books > Nonfiction (267 is parent-only, not leaf)
  greetingcard: 252,     // Paper > Cards & Postcards
  // Digital (184638/64482/550 all non-leaf; 29223 = Books>Nonfiction confirmed leaf; craft/art TBD)
  digital_art:    29223,
  digital_craft:  29223,
  book:           29223, // Books > Nonfiction (leaf category)
  // Fallback (550/184638/64482 are all parent nodes; 156778 = Ornaments is confirmed leaf)
  default:      156778,
};

// Note: No reserve pricing — eBay charges $5 per listing for reserve prices (non-refundable).
// Auctions start at full retail price instead.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── Printify image helper ─────────────────────────────────────────────────────
// Returns the best Printify CDN image URL for a product.
// Uses images.printify.com — publicly accessible by eBay's crawler.
// (Never use i.etsystatic.com — Etsy blocks hotlinking from eBay.)

async function getPrintifyImage(printifyId: string): Promise<string> {
  if (!printifyId || !PRINTIFY_KEY) return "";
  try {
    const res = await fetch(
      `${PRINTIFY_API_BASE}/shops/${PRINTIFY_SHOP_ID}/products/${printifyId}.json`,
      { headers: { Authorization: `Bearer ${PRINTIFY_KEY}` } },
    );
    if (!res.ok) return "";
    const data = await res.json();
    const images: Array<{ src: string; is_default?: boolean; position?: string }> = data.images ?? [];
    if (!images.length) return "";
    // Prefer default/front image
    const best = images.find(i => i.is_default) ?? images.find(i => i.position === "front") ?? images[0];
    return best?.src ?? "";
  } catch {
    return "";
  }
}

// ── eBay required ItemSpecifics by product type ───────────────────────────────

function buildItemSpecifics(productType: string): string {
  const specs: Array<{ name: string; value: string }> = [
    { name: "Brand", value: "Unbranded" },
  ];

  switch (productType) {
    case "tshirt":
    case "longsleeve":
      specs.push(
        { name: "Color", value: "White" },
        { name: "Size", value: "S" },
        { name: "Size Type", value: "Regular" },
        { name: "Department", value: "Unisex Adults" },
        { name: "Garment Care", value: "Machine Wash" },
        { name: "Material", value: "Cotton" },
        { name: "Neckline", value: "Crew Neck" },
        { name: "Sleeve Length", value: productType === "longsleeve" ? "Long Sleeve" : "Short Sleeve" },
        { name: "Type", value: "T-Shirt" },
      );
      break;
    case "hoodie":
    case "sweatshirt":
      specs.push(
        { name: "Color", value: "White" },
        { name: "Size", value: "S" },
        { name: "Size Type", value: "Regular" },
        { name: "Style", value: productType === "hoodie" ? "Pullover" : "Crewneck" },
        { name: "Department", value: "Unisex Adults" },
        { name: "Garment Care", value: "Machine Wash" },
        { name: "Material", value: "Cotton Blend" },
        { name: "Type", value: productType === "hoodie" ? "Hoodie" : "Sweatshirt" },
      );
      break;
    case "mug":
      specs.push(
        { name: "Color", value: "White" },
        { name: "Type", value: "Mug" },
        { name: "Material", value: "Ceramic" },
        { name: "Features", value: "Dishwasher Safe" },
        { name: "Capacity", value: "11 oz" },
      );
      break;
    case "tumbler":
    case "travelmug":
      specs.push(
        { name: "Color", value: "Silver" },
        { name: "Type", value: "Travel Mug" },
        { name: "Material", value: "Stainless Steel" },
        { name: "Features", value: "Insulated" },
      );
      break;
    case "sock":
      specs.push(
        { name: "Color", value: "Multicolor" },
        { name: "Size", value: "One Size" },
        { name: "Size Type", value: "Regular" },
        { name: "Style", value: "Novelty" },
        { name: "Pattern", value: "Novelty" },
        { name: "Material", value: "Polyester Blend" },
        { name: "Department", value: "Unisex Adults" },
      );
      break;
    case "hat":
    case "truckercap":
      specs.push(
        { name: "Color", value: "Black" },
        { name: "Size", value: "One Size" },
        { name: "Style", value: "Baseball Cap" },
        { name: "Material", value: "Cotton" },
        { name: "Department", value: "Unisex Adults" },
      );
      break;
    case "poster_v":
    case "poster_h":
      specs.push(
        { name: "Type", value: "Print" },
        { name: "Material", value: "Paper" },
        { name: "Subject", value: "Inspirational" },
      );
      break;
    case "blanket":
      specs.push(
        { name: "Type", value: "Throw" },
        { name: "Material", value: "Fleece" },
        { name: "Size", value: "50x60 in" },
      );
      break;
    case "pillow":
      specs.push(
        { name: "Type", value: "Throw Pillow" },
        { name: "Material", value: "Polyester" },
        { name: "Filling", value: "Polyester Fiberfill" },
      );
      break;
    case "onesie":
      specs.push(
        { name: "Color", value: "White" },
        { name: "Size", value: "0-3 Months" },
        { name: "Size Type", value: "Regular" },
        { name: "Department", value: "Baby & Toddler" },
        { name: "Material", value: "Cotton" },
        { name: "Type", value: "One-Piece" },
      );
      break;
    case "tumbler40":
      specs.push(
        { name: "Color", value: "Black" },
        { name: "Type", value: "Travel Mug" },
        { name: "Material", value: "Stainless Steel" },
        { name: "Features", value: "Insulated" },
      );
      break;
    case "pintglass":
    case "shotglass":
    case "wineglass":
      specs.push(
        { name: "Color", value: "Clear" },
        { name: "Material", value: "Glass" },
        { name: "Type", value: productType === "shotglass" ? "Shot Glass" : productType === "wineglass" ? "Wine Glass" : "Pint Glass" },
      );
      break;
    case "coaster":
      specs.push(
        { name: "Material", value: "Hardboard" },
        { name: "Type", value: "Coaster" },
        { name: "Number of Pieces", value: "1" },
      );
      break;
    case "candle":
      specs.push(
        { name: "Color", value: "White" },
        { name: "Material", value: "Soy Wax" },
        { name: "Scent", value: "Unscented" },
        { name: "Type", value: "Pillar Candle" },
      );
      break;
    case "sticker":
      specs.push(
        { name: "Type", value: "Sticker" },
        { name: "Material", value: "Vinyl" },
        { name: "Features", value: "Waterproof" },
      );
      break;
    case "puzzle":
      specs.push(
        { name: "Type", value: "Jigsaw Puzzle" },
        { name: "Number of Pieces", value: "500" },
        { name: "Material", value: "Cardboard" },
        { name: "Age Level", value: "12+" },
      );
      break;
    case "laptopsleeve":
      specs.push(
        { name: "Compatible Brand", value: "Universal" },
        { name: "Compatible Screen Size", value: "15 in" },
        { name: "Material", value: "Neoprene" },
        { name: "Type", value: "Sleeve/Pouch" },
      );
      break;
    case "phonecase_slim":
    case "phonecase_tough":
      specs.push(
        { name: "Compatible Brand", value: "Apple" },
        { name: "Compatible Model", value: "iPhone 15" },
        { name: "Type", value: "Case" },
        { name: "Material", value: productType === "phonecase_tough" ? "Polycarbonate" : "TPU" },
        { name: "Features", value: productType === "phonecase_tough" ? "Heavy-Duty Protection" : "Slim" },
      );
      break;
    case "petbandana":
      specs.push(
        { name: "Animal", value: "Dog" },
        { name: "Size", value: "One Size" },
        { name: "Material", value: "Polyester" },
        { name: "Type", value: "Bandana/Scarf" },
      );
      break;
    case "ornament":
      specs.push(
        { name: "Type", value: "Ornament" },
        { name: "Material", value: "Ceramic" },
        { name: "Holiday", value: "Christmas" },
        { name: "Shape", value: "Round" },
      );
      break;
    case "greetingcard":
      specs.push(
        { name: "Type", value: "Greeting Card" },
        { name: "Material", value: "Paper" },
        { name: "Features", value: "Blank Inside" },
      );
      break;
    case "journal":
      specs.push(
        { name: "Type", value: "Journal/Notebook" },
        { name: "Material", value: "Paper" },
        { name: "Features", value: "Lined Pages" },
        { name: "Number of Pages", value: "120" },
      );
      break;
    case "mousepad":
      specs.push(
        { name: "Compatible Brand", value: "Universal" },
        { name: "Material", value: "Rubber" },
        { name: "Features", value: "Non-Slip Base" },
      );
      break;
    case "digital_art":
    case "digital_craft":
    default:
      if (productType === "book") {
        specs.push(
          { name: "Author", value: "GnG Store" },
          { name: "Format", value: "Trade Paperback" },
          { name: "Language", value: "English" },
        );
      } else {
        specs.push(
          { name: "Type", value: "Digital Art" },
          { name: "File Format", value: "PDF/PNG" },
        );
      }
      break;
  }

  const nameValues = specs.map(s =>
    `<NameValueList><Name>${s.name}</Name><Value>${xmlEscape(s.value)}</Value></NameValueList>`
  ).join("\n  ");

  return `<ItemSpecifics>\n  ${nameValues}\n</ItemSpecifics>`;
}

// ── Token management ──────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data } = await supabase
    .from("ebay_oauth_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("account_id", "gngstore")
    .single();

  if (!data) throw new Error("No eBay token found — visit /ebay-oauth-start");

  // Refresh if within 10 min of expiry
  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() > expiresAt - 600_000) {
    return await refreshToken(data.refresh_token);
  }
  return data.access_token;
}

async function refreshToken(refreshToken: string): Promise<string> {
  const creds = btoa(`${APP_ID}:${CERT_ID}`);
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      scope:         "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Token refresh failed: " + JSON.stringify(data));

  await supabase.from("ebay_oauth_tokens").update({
    access_token: data.access_token,
    expires_at:   new Date(Date.now() + data.expires_in * 1000).toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq("account_id", "gngstore");

  return data.access_token;
}

// ── Trading API helper ────────────────────────────────────────────────────────

async function tradingCall(callName: string, xmlBody: string, token: string): Promise<string> {
  const res = await fetch(TRADING_API, {
    method: "POST",
    headers: {
      "Content-Type":          "text/xml",
      "X-EBAY-API-CALL-NAME":  callName,
      "X-EBAY-API-APP-NAME":   APP_ID,
      "X-EBAY-API-DEV-NAME":   DEV_ID,
      "X-EBAY-API-CERT-NAME":  CERT_ID,
      "X-EBAY-API-SITEID":     SITE_ID,
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1113",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  ${xmlBody}
</${callName}Request>`,
  });
  return await res.text();
}

function extractXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "s"));
  return m?.[1]?.trim() ?? "";
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── VeRO-safe title sanitizer ─────────────────────────────────────────────────
// eBay VeRO (Verified Rights Owner) lets IP holders auto-remove listings
// containing their trademarked names with zero warning.
//
// Known VeRO triggers we've been hit with (updated 2026-05-26):
//   • ChatGPT (OpenAI TM), Amazon / FBA (Amazon TM), TikTok (ByteDance TM)
//   • YouTube (Google TM), Instagram / Facebook (Meta TM), LinkedIn, Pinterest
//   • Twitter / X (X Corp TM), Etsy (Etsy TM)
//   • "Bloom Where You Are Planted" (registered by multiple art companies)
//   • "But First Coffee", "Coffee Lover" (registered by multiple brands)
//   • "Blessed to Be", "Blessed Beyond Measure" (registered inspirational brands)
//   • "Crazy Cat Lady" (registered by multiple gift brands)
//   • "Word Search" / "Word Search for Adults" (registered by KDP publishers)
//
// KDP books get "GnG: " prefix + "Word Search" → "Word Puzzle"
// Whop products get platform TM swaps
// Digital art gets "Original AI Art: " prefix + phrase swaps

function sanitizeEbayTitle(
  title: string,
  context: "whop" | "digital" | "book" | "physical" = "physical",
): string {
  let t = title;

  // ── Platform trademarks ────────────────────────────────────────────────────
  t = t.replace(/\bChatGPT\b/gi,              "AI Chat Assistant");
  t = t.replace(/\bAmazon FBA\b/gi,           "eCommerce Fulfillment");
  t = t.replace(/\bFBA\b/g,                   "Fulfillment");
  t = t.replace(/\bAmazon\b/gi,               "Online Marketplace");
  t = t.replace(/\bTikTok Shop\b/gi,          "Short-Form Video Shop");
  t = t.replace(/\bTikTok\b/gi,               "Short-Form Video");
  t = t.replace(/\bYouTube\b/gi,              "Video Marketing");
  t = t.replace(/\bInstagram\b/gi,            "Social Media");
  t = t.replace(/\bFacebook\b/gi,             "Social Network");
  t = t.replace(/\bGoogle\b/gi,               "Search Engine");
  t = t.replace(/Twitter\/X\b/gi,             "Microblogging Network");
  t = t.replace(/\bTwitter\b/gi,              "Microblogging Network");
  t = t.replace(/\bLinkedIn\b/gi,             "Professional Network");
  t = t.replace(/\bPinterest\b/gi,            "Visual Social Media");
  t = t.replace(/\bShopify\b/gi,              "eCommerce Platform");
  t = t.replace(/\bEtsy\b/gi,                 "Handmade Marketplace");
  t = t.replace(/\bOpenAI\b/gi,               "AI Platform");
  t = t.replace(/\bMidjourney\b/gi,           "AI Image Generator");
  t = t.replace(/\bKindle\b/gi,               "eReader");
  t = t.replace(/\bKDP\b/g,                   "Self-Publishing");
  t = t.replace(/\bDropshipping\b/gi,         "Product Reselling");
  t = t.replace(/\bPayPal\b/gi,               "Online Payment");
  t = t.replace(/\bStripe\b/gi,               "Payment Platform");
  t = t.replace(/\bWhop\b/gi,                 "Digital Platform");
  t = t.replace(/\bGumroad\b/gi,              "Creator Marketplace");

  // ── Wall art / inspirational quote VeRO phrases ────────────────────────────
  // (registered by art companies like Stupell Industries, Marmont Hill, etc.)
  t = t.replace(/\bBloom Where You Are Planted\b/gi,         "Flourish Where You Stand");
  t = t.replace(/\bShe Believed She Could So She Did\b/gi,   "Believe and Achieve");
  t = t.replace(/\bLive Laugh Love\b/gi,                     "Joy Every Day");
  t = t.replace(/\bYou Got This\b/gi,                        "Keep Going Strong");
  t = t.replace(/\bBe Kind\b/gi,                             "Choose Kindness");
  t = t.replace(/\bDream Big\b/gi,                           "Aim High");
  t = t.replace(/\bFollow Your Heart\b/gi,                   "Trust Your Journey");

  // ── Coffee / food / lifestyle VeRO phrases ────────────────────────────────
  // Multiple brands have registered these exact phrases
  t = t.replace(/\bBut First Coffee\b/gi,                    "Morning Brew Ritual");
  t = t.replace(/\bCoffee Lover\b/gi,                        "Coffee Enthusiast");
  t = t.replace(/\bDecaf is the Enemy\b/gi,                  "Real Coffee Only");
  t = t.replace(/\bLife Begins After Coffee\b/gi,            "Life is Better with Coffee");

  // ── Religious / inspirational VeRO phrases ───────────────────────────────
  t = t.replace(/\bBlessed to Be\b/gi,                       "Proud to Be");
  t = t.replace(/\bBlessed Beyond Measure\b/gi,              "Grateful Beyond Measure");
  t = t.replace(/\bBlessed\b/gi,                             "Grateful");

  // ── Humor / pop-culture VeRO phrases ─────────────────────────────────────
  t = t.replace(/\bCrazy Cat Lady\b/gi,                      "Cat Obsessed");
  t = t.replace(/\bAdulting is Hard\b/gi,                    "Growing Up is Hard");

  // ── Book-specific transforms ───────────────────────────────────────────────
  if (context === "book") {
    // Multi-word variants first to avoid partial matches
    t = t.replace(/\bWord Search(?:\s+Puzzles?)?\s+for\s+Adults\b/gi, "Word Puzzles");
    t = t.replace(/\bWord Search\s+Puzzles\b/gi,             "Word Puzzles");
    t = t.replace(/\bWord Search\b/gi,                       "Word Puzzle");
    t = t.replace(/\bCrossword\b/gi,                         "Crossword Puzzle");
    // Prefix if not already present
    if (!t.startsWith("GnG:")) t = `GnG: ${t}`;
  }

  // ── Digital art: flag as AI-generated original ────────────────────────────
  if (context === "digital") {
    if (
      !/\bAI[\s-]Generated\b/i.test(t) &&
      !/\bOriginal AI\b/i.test(t) &&
      /\bWall Art\b|\bPrintable\b|\bPoster\b|\bDigital Print\b|\bDigital Download\b/i.test(t)
    ) {
      t = `Original AI Art: ${t}`;
    }
  }

  // Enforce 80-char eBay title limit
  return t.slice(0, 80).trim();
}

// ── Auction listings (POD Physical) ──────────────────────────────────────────

async function createAuctions(limit = 10): Promise<object> {
  const token = await getToken();

  // Get top published products not yet on eBay
  const { data: products } = await supabase
    .from("pod_product_queue")
    .select("id, name, product_type, printify_id, visual_score, retail_price")
    .eq("status", "published")
    .not("product_type", "in", '("download","digital")')
    .is("ebay_item_id", null)
    .not("printify_id", "is", null)
    .order("visual_score", { ascending: false })
    .limit(limit);

  if (!products?.length) return { created: 0, message: "No unlisted products found" };

  const results = [];
  for (const p of products) {
    try {
      const categoryId = CATEGORIES[p.product_type] ?? CATEGORIES.default;
      const description = buildDescription(p.name, p.product_type, "physical");
      // Use full retail price as start price — NO reserve (avoids $5/listing eBay fee)
      const startPrice = ((p.retail_price ?? 1999) / 100).toFixed(2);
      // Fetch Printify CDN image (publicly accessible by eBay — never use Etsy CDN)
      const imageUrl = await getPrintifyImage(p.printify_id ?? "");
      const pictureXml = imageUrl ? `<PictureDetails><PictureURL>${xmlEscape(imageUrl)}</PictureURL></PictureDetails>` : "";
      // Use full retail price as start price — NO reserve price (avoids $5/listing eBay fee)
      const startPrice = ((p.retail_price ?? 1999) / 100).toFixed(2);
      // Fetch Printify CDN image (publicly accessible by eBay — never use Etsy CDN)
      const imageUrl = await getPrintifyImage(p.printify_id ?? "");
      const pictureXml = imageUrl ? `<PictureDetails><PictureURL>${xmlEscape(imageUrl)}</PictureURL></PictureDetails>` : "";

      const xml = `
<Item>
  <Title>${xmlEscape(p.name.slice(0, 80))}</Title>
  <Description><![CDATA[${description}]]></Description>
  <PrimaryCategory><CategoryID>${categoryId}</CategoryID></PrimaryCategory>
  ${pictureXml}
  <StartPrice>${startPrice}</StartPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>Days_7</ListingDuration>
  <ListingType>Chinese</ListingType>
  <Quantity>1</Quantity>
  <DispatchTimeMax>5</DispatchTimeMax>
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSPriority</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
    <ShippingServiceOptions>
      <ShippingServicePriority>2</ShippingServicePriority>
      <ShippingService>USPSMedia</ShippingService>
      <ShippingServiceCost>0</ShippingServiceCost>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics(p.product_type)}
  <ReturnPolicy>
    <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
    <RefundOption>MoneyBack</RefundOption>
    <ReturnsWithinOption>Days_30</ReturnsWithinOption>
    <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
  </ReturnPolicy>
</Item>`;

      const response = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(response, "ItemID");
      const errors = extractXml(response, "ShortMessage");

      if (itemId) {
        const auctionEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await supabase.from("pod_product_queue").update({
          ebay_item_id:      itemId,
          ebay_listing_type: "auction",
          ebay_listed_at:    new Date().toISOString(),
          ebay_auction_ends: auctionEnds.toISOString(),
        }).eq("id", p.id);

        await supabase.from("ebay_listings").upsert({
          title:        p.name,
          ebay_item_id: itemId,
          price_usd:    0.99,
          status:       "active",
        }, { onConflict: "ebay_item_id", ignoreDuplicates: true }).then(() => {});

        results.push({ id: p.id, name: p.name, itemId, startPrice: `$${startPrice}`, status: "listed" });
      } else {
        results.push({ id: p.id, name: p.name, status: "failed", error: errors });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      results.push({ id: p.id, name: p.name, status: "error", error: String(err) });
    }
  }

  return { created: results.filter(r => r.status === "listed").length, results };
}

// ── Fixed-price physical listings ────────────────────────────────────────────

async function createPhysicalFixed(limit = 20): Promise<object> {
  const token = await getToken();

  const { data: products } = await supabase
    .from("pod_product_queue")
    .select("id, name, product_type, retail_price, printify_id")
    .eq("status", "published")
    .not("product_type", "in", '("download","digital")')  // digital has no Printify images
    .is("ebay_item_id", null)
    .not("retail_price", "is", null)
    .not("printify_id", "is", null)                       // must have Printify ID for images
    .limit(limit);

  if (!products?.length) return { created: 0, message: "No unlisted physical products" };

  const results = [];
  for (const p of products) {
    try {
      const categoryId = CATEGORIES[p.product_type] ?? CATEGORIES.default;
      const price = ((p.retail_price ?? 1999) / 100).toFixed(2);
      const description = buildDescription(p.name, p.product_type, "physical");

      // Fetch Printify CDN image (publicly accessible by eBay — never use Etsy CDN)
      const imageUrl = await getPrintifyImage(p.printify_id ?? "");
      const pictureXml = imageUrl
        ? `<PictureDetails><PictureURL>${xmlEscape(imageUrl)}</PictureURL></PictureDetails>`
        : "";

      const xml = `
<Item>
  <Title>${xmlEscape(p.name.slice(0, 80))}</Title>
  <Description><![CDATA[${description}]]></Description>
  <PrimaryCategory><CategoryID>${categoryId}</CategoryID></PrimaryCategory>
  ${pictureXml}
  <StartPrice>${price}</StartPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>GTC</ListingDuration>
  <ListingType>FixedPriceItem</ListingType>
  <Quantity>10</Quantity>
  <DispatchTimeMax>5</DispatchTimeMax>
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSPriority</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics(p.product_type)}
  <ReturnPolicy>
    <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
    <RefundOption>MoneyBack</RefundOption>
    <ReturnsWithinOption>Days_30</ReturnsWithinOption>
    <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
  </ReturnPolicy>
</Item>`;

      const response = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(response, "ItemID");
      const errors = extractXml(response, "ShortMessage");

      if (itemId) {
        await supabase.from("pod_product_queue").update({
          ebay_item_id:      itemId,
          ebay_listing_type: "fixed",
          ebay_listed_at:    new Date().toISOString(),
        }).eq("id", p.id);

        results.push({ id: p.id, name: p.name, itemId, price: `$${price}`, status: "listed" });
      } else {
        results.push({ id: p.id, name: p.name, status: "failed", error: errors });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      results.push({ id: p.id, name: p.name, status: "error", error: String(err) });
    }
  }

  return { created: results.filter(r => r.status === "listed").length, results };
}

// ── Digital listings (Etsy digital downloads) ────────────────────────────────

async function createDigitalListings(limit = 20): Promise<object> {
  const token = await getToken();

  const { data: listings } = await supabase
    .from("etsy_digital_listings")
    .select("id, title, niche, price_cents, file_path, original_price_cents, preview_image_url")
    .is("ebay_item_id", null)
    .not("etsy_listing_id", "is", null)
    .not("preview_image_url", "is", null)  // skip items with no prepped image
    .limit(limit);

  if (!listings?.length) return { created: 0, message: "No unlisted digital products" };

  const results = [];
  for (const l of listings) {
    try {
      const price = ((l.original_price_cents ?? l.price_cents ?? 399) / 100).toFixed(2);
      const description = buildDescription(l.title, "digital", "digital");
      // Use Supabase Storage URL (re-hosted from Etsy CDN via ebay-digital-image-prep)
      // Direct i.etsystatic.com URLs are blocked by eBay's image crawler
      const pictureXml = l.preview_image_url
        ? `<PictureDetails><PictureURL>${xmlEscape(l.preview_image_url)}</PictureURL></PictureDetails>`
        : "";

      const safeTitle = sanitizeEbayTitle(l.title, "digital");
      const xml = `
<Item>
  <Title>${xmlEscape(safeTitle)}</Title>
  <Description><![CDATA[${description}]]></Description>
  <PrimaryCategory><CategoryID>${CATEGORIES.digital_craft}</CategoryID></PrimaryCategory>
  ${pictureXml}
  <StartPrice>${price}</StartPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>GTC</ListingDuration>
  <ListingType>FixedPriceItem</ListingType>
  <Quantity>999</Quantity>
  <DispatchTimeMax>1</DispatchTimeMax>
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSFirstClass</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics("digital_craft")}
  <ReturnPolicy>
    <ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption>
  </ReturnPolicy>
</Item>`;

      const response = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(response, "ItemID");
      const shortMsg = extractXml(response, "ShortMessage");
      const longMsg  = extractXml(response, "LongMessage");
      const errors = longMsg || shortMsg;

      if (itemId) {
        await supabase.from("etsy_digital_listings").update({
          ebay_item_id:   itemId,
          ebay_listed_at: new Date().toISOString(),
        }).eq("id", l.id);

        results.push({ id: l.id, title: l.title, itemId, price: `$${price}`, status: "listed" });
      } else {
        results.push({ id: l.id, title: l.title, status: "failed", error: errors });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      results.push({ id: l.id, title: l.title, status: "error", error: String(err) });
    }
  }

  return { created: results.filter(r => r.status === "listed").length, results };
}

// ── KDP Book listings ─────────────────────────────────────────────────────────

async function createBookListings(limit = 20): Promise<object> {
  const token = await getToken();

  const { data: books } = await supabase
    .from("kdp_books")
    .select("id, title, description, niche, cover_url, page_count, book_type")
    .is("ebay_item_id", null)
    .not("cover_url", "is", null)
    .limit(limit);

  if (!books?.length) return { created: 0, message: "No unlisted KDP books" };

  const results = [];
  for (const b of books) {
    try {
      const price = b.book_type === "journal" ? "4.99" : "3.99";
      const description = buildDescription(b.title, b.book_type ?? "book", "book", b.description);
      const pictureXml = b.cover_url
        ? `<PictureDetails><PictureURL>${xmlEscape(b.cover_url)}</PictureURL></PictureDetails>`
        : "";

      const safeTitle = sanitizeEbayTitle(b.title, "book");
      const xml = `
<Item>
  <Title>${xmlEscape(safeTitle)}</Title>
  <Description><![CDATA[${description}]]></Description>
  <PrimaryCategory><CategoryID>${CATEGORIES.book}</CategoryID></PrimaryCategory>
  <StartPrice>${price}</StartPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>GTC</ListingDuration>
  <ListingType>FixedPriceItem</ListingType>
  <Quantity>999</Quantity>
  <DispatchTimeMax>1</DispatchTimeMax>
  ${pictureXml}
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSFirstClass</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics("book")}
  <ReturnPolicy>
    <ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption>
  </ReturnPolicy>
</Item>`;

      const response = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(response, "ItemID");
      const errors = extractXml(response, "ShortMessage");

      if (itemId) {
        await supabase.from("kdp_books").update({ ebay_item_id: itemId }).eq("id", b.id);
        results.push({ id: b.id, original_title: b.title, safe_title: safeTitle, itemId, price: `$${price}`, status: "listed" });
      } else {
        results.push({ id: b.id, original_title: b.title, safe_title: safeTitle, status: "failed", error: errors });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      results.push({ id: b.id, title: b.title, status: "error", error: String(err) });
    }
  }

  return { created: results.filter(r => r.status === "listed").length, results };
}

// ── Whop digital product listings ────────────────────────────────────────────

async function createWhopListings(limit = 20): Promise<object> {
  const token = await getToken();

  const { data: products } = await supabase
    .from("whop_products")
    .select("id, title, niche, price_cents, cover_image_url, product_type")
    .is("ebay_item_id", null)
    .not("cover_image_url", "is", null)
    .limit(limit);

  if (!products?.length) return { created: 0, message: "No unlisted Whop products" };

  const results = [];
  for (const p of products) {
    try {
      const price = ((p.price_cents ?? 499) / 100).toFixed(2);
      const description = buildDescription(p.title, "digital", "digital");
      const pictureXml = p.cover_image_url
        ? `<PictureDetails><PictureURL>${xmlEscape(p.cover_image_url)}</PictureURL></PictureDetails>`
        : "";

      const safeTitle = sanitizeEbayTitle(p.title, "whop");
      const xml = `
<Item>
  <Title>${xmlEscape(safeTitle)}</Title>
  <Description><![CDATA[${description}]]></Description>
  <PrimaryCategory><CategoryID>${CATEGORIES.digital_craft}</CategoryID></PrimaryCategory>
  ${pictureXml}
  <StartPrice>${price}</StartPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>GTC</ListingDuration>
  <ListingType>FixedPriceItem</ListingType>
  <Quantity>999</Quantity>
  <DispatchTimeMax>1</DispatchTimeMax>
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSFirstClass</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics("digital_craft")}
  <ReturnPolicy>
    <ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption>
  </ReturnPolicy>
</Item>`;

      const response = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(response, "ItemID");
      const shortMsg = extractXml(response, "ShortMessage");
      const longMsg  = extractXml(response, "LongMessage");
      const errors = longMsg || shortMsg;

      if (itemId) {
        await supabase.from("whop_products").update({
          ebay_item_id:   itemId,
          ebay_listed_at: new Date().toISOString(),
        }).eq("id", p.id);

        results.push({ id: p.id, original_title: p.title, safe_title: safeTitle, itemId, price: `$${price}`, status: "listed" });
      } else {
        results.push({ id: p.id, original_title: p.title, safe_title: safeTitle, status: "failed", error: errors });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      results.push({ id: p.id, title: p.title, status: "error", error: String(err) });
    }
  }

  return { created: results.filter(r => r.status === "listed").length, results };
}

// ── End a live eBay listing ───────────────────────────────────────────────────

async function endEbayItem(itemId: string, token: string): Promise<boolean> {
  try {
    const xml = `<ItemID>${itemId}</ItemID><EndingReason>NotAvailable</EndingReason>`;
    const resp = await tradingCall("EndItem", xml, token);
    return resp.includes("<Ack>Success</Ack>") || resp.includes("<Ack>Warning</Ack>");
  } catch {
    return false;
  }
}

// ── Digital auctions (Whop + Etsy digital + KDP books) ───────────────────────
// $0.99 start bid + BuyItNow at full retail. 7-day listing.
// Run `relist_digital` daily to clear expired auctions and re-queue them.

async function createDigitalAuctions(limit = 10): Promise<object> {
  const token = await getToken();
  const auctionEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const results: object[] = [];

  // ── Whop products ──────────────────────────────────────────────────────────
  const { data: whopProducts } = await supabase
    .from("whop_products")
    .select("id, title, price_cents, cover_image_url, product_type")
    .is("ebay_item_id", null)
    .not("cover_image_url", "is", null)
    .eq("status", "live")
    .limit(limit);

  for (const p of whopProducts ?? []) {
    try {
      const retail    = ((p.price_cents ?? 499) / 100).toFixed(2);
      const safeTitle = sanitizeEbayTitle(p.title, "whop");
      const desc      = buildDescription(p.title, "digital", "digital");
      const picXml    = `<PictureDetails><PictureURL>${xmlEscape(p.cover_image_url)}</PictureURL></PictureDetails>`;
      const xml = `
<Item>
  <Title>${xmlEscape(safeTitle)}</Title>
  <Description><![CDATA[${desc}]]></Description>
  <PrimaryCategory><CategoryID>${CATEGORIES.digital_craft}</CategoryID></PrimaryCategory>
  ${picXml}
  <StartPrice>0.99</StartPrice>
  <BuyItNowPrice>${retail}</BuyItNowPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>Days_7</ListingDuration>
  <ListingType>Chinese</ListingType>
  <Quantity>1</Quantity>
  <AutoPay>true</AutoPay>
  <DispatchTimeMax>1</DispatchTimeMax>
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSFirstClass</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics("digital_craft")}
  <ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>
</Item>`;
      const resp   = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(resp, "ItemID");
      const err    = extractXml(resp, "LongMessage") || extractXml(resp, "ShortMessage");
      if (itemId) {
        await supabase.from("whop_products").update({
          ebay_item_id: itemId, ebay_listed_at: new Date().toISOString(),
          ebay_listing_type: "auction", ebay_auction_ends: auctionEnds,
        }).eq("id", p.id);
        results.push({ source: "whop", id: p.id, title: safeTitle, itemId, startPrice: "$0.99", bin: `$${retail}`, status: "listed" });
      } else {
        results.push({ source: "whop", id: p.id, title: safeTitle, status: "failed", error: err });
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      results.push({ source: "whop", id: p.id, status: "error", error: String(e) });
    }
  }

  // ── Etsy digital downloads ─────────────────────────────────────────────────
  const { data: etsy } = await supabase
    .from("etsy_digital_listings")
    .select("id, title, price_cents, preview_image_url")
    .is("ebay_item_id", null)
    .not("preview_image_url", "is", null)
    .limit(limit);

  for (const l of etsy ?? []) {
    try {
      const retail    = ((l.price_cents ?? 499) / 100).toFixed(2);
      const safeTitle = sanitizeEbayTitle(l.title, "digital");
      const desc      = buildDescription(l.title, "digital", "digital");
      const picXml    = `<PictureDetails><PictureURL>${xmlEscape(l.preview_image_url)}</PictureURL></PictureDetails>`;
      const xml = `
<Item>
  <Title>${xmlEscape(safeTitle)}</Title>
  <Description><![CDATA[${desc}]]></Description>
  <PrimaryCategory><CategoryID>${CATEGORIES.digital_craft}</CategoryID></PrimaryCategory>
  ${picXml}
  <StartPrice>0.99</StartPrice>
  <BuyItNowPrice>${retail}</BuyItNowPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>Days_7</ListingDuration>
  <ListingType>Chinese</ListingType>
  <Quantity>1</Quantity>
  <AutoPay>true</AutoPay>
  <DispatchTimeMax>1</DispatchTimeMax>
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSFirstClass</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics("digital_craft")}
  <ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>
</Item>`;
      const resp   = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(resp, "ItemID");
      const err    = extractXml(resp, "LongMessage") || extractXml(resp, "ShortMessage");
      if (itemId) {
        await supabase.from("etsy_digital_listings").update({
          ebay_item_id: itemId, ebay_listed_at: new Date().toISOString(),
          ebay_listing_type: "auction", ebay_auction_ends: auctionEnds,
        }).eq("id", l.id);
        results.push({ source: "etsy_digital", id: l.id, title: safeTitle, itemId, startPrice: "$0.99", bin: `$${retail}`, status: "listed" });
      } else {
        results.push({ source: "etsy_digital", id: l.id, title: safeTitle, status: "failed", error: err });
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      results.push({ source: "etsy_digital", id: l.id, status: "error", error: String(e) });
    }
  }

  // ── KDP books ──────────────────────────────────────────────────────────────
  const { data: kdp } = await supabase
    .from("kdp_books")
    .select("id, title, description, book_type, cover_url")
    .is("ebay_item_id", null)
    .not("cover_url", "is", null)
    .limit(limit);

  for (const b of kdp ?? []) {
    try {
      const retail    = b.book_type === "journal" ? "4.99" : "3.99";
      const safeTitle = sanitizeEbayTitle(b.title, "book");
      const desc      = buildDescription(b.title, b.book_type ?? "book", "book", b.description);
      const picXml    = `<PictureDetails><PictureURL>${xmlEscape(b.cover_url)}</PictureURL></PictureDetails>`;
      const xml = `
<Item>
  <Title>${xmlEscape(safeTitle)}</Title>
  <Description><![CDATA[${desc}]]></Description>
  <PrimaryCategory><CategoryID>${CATEGORIES.book}</CategoryID></PrimaryCategory>
  ${picXml}
  <StartPrice>0.99</StartPrice>
  <BuyItNowPrice>${retail}</BuyItNowPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>Days_7</ListingDuration>
  <ListingType>Chinese</ListingType>
  <Quantity>1</Quantity>
  <AutoPay>true</AutoPay>
  <DispatchTimeMax>1</DispatchTimeMax>
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSFirstClass</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics("book")}
  <ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>
</Item>`;
      const resp   = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(resp, "ItemID");
      const err    = extractXml(resp, "LongMessage") || extractXml(resp, "ShortMessage");
      if (itemId) {
        await supabase.from("kdp_books").update({
          ebay_item_id: itemId, ebay_listed_at: new Date().toISOString(),
          ebay_listing_type: "auction", ebay_auction_ends: auctionEnds,
        }).eq("id", b.id);
        results.push({ source: "kdp_books", id: b.id, title: safeTitle, itemId, startPrice: "$0.99", bin: `$${retail}`, status: "listed" });
      } else {
        results.push({ source: "kdp_books", id: b.id, title: safeTitle, status: "failed", error: err });
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      results.push({ source: "kdp_books", id: b.id, status: "error", error: String(e) });
    }
  }

  const created = (results as any[]).filter(r => r.status === "listed").length;
  return { created, total_attempted: results.length, results };
}

// ── Relist expired digital auctions ──────────────────────────────────────────
// Clears ebay_item_id for any auction that ended >7d ago, then immediately
// re-queues them as fresh auctions.

async function relistExpiredDigitalAuctions(): Promise<object> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const cleared: object[] = [];

  for (const tbl of ["whop_products", "etsy_digital_listings", "kdp_books"] as const) {
    const { data } = await supabase
      .from(tbl)
      .select("id, ebay_item_id")
      .eq("ebay_listing_type", "auction")
      .not("ebay_item_id", "is", null)
      .lt("ebay_auction_ends", cutoff);

    if (data?.length) {
      const ids = data.map(r => r.id);
      await supabase.from(tbl).update({
        ebay_item_id: null, ebay_listed_at: null,
        ebay_listing_type: null, ebay_auction_ends: null,
      }).in("id", ids);
      cleared.push({ table: tbl, cleared: ids.length });
    }
  }

  const totalCleared = (cleared as any[]).reduce((s, r) => s + r.cleared, 0);
  if (totalCleared === 0) return { message: "No expired auctions to clear", cleared: 0 };

  const relisted = await createDigitalAuctions(totalCleared + 5);
  return { expired_cleared: totalCleared, cleared, relisted };
}

// ── Convert fixed-price digital listings to auctions ─────────────────────────
// Ends existing fixed-price digital listings via EndItem, then relists as auctions.

async function convertDigitalToAuctions(): Promise<object> {
  const token = await getToken();
  const ended: string[] = [];
  const failed: string[] = [];

  for (const tbl of ["whop_products", "etsy_digital_listings", "kdp_books"] as const) {
    const { data } = await supabase
      .from(tbl)
      .select("id, ebay_item_id")
      .eq("ebay_listing_type", "fixed")
      .not("ebay_item_id", "is", null);

    for (const row of data ?? []) {
      const ok = await endEbayItem(row.ebay_item_id, token);
      if (ok) {
        await supabase.from(tbl).update({
          ebay_item_id: null, ebay_listed_at: null,
          ebay_listing_type: null, ebay_auction_ends: null,
        }).eq("id", row.id);
        ended.push(row.ebay_item_id);
      } else {
        failed.push(row.ebay_item_id);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const relisted = ended.length ? await createDigitalAuctions(ended.length + 5) : { created: 0 };
  return { ended: ended.length, failed: failed.length, failed_item_ids: failed, relisted };
}

// ── Description builder ───────────────────────────────────────────────────────

function buildDescription(name: string, type: string, category: string, extra?: string): string {
  if (category === "digital") {
    return `<h2>${name}</h2>
<p><strong>✅ INSTANT DIGITAL DOWNLOAD</strong></p>
<p>You will receive your digital files within 1 hour of payment via eBay message.</p>
<p>Files included: high-resolution PNG/PDF ready to print or use immediately.</p>
<p>${extra ?? "Perfect for personal use, gifts, and more."}</p>
<p><strong>📦 What you get:</strong> Instant download link sent via eBay message after payment.</p>
<p><em>No physical item will be shipped. This is a digital product.</em></p>`;
  }

  if (category === "book") {
    return `<h2>${name}</h2>
<p><strong>✅ INSTANT DIGITAL PDF DOWNLOAD</strong></p>
<p>${extra ?? `A beautifully designed ${type} ready to print or use digitally.`}</p>
<p><strong>📚 Details:</strong></p>
<ul>
  <li>Format: Printable PDF</li>
  <li>Delivery: Via eBay message within 1 hour of payment</li>
  <li>Print at home or at a local print shop</li>
</ul>
<p><em>No physical book will be shipped.</em></p>`;
  }

  return `<h2>${name}</h2>
<p>🎁 <strong>Unique, custom-printed ${type} — made to order just for you!</strong></p>
<p>High-quality print-on-demand product. Printed and shipped within 3–5 business days.</p>
<p><strong>✅ Free shipping on all US orders</strong></p>
<p><strong>↩️ 30-day returns accepted</strong></p>
<p>Makes a perfect gift! Each item is individually printed to order.</p>`;
}

// ── Status check ──────────────────────────────────────────────────────────────

async function getStatus(): Promise<object> {
  const [physical, digital, books, whop] = await Promise.all([
    supabase.from("pod_product_queue")
      .select("ebay_item_id, ebay_listing_type", { count: "exact" })
      .eq("status", "published")
      .neq("product_type", "download"),
    supabase.from("etsy_digital_listings")
      .select("ebay_item_id, preview_image_url", { count: "exact" })
      .not("etsy_listing_id", "is", null),
    supabase.from("kdp_books")
      .select("ebay_item_id", { count: "exact" }),
    supabase.from("whop_products")
      .select("ebay_item_id", { count: "exact" }),
  ]);

  const physTotal = physical.count ?? 0;
  const physListed = physical.data?.filter(r => r.ebay_item_id).length ?? 0;
  const physAuction = physical.data?.filter(r => r.ebay_listing_type === "auction").length ?? 0;

  const digTotal = digital.count ?? 0;
  const digListed = digital.data?.filter(r => r.ebay_item_id).length ?? 0;
  const digWithImage = digital.data?.filter(r => r.preview_image_url).length ?? 0;

  const bookTotal = books.count ?? 0;
  const bookListed = books.data?.filter(r => r.ebay_item_id).length ?? 0;

  const whopTotal = whop.count ?? 0;
  const whopListed = whop.data?.filter(r => r.ebay_item_id).length ?? 0;

  return {
    physical: { total: physTotal, listed: physListed, auctions: physAuction, unlisted: physTotal - physListed },
    digital:  { total: digTotal,  listed: digListed,  with_image: digWithImage, unlisted: digTotal - digListed },
    books:    { total: bookTotal, listed: bookListed, unlisted: bookTotal - bookListed },
    whop:     { total: whopTotal, listed: whopListed, unlisted: whopTotal - whopListed },
    total_potential: physTotal + digTotal + bookTotal + whopTotal,
    total_listed: physListed + digListed + bookListed + whopListed,
  };
}

// ── VeRO reset: clear ebay_item_id so removed listings can be relisted ────────
// Call mode:"reset_vero" after eBay removes listings via VeRO.
// Clears digital/whop/books only — physical products are not affected by VeRO.
// Optionally pass target:"digital"|"whop"|"books"|"all" (default: all).

async function resetVeroRemovals(target = "all"): Promise<object> {
  const results: Record<string, unknown> = {};

  if (target === "all" || target === "digital") {
    const r = await supabase
      .from("etsy_digital_listings")
      .update({ ebay_item_id: null })
      .not("ebay_item_id", "is", null);
    results.digital = { cleared: r.error ? 0 : "done", error: r.error?.message };
  }

  if (target === "all" || target === "whop") {
    const r = await supabase
      .from("whop_products")
      .update({ ebay_item_id: null, ebay_listed_at: null })
      .not("ebay_item_id", "is", null);
    results.whop = { cleared: r.error ? 0 : "done", error: r.error?.message };
  }

  if (target === "all" || target === "books") {
    const r = await supabase
      .from("kdp_books")
      .update({ ebay_item_id: null, ebay_listed_at: null })
      .not("ebay_item_id", "is", null);
    results.books = { cleared: r.error ? 0 : "done", error: r.error?.message };
  }

  if (target === "all" || target === "pod_digital") {
    const r = await supabase
      .from("pod_digital_products")
      .update({ ebay_item_id: null, ebay_listed_at: null })
      .not("ebay_item_id", "is", null);
    results.pod_digital = { cleared: r.error ? 0 : "done", error: r.error?.message };
  }

  return {
    message: `VeRO reset complete (target: ${target}) — cleared eBay IDs for relisting with sanitized titles`,
    ...results,
  };
}

// ── Printify cost fetcher ─────────────────────────────────────────────────────
// Fetches actual production cost for a Printify product (cheapest variant).
// Returns cents. Returns null on failure.

async function getPrintifyCost(printifyId: string): Promise<number | null> {
  if (!printifyId || !PRINTIFY_KEY) return null;
  try {
    const res = await fetch(
      `${PRINTIFY_API_BASE}/shops/${PRINTIFY_SHOP_ID}/products/${printifyId}.json`,
      { headers: { Authorization: `Bearer ${PRINTIFY_KEY}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const variants: Array<{ cost: number; is_enabled: boolean }> = data.variants ?? [];
    const enabled = variants.filter(v => v.is_enabled);
    if (!enabled.length) return null;
    return Math.min(...enabled.map(v => v.cost));
  } catch {
    return null;
  }
}

// ── Printify shipping cost lookup (US first item, by provider) ────────────────
// These are approximate US domestic shipping costs from Printify providers.
// Used to calculate total landed cost (production + shipping) for margin math.
const SHIPPING_COST_CENTS: Record<string, number> = {
  mug:          499,   // ~$4.99 first class
  tshirt:       499,
  hoodie:       499,
  sweatshirt:   499,
  longsleeve:   499,
  sock:         499,
  hat:          499,
  truckercap:   499,
  onesie:       499,
  tumbler:      599,
  tumbler40:    699,
  travelmug:    599,
  pintglass:    599,
  shotglass:    499,
  wineglass:    599,
  coaster:      499,
  candle:       599,
  poster_v:     399,
  poster_h:     399,
  sticker:      299,
  blanket:      799,
  pillow:       599,
  mousepad:     499,
  laptopsleeve: 499,
  puzzle:       599,
  phonecase_slim:  399,
  phonecase_tough: 399,
  petbandana:   399,
  ornament:     499,
  journal:      499,
  greetingcard: 299,
  default:      499,
};

// ── Cost audit: fetch real Printify costs + calculate eBay floor prices ───────
// eBay fee structure: 12.9% FVF + $0.30 per transaction (free shipping listings)
// Floor price formula: (printify_cost + shipping + 0.30) / (1 - 0.129 - 0.10)
//   where 0.10 = minimum 10% profit margin on sale price

async function costAudit(): Promise<object> {
  const { data: products } = await supabase
    .from("pod_product_queue")
    .select("id, name, product_type, retail_price, printify_id")
    .eq("status", "published")
    .not("product_type", "in", '("download","digital")')
    .not("printify_id", "is", null)
    .order("product_type");

  if (!products?.length) return { error: "No published products with printify_id" };

  const results = [];
  for (const p of products) {
    const prodCost = await getPrintifyCost(p.printify_id);
    const shipping = SHIPPING_COST_CENTS[p.product_type] ?? SHIPPING_COST_CENTS.default;
    const totalCost = prodCost !== null ? prodCost + shipping : null;

    // Floor price: minimum start price to guarantee ≥10% profit even at start bid
    // profit = sale - totalCost - (0.129*sale + 0.30)  ≥  0.10 * sale
    // sale * (1 - 0.129 - 0.10) ≥ totalCost + 0.30
    // sale ≥ (totalCost + 0.30) / 0.771
    const floorCents = totalCost !== null
      ? Math.ceil((totalCost + 30) / 0.771)
      : null;

    const retailCents = p.retail_price ?? 0;
    const profitAtRetail = totalCost !== null
      ? retailCents - totalCost - Math.round(retailCents * 0.129) - 30
      : null;
    const marginAtRetail = profitAtRetail !== null && retailCents > 0
      ? ((profitAtRetail / retailCents) * 100).toFixed(1) + "%"
      : "unknown";

    results.push({
      id: p.id,
      name: p.name.slice(0, 50),
      product_type: p.product_type,
      retail: "$" + (retailCents / 100).toFixed(2),
      printify_prod_cost: prodCost !== null ? "$" + (prodCost / 100).toFixed(2) : "fetch_failed",
      shipping_est: "$" + (shipping / 100).toFixed(2),
      total_cost: totalCost !== null ? "$" + (totalCost / 100).toFixed(2) : "unknown",
      floor_start_price: floorCents !== null ? "$" + (floorCents / 100).toFixed(2) : "unknown",
      margin_at_retail: marginAtRetail,
      ebay_listed: p.id !== null ? "check" : "no",
    });
    await new Promise(r => setTimeout(r, 300)); // Printify rate limit
  }

  return { count: results.length, results };
}

// ── Auction physical: $0.99-floor auctions for unlisted physical POD products ─
// Start price = MAX($0.99, floor_price) where floor_price guarantees 10% margin.
// BuyItNow = retail_price.

async function createPhysicalAuctions(limit = 20): Promise<object> {
  const token = await getToken();

  const { data: products } = await supabase
    .from("pod_product_queue")
    .select("id, name, product_type, retail_price, printify_id")
    .eq("status", "published")
    .not("product_type", "in", '("download","digital")')
    .is("ebay_item_id", null)
    .not("retail_price", "is", null)
    .not("printify_id", "is", null)
    .order("product_type")
    .limit(limit);

  if (!products?.length) return { created: 0, message: "No unlisted physical products" };

  const results = [];
  for (const p of products) {
    try {
      const categoryId = CATEGORIES[p.product_type] ?? CATEGORIES.default;
      const retailCents = p.retail_price ?? 1999;

      // Fetch real Printify cost
      const prodCost = await getPrintifyCost(p.printify_id ?? "");
      const shipping = SHIPPING_COST_CENTS[p.product_type] ?? SHIPPING_COST_CENTS.default;
      const totalCost = prodCost !== null ? prodCost + shipping : Math.round(retailCents * 0.55); // fallback: 55% of retail

      // Floor = (totalCost + $0.30) / 0.771  (10% margin after eBay 12.9% FVF + $0.30)
      const floorCents = Math.ceil((totalCost + 30) / 0.771);
      // Start price = floor, rounded up to nearest $0.50, minimum $0.99
      const startCents = Math.max(99, Math.ceil(floorCents / 50) * 50);
      const startPrice = (startCents / 100).toFixed(2);
      // BIN: if retail < floor (product priced below cost), set BIN 30% above start; otherwise use retail
      const binCents = retailCents >= startCents ? retailCents : Math.ceil(startCents * 1.30 / 50) * 50;
      const bin = (binCents / 100).toFixed(2);

      const description = buildDescription(p.name, p.product_type, "physical");
      const imageUrl = await getPrintifyImage(p.printify_id ?? "");
      const pictureXml = imageUrl
        ? `<PictureDetails><PictureURL>${xmlEscape(imageUrl)}</PictureURL></PictureDetails>`
        : "";

      const xml = `
<Item>
  <Title>${xmlEscape(p.name.slice(0, 80))}</Title>
  <Description><![CDATA[${description}]]></Description>
  <PrimaryCategory><CategoryID>${categoryId}</CategoryID></PrimaryCategory>
  ${pictureXml}
  <StartPrice>${startPrice}</StartPrice>
  <BuyItNowPrice>${bin}</BuyItNowPrice>
  <ConditionID>1000</ConditionID>
  <Country>US</Country>
  <Location>Detroit, MI</Location>
  <PostalCode>48201</PostalCode>
  <Currency>USD</Currency>
  <ListingDuration>Days_7</ListingDuration>
  <ListingType>Chinese</ListingType>
  <Quantity>1</Quantity>
  <AutoPay>true</AutoPay>
  <DispatchTimeMax>5</DispatchTimeMax>
  <ShippingDetails>
    <ShippingType>Flat</ShippingType>
    <ShippingServiceOptions>
      <ShippingServicePriority>1</ShippingServicePriority>
      <ShippingService>USPSPriority</ShippingService>
      <FreeShipping>true</FreeShipping>
    </ShippingServiceOptions>
  </ShippingDetails>
  ${buildItemSpecifics(p.product_type)}
  <ReturnPolicy>
    <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
    <RefundOption>MoneyBack</RefundOption>
    <ReturnsWithinOption>Days_30</ReturnsWithinOption>
    <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
  </ReturnPolicy>
</Item>`;

      const response = await tradingCall("AddItem", xml, token);
      const itemId = extractXml(response, "ItemID");
      const err = extractXml(response, "LongMessage") || extractXml(response, "ShortMessage");

      if (itemId) {
        const auctionEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from("pod_product_queue").update({
          ebay_item_id:      itemId,
          ebay_listing_type: "auction",
          ebay_listed_at:    new Date().toISOString(),
          ebay_auction_ends: auctionEnds,
        }).eq("id", p.id);

        results.push({
          id: p.id, name: p.name, itemId,
          startPrice: `$${startPrice}`, bin: `$${bin}`,
          printify_cost: prodCost !== null ? `$${(prodCost/100).toFixed(2)}` : "est",
          total_landed: `$${(totalCost/100).toFixed(2)}`,
          min_profit_if_bid_wins: `$${((startCents - totalCost - Math.round(startCents*0.129) - 30)/100).toFixed(2)}`,
          status: "listed",
        });
      } else {
        results.push({ id: p.id, name: p.name, status: "failed", error: err });
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      results.push({ id: p.id, name: p.name, status: "error", error: String(e) });
    }
  }

  return { created: results.filter(r => r.status === "listed").length, results };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const mode: string   = body.mode   ?? "status";
  const limit: number  = body.limit  ?? 10;
  const target: string = body.target ?? "all";

  try {
    let result: object;

    if (mode === "auctions")               result = await createAuctions(limit);
    else if (mode === "auction_physical")  result = await createPhysicalAuctions(limit);
    else if (mode === "cost_audit")        result = await costAudit();
    else if (mode === "physical")          result = await createPhysicalFixed(limit);
    else if (mode === "digital")           result = await createDigitalListings(limit);
    else if (mode === "books")             result = await createBookListings(limit);
    else if (mode === "whop")              result = await createWhopListings(limit);
    else if (mode === "auction_digital")   result = await createDigitalAuctions(limit);
    else if (mode === "relist_digital")    result = await relistExpiredDigitalAuctions();
    else if (mode === "convert_to_auction") result = await convertDigitalToAuctions();
    else if (mode === "reset_vero")        result = await resetVeroRemovals(target);
    else if (mode === "refresh_token") {
      const { data } = await supabase.from("ebay_oauth_tokens").select("refresh_token").eq("account_id","gngstore").single();
      const token = await refreshToken(data!.refresh_token);
      result = { status: "refreshed", preview: token.slice(0, 20) + "..." };
    } else if (mode === "all") {
      // Run sequentially to avoid eBay rate limits
      // NOTE: books mode intentionally excluded — KDP word search titles trigger eBay IP flags
      const p = await createPhysicalFixed(limit);
      const d = await createDigitalListings(limit);
      const w = await createWhopListings(limit);
      result = { physical: p, digital: d, whop: w, books_skipped: "KDP books re-enabled via mode:books with sanitized titles" };
    }
    else result = await getStatus();

    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
