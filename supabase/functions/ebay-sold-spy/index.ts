/**
 * ebay-sold-spy
 * Scans eBay completed/sold listings to find what's actually selling in our niches.
 * Uses eBay Finding API (no user auth needed — app token only).
 *
 * POST {"niches":["nurse mug","dog mom shirt","funny hoodie"]}
 * POST {"mode":"auto"}  — auto-scans all niches from pod_niche_library
 * POST {"mode":"report"} — show top sellers from last scan
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID = Deno.env.get("EBAY_APP_ID")!;
const FINDING_API = "https://svcs.ebay.com/services/search/FindingService/v1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface EbaySoldItem {
  title: string;
  itemId: string;
  soldPrice: number;
  shippingCost: number;
  totalPrice: number;
  endDate: string;
  imageUrl: string;
  viewItemURL: string;
  categoryName: string;
  listingType: string;
}

async function searchCompleted(keyword: string, limit = 20): Promise<EbaySoldItem[]> {
  const params = new URLSearchParams({
    "OPERATION-NAME":          "findCompletedItems",
    "SERVICE-VERSION":         "1.0.0",
    "SECURITY-APPNAME":        APP_ID,
    "RESPONSE-DATA-FORMAT":    "JSON",
    "outputSelector(0)":       "GalleryInfo",
    "outputSelector(1)":       "PictureURLLarge",
    "keywords":                keyword,
    "itemFilter(0).name":      "SoldItemsOnly",
    "itemFilter(0).value":     "true",
    "itemFilter(1).name":      "ListingType",
    "itemFilter(1).value(0)":  "FixedPrice",
    "itemFilter(1).value(1)":  "AuctionWithBIN",
    "itemFilter(1).value(2)":  "Auction",
    "itemFilter(2).name":      "Country",
    "itemFilter(2).value":     "US",
    "sortOrder":               "EndTimeSoonest",
    "paginationInput.entriesPerPage": String(limit),
  });

  const res = await fetch(`${FINDING_API}?${params}`);
  if (!res.ok) throw new Error(`eBay API HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
  const data = await res.json();

  // Surface eBay API errors (auth failures, deprecated API, etc.)
  const ack = data?.findCompletedItemsResponse?.[0]?.ack?.[0];
  if (ack === "Failure" || data?.errorMessage) {
    const errMsg = data?.findCompletedItemsResponse?.[0]?.errorMessage?.[0]?.error?.[0]?.message?.[0]
      ?? data?.errorMessage?.[0]?.error?.[0]?.message?.[0]
      ?? JSON.stringify(data).slice(0, 300);
    throw new Error(`eBay API error: ${errMsg}`);
  }

  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];

  return items.map((item: Record<string, unknown>) => {
    const price = parseFloat((item.sellingStatus as Record<string, unknown[]>)?.[0]?.currentPrice?.[0]?.__value__ as string ?? "0");
    const shipping = parseFloat((item.shippingInfo as Record<string, unknown[]>)?.[0]?.shippingServiceCost?.[0]?.__value__ as string ?? "0");
    const imgArr = (item.pictureURLLarge as string[]) ?? (item.galleryURL as string[]) ?? [""];
    return {
      title:        String((item.title as string[])?.[0] ?? ""),
      itemId:       String((item.itemId as string[])?.[0] ?? ""),
      soldPrice:    price,
      shippingCost: shipping,
      totalPrice:   price + shipping,
      endDate:      String((item.listingInfo as Record<string, string[]>)?.[0]?.endTime?.[0] ?? ""),
      imageUrl:     imgArr[0] ?? "",
      viewItemURL:  String((item.viewItemURL as string[])?.[0] ?? ""),
      categoryName: String((item.primaryCategory as Record<string, string[]>)?.[0]?.categoryName?.[0] ?? ""),
      listingType:  String((item.listingInfo as Record<string, string[]>)?.[0]?.listingType?.[0] ?? ""),
    };
  });
}

async function runSpy(niches: string[]): Promise<object> {
  const allResults: object[] = [];

  for (const niche of niches) {
    try {
      const items = await searchCompleted(niche, 25);
      if (!items.length) continue;

      // Stats
      const prices = items.map(i => i.totalPrice).filter(p => p > 0);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);

      // Top 3 by price
      const topSellers = items
        .sort((a, b) => b.soldPrice - a.soldPrice)
        .slice(0, 3)
        .map(i => ({ title: i.title, price: `$${i.soldPrice.toFixed(2)}`, url: i.viewItemURL }));

      // Store in pod_niche_library if it exists
      await supabase.from("pod_niche_library").upsert({
        niche,
        ebay_avg_sold_price: avgPrice.toFixed(2),
        ebay_max_sold_price: maxPrice.toFixed(2),
        ebay_sold_count:     items.length,
        ebay_scanned_at:     new Date().toISOString(),
      }, { onConflict: "niche" }).then(() => {});

      // Queue top-performing niches as new products if they're selling well
      if (avgPrice >= 15 && items.length >= 5) {
        // Find most common product type from titles
        const productType = inferProductType(items.map(i => i.title).join(" "));
        if (productType) {
          const existing = await supabase
            .from("pod_product_queue")
            .select("id")
            .ilike("name", `%${niche}%`)
            .limit(1);

          if (!existing.data?.length) {
            await supabase.from("pod_product_queue").insert({
              name:         `${niche} - ${productType}`,
              product_type: productType,
              status:       "pending",
              niche,
              source:       "ebay_spy",
            });
          }
        }
      }

      allResults.push({
        niche,
        soldCount: items.length,
        avgPrice:  `$${avgPrice.toFixed(2)}`,
        priceRange: `$${minPrice.toFixed(2)}–$${maxPrice.toFixed(2)}`,
        topSellers,
        queued: avgPrice >= 15 && items.length >= 5,
      });

      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      allResults.push({ niche, error: String(err) });
    }
  }

  return { scanned: niches.length, results: allResults };
}

function inferProductType(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("mug") || lower.includes("cup")) return "mug";
  if (lower.includes("hoodie") || lower.includes("sweatshirt")) return "hoodie";
  if (lower.includes("t-shirt") || lower.includes("tshirt") || lower.includes("tee")) return "tshirt";
  if (lower.includes("tumbler")) return "tumbler";
  if (lower.includes("sock")) return "sock";
  if (lower.includes("hat") || lower.includes("cap")) return "hat";
  if (lower.includes("poster") || lower.includes("print")) return "poster_v";
  if (lower.includes("pillow")) return "pillow";
  if (lower.includes("blanket")) return "blanket";
  return null;
}

async function getAutoNiches(): Promise<string[]> {
  // Pull from niche library
  const { data } = await supabase
    .from("pod_niche_library")
    .select("niche")
    .limit(30);

  if (data?.length) return data.map(r => r.niche);

  // Fallback to known high-performing niches
  return [
    "funny nurse mug", "dog mom t-shirt", "teacher appreciation gift",
    "funny dad hoodie", "gym workout shirt", "cat mom mug",
    "retirement gift mug", "custom name tumbler", "funny sarcastic t-shirt",
    "motivational poster print", "nurse gift graduation", "dog lover gift",
    "baby shower gift onesie", "birthday gift mom mug", "funny coworker gift",
  ];
}

async function getReport(): Promise<object> {
  const { data } = await supabase
    .from("pod_niche_library")
    .select("niche, ebay_avg_sold_price, ebay_max_sold_price, ebay_sold_count, ebay_scanned_at")
    .not("ebay_avg_sold_price", "is", null)
    .order("ebay_avg_sold_price", { ascending: false })
    .limit(30);

  return { report: data ?? [], total: data?.length ?? 0 };
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? "scan";

  try {
    let result: object;

    if (mode === "report") {
      result = await getReport();
    } else if (mode === "auto") {
      const niches = await getAutoNiches();
      result = await runSpy(niches.slice(0, body.limit ?? 10));
    } else if (mode === "debug") {
      // Return raw eBay API response to diagnose empty results / sandbox vs production key
      const keyword = body.keyword ?? "funny nurse mug";
      const params = new URLSearchParams({
        "OPERATION-NAME":          "findCompletedItems",
        "SERVICE-VERSION":         "1.0.0",
        "SECURITY-APPNAME":        APP_ID,
        "RESPONSE-DATA-FORMAT":    "JSON",
        "keywords":                keyword,
        "itemFilter(0).name":      "SoldItemsOnly",
        "itemFilter(0).value":     "true",
        "itemFilter(1).name":      "Country",
        "itemFilter(1).value":     "US",
        "paginationInput.entriesPerPage": "3",
      });
      const res = await fetch(`${FINDING_API}?${params}`);
      const rawText = await res.text();
      result = {
        app_id_prefix: APP_ID ? APP_ID.slice(0, 8) + "..." : "NOT SET",
        http_status: res.status,
        http_ok: res.ok,
        is_sandbox: APP_ID?.toLowerCase().includes("sandbox") ?? false,
        raw_response: rawText.slice(0, 3000),
      };
    } else {
      const niches: string[] = body.niches ?? await getAutoNiches().then(n => n.slice(0, 5));
      result = await runSpy(niches);
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
