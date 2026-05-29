// etsy-listing-renewer — auto-renews Etsy listings expiring within 7 days.
// Etsy listings expire every 4 months ($0.20 renewal fee per listing).
// A lapsed listing loses its review history and search rank.
//
// Run: POST {} — renew all listings expiring within 7 days
// Run: POST {"dry_run": true} — returns listings that WOULD be renewed without acting
// Run: POST {"days_ahead": 14} — extend the renewal window
// Cron: daily 7am UTC on secondary project

const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";
const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[ETSY-RENEWER] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

async function etsyGet(path: string): Promise<Response> {
  return fetch(`https://openapi.etsy.com/v3/application${path}`, {
    headers: { "x-api-key": ETSY_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });
}

async function etsyPost(path: string): Promise<Response> {
  return fetch(`https://openapi.etsy.com/v3/application${path}`, {
    method: "POST",
    headers: { "x-api-key": ETSY_API_KEY, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
}

interface EtsyListing {
  listing_id: number;
  title: string;
  state: string;
  ending_tsz: number;
}

async function fetchAllActiveListings(): Promise<EtsyListing[]> {
  const all: EtsyListing[] = [];
  let offset = 0;

  while (true) {
    const res = await etsyGet(
      `/shops/${ETSY_SHOP_ID}/listings?state=active&limit=100&offset=${offset}`,
    );
    if (!res.ok) { log("Fetch failed", { status: res.status, offset }); break; }

    const data = await res.json() as { results: EtsyListing[] };
    const items = Array.isArray(data.results) ? data.results : [];
    all.push(...items);
    if (items.length < 100) break;
    offset += 100;
    await new Promise((r) => setTimeout(r, 400));
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!ETSY_API_KEY || !ETSY_SHOP_ID) {
    return Response.json({ error: "ETSY_API_KEY and ETSY_SHOP_ID required" }, { status: 500, headers: CORS });
  }

  const body = await req.json().catch(() => ({})) as { dry_run?: boolean; days_ahead?: number };
  const dryRun = body.dry_run === true;
  const daysAhead = typeof body.days_ahead === "number" ? body.days_ahead : 7;
  const cutoffTimestamp = Math.floor(Date.now() / 1000) + daysAhead * 24 * 60 * 60;

  try {
    log("Starting renewal check", { daysAhead, dryRun });
    const allListings = await fetchAllActiveListings();
    log("Fetched active listings", { count: allListings.length });

    // Filter to those expiring within daysAhead
    const expiringSoon = allListings.filter(
      (l) => typeof l.ending_tsz === "number" && l.ending_tsz > 0 && l.ending_tsz < cutoffTimestamp,
    );

    log("Found listings expiring soon", {
      count: expiringSoon.length,
      daysAhead,
      cutoff: new Date(cutoffTimestamp * 1000).toISOString(),
    });

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_active: allListings.length,
        expiring_soon: expiringSoon.length,
        days_ahead: daysAhead,
        listings: expiringSoon.map((l) => ({
          listing_id: l.listing_id,
          title: l.title.slice(0, 60),
          expires: new Date(l.ending_tsz * 1000).toISOString(),
        })),
      }, { headers: CORS });
    }

    let renewed = 0;
    let errors = 0;
    const renewedListings: Array<{ listing_id: number; title: string; status: string }> = [];

    for (const listing of expiringSoon) {
      try {
        // Etsy renew endpoint: POST /v3/application/listings/{listing_id}/renew
        const res = await etsyPost(`/listings/${listing.listing_id}/renew`);

        if (res.ok) {
          renewed++;
          renewedListings.push({
            listing_id: listing.listing_id,
            title: listing.title.slice(0, 60),
            status: "renewed",
          });
          log("Renewed listing", { listingId: listing.listing_id, title: listing.title.slice(0, 40) });
        } else {
          const errText = await res.text().catch(() => "");
          errors++;
          renewedListings.push({
            listing_id: listing.listing_id,
            title: listing.title.slice(0, 60),
            status: `error_${res.status}`,
          });
          log("Renew failed", { listingId: listing.listing_id, status: res.status, err: errText.slice(0, 100) });
        }

        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        errors++;
        log("Renew exception", { listingId: listing.listing_id, err: String(e).slice(0, 80) });
      }
    }

    log("Renewal run complete", { renewed, errors, total_expiring: expiringSoon.length });
    return Response.json({
      status: "ok",
      total_active: allListings.length,
      expiring_checked: expiringSoon.length,
      renewed,
      errors,
      listings: renewedListings,
    }, { headers: CORS });

  } catch (err) {
    log("Fatal", { err: String(err) });
    return Response.json({ error: String(err) }, { status: 500, headers: CORS });
  }
});
