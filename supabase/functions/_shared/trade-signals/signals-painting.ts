// Painting Radar signal scanner.
// Sources: Zillow FSBO (canonical shared scraper), Wayne County deeds, foreclosure pre-sale.

import { scrapeZillowFSBO } from "../scrapers-public-listings.ts";
import { scrapeForeclosureNotices } from "../scrapers-county-records.ts";

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
  foreclosure_presale: 5,
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
  foreclosure_presale: {
    opener: "Bank-owned properties almost always need a full repaint before listing — we work with REO agents and can turn quotes around same day.",
    window: "Before REO listing goes active",
  },
};

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. Zillow FSBO (canonical shared scraper via Firecrawl — replaces inline ZIP loop)
  try {
    const fsboResults = await scrapeZillowFSBO({ perCityCap: 5 });
    for (const s of fsboResults) {
      if (zipFilter?.length && s.zip && !zipFilter.includes(s.zip)) continue;
      signals.push({
        address: s.address,
        city: s.city ?? "Detroit",
        zip: s.zip ?? "",
        signal_type: "fsbo_prep",
        signal_detail: `Zillow FSBO (${s.signal_source}): ${s.address}`,
        signal_date: s.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.fsbo_prep,
        source_method: "zillow_fsbo_scrape",
        suggested_opener: OPENERS.fsbo_prep.opener,
        best_call_window: OPENERS.fsbo_prep.window,
        estimated_value: 3500,
        raw_source_data: { address: s.address, source: s.signal_source },
      });
    }
  } catch (e) { console.error("[painting] FSBO:", e); }

  // 2. Foreclosure notices (pre-sale paint opportunity — bank wants turnkey listing)
  try {
    const foreclosures = await scrapeForeclosureNotices({ perSourceCap: 6 });
    for (const f of foreclosures) {
      if (zipFilter?.length && f.zip && !zipFilter.includes(f.zip)) continue;
      signals.push({
        address: f.address,
        city: f.city ?? "Detroit",
        zip: f.zip ?? "",
        signal_type: "foreclosure_presale",
        signal_detail: `Foreclosure notice (${f.signal_source}): ${f.signal_detail ?? f.address}`,
        signal_date: f.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.foreclosure_presale,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.foreclosure_presale.opener,
        best_call_window: OPENERS.foreclosure_presale.window,
        estimated_value: 2800,
        raw_source_data: { address: f.address, source: f.signal_source },
      });
    }
  } catch (e) { console.error("[painting] foreclosure:", e); }

  return signals;
}
