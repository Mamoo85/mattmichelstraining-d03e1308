// Demo & Junk Radar signal scanner.
// Buyers: junk haulers ($10-100/lead) and demo contractors ($50-200/lead).
// Signal stack reuses proven scrapers already running for pest/painting verticals.
//
// Sources:
//   Per-address: BSEED demo permits, estate sales, probate filings, foreclosure notices

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
  demo_permit: 9,
  estate_clearout: 8,
  probate_clearout: 7,
  foreclosure_clearout: 7,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  demo_permit: {
    opener: "A demo permit was just filed at this address — we haul debris same-day and can coordinate directly with your demo contractor to keep the project on schedule.",
    window: "While permit is active (usually 90 days)",
  },
  estate_clearout: {
    opener: "We saw an estate sale is being held at this address — most families need a full cleanout crew the day after. We can have a truck there within 24 hours of the sale ending.",
    window: "Day of / day after estate sale",
  },
  probate_clearout: {
    opener: "Estate properties in probate often need a full cleanout before they can be listed or transferred. We specialize in respectful, efficient estate cleanouts with same-week availability.",
    window: "Within 60 days of probate filing",
  },
  foreclosure_clearout: {
    opener: "Bank-owned properties always need a cleanout before REO listing. We work with real estate agents and banks directly and can deliver a cleared property in 48 hours.",
    window: "Within 45 days of foreclosure filing",
  },
};

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. BSEED demolition permits — per-address (confirmed service: bseed_building_permits)
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%DEMO%' OR work_description LIKE '%DEMOLITION%' OR work_description LIKE '%TEAR DOWN%' OR work_description LIKE '%TEARDOWN%')`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,work_description,amt_estimated_contractor_cost,latitude,longitude&resultRecordCount=50&orderByFields=issued_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
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
          signal_type: "demo_permit",
          signal_detail: `BSEED demo permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.demo_permit.opener,
          best_call_window: OPENERS.demo_permit.window,
          estimated_value: 3000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] BSEED:", e); }

  // 2. Estate sales (canonical scraper — addresses verified via Firecrawl)
  try {
    const estates = await scrapeEstateSales({ perCityCap: 6 });
    for (const s of estates) {
      if (zipFilter?.length && s.zip && !zipFilter.includes(s.zip)) continue;
      signals.push({
        address: s.address,
        city: s.city ?? "Detroit",
        zip: s.zip ?? "",
        signal_type: "estate_clearout",
        signal_detail: `EstateSales (${s.signal_source}): ${s.signal_detail ?? s.address}`,
        signal_date: s.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.estate_clearout,
        source_method: "estate_sales_scrape",
        suggested_opener: OPENERS.estate_clearout.opener,
        best_call_window: OPENERS.estate_clearout.window,
        estimated_value: 1200,
        raw_source_data: { address: s.address, source: s.signal_source },
      });
    }
  } catch (e) { console.error("[demo_junk] EstateSales:", e); }

  // 3. Probate filings (Wayne + Oakland + Macomb legal notices)
  try {
    const probates = await scrapeProbateFilings({ perSourceCap: 8 });
    for (const p of probates) {
      if (zipFilter?.length && p.zip && !zipFilter.includes(p.zip)) continue;
      signals.push({
        address: p.address,
        city: p.city ?? "Detroit",
        zip: p.zip ?? "",
        signal_type: "probate_clearout",
        signal_detail: `Probate (${p.signal_source}): ${p.signal_detail ?? p.address}`,
        signal_date: p.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.probate_clearout,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.probate_clearout.opener,
        best_call_window: OPENERS.probate_clearout.window,
        estimated_value: 1500,
        raw_source_data: { address: p.address, source: p.signal_source },
      });
    }
  } catch (e) { console.error("[demo_junk] probate:", e); }

  // 4. Foreclosure notices (bank-owned = guaranteed cleanout need)
  try {
    const foreclosures = await scrapeForeclosureNotices({ perSourceCap: 8 });
    for (const f of foreclosures) {
      if (zipFilter?.length && f.zip && !zipFilter.includes(f.zip)) continue;
      signals.push({
        address: f.address,
        city: f.city ?? "Detroit",
        zip: f.zip ?? "",
        signal_type: "foreclosure_clearout",
        signal_detail: `Foreclosure (${f.signal_source}): ${f.signal_detail ?? f.address}`,
        signal_date: f.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.foreclosure_clearout,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.foreclosure_clearout.opener,
        best_call_window: OPENERS.foreclosure_clearout.window,
        estimated_value: 1800,
        raw_source_data: { address: f.address, source: f.signal_source },
      });
    }
  } catch (e) { console.error("[demo_junk] foreclosure:", e); }

  // 5. Detroit Blight Violations — debris, excessive growth, structural hazards
  try {
    const where = encodeURIComponent(
      `ordinance_description LIKE '%debris%' OR ordinance_description LIKE '%junk%' OR ordinance_description LIKE '%dumping%' OR ordinance_description LIKE '%vacant%' OR ordinance_description LIKE '%abandoned%'`,
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
          signal_type: "demo_permit",
          signal_detail: `Detroit blight citation: ${(a.ordinance_description ?? "").slice(0, 120)} — junk/debris removal opportunity`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit - 2,
          source_method: "detroit_blight_arcgis",
          suggested_opener: OPENERS.estate_clearout.opener,
          best_call_window: OPENERS.estate_clearout.window,
          estimated_value: 800,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] blight:", e); }

  // 6. Detroit Land Bank Authority (DLBA) — city-owned vacant properties available for sale
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
          signal_type: "demo_permit",
          signal_detail: `DLBA vacant property (${a.neighborhood ?? "Detroit"}): city-owned lot available — demolition/clearout opportunity`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit - 1,
          source_method: "detroit_dlba",
          suggested_opener: OPENERS.foreclosure_clearout.opener,
          best_call_window: OPENERS.foreclosure_clearout.window,
          estimated_value: 1500,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] DLBA:", e); }

  // 7. BSEED Dedicated Demolition Permits — cleaner data than keyword-filtering building permits
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_demolition_permits/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,issued_date,work_description,owner_name,latitude,longitude&resultRecordCount=50&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = a.zip_code ?? "";
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "demo_permit",
          signal_detail: `BSEED Demolition Permit: ${(a.work_description ?? "demolition").slice(0, 100)} — owner: ${a.owner_name ?? "on file"}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit,
          source_method: "bseed_demo_permits",
          suggested_opener: OPENERS.demo_permit.opener,
          best_call_window: OPENERS.demo_permit.window,
          estimated_value: 3500,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] BSEED demo permits:", e); }

  // 8. DLBA Auction Sales — new buyers of distressed properties need immediate clearout
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/dlba_auction_sales/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,sale_closed_date,amt_final_sale_price,sale_program,neighborhood&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = a.zip_code ?? "";
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "estate_clearout",
          signal_detail: `DLBA Auction Sale: ${addr} (${a.sale_program ?? "auction"}) sold for $${(a.amt_final_sale_price || 0).toLocaleString()} — investors who buy at DLBA auction need immediate debris removal to start renovation`,
          signal_date: a.sale_closed_date ? new Date(a.sale_closed_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.estate_clearout,
          source_method: "dlba_auction_sales",
          suggested_opener: "You just picked up a DLBA property — these homes are full of debris, personal property, and often hazardous materials. We do same-week full clearouts so you can start renovation on schedule.",
          best_call_window: "Within 30 days of auction close",
          estimated_value: 2000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] DLBA auction:", e); }

  // 9. Detroit Commercial Demolitions — city-tracked commercial demo projects (contractor referral signal)
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Commercial_Demolitions/FeatureServer/0/query?where=1%3D1&outFields=address,demo_date,projected_demo_date,demolition_contractor,status,neighborhood&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        if (!addr) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "demo_permit",
          signal_detail: `City commercial demolition: ${addr} — contractor: ${a.demolition_contractor ?? "TBD"}, status: ${a.status ?? "active"}, projected: ${a.projected_demo_date ? new Date(a.projected_demo_date).toISOString().slice(0, 10) : "TBD"}`,
          signal_date: a.demo_date ? new Date(a.demo_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit - 1,
          source_method: "detroit_commercial_demo",
          suggested_opener: "We see a commercial demo is scheduled at this address — we specialize in post-demolition debris hauling and site clearance, and coordinate directly with the demolition crew for zero downtime.",
          best_call_window: "Within 2 weeks of projected demo date",
          estimated_value: 5000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] commercial demo:", e); }

  return signals;
}
