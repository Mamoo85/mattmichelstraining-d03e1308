// Plumbing Radar signal scanner.
// Sources: Foreclosure notices (LegalNews), BSEED plumbing permits ≥$5k, EPA ECHO.

import { scrapeForeclosureNotices } from "../scrapers-county-records.ts";

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  plumbing_permit_major: 8,
  foreclosure_deferred: 7,
  lead_line_area: 6,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  plumbing_permit_major: {
    opener: "We saw a major plumbing permit recently pulled in your area — often that means neighboring homes have the same aging pipes. We're offering free inspections this week.",
    window: "Within 30 days of permit",
  },
  foreclosure_deferred: {
    opener: "Properties in foreclosure often have years of deferred maintenance — we specialize in getting plumbing up to code quickly so owners can sell or refinance.",
    window: "Within 60 days of filing",
  },
  lead_line_area: {
    opener: "The EPA recently flagged your ZIP for lead service lines — we can assess and replace yours, and the city may cover part of the cost.",
    window: "Any time while area is flagged",
  },
};

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. BSEED major plumbing permits
  try {
    const since = new Date(Date.now() - 14 * 86400_000).toISOString().split("T")[0];
    const where = encodeURIComponent(
      `(work_description LIKE '%PLUMB%' OR work_description LIKE '%SEWER%' OR work_description LIKE '%WATER MAIN%') AND amt_estimated_contractor_cost >= 5000 AND issued_date >= DATE '${since}'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_permits/FeatureServer/0/query?where=${where}&outFields=address,issued_date,work_description,amt_estimated_contractor_cost&resultRecordCount=50&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
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
          signal_type: "plumbing_permit_major",
          signal_detail: `BSEED plumbing permit: ${(a.work_description ?? "").slice(0, 100)} — Est. $${a.amt_estimated_contractor_cost ?? "?"}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.plumbing_permit_major,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.plumbing_permit_major.opener,
          best_call_window: OPENERS.plumbing_permit_major.window,
          estimated_value: Number(a.amt_estimated_contractor_cost ?? 3000),
          raw_source_data: a,
        });
      }
    }
  } catch (e) { console.error("[plumbing] BSEED:", e); }

  // 2. Foreclosure notices (deferred maintenance signal)
  try {
    const foreclosures = await scrapeForeclosureNotices({ perSourceCap: 8 });
    for (const f of foreclosures) {
      if (zipFilter?.length && f.zip && !zipFilter.includes(f.zip)) continue;
      signals.push({
        address: f.address,
        city: f.city ?? "Detroit",
        zip: f.zip ?? "",
        signal_type: "foreclosure_deferred",
        signal_detail: `Foreclosure notice (${f.signal_source}): ${f.signal_detail ?? f.address}`,
        signal_date: f.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.foreclosure_deferred,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.foreclosure_deferred.opener,
        best_call_window: OPENERS.foreclosure_deferred.window,
        estimated_value: 2500,
        raw_source_data: { address: f.address, source: f.signal_source },
      });
    }
  } catch (e) { console.error("[plumbing] foreclosure scrape:", e); }

  // 3. EPA ECHO — enforcement actions as lead-line proxy
  try {
    const res = await fetch(
      `https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?p_st=${state}&p_act=Y&output=JSON&p_limit=30`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const fac of (d?.Results?.Facilities ?? []).slice(0, 20)) {
        if (!fac.CWAstatuses?.includes("Significant")) continue;
        signals.push({
          address: fac.FacName ?? "Unknown facility",
          city: fac.City ?? state,
          zip: fac.Zip ?? "",
          signal_type: "lead_line_area",
          signal_detail: `EPA enforcement: ${fac.CWAstatuses} — ${fac.FacName}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.lead_line_area,
          source_method: "epa_echo",
          suggested_opener: OPENERS.lead_line_area.opener,
          best_call_window: OPENERS.lead_line_area.window,
          estimated_value: 4000,
          raw_source_data: fac,
        });
      }
    }
  } catch (e) { console.error("[plumbing] EPA ECHO:", e); }

  return signals;
}
