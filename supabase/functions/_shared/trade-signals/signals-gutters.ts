// Gutters Radar signal scanner.
// Sources: BSEED roof permits (upsell window), NOAA storm events.
// Natural complement to Roofing Radar — same permit scan, different client.

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  roof_permit_upsell: 8,
  storm_gutter_damage: 7,
  fema_gutter_damage: 8,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  roof_permit_upsell: {
    opener: "We noticed a roofing permit was just pulled at your address — most contractors don't mention it, but new roofs void their warranty without matching gutters. We can have yours replaced same week for less than you'd expect.",
    window: "Within 21 days of roof permit",
  },
  storm_gutter_damage: {
    opener: "The storm this week is the #1 cause of gutter failures in Michigan — we're in your neighborhood doing inspections and can take a quick look at no charge.",
    window: "Within 10 days of storm event",
  },
  fema_gutter_damage: {
    opener: "Your area received a FEMA disaster declaration — storm-damaged gutters are one of the most overlooked items on insurance claims. We can assess and document yours at no charge.",
    window: "Within 30 days of declaration",
  },
};

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. BSEED building permits — roof keyword = gutter upsell window (service: bseed_building_permits)
  try {
    const where = encodeURIComponent(`(work_description LIKE '%ROOF%' OR work_description LIKE '%GUTTER%')`);
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
          signal_type: "roof_permit_upsell",
          signal_detail: `Roof permit pulled: ${(a.work_description ?? "").slice(0, 80)} — gutter upsell window open`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.roof_permit_upsell,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.roof_permit_upsell.opener,
          best_call_window: OPENERS.roof_permit_upsell.window,
          estimated_value: 2000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[gutters] BSEED:", e); }

  // 2. NOAA storm events (wind/rain/ice)
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
        if (!["Wind", "Rain", "Ice", "Hail", "Flood"].some((e) => event.includes(e))) continue;
        const areaDesc: string = props.areaDesc ?? "";
        const effective = (props.effective ?? props.onset ?? new Date().toISOString()).split("T")[0];
        signals.push({
          address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
          city: areaDesc.split(",")[0]?.trim() ?? state,
          zip: "",
          signal_type: "storm_gutter_damage",
          signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 100) ?? ""}`,
          signal_date: effective,
          score: BASE_SCORES.storm_gutter_damage,
          source_method: "noaa_nws_alerts",
          suggested_opener: OPENERS.storm_gutter_damage.opener,
          best_call_window: OPENERS.storm_gutter_damage.window,
          estimated_value: 1800,
          raw_source_data: { event, areaDesc },
        });
      }
    }
  } catch (e) { console.error("[gutters] NWS:", e); }

  // 3. FEMA disaster declarations (storm damage → gutter insurance claims)
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq '${state}' and declarationDate ge '${since}'&$top=10`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const dec of (d?.DisasterDeclarationsSummaries ?? [])) {
        if (!dec.incidentType?.match(/Hurricane|Tornado|Severe Storm|Flood|Wind/i)) continue;
        signals.push({
          address: dec.designatedArea ?? state,
          city: dec.designatedArea?.split(" County")[0] ?? state,
          zip: "",
          signal_type: "fema_gutter_damage",
          signal_detail: `FEMA DR-${dec.disasterNumber}: ${dec.incidentType} — ${dec.designatedArea}`,
          signal_date: dec.declarationDate?.split("T")[0] ?? since,
          score: BASE_SCORES.fema_gutter_damage,
          source_method: "fema_api",
          suggested_opener: OPENERS.fema_gutter_damage.opener,
          best_call_window: OPENERS.fema_gutter_damage.window,
          estimated_value: 2200,
          raw_source_data: dec,
        });
      }
    }
  } catch (e) { console.error("[gutters] FEMA:", e); }

  // 4. CFPB HMDA Refinance Loans — homeowners with equity fund gutter/exterior upgrades
  try {
    const res = await fetch(
      `https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?states=${state}&years=2023&actions_taken=1&loan_purposes=3`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const total = (d?.aggregations ?? []).reduce((n: number, r: any) => n + (r.count || 0), 0);
      if (total > 0) {
        signals.push({
          address: `${state} — ${total.toLocaleString()} refinances (2023)`,
          city: state, zip: "",
          signal_type: "homeowner_equity_area",
          signal_detail: `CFPB HMDA: ${total.toLocaleString()} refinance originations in ${state} (2023) — equity-flush homeowners frequently bundle gutter/roof work`,
          signal_date: new Date().toISOString().split("T")[0],
          score: 5,
          source_method: "ffiec_hmda",
          suggested_opener: "You recently refinanced — many homeowners use that equity to handle deferred gutter work before small blockages become $5,000 fascia and soffit problems. Want a free inspection?",
          best_call_window: "Within 90 days of refinance close",
          estimated_value: 2000,
          raw_source_data: { total, state, year: 2023, loan_purpose: "refinance" },
        });
      }
    }
  } catch (e) { console.error("[gutters] CFPB refi:", e); }

  // 5. Detroit Parcel Data — pre-1960 homes with no gutters replaced in 60+ years
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/parcel_file_current/FeatureServer/0/query?where=year_built+<+1960+AND+year_built+>+1880&outFields=address,zip_code,year_built&resultRecordCount=30&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const count = d?.features?.length ?? 0;
      if (count > 0) {
        const oldest = d.features.reduce((m: any, f: any) =>
          (f.attributes?.year_built ?? 9999) < (m.attributes?.year_built ?? 9999) ? f : m, d.features[0]);
        const a = oldest.attributes;
        signals.push({
          address: `Detroit — ${count} sampled parcels built before 1960`,
          city: "Detroit", zip: "",
          signal_type: "roof_permit_upsell",
          signal_detail: `Detroit parcel data: ${count} sample pre-1960 homes in query — oldest at ${a.address} (built ${a.year_built}). Gutters on 60+ year old homes are almost always undersized or blocked`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.roof_permit_upsell - 1,
          source_method: "detroit_parcel_arcgis",
          suggested_opener: "Your home was built before 1960 — most gutters on homes this age are undersized for modern rain events and clogged with decades of debris. We're doing free inspections in your area.",
          best_call_window: "Evergreen — pre-1960 homes always need gutter work",
          estimated_value: 2000,
          raw_source_data: { count, oldest_address: a.address, oldest_year: a.year_built },
        });
      }
    }
  } catch (e) { console.error("[gutters] parcel:", e); }

  // 6. NOAA SPC Day-1 Outlook — severe weather clogs and damages gutters overnight
  try {
    const res = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? [])) {
        const props = feat?.properties ?? {};
        if (!["SLGT", "ENH", "MDT", "HIGH"].some((r) => props.LABEL?.includes(r))) continue;
        const label: string = props.LABEL2 ?? props.LABEL ?? "";
        const valid = (props.VALID_ISO ?? new Date().toISOString()).slice(0, 10);
        signals.push({
          address: "Michigan region",
          city: state, zip: "",
          signal_type: "storm_gutter_damage",
          signal_detail: `NOAA SPC Day-1 Outlook: ${label} — severe storm forecast. Heavy rain + debris flow is the leading cause of gutter failures. Outreach before the storm prevents emergency calls`,
          signal_date: valid,
          score: BASE_SCORES.storm_gutter_damage + 1,
          source_method: "noaa_spc_day1_outlook",
          suggested_opener: OPENERS.storm_gutter_damage.opener,
          best_call_window: OPENERS.storm_gutter_damage.window,
          estimated_value: 2000,
          raw_source_data: { label, valid, forecaster: props.FORECASTER },
        });
      }
    }
  } catch (e) { console.error("[gutters] SPC day-1:", e); }

  // 7. Detroit Assessor property sales — new homeowners discover neglected gutters
  try {
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`sale_date >= '${cutoff}' AND amt_sale_price > 10000`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${where}&outFields=address,zip_code,sale_date,grantee&resultRecordCount=25&orderByFields=sale_date+DESC&f=json`,
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
          signal_type: "roof_permit_upsell",
          signal_detail: `Detroit property sale: ${a.grantee ?? "New owner"} — gutters are the most frequently deferred maintenance item on older Detroit homes`,
          signal_date: a.sale_date ? new Date(a.sale_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessor_sales",
          suggested_opener: "Congratulations on your new home — gutters are the most overlooked item during home inspections. A clogged or damaged gutter causes $5k+ in fascia and foundation damage. Free inspection for new homeowners this month.",
          best_call_window: "Within 90 days of purchase",
          estimated_value: 2000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[gutters] assessor sales:", e); }

  // 8. BSEED Occupancy Certificates — recently completed major renovations trigger neighborhood attention
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_occupancy_certificates/FeatureServer/0/query?where=task_status+%3D+'Completed'&outFields=address,zip_code,issued_date,permit_type,work_description,construction_type&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "roof_permit_upsell",
          signal_detail: `BSEED Occupancy Certificate: ${addr} — completed ${(a.work_description ?? a.permit_type ?? "renovation").slice(0, 80)}. New occupancy = visible renovation on the block; neighbors notice and want the same curb appeal improvement`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "bseed_occupancy_certs",
          suggested_opener: "A home on your block just completed a full renovation and received a new occupancy certificate — we're in the neighborhood offering assessments to adjacent homeowners on the same permit cycle.",
          best_call_window: "Within 45 days of occupancy certificate issuance",
          estimated_value: 2000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[gutters] occupancy certs:", e); }

  // 7. Detroit Assessment Roll 2026 — recently sold pre-1970 homes (old gutters/fascia)
  try {
    const since = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/tentative_assessment_roll_2026/FeatureServer/0/query?where=sale_date+%3E%3D+'${since}'+AND+residential_year_built+%3C+1970+AND+residential_year_built+%3E+1880+AND+is_improved+%3D+1&outFields=address,zip_code,residential_year_built,sale_date,taxpayer_1&resultRecordCount=40&orderByFields=sale_date+DESC&f=json`,
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
          signal_type: "roof_permit_upsell",
          signal_detail: `Detroit new owner: ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — pre-1970 homes have original galvanized steel gutters that are corroded and disconnected. New owners rarely realize gutters are the #1 cause of basement flooding`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Welcome to ${addr}! Homes built in ${yrBuilt} have original gutters that are almost certainly failing — the leading cause of the basement flooding issues Detroit homeowners discover after the first big rain. Free inspection this week?`,
          best_call_window: "Within 90 days of purchase, or before first heavy rain season",
          estimated_value: 2200,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[gutters] Detroit assessment roll:", e); }

  // New: Multifamily Construction — new builds need complete gutter/downspout systems
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/multifamily_housing_construction_sites/FeatureServer/0/query?where=construction_status+IN+('Under+Construction','Construction+Not+Started')&outFields=address,zip_code,owner_developer_name,legal_entity,total_units,construction_status&resultRecordCount=30&orderByFields=OBJECTID+DESC&f=json",
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
          signal_type: "roof_permit_upsell",
          signal_detail: `Multifamily construction: ${addr} (${units} units, ${a.construction_status}) — ${developer}. New multifamily requires full commercial gutter and downspout system to meet city drainage requirements`,
          signal_date: new Date().toISOString().split("T")[0],
          score: units >= 20 ? BASE_SCORES.roof_permit_upsell + 1 : BASE_SCORES.roof_permit_upsell,
          source_method: "multifamily_construction_sites",
          suggested_opener: `We saw ${addr} is under construction — ${units} units of new multifamily requires a commercial-grade gutter and drainage system. Are you taking bids on the exterior drainage package?`,
          best_call_window: "Late construction phase — exterior close-in",
          estimated_value: units * 800,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[gutters] multifamily construction:", e); }

  // Historic District Violations — open cases with roof/gutter/chimney flags
  try {
    const where = encodeURIComponent(`case_status = 'Open' AND has_roof_gutter_chimney_violati = 'True'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Historic_District_Violations/FeatureServer/0/query?where=${where}&outFields=address,zip_code,intake_date,historic_district,violation_scope&resultRecordCount=25&orderByFields=OBJECTID+DESC&f=json`,
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
        const district = a.historic_district || "Detroit historic district";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "roof_permit_upsell",
          signal_detail: `Historic District Violation (Open): ${addr} in ${district} — roof/gutter violation. Gutters in historic districts must match the period aesthetic; improper materials can result in additional violations`,
          signal_date: a.intake_date ? String(a.intake_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 8,
          source_method: "historic_district_violations",
          suggested_opener: `Your property at ${addr} in ${district} has an open city violation that includes gutters — historic district compliance requires approved materials and contractors. We specialize in historic gutter replacement and can get the violation closed fast.`,
          best_call_window: "Any time — open violation creates compliance urgency",
          estimated_value: 4000,
          raw_source_data: { addr, zip, district, scope: a.violation_scope },
        });
      }
    }
  } catch (e) { console.error("[gutters] historic violations:", e); }

  return signals;
}
