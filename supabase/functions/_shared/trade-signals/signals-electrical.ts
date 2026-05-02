// Electrical Radar signal scanner.
// Sources: BSEED permits, probate filings (old wiring), NWS storm alerts (surge/lightning).

import { scrapeProbateFilings } from "../scrapers-county-records.ts";

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  renovation_electrical: 8,
  addition_permit: 9,
  new_construction: 7,
  probate_old_wiring: 7,
  storm_panel_check: 6,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  renovation_electrical: {
    opener: "We noticed a renovation permit was recently pulled on your property — older homes often need panel upgrades as part of a remodel. Want a free estimate while work is already underway?",
    window: "Within 30 days of permit",
  },
  addition_permit: {
    opener: "Adding square footage almost always means a panel upgrade — we specialize in same-week installs so your project doesn't lose momentum.",
    window: "Within 14 days of permit",
  },
  new_construction: {
    opener: "New construction in your area means electrical rough-in is happening now — we're taking on subcontracting work and can turn bids around in 24 hours.",
    window: "While permit is active",
  },
  probate_old_wiring: {
    opener: "Older estate properties often have knob-and-tube or 60-amp service that needs upgrading before sale — we specialize in fast panel upgrades that clear inspections.",
    window: "Within 60 days of probate filing",
  },
  storm_panel_check: {
    opener: "Lightning and power surges from last week's storm can silently damage panels and surge protectors — we're doing free visual checks in your area this week.",
    window: "Within 10 days of storm event",
  },
};

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. BSEED Electrical Permits + renovation/addition from building permits
  try {
    // Trades: dedicated electrical permits
    const tradeWhere = encodeURIComponent(`permit_type = 'Electrical Permit'`);
    const tradeRes = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=${tradeWhere}&outFields=address,zip_code,issued_date,work_description,latitude,longitude&resultRecordCount=40&orderByFields=issued_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (tradeRes.ok) {
      const d = await tradeRes.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = a.zip_code ?? addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "renovation_electrical",
          signal_detail: `BSEED Electrical Permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.renovation_electrical,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.renovation_electrical.opener,
          best_call_window: OPENERS.renovation_electrical.window,
          estimated_value: 4000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
    // Building permits: additions and renovations → panel upgrade signal
    const bldgWhere = encodeURIComponent(`(work_description LIKE '%ADDITION%' OR work_description LIKE '%RENOVATION%' OR work_description LIKE '%REMODEL%')`);
    const bldgRes = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=${bldgWhere}&outFields=address,zip_code,issued_date,work_description,amt_estimated_contractor_cost,latitude,longitude&resultRecordCount=30&orderByFields=issued_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (bldgRes.ok) {
      const d = await bldgRes.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = a.zip_code ?? addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const desc = (a.work_description ?? "").toUpperCase();
        const signalType = desc.includes("ADDITION") ? "addition_permit" : "renovation_electrical";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: signalType,
          signal_detail: `BSEED building permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES[signalType],
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS[signalType].opener,
          best_call_window: OPENERS[signalType].window,
          estimated_value: Number(a.amt_estimated_contractor_cost) || 4000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[electrical] BSEED:", e); }

  // 2. Probate filings (estate homes = knob-and-tube / 60A service — old wiring signal)
  try {
    const probates = await scrapeProbateFilings({ perSourceCap: 6 });
    for (const p of probates) {
      if (zipFilter?.length && p.zip && !zipFilter.includes(p.zip)) continue;
      signals.push({
        address: p.address,
        city: p.city ?? "Detroit",
        zip: p.zip ?? "",
        signal_type: "probate_old_wiring",
        signal_detail: `Probate filing (${p.signal_source}): ${p.signal_detail ?? p.address}`,
        signal_date: p.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.probate_old_wiring,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.probate_old_wiring.opener,
        best_call_window: OPENERS.probate_old_wiring.window,
        estimated_value: 3500,
        raw_source_data: { address: p.address, source: p.signal_source },
      });
    }
  } catch (e) { console.error("[electrical] probate:", e); }

  // 3. NWS storm alerts (lightning / severe thunderstorm → panel surge check)
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?area=${state}&status=actual`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0", Accept: "application/geo+json" } },
    );
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? []).slice(0, 20)) {
        const props = feat?.properties ?? {};
        const event: string = props.event ?? "";
        if (!["Thunderstorm", "Lightning", "Tornado", "Severe"].some((e) => event.includes(e))) continue;
        const areaDesc: string = props.areaDesc ?? "";
        const effective = (props.effective ?? props.onset ?? new Date().toISOString()).split("T")[0];
        signals.push({
          address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
          city: areaDesc.split(",")[0]?.trim() ?? state,
          zip: "",
          signal_type: "storm_panel_check",
          signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 100) ?? ""}`,
          signal_date: effective,
          score: BASE_SCORES.storm_panel_check,
          source_method: "noaa_nws_alerts",
          suggested_opener: OPENERS.storm_panel_check.opener,
          best_call_window: OPENERS.storm_panel_check.window,
          estimated_value: 800,
          raw_source_data: { event, areaDesc },
        });
      }
    }
  } catch (e) { console.error("[electrical] NWS:", e); }

  return signals;
}
