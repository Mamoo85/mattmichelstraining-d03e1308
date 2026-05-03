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
  commercial_compliance_elec: 8,
  panel_upgrade_permit: 7,
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

  // 4. US Census ACS — pre-1960 ZIP codes need panel upgrades (knob-and-tube / 60A service)
  try {
    const acsRes = await fetch(
      "https://api.census.gov/data/2022/acs/acs5?get=B25035_001E,B25034_002E&for=zip+code+tabulation+area:*&in=state:26",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (acsRes.ok) {
      const rows: string[][] = await acsRes.json();
      const data = rows.slice(1); // skip header
      const old = data.filter((r) => {
        const yr = Number(r[0]);
        return yr > 0 && yr <= 1960;
      }).sort((a, b) => Number(a[0]) - Number(b[0]));
      if (old.length > 0) {
        const topZips = old.slice(0, 5).map((r) => r[2]);
        signals.push({
          address: `Michigan — ${old.length} ZIPs with median year built ≤ 1960`,
          city: state, zip: "",
          signal_type: "aging_panel_area",
          signal_detail: `Census ACS: ${old.length} MI ZIP codes have median year-built at or before 1960 — homes this age overwhelmingly have undersized 60A/100A panels, knob-and-tube, and no AFCI protection. Top aging ZIPs: ${topZips.join(", ")}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "census_acs",
          suggested_opener: "Homes built before 1960 were wired for 1960 appliances — two window ACs and a modern kitchen will trip a 60A panel constantly. We offer free panel assessments in your area.",
          best_call_window: "Evergreen — aging housing stock always needs upgrades",
          estimated_value: 4500,
          raw_source_data: { old_zip_count: old.length, top_zips: topZips },
        });
      }
    }
  } catch (e) { console.error("[electrical] Census ACS:", e); }

  // 5. CFPB HMDA Home Improvement Loans — renovation borrowers = panel upgrade market
  try {
    const res = await fetch(
      `https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?states=${state}&years=2023&actions_taken=1&loan_purposes=2`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const total = (d?.aggregations ?? []).reduce((n: number, r: any) => n + (r.count || 0), 0);
      if (total > 0) {
        signals.push({
          address: `${state} — ${total.toLocaleString()} home improvement loans (2023)`,
          city: state, zip: "",
          signal_type: "home_improvement_loan_area",
          signal_detail: `CFPB HMDA: ${total.toLocaleString()} home improvement loan originations in ${state} (2023) — major renovations almost always require panel upgrades to meet code`,
          signal_date: new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "ffiec_hmda",
          suggested_opener: "You're doing major renovations — most contractors don't tell you until inspection fails that adding a kitchen or bathroom almost always requires a panel upgrade. We can quote yours before you start.",
          best_call_window: "Within 90 days of loan origination",
          estimated_value: 4000,
          raw_source_data: { total, state, year: 2023, loan_purpose: "home_improvement" },
        });
      }
    }
  } catch (e) { console.error("[electrical] CFPB HI:", e); }

  // 6. BSEED Rental Registrations — landlords in pre-1960 buildings must pass electrical inspection
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_rental_registrations/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,issued_date,registration_type&resultRecordCount=50&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "panel_upgrade_permit",
          signal_detail: `BSEED Rental Registration: ${addr} — Detroit rental inspection requires electrical compliance. Pre-1960 rentals have undersized panels, knob-and-tube wiring, and no AFCI — all flagged during city inspection`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "bseed_rental_registrations",
          suggested_opener: "Your rental registration at this address triggers a city electrical inspection — pre-1960 homes routinely fail on panel capacity and wiring. We can assess and bring you into compliance before the inspector arrives.",
          best_call_window: "Within 45 days of registration",
          estimated_value: 5000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[electrical] rental registrations:", e); }

  // 6. Detroit Assessment Roll 2026 — recently sold pre-1970 homes (new owner + aging electrical)
  try {
    const since = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/tentative_assessment_roll_2026/FeatureServer/0/query?where=sale_date+%3E%3D+'${since}'+AND+residential_year_built+%3C+1970+AND+residential_year_built+%3E+1880+AND+is_improved+%3D+1+AND+property_class+%3D+'401'&outFields=address,zip_code,residential_year_built,sale_date,taxpayer_1&resultRecordCount=40&orderByFields=sale_date+DESC&f=json`,
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
        const era = yrBuilt < 1950 ? "pre-1950 knob-and-tube wiring era" : yrBuilt < 1960 ? "pre-1960 60-amp service era" : "pre-1970 ungrounded outlet era";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "renovation_electrical",
          signal_detail: `New owner at ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — ${era}. Pre-1970 Detroit homes almost universally need panel upgrades, grounding, and AFCI protection during ownership transitions`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: BASE_SCORES.renovation_electrical + 1,
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Congrats on the new home at ${addr}! Built ${yrBuilt}, so it's almost certainly running on ${yrBuilt < 1950 ? "knob-and-tube wiring" : "a 60-amp or ungrounded panel"}. Insurance companies often require upgrades before binding coverage. Want a free assessment this week?`,
          best_call_window: "Within 60 days of purchase",
          estimated_value: 4500,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[electrical] assessment roll:", e); }

  // 7. BSEED Presale Inspections — FAIL results (electrical deficiencies commonly cited)
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
          signal_type: "renovation_electrical",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — electrical panel capacity and wiring safety are standard inspection items. Knob-and-tube, 60-amp panels, and ungrounded outlets commonly fail`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 9,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — electrical deficiencies are one of the most common reasons older Detroit homes fail. We can upgrade the panel and rewire key circuits fast, with a re-inspection scheduled within days.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 5000,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[electrical] presale inspections:", e); }

  // 8. Detroit commercial building compliance failures — electrical code violations
  try {
    const complianceWhere = encodeURIComponent(`commercial_compliance_indicator = 'YELLOW' OR commercial_compliance_indicator = 'RED'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_commercial_building_compliance/FeatureServer/0/query?where=${complianceWhere}&outFields=parcel_address,taxpayer_1,commercial_compliance_indicator,commercial_compliance_detail,latest_inspection_result,amt_balance_due&resultRecordCount=40&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.parcel_address || "").trim();
        if (!addr) continue;
        const status = a.commercial_compliance_indicator ?? "YELLOW";
        const owner = (a.taxpayer_1 || "").trim();
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "commercial_compliance_elec",
          signal_detail: `Detroit commercial compliance ${status}: ${addr}${owner ? " — " + owner : ""}. Electrical panel capacity and grounding are top reasons Detroit commercial buildings fail CofC inspection`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.commercial_compliance_elec - (status === "YELLOW" ? 1 : 0),
          source_method: "bseed_commercial_compliance",
          suggested_opener: `Your commercial property at ${addr} is flagged ${status} in the city compliance system — electrical code failures are the most common reason buildings don't get their Certificate of Compliance. We specialize in fast commercial panel upgrades and inspections.`,
          best_call_window: "Any time — compliance creates deadline urgency",
          estimated_value: 8000,
          raw_source_data: { addr, status, owner, detail: a.commercial_compliance_detail, balance: a.amt_balance_due },
        });
      }
    }
  } catch (e) { console.error("[electrical] commercial compliance:", e); }

  // 8. Detroit commercial compliance certificates expiring in 90 days
  try {
    const certWhere = encodeURIComponent(`num_days_until_expired <= 90 AND num_days_until_expired > 0`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_commercial_compliance_certificates/FeatureServer/0/query?where=${certWhere}&outFields=address,zip_code,expired_date,num_days_until_expired&resultRecordCount=40&orderByFields=num_days_until_expired+ASC&f=json`,
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
        const daysLeft = Number(a.num_days_until_expired) || 90;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "commercial_compliance_elec",
          signal_detail: `Detroit commercial CofC expires in ${daysLeft} days: ${addr}. Pre-inspection electrical audit prevents failed re-inspection and compliance penalties`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.commercial_compliance_elec - (daysLeft > 45 ? 1 : 0),
          source_method: "bseed_commercial_cert_expiry",
          suggested_opener: `Your Certificate of Compliance at ${addr} expires in ${daysLeft} days — electrical issues are one of the most common reasons Detroit commercial buildings fail. We'll do a pre-inspection audit so you pass the first time.`,
          best_call_window: `Within ${Math.min(daysLeft, 60)} days`,
          estimated_value: 6000,
          raw_source_data: { addr, zip, days_left: daysLeft },
        });
      }
    }
  } catch (e) { console.error("[electrical] commercial cert expiry:", e); }

  // 9. Multifamily Construction Sites — new builds needing full electrical service
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/multifamily_housing_construction_sites/FeatureServer/0/query?where=construction_status+IN+('Under+Construction','Construction+Not+Started')&outFields=address,zip_code,owner_developer_name,legal_entity,total_units,construction_status&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json",
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
        const developer = a.owner_developer_name || a.legal_entity || "developer";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "commercial_compliance_elec",
          signal_detail: `Multifamily construction: ${addr} (${units} units, ${a.construction_status}) — ${developer}. New multifamily construction requires full electrical service panels, wiring, and inspection sign-off`,
          signal_date: new Date().toISOString().split("T")[0],
          score: units >= 20 ? BASE_SCORES.commercial_compliance_elec + 1 : BASE_SCORES.commercial_compliance_elec,
          source_method: "multifamily_construction_sites",
          suggested_opener: `We saw ${addr} is in active multifamily construction — ${units} units means a significant electrical package. Do you have a licensed electrician bid on the service panels and unit wiring yet?`,
          best_call_window: "During construction — pre-drywall phase",
          estimated_value: units * 2500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[electrical] multifamily construction:", e); }

  // 10. Energy Benchmarking — low Energy Star scores signal aging electrical infrastructure
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/energy_water_benchmarking_ordinance_-_buildings/FeatureServer/0/query?where=is_municipal+%3D+0+AND+greenhouse_emissions+%3E+100&outFields=parcel_address,zip_code,energystar_name,assessor_year_built,greenhouse_emissions,energystar_score&resultRecordCount=40&orderByFields=greenhouse_emissions+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.parcel_address || "").trim();
        const zip = String(a.zip_code || "").trim();
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const emissions = a.greenhouse_emissions || 0;
        const name = a.energystar_name || "";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "aging_panel_area",
          signal_detail: `Energy benchmarking: ${addr} (${name}) — ${emissions} metric tons CO2, built ${a.assessor_year_built || "unknown"}. High emissions + old construction = aging electrical infrastructure likely needing panel upgrades`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.aging_panel_area || 6,
          source_method: "energy_benchmarking_ordinance",
          suggested_opener: `${name || addr} appears in Detroit's energy benchmarking data with high emissions — buildings of that age typically have outdated electrical panels that are both inefficient and a fire risk. We do free commercial electrical assessments.`,
          best_call_window: "Any time — energy costs are always pressing for property owners",
          estimated_value: 15000,
          raw_source_data: { addr, zip, emissions, year_built: a.assessor_year_built },
        });
      }
    }
  } catch (e) { console.error("[electrical] energy benchmarking:", e); }

  // 11. BSEED Rental Compliance — non-compliant rentals with electrical citation history
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_rental_compliance_public_view/FeatureServer/0/query?where=current_cofc_expired_date+IS+NULL&outFields=record_addresses,parcel_address,current_cofc_issued_date,current_reg_issued_date&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.record_addresses || a.parcel_address || "").trim();
        if (!addr) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "panel_upgrade_permit",
          signal_detail: `Rental compliance gap: ${addr} — no Certificate of Compliance on file. Electrical violations (outdated wiring, missing GFCI, overloaded panels) are frequently the root cause of failed rental inspections`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.panel_upgrade_permit || 6,
          source_method: "bseed_rental_compliance_view",
          suggested_opener: `Your rental at ${addr} shows a compliance certificate gap — electrical issues are the #1 reason Detroit rentals fail inspection. We specialize in getting landlords cleared fast with same-week service and inspection documentation.`,
          best_call_window: "Immediately — compliance creates hard deadline",
          estimated_value: 3500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[electrical] rental compliance view:", e); }

  // 12. BSEED Residential Compliance Certificates expiring in 60 days — pre-inspection electrical window
  try {
    const certWhere = encodeURIComponent(`num_days_until_expired <= 60 AND num_days_until_expired > 0`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_residential_compliance_certificates/FeatureServer/0/query?where=${certWhere}&outFields=address,zip_code,expired_date,num_days_until_expired&resultRecordCount=40&orderByFields=num_days_until_expired+ASC&f=json`,
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
        const daysLeft = Number(a.num_days_until_expired) || 60;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "panel_upgrade_permit",
          signal_detail: `Detroit residential CofC expires in ${daysLeft} days: ${addr}. Electrical panel capacity, GFCI outlets, and wiring condition are standard items in residential compliance re-inspection`,
          signal_date: new Date().toISOString().split("T")[0],
          score: daysLeft <= 7 ? 9 : daysLeft <= 30 ? 8 : 7,
          source_method: "bseed_residential_cert_expiry",
          suggested_opener: `Your Certificate of Compliance at ${addr} expires in ${daysLeft} days — electrical deficiencies are one of the most common reasons properties fail re-inspection. We'll do a pre-audit so you pass clean the first time.`,
          best_call_window: `Within ${Math.min(daysLeft, 45)} days`,
          estimated_value: 4500,
          raw_source_data: { addr, zip, days_left: daysLeft, expired_date: a.expired_date },
        });
      }
    }
  } catch (e) { console.error("[electrical] residential cert expiry:", e); }

  // 13. BSEED Plan Reviews — approved electrical/addition plans (service upgrade imminent)
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%ELECTRICAL%' OR work_description LIKE '%ADDITION%' OR work_description LIKE '%PANEL%') AND task_status LIKE '%Approved%'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permit_plan_reviews/FeatureServer/0/query?where=${where}&outFields=address,zip_code,submitted_date,work_description,task_status&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json`,
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
          signal_type: "renovation_electrical",
          signal_detail: `BSEED plan review approved: ${(a.work_description ?? "electrical project").slice(0, 100)} — approved plans mean the permit will be pulled within days`,
          signal_date: a.submitted_date ? new Date(a.submitted_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.renovation_electrical + 2,
          source_method: "bseed_plan_reviews",
          suggested_opener: `Your project at ${addr} has approved plans — we can provide same-week electrical service once the permit clears. Want a parallel bid before the work starts?`,
          best_call_window: "Immediately — plans approved means permit imminent",
          estimated_value: 5000,
          raw_source_data: { addr, zip, desc: a.work_description, status: a.task_status },
        });
      }
    }
  } catch (e) { console.error("[electrical] plan reviews:", e); }

  // Detroit Assessor property sales — new homeowners need electrical assessment
  try {
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const where = encodeURIComponent(
      `sale_date >= '${since90}' AND property_class_description = 'RESIDENTIAL' AND amt_sale_price > 5000`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${where}&outFields=address,zip_code,sale_date,amt_sale_price,grantee&resultRecordCount=30&orderByFields=sale_date+DESC&f=json`,
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
          signal_type: "panel_upgrade_permit",
          signal_detail: `Detroit property sale: ${a.grantee ?? "New owner"} purchased for $${(a.amt_sale_price || 0).toLocaleString()} — new owners in Detroit's pre-1970 housing stock frequently inherit Federal Pacific or Zinsco panels and aluminum wiring`,
          signal_date: a.sale_date ? a.sale_date.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessor_sales",
          suggested_opener: `You recently purchased ${addr} — Detroit homes built before 1980 commonly have outdated electrical panels and aluminum wiring that fail modern code and are a fire risk. We offer a free panel inspection for new homeowners.`,
          best_call_window: "Within 90 days of purchase",
          estimated_value: 4500,
          raw_source_data: { addr, zip, sale_date: a.sale_date, price: a.amt_sale_price, buyer: a.grantee },
        });
      }
    }
  } catch (e) { console.error("[electrical] assessor sales:", e); }

  // BSEED Trades Permits — Electrical Permits with owner name
  try {
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const where = encodeURIComponent(
      `permit_type = 'Electrical Permit' AND address IS NOT NULL AND issued_date >= '${since90}'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,permit_type,work_description,owner_name&resultRecordCount=50&orderByFields=issued_date+DESC&f=json`,
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
        const desc = (a.work_description || "").toLowerCase();
        const isPanel = /panel|service|upgrade|100 amp|200 amp|meter|disconnect/.test(desc);
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: isPanel ? "panel_upgrade_permit" : "renovation_electrical",
          signal_detail: `BSEED Electrical Permit: ${a.owner_name ?? "owner"} — ${a.work_description ?? "electrical work"} at ${addr}`,
          signal_date: a.issued_date ? a.issued_date.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: isPanel ? BASE_SCORES.panel_upgrade_permit : BASE_SCORES.renovation_electrical,
          source_method: "bseed_trades_permits_elec",
          suggested_opener: isPanel
            ? `You just permitted a ${a.work_description ?? "panel upgrade"} at ${addr} — while the service is being upgraded, it's an ideal time to add arc-fault breakers and ground-fault protection at no extra permit cost.`
            : `You have an open electrical permit at ${addr} — if you're adding circuits or outlets, we can often quote generator hookup and EV charger rough-in at the same time to save you a second permit fee.`,
          best_call_window: "While permit is active",
          estimated_value: isPanel ? 4500 : 2500,
          raw_source_data: { addr, zip, desc: a.work_description, owner: a.owner_name, issued: a.issued_date },
        });
      }
    }
  } catch (e) { console.error("[electrical] trades permits:", e); }

  // --- BSEED Residential CofC Expiring ---
  try {
    const where = encodeURIComponent(`num_days_until_expired <= 90 AND num_days_until_expired >= 0`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_residential_compliance_certificates/FeatureServer/0/query?where=${where}&outFields=address,zip_code,num_days_until_expired,expired_date&resultRecordCount=50&orderByFields=num_days_until_expired+ASC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const today = new Date().toISOString().split("T")[0];
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").trim();
        const zip = String(a.zip_code || "").trim();
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const daysLeft = a.num_days_until_expired ?? 90;
        const score = daysLeft <= 7 ? 9 : daysLeft <= 30 ? 8 : 7;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "cofc_electrical_inspection",
          signal_detail: `CofC expires in ${daysLeft} days — BSEED inspects smoke detectors, GFCI, and panel safety at renewal. ${addr} landlord needs electrical compliance`,
          signal_date: today,
          score,
          source_method: "bseed_cofc_expiring",
          suggested_opener: `Your rental at ${addr} has a Certificate of Compliance expiring in ${daysLeft} days — BSEED checks smoke detectors, GFCI outlets, and panel condition. We can do a pre-inspection electrical safety check so you pass on the first visit.`,
          best_call_window: "Immediately — renewal deadline",
          estimated_value: 3000,
          raw_source_data: { addr, zip, days_left: daysLeft, expires: a.expired_date },
        });
      }
    }
  } catch (e) { console.error("[electrical] cofc expiring:", e); }

  return signals;
}
