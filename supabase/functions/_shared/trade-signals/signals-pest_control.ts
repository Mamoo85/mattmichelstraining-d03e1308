// Pest Control Radar signal scanner.
// Sources: EstateSales (vacant), probate filings, foreclosure notices — unique aggregation.
// Uses canonical shared scrapers instead of inline copies.

import { scrapeEstateSales } from "../scrapers-public-listings.ts";
import { scrapeProbateFilings, scrapeForeclosureNotices } from "../scrapers-county-records.ts";

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

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. EstateSales (canonical shared scraper — replaces inline ZIP loop)
  try {
    const estateResults = await scrapeEstateSales({ perCityCap: 5 });
    for (const s of estateResults) {
      if (zipFilter?.length && s.zip && !zipFilter.includes(s.zip)) continue;
      signals.push({
        address: s.address,
        city: s.city ?? "Detroit",
        zip: s.zip ?? "",
        signal_type: "vacant_estate_risk",
        signal_detail: `EstateSales (${s.signal_source}): ${s.signal_detail ?? s.address}`,
        signal_date: s.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.vacant_estate_risk,
        source_method: "estate_sales_scrape",
        suggested_opener: OPENERS.vacant_estate_risk.opener,
        best_call_window: OPENERS.vacant_estate_risk.window,
        estimated_value: 600,
        raw_source_data: { address: s.address, source: s.signal_source },
      });
    }
  } catch (e) { console.error("[pest] EstateSales:", e); }

  // 2. Probate filings (Wayne + Oakland + Macomb legal notices)
  try {
    const probates = await scrapeProbateFilings({ perSourceCap: 8 });
    for (const p of probates) {
      if (zipFilter?.length && p.zip && !zipFilter.includes(p.zip)) continue;
      signals.push({
        address: p.address,
        city: p.city ?? "Detroit",
        zip: p.zip ?? "",
        signal_type: "probate_vacant",
        signal_detail: `Probate filing (${p.signal_source}): ${p.signal_detail ?? p.address}`,
        signal_date: p.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.probate_vacant,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.probate_vacant.opener,
        best_call_window: OPENERS.probate_vacant.window,
        estimated_value: 500,
        raw_source_data: { address: p.address, source: p.signal_source },
      });
    }
  } catch (e) { console.error("[pest] probate:", e); }

  // 3. BSEED vacant property registrations — city-confirmed vacant = pest magnet
  try {
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_vacant_property_registrations/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,issued_date,owner_name,latitude,longitude&resultRecordCount=30&orderByFields=issued_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = a.zip_code ?? addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "foreclosure_vacant",
          signal_detail: `BSEED vacant registration: ${addr}${a.owner_name ? ` — Owner: ${a.owner_name}` : ""}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foreclosure_vacant + 1,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.foreclosure_vacant.opener,
          best_call_window: OPENERS.foreclosure_vacant.window,
          estimated_value: 500,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[pest] vacant registrations:", e); }

  // 4. Foreclosure notices (vacant bank-owned properties = pest magnet)
  try {
    const foreclosures = await scrapeForeclosureNotices({ perSourceCap: 6 });
    for (const f of foreclosures) {
      if (zipFilter?.length && f.zip && !zipFilter.includes(f.zip)) continue;
      signals.push({
        address: f.address,
        city: f.city ?? "Detroit",
        zip: f.zip ?? "",
        signal_type: "foreclosure_vacant",
        signal_detail: `Foreclosure (${f.signal_source}): ${f.signal_detail ?? f.address}`,
        signal_date: f.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.foreclosure_vacant,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.foreclosure_vacant.opener,
        best_call_window: OPENERS.foreclosure_vacant.window,
        estimated_value: 450,
        raw_source_data: { address: f.address, source: f.signal_source },
      });
    }
  } catch (e) { console.error("[pest] foreclosure:", e); }

  // 5. Detroit Land Bank Authority (DLBA) — city-owned vacant properties = guaranteed pest pressure on neighbors
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/DLBA_Owned_Properties/FeatureServer/0/query?where=1%3D1&outFields=name,street_number,street_direction,street_name,street_type,neighborhood,latitude,longitude&resultRecordCount=40&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = [a.street_number, a.street_direction, a.street_name, a.street_type]
          .filter(Boolean).join(" ").trim();
        if (!addr) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "foreclosure_vacant",
          signal_detail: `DLBA vacant property (${a.neighborhood ?? "Detroit"}): city-owned lot — vacant structures are #1 pest harborage source affecting neighbors`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foreclosure_vacant - 1,
          source_method: "detroit_dlba",
          suggested_opener: OPENERS.foreclosure_vacant.opener,
          best_call_window: OPENERS.foreclosure_vacant.window,
          estimated_value: 400,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[pest] DLBA:", e); }

  // 6. Detroit Blight Violations — overgrown/debris properties = pest harborage adjacent to real homeowners
  try {
    const where = encodeURIComponent(
      `ordinance_description LIKE '%overgrown%' OR ordinance_description LIKE '%debris%' OR ordinance_description LIKE '%vacant%' OR ordinance_description LIKE '%rodent%' OR ordinance_description LIKE '%infestation%'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/blight_tickets/FeatureServer/0/query?where=${where}&outFields=address,zip_code,ordinance_description,latitude,longitude&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = `${a.address ?? ""}`.trim();
        const zip: string = a.zip_code ?? "";
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "foreclosure_vacant",
          signal_detail: `Detroit blight citation: ${(a.ordinance_description ?? "").slice(0, 120)} — overgrown/debris properties generate rodent and pest pressure on neighbors`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foreclosure_vacant - 1,
          source_method: "detroit_blight_arcgis",
          suggested_opener: "Your neighbor's property was just cited for overgrowth or debris — that's the #1 source of rodent migration into adjacent homes. A free inspection takes 20 minutes and we can show you exactly what we're seeing.",
          best_call_window: "Within 30 days of blight citation",
          estimated_value: 350,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[pest] blight:", e); }

  return signals;
}
