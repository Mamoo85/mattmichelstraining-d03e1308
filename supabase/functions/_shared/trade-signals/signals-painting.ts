// Painting Radar signal scanner.
// Sources: Wayne County deed transfers ≤60 days (new ownership), FSBO prep, EstateSales.

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  new_ownership_paint: 9,
  fsbo_prep: 7,
  estate_paint: 6,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  new_ownership_paint: {
    opener: "Congratulations on the new home — most buyers do a fresh coat in the first 60 days while the house is still empty. We can give you a quote within 24 hours and start this week.",
    window: "Within 60 days of deed transfer",
  },
  fsbo_prep: {
    opener: "Painting before listing adds $5–15k to your sale price according to Zillow data — we can do a full interior in 3 days and have you on the market by the weekend.",
    window: "While FSBO listing is active",
  },
  estate_paint: {
    opener: "Estate properties often need a full repaint before sale — we work quickly and discreetly and can coordinate around the estate sale schedule.",
    window: "While estate sale is listed",
  },
};

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. Wayne County recent deed transfers (new ownership)
  try {
    const since = new Date(Date.now() - 45 * 86400_000).toISOString().split("T")[0];
    const where = encodeURIComponent(`transfer_date >= DATE '${since}'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_permits/FeatureServer/0/query?where=${where}&outFields=address,issued_date,work_description&resultRecordCount=50&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const desc: string = (a.work_description ?? "").toUpperCase();
        if (!desc.includes("OWNERSHIP") && !desc.includes("DEED") && !desc.includes("TRANSFER")) continue;
        const addr: string = a.address ?? "";
        const zip = addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "new_ownership_paint",
          signal_detail: `Recent deed transfer: ${(a.work_description ?? "").slice(0, 80)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.new_ownership_paint,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.new_ownership_paint.opener,
          best_call_window: OPENERS.new_ownership_paint.window,
          estimated_value: 4000,
          raw_source_data: a,
        });
      }
    }
  } catch (e) { console.error("[painting] deeds:", e); }

  // 2. Zillow FSBO scrape (existing scraper reuse)
  try {
    const targetZips = zipFilter?.length ? zipFilter.slice(0, 5) : ["48009","48067","48301","48304","48306"];
    for (const zip of targetZips) {
      try {
        const res = await fetch(
          `https://www.zillow.com/homes/for_sale/${zip}_rb/?searchQueryState=%7B%22isListedByOwner%22:true%7D`,
          { headers: { "User-Agent": "Mozilla/5.0 (compatible; DWA-TradeRadar/1.0)" } },
        );
        if (!res.ok) continue;
        const html = await res.text();
        const addressMatches = html.matchAll(/"streetAddress":"([^"]+)"/g);
        for (const m of addressMatches) {
          signals.push({
            address: m[1],
            city: zip,
            zip,
            signal_type: "fsbo_prep",
            signal_detail: `Zillow FSBO listing: ${m[1]}`,
            signal_date: new Date().toISOString().split("T")[0],
            score: BASE_SCORES.fsbo_prep,
            source_method: "zillow_fsbo_scrape",
            suggested_opener: OPENERS.fsbo_prep.opener,
            best_call_window: OPENERS.fsbo_prep.window,
            estimated_value: 3500,
            raw_source_data: { zip, address: m[1] },
          });
        }
      } catch { /* fail open */ }
    }
  } catch (e) { console.error("[painting] FSBO:", e); }

  return signals;
}
