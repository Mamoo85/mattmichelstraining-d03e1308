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

  // 7. DLBA Auction Sales — vacant property buyers inherit severe pest problems
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/dlba_auction_sales/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,sale_closed_date,amt_final_sale_price,sale_program&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "foreclosure_vacant",
          signal_detail: `DLBA Auction Sale: ${addr} — DLBA properties vacant for years have active rodent colonies, raccoon nesting, and cockroach infestations before renovation can begin`,
          signal_date: a.sale_closed_date ? new Date(a.sale_closed_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foreclosure_vacant,
          source_method: "dlba_auction_sales",
          suggested_opener: "You just purchased a DLBA property — these homes almost always have active pest infestations from years of vacancy. We do pre-renovation pest assessments and exclusion work so you don't seal rodents inside your new walls.",
          best_call_window: "Before renovation begins — within 30 days of auction close",
          estimated_value: 600,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[pest] DLBA auction:", e); }

  // 8. BSEED Vacant Property Registrations — owners must register vacants; active registrations = reachable owner
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
          signal_type: "foreclosure_vacant",
          signal_detail: `BSEED Vacant Property Registration: ${addr} — owner: ${a.owner_name ?? "on file"}. Registered vacants in Detroit have active rodent, raccoon, and insect infestations migrating to adjacent occupied homes`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foreclosure_vacant,
          source_method: "bseed_vacant_registrations",
          suggested_opener: "The vacant property next to you at this address is registered with the city — vacant properties generate active pest migration into adjacent homes. A free inspection takes 20 minutes.",
          best_call_window: "While property is registered vacant (typically 12-month registration)",
          estimated_value: 400,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[pest] vacant registrations:", e); }

  // 6. Detroit Assessment Roll 2026 — recently sold pre-1950 homes (new owner + entry points)
  try {
    const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/tentative_assessment_roll_2026/FeatureServer/0/query?where=sale_date+%3E%3D+'${since}'+AND+residential_year_built+%3C+1950+AND+residential_year_built+%3E+1880+AND+is_improved+%3D+1+AND+property_class+%3D+'401'&outFields=address,zip_code,residential_year_built,sale_date,taxpayer_1&resultRecordCount=40&orderByFields=sale_date+DESC&f=json`,
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
        const yrBuilt: number = a.residential_year_built || 0;
        const owner = (a.taxpayer_1 || "").trim();
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "foreclosure_vacant",
          signal_detail: `New owner at ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — pre-1950 Detroit homes have foundation gaps, old wood framing with rodent harborage, and deteriorated weatherstripping. New owners routinely discover pest problems within the first 3 months`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foreclosure_vacant + 1,
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Congrats on ${addr}! Built ${yrBuilt} — pre-1950 Detroit homes almost always have entry points for rodents and insects that the previous owners just lived with. A free inspection takes 20 minutes and we can seal everything same-day.`,
          best_call_window: "Within 60 days of purchase",
          estimated_value: 600,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[pest] assessment roll:", e); }

  // 7. Fire Inspections overdue — neglected buildings = pest harborage
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Fire_Inspections/FeatureServer/0/query?where=InspWithinLastYear+%3D+'No'+AND+(propusetype+LIKE+'%25Residential%25'+OR+propusetype+LIKE+'%25Vacant%25'+OR+propusetypedescription+LIKE+'%25warehouse%25')&outFields=Address,zip,OccupantName,propusetypedescription,LatestInspDate&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.Address || "").trim();
        const zip = String(a.zip || "").trim();
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const occupant = a.OccupantName || "";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "foreclosure_vacant",
          signal_detail: `Fire inspection overdue: ${addr} (${occupant || a.propusetypedescription || "building"}) — deferred building maintenance creates harborage for rodents and insects, especially around structural gaps, open utilities, and debris accumulation`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foreclosure_vacant,
          source_method: "fire_inspections",
          suggested_opener: `${occupant ? occupant + " — " : ""}Buildings with deferred maintenance like ${addr} are a magnet for rodents and insects — structural gaps, open crawlspaces, and accumulated debris are the main entry points. We offer commercial pest contracts with monthly service reports.`,
          best_call_window: "Any time — deferred maintenance compounds over time",
          estimated_value: 800,
          raw_source_data: { addr, zip, occupant, type: a.propusetypedescription },
        });
      }
    }
  } catch (e) { console.error("[pest] fire inspections:", e); }

  // 8. Existing Multifamily Housing — large regulated properties need pest service contracts
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/existing_multifamily_housing_sites/FeatureServer/0/query?where=regulatory_status+%3D+'Regulated'+AND+total_units+%3E+5&outFields=address,zip_code,owner_developer_name,legal_entity,total_units&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json",
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
        const units = a.total_units || 0;
        const manager = a.owner_developer_name || a.legal_entity || "property manager";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "foreclosure_vacant",
          signal_detail: `Regulated multifamily property: ${addr} (${units} units) — ${manager}. Regulated affordable housing is required to maintain pest-free conditions per HUD guidelines. Properties without active pest contracts face HUD audit risk`,
          signal_date: new Date().toISOString().split("T")[0],
          score: units >= 20 ? BASE_SCORES.foreclosure_vacant + 1 : BASE_SCORES.foreclosure_vacant,
          source_method: "existing_multifamily_sites",
          suggested_opener: `We work with regulated multifamily property managers like ${manager} — HUD requires documented pest control programs for regulated units. Are you currently covered by a licensed pest service contract with monthly reporting?`,
          best_call_window: "Any time — compliance mandate creates recurring contract value",
          estimated_value: units * 120,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[pest] existing multifamily:", e); }

  // BSEED Presale Inspections — FAIL results (pest/rodent evidence blocks sale)
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
          signal_type: "foreclosure_vacant",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — rodent evidence, insect activity, and pest entry points are commonly cited in presale inspection. Seller must resolve before closing`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 9,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — pest issues are commonly cited and can derail a closing if not professionally documented. We provide fast inspection + treatment + certification letters for buyers and inspectors.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 800,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[pest] presale inspections:", e); }

  return signals;
}
