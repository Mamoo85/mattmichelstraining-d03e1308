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

  // 9. Detroit Demo Pipeline — upcoming planned demolitions (advance positioning signal)
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Demo_Pipeline/FeatureServer/0/query?where=1%3D1&outFields=address,neighborhood,commercial_building,demo_rfp_group,latitude,longitude&resultRecordCount=50&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        if (!addr) continue;
        const isCommercial = (a.commercial_building ?? "No") === "Yes";
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "demo_permit",
          signal_detail: `Detroit Demo Pipeline: ${addr} (${a.neighborhood ?? "Detroit"}) — ${isCommercial ? "commercial" : "residential"} property in city demolition queue. Group: ${a.demo_rfp_group ?? "active"} — adjacent properties need pre-demo cleanup and debris services`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit,
          source_method: "detroit_demo_pipeline",
          suggested_opener: "This address is in the city demolition queue — we partner with demo contractors for same-day debris and material hauling to keep your project on schedule.",
          best_call_window: "While property is in pipeline (90-day window)",
          estimated_value: 3000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] demo pipeline:", e); }

  // 10. Demolitions under Contract — contracted demolitions imminent (highest urgency signal)
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Demolitions_under_Contract/FeatureServer/0/query?where=1%3D1&outFields=address,demolish_by_date,price,contractor_name,council_district,neighborhood&resultRecordCount=40&f=json",
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
          signal_detail: `Demolition Under Contract: ${addr} — contractor: ${a.contractor_name ?? "active"}, demolish by: ${a.demolish_by_date ? new Date(a.demolish_by_date).toISOString().slice(0, 10) : "imminent"}, contract value: $${(a.price || 0).toLocaleString()}`,
          signal_date: a.demolish_by_date ? new Date(a.demolish_by_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit + 1, // contracted = guaranteed demolition = highest priority
          source_method: "detroit_demolitions_contracted",
          suggested_opener: "A demolition is contracted at this address — we do post-demo site clearance and debris hauling, and coordinate directly with the demo contractor for zero scheduling gaps.",
          best_call_window: "Immediately — demo is imminent",
          estimated_value: 4000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] contracted demo:", e); }

  // 11. DLBA Own-It-Now Sales — buyers who bought off the DLBA "own it now" direct listing
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/dlba_own_it_now_sales/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,sale_closed_date,amt_final_sale_price,sale_program,neighborhood&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json",
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
          signal_detail: `DLBA Own-It-Now Sale: ${addr} sold for $${(a.amt_final_sale_price || 0).toLocaleString()} — direct DLBA purchasers are typically first-time investors doing their first renovation, often unaware of scope`,
          signal_date: a.sale_closed_date ? new Date(a.sale_closed_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.estate_clearout,
          source_method: "dlba_own_it_now",
          suggested_opener: "You just purchased through the DLBA own-it-now program — these properties require full debris removal before renovation can start. We do same-week clearouts for new DLBA buyers.",
          best_call_window: "Within 30 days of sale close",
          estimated_value: 1800,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] DLBA own-it-now:", e); }

  // 12. DLBA Project Sales — developers buying distressed properties in bulk = large-scale clearout demand
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/dlba_project_sales/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,sale_closed_date,amt_final_sale_price,sale_program,project_group_id,neighborhood&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json",
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
          signal_detail: `DLBA Project Sale: ${addr} sold to developer (project: ${a.project_group_id ?? "DLBA"}) for $${(a.amt_final_sale_price || 0).toLocaleString()} — developers buying in project groups need coordinated bulk clearout services across multiple properties`,
          signal_date: a.sale_closed_date ? new Date(a.sale_closed_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit,
          source_method: "dlba_project_sales",
          suggested_opener: "You're buying properties through the DLBA project program — we offer bulk clearout pricing for developers acquiring multiple addresses and can coordinate across your entire project group.",
          best_call_window: "Within 30 days of project sale close",
          estimated_value: 6000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] DLBA project:", e); }

  // 14. BSEED Vacant Property Registrations — registered vacants are candidates for demo or sale prep
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_vacant_property_registrations/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,issued_date,owner_name,neighborhood&resultRecordCount=50&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "foreclosure_clearout",
          signal_detail: `BSEED Vacant Registration: ${addr} — owner: ${a.owner_name ?? "on file"}. Registered vacants approaching 2+ years are heading toward city demo order or forced sale — owners often need clearout before listing`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foreclosure_clearout,
          source_method: "bseed_vacant_registrations",
          suggested_opener: "Your property is registered as vacant with the city — registered vacants often require emergency cleanup before the city issues an order. We can clear and secure the property to avoid escalation.",
          best_call_window: "Within 60 days of registration or renewal",
          estimated_value: 1500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] vacant registrations:", e); }

  // 16. Detroit Commercial Demolitions — city-tracked commercial demo projects (contractor referral signal)
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

  // 17. DLBA Side Lots For Sale — city sells cleared lots; buyers need debris removal + site prep
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Side_Lots_For_Sale/FeatureServer/0/query?where=Status+%3D+%27For+Sale%27&outFields=Address,Status,Knock_Down_Date,Demo_RFP__RFP_Group,latitude,longitude&resultRecordCount=40&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.Address ?? "";
        if (!addr) continue;
        if (zipFilter?.length) continue; // side lots have no ZIP in this dataset
        const knockDate = a.Knock_Down_Date ? new Date(a.Knock_Down_Date).toISOString().slice(0, 10) : null;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "demo_permit",
          signal_detail: `DLBA side lot for sale: ${addr} — cleared lot available for purchase. Buyers need debris removal, site grading, and final prep before building or landscaping${knockDate ? `. Demo completed: ${knockDate}` : ""}`,
          signal_date: knockDate ?? new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit - 2,
          source_method: "dlba_side_lots",
          suggested_opener: "You're looking at a DLBA side lot — after purchase, most buyers need a final debris sweep, grade leveling, and fence removal before they can use the space. We can usually knock that out in half a day.",
          best_call_window: "Within 30 days of lot sale closing",
          estimated_value: 1200,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] side lots:", e); }

  // 18. BSEED Demolition Inspections — passed inspection = structure is down, lot needs immediate cleanup
  try {
    const since = new Date(Date.now() - 90 * 86400_000).toISOString().split("T")[0];
    const where = encodeURIComponent(`inspection_result LIKE '%PASS%' OR inspection_result LIKE '%pass%' OR inspection_result LIKE '%Approved%'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_demolition_inspections/FeatureServer/0/query?where=${where}&outFields=address,inspection_date,inspection_type,inspection_result,zip_code,neighborhood&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = String(a.zip_code ?? "").split(".")[0];
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const inspDate = a.inspection_date ? new Date(a.inspection_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "demo_permit",
          signal_detail: `BSEED demolition inspection passed: ${addr} — ${a.inspection_type ?? "final"} inspection approved. Structure is confirmed down. Lot cleanup, debris removal, and grading typically needed within 2 weeks of final inspection`,
          signal_date: inspDate,
          score: BASE_SCORES.demo_permit,
          source_method: "bseed_demo_inspection",
          suggested_opener: "The demolition inspection at this address just passed — we specialize in immediate post-demo cleanouts. Structure down means the owner needs debris hauled, foundation capped, and the lot graded before it can be listed or reused.",
          best_call_window: "Within 2 weeks of inspection pass date",
          estimated_value: 3500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] demo inspections:", e); }

  // 19. DLBA Vacant Land Program Sales — recently sold vacant land = new owner needs site prep
  try {
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/dlba_vacant_land_program_sales/FeatureServer/0/query?where=sale_closed_date+%3E%3D+%27${since90}%27&outFields=address,sale_closed_date,amt_final_sale_price,sale_program,neighborhood,zip_code,latitude,longitude&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json`,
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
          signal_detail: `DLBA vacant land sale: ${addr} — sold ${a.sale_closed_date ? a.sale_closed_date.slice(0, 10) : "recently"} for $${a.amt_final_sale_price ?? "N/A"} (${a.sale_program ?? "land program"}). New land owners typically need debris clearing, grading, and fence removal before any build or garden project`,
          signal_date: a.sale_closed_date ?? new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit - 2,
          source_method: "dlba_vacant_land_sales",
          suggested_opener: "You just purchased a DLBA vacant lot — most of these lots have leftover foundation debris, overgrowth, and fence remnants that need to come out before you can break ground. We do same-week site clearances.",
          best_call_window: "Within 60 days of lot sale closing",
          estimated_value: 1500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] vacant land sales:", e); }

  // 20. Detroit Commercial Properties for Sale — city-owned commercial listings; buyers need demo/clearout
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Commercial_Properties_for_Sale/FeatureServer/0/query?where=1%3D1&outFields=address,title,size,price,property_type&resultRecordCount=30&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        if (!addr) continue;
        const isLand = (a.property_type ?? "").toLowerCase().includes("land") || (a.property_type ?? "").toLowerCase().includes("vacant");
        if (!isLand) continue; // only land/vacant listings need demo junk — commercial buildings go to restoration
        if (zipFilter?.length) continue; // no ZIP in dataset
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "demo_permit",
          signal_detail: `City commercial property for sale: ${addr} — "${a.title ?? a.property_type}" listed at ${a.price ?? "TBD"} (${a.size ?? "?"}). Vacant land buyers almost always need site clearance, debris removal, and grading before any build`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit - 3,
          source_method: "detroit_commercial_for_sale",
          suggested_opener: `We saw the ${a.property_type ?? "vacant lot"} listing at ${addr} — buyers of city land typically need a site clearance before they can break ground. We do same-week debris and foundation clearing.`,
          best_call_window: "While property is listed or just after sale closes",
          estimated_value: 2000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] commercial for sale:", e); }

  // 21. Detroit City Real Estate Land — city-owned development land (adjacent signal to DLBA)
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/development_opportunities_city_real_estate_land/FeatureServer/0/query?where=1%3D1&outFields=address,street_number,street_prefix,street_name,street_type&resultRecordCount=40&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = a.address || [a.street_number, a.street_prefix, a.street_name, a.street_type].filter(Boolean).join(" ").trim();
        if (!addr) continue;
        if (zipFilter?.length) continue; // no ZIP in dataset
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "demo_permit",
          signal_detail: `City-owned development land available: ${addr} — city real estate listings attract developers and contractors; post-acquisition site clearing and prep is standard`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit - 4,
          source_method: "detroit_city_land",
          suggested_opener: "We work with Detroit land developers for post-acquisition site clearing. If you're buying or developing city land in this area, we can have a clearance crew on-site within days of closing.",
          best_call_window: "Active during city land sale period",
          estimated_value: 1500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] city land:", e); }

  // 22. Completed Residential Demolitions — structure just came down; lot needs immediate cleanup
  // This dataset updates DAILY with real demolition completions (latest data: May 2026)
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Completed_Residential_Demolitions/FeatureServer/0/query?where=1%3D1&outFields=address,demolition_date,contractor_name,neighborhood,emergency_demo,latitude,longitude&resultRecordCount=50&orderByFields=demolition_date+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      // Cut off records older than 45 days
      const cutoffMs = Date.now() - 45 * 86400_000;
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        if (!addr) continue;
        const demoMs: number | null = typeof a.demolition_date === "number" ? a.demolition_date : null;
        if (demoMs && demoMs < cutoffMs) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "demo_permit",
          signal_detail: `Residential demolition COMPLETED: ${addr} — structure demolished ${demoMs ? new Date(demoMs).toISOString().slice(0, 10) : "recently"} by ${a.contractor_name ?? "city contractor"}${a.emergency_demo === "Yes" ? " (emergency demolition)" : ""}. Lot needs debris removal, foundation cap, grading, and site cleanup within 30 days of completion`,
          signal_date: demoMs ? new Date(demoMs).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.demo_permit,
          source_method: "completed_residential_demolitions",
          suggested_opener: `The city just completed the demolition at ${addr}. The lot is down but needs debris cleared, the foundation capped, and the site graded before it's clean and usable. We can typically be on-site within 48 hours of demo completion.`,
          best_call_window: "Within 2 weeks of demolition date",
          estimated_value: 3500,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] completed demos:", e); }

  // 23. Demolition Post-Abatement Verification Reports — lot passed abatement = needs grading/cleanup
  try {
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Demolition_Post_Abatement_Verification_Reports/FeatureServer/0/query?where=pav_passed_date+%3E%3D+%27${since90}%27&outFields=address,structure_type,pav_passed_date,demolition_contractor,zip_code,neighborhood,latitude,longitude&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").trim();
        if (!addr) continue;
        const zip = String(a.zip_code || "").trim();
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const passed = a.pav_passed_date ? String(a.pav_passed_date).slice(0, 10) : new Date().toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "demo_permit",
          signal_detail: `Post-abatement verification passed: ${addr} (${a.structure_type || "structure"}) — abatement cleared ${passed} by ${a.demolition_contractor || "contractor"}. Lot now cleared for full debris removal and site grading`,
          signal_date: passed,
          score: BASE_SCORES.demo_permit,
          source_method: "demo_post_abatement_reports",
          suggested_opener: `The post-abatement report was just cleared at ${addr} — the lot is now approved for full cleanup and grading. We specialize in post-demo lot clearance and can be on-site within 48 hours.`,
          best_call_window: "Within 30 days of abatement clearance",
          estimated_value: 3000,
          raw_source_data: { addr, zip, passed, contractor: a.demolition_contractor, type: a.structure_type },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] post-abatement reports:", e); }

  // 24. ARPA Blight Remediation (Industrial/Commercial Completed) — commercial lot cleanup opportunity
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/ARPA_Blight_Remediation_Industrial_and_Commercial_Completed_EDD/FeatureServer/0/query?where=Commercial_Demo_Status+%3D+'Demolished'&outFields=Property_Account__Account_Name,Commercial_Demo_Status,ENV_Phase1_Date&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const name = (a.Property_Account__Account_Name || "").trim();
        if (!name) continue;
        // Normalize address from account name (e.g. "6075 Begole")
        const addr = name.replace(/[^0-9A-Za-z\s\-]/g, "").trim();
        if (!addr || addr.length < 5) continue;
        const phase1 = a.ENV_Phase1_Date ? String(a.ENV_Phase1_Date).slice(0, 10) : new Date().toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "demo_permit",
          signal_detail: `ARPA commercial demolition completed: ${addr} — commercial/industrial structure demolished. Large-scale lot cleanup, debris removal, and site prep needed`,
          signal_date: phase1,
          score: BASE_SCORES.demo_permit + 1,
          source_method: "arpa_commercial_demo",
          suggested_opener: `The ARPA-funded demolition at ${addr} is complete — commercial demo sites need comprehensive lot cleanup, foundation removal, and site grading. We handle large-scale post-demo work.`,
          best_call_window: "Within 60 days of demolition completion",
          estimated_value: 8000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] ARPA commercial demo:", e); }

  // BSEED Presale Inspections — FAIL results (junk removal / cleanout needed to pass)
  try {
    const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`(inspection_result = 'FAIL' OR inspection_result = '***Failed Insp') AND inspection_date >= '${since}'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_presale_inspections/FeatureServer/0/query?where=${where}&outFields=address,zip_code,inspection_date&resultRecordCount=25&orderByFields=inspection_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").trim();
        const zip = String(a.zip_code || "").trim();
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "presale_cleanout",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — accumulated junk, debris piles, and hazardous materials in basements or garages are commonly cited in presale inspection. Fast cleanout can turn a fail into a pass`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 8,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — debris and accumulated junk in the basement or garage is a common fail item. We do same-day full cleanouts with same-day documentation so you can rebook your re-inspection immediately.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 1800,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[demo_junk] presale inspections:", e); }

  return signals;
}
