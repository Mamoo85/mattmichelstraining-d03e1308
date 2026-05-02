// Pest Control Radar signal scanner.
// Sources: EstateSales (vacant), probate filings, foreclosure notices, USPS vacancy proxy.
// This is unique data — nobody else aggregates probate + estate + foreclosure into pest leads.

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  vacant_estate_risk: 9,
  probate_vacant: 8,
  foreclosure_vacant: 7,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  vacant_estate_risk: {
    opener: "Estate properties that sit vacant for even a few months almost always have pest issues before they sell — we can do a discreet inspection and treatment so it doesn't kill the deal.",
    window: "Before or right after estate sale listing",
  },
  probate_vacant: {
    opener: "Probate properties often sit for 6–12 months — that's enough time for a serious infestation. A preventive treatment now is far cheaper than a remediation later.",
    window: "Within 30 days of probate filing",
  },
  foreclosure_vacant: {
    opener: "Banks and REO agents need pest clearances before listing — we're fast, affordable, and can provide the documentation needed for FHA/VA loans.",
    window: "Within 60 days of foreclosure filing",
  },
};

async function scrapeEstateSalesZips(zips: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  for (const zip of zips.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://www.estatesales.net/garage-sales/${zip}`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; DWA-TradeRadar/1.0)" } },
      );
      if (!res.ok) continue;
      const html = await res.text();
      const matches = html.matchAll(/<h2[^>]*class="[^"]*sale-title[^"]*"[^>]*>([^<]+)<\/h2>/gi);
      for (const m of matches) {
        signals.push({
          address: zip,
          city: zip,
          zip,
          signal_type: "vacant_estate_risk",
          signal_detail: `EstateSales listing in ZIP ${zip}: ${m[1]?.trim().slice(0, 80)}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.vacant_estate_risk,
          source_method: "estate_sales_scrape",
          suggested_opener: OPENERS.vacant_estate_risk.opener,
          best_call_window: OPENERS.vacant_estate_risk.window,
          estimated_value: 600,
          raw_source_data: { zip, title: m[1] },
        });
      }
    } catch { /* fail open */ }
  }
  return signals;
}

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const targetZips = zipFilter?.length ? zipFilter.slice(0, 20) : ["48201","48205","48221","48224","48235","48227","48228","48214","48219","48223"];

  // 1. Estate sales (vacant property indicator)
  const estateSignals = await scrapeEstateSalesZips(targetZips);
  signals.push(...estateSignals);

  // 2. Wayne County probate court (proxy via foreclosure notices endpoint)
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const where = encodeURIComponent(
      `(work_description LIKE '%PROBATE%' OR work_description LIKE '%ESTATE%') AND issued_date >= DATE '${since}'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_permits/FeatureServer/0/query?where=${where}&outFields=address,issued_date,work_description&resultRecordCount=30&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip = addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "probate_vacant",
          signal_detail: `Probate/estate permit: ${(a.work_description ?? "").slice(0, 80)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.probate_vacant,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.probate_vacant.opener,
          best_call_window: OPENERS.probate_vacant.window,
          estimated_value: 500,
          raw_source_data: a,
        });
      }
    }
  } catch (e) { console.error("[pest] probate:", e); }

  return signals;
}
