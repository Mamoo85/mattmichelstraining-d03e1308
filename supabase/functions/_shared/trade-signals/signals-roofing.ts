// Roofing Radar signal scanner.
// Sources: NOAA NWS Alerts (hail/wind), BSEED roof permits, FEMA disaster declarations.

export interface RawSignal {
  address: string;
  city: string;
  zip: string;
  signal_type: string;
  signal_detail: string;
  signal_date: string;
  score: number;
  source_method: string;
  suggested_opener: string;
  best_call_window: string;
  estimated_value: number;
  raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  hail_damage_area: 9,
  storm_wind_damage: 7,
  roof_permit_upsell: 6,
  fema_disaster: 8,
  new_homeowner_roof: 5,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  hail_damage_area: {
    opener: "Hi, I noticed your neighborhood was hit by hail recently — are you seeing any granule loss or interior leaks?",
    window: "Within 2 weeks of storm event",
  },
  storm_wind_damage: {
    opener: "We've been helping homeowners in your area after last week's wind storm — wanted to make sure you got a free inspection before insurance deadlines.",
    window: "Within 2 weeks of storm event",
  },
  roof_permit_upsell: {
    opener: "A neighbor at [address] just had roofwork done — we're in the area and can do a complimentary 10-minute inspection while we're here.",
    window: "Within 30 days of permit",
  },
  fema_disaster: {
    opener: "Your area was declared a federal disaster zone — FEMA and your homeowner's insurance may cover full roof replacement. Want a free assessment?",
    window: "Within 30 days of declaration",
  },
  new_homeowner_roof: {
    opener: "Congratulations on the new home! Most buyers don't think to get a roof inspection until it's too late — we offer a free 20-minute check so you know exactly what you're working with.",
    window: "Within 90 days of purchase close",
  },
};

const NWS_HAIL_EVENTS = ["Hail", "Tornado", "Thunderstorm Wind"];

export async function scanSignals(
  state = "MI",
  zipFilter?: string[],
): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. NOAA NWS Active Alerts (real-time, free, no key)
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?area=${state}&status=actual&urgency=Immediate,Expected`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)", Accept: "application/geo+json" } },
    );
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? []).slice(0, 50)) {
        const props = feat?.properties ?? {};
        const event: string = props.event ?? "";
        if (!NWS_HAIL_EVENTS.some((e) => event.includes(e))) continue;
        const areaDesc: string = props.areaDesc ?? "";
        const effective = (props.effective ?? props.onset ?? new Date().toISOString()).split("T")[0];
        const isHail = event.includes("Hail") || event.includes("Tornado");
        signals.push({
          address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
          city: areaDesc.split(",")[0]?.trim() ?? state,
          zip: "",
          signal_type: isHail ? "hail_damage_area" : "storm_wind_damage",
          signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 120) ?? ""}`,
          signal_date: effective,
          score: BASE_SCORES[isHail ? "hail_damage_area" : "storm_wind_damage"],
          source_method: "noaa_nws_alerts",
          suggested_opener: OPENERS[isHail ? "hail_damage_area" : "storm_wind_damage"].opener,
          best_call_window: OPENERS[isHail ? "hail_damage_area" : "storm_wind_damage"].window,
          estimated_value: 10000,
          raw_source_data: { event, areaDesc, effective },
        });
      }
    }
  } catch (e) { console.error("[roofing] NWS alerts:", e); }

  // 2. FEMA Disaster Declarations (free API, no key)
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq '${state}' and declarationDate ge '${since}'&$top=20`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const dec of (d?.DisasterDeclarationsSummaries ?? [])) {
        if (!dec.incidentType?.match(/Hurricane|Tornado|Severe Storm|Flood/i)) continue;
        signals.push({
          address: dec.designatedArea ?? dec.countyCode ?? state,
          city: dec.designatedArea?.split(" County")[0] ?? state,
          zip: "",
          signal_type: "fema_disaster",
          signal_detail: `FEMA DR-${dec.disasterNumber}: ${dec.incidentType} — ${dec.designatedArea}`,
          signal_date: dec.declarationDate?.split("T")[0] ?? since,
          score: BASE_SCORES.fema_disaster,
          source_method: "fema_api",
          suggested_opener: OPENERS.fema_disaster.opener,
          best_call_window: OPENERS.fema_disaster.window,
          estimated_value: 12000,
          raw_source_data: dec,
        });
      }
    }
  } catch (e) { console.error("[roofing] FEMA:", e); }

  // 3. BSEED building permits — roof keyword (service: bseed_building_permits)
  try {
    // amt_estimated_contractor_cost is esriFieldTypeString — numeric compare fails.
    // amt_permit_cost is esriFieldTypeDouble — safe for >= filter.
    const where = encodeURIComponent(`work_description LIKE '%ROOF%' AND amt_permit_cost >= 5000`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,work_description,amt_permit_cost,amt_estimated_contractor_cost,latitude,longitude&resultRecordCount=50&orderByFields=issued_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = a.zip_code ?? addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const cost = Number(a.amt_estimated_contractor_cost) || 8000;
        signals.push({
          address: addr,
          city: "Detroit",
          zip,
          signal_type: "roof_permit_upsell",
          signal_detail: `BSEED permit: ${(a.work_description ?? "").slice(0, 100)} — Est. $${a.amt_estimated_contractor_cost ?? "?"}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.roof_permit_upsell,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.roof_permit_upsell.opener.replace("[address]", addr),
          best_call_window: OPENERS.roof_permit_upsell.window,
          estimated_value: cost,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[roofing] BSEED:", e); }

  // 4. FFIEC HMDA — new homeowners as first-inspection targets
  try {
    const res = await fetch(
      `https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?states=${state}&years=2023&actions_taken=1&loan_purposes=1`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const rows: any[] = d?.aggregations ?? [];
      const total = rows.reduce((n, r) => n + (r.count || 0), 0);
      if (total > 0) {
        signals.push({
          address: `${state} — ${total.toLocaleString()} new purchase loans (2023)`,
          city: state,
          zip: "",
          signal_type: "new_homeowner_roof",
          signal_detail: `FFIEC HMDA: ${total.toLocaleString()} purchase loan originations in ${state} — new homeowners primed for first roof inspection`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.new_homeowner_roof,
          source_method: "ffiec_hmda",
          suggested_opener: OPENERS.new_homeowner_roof.opener,
          best_call_window: OPENERS.new_homeowner_roof.window,
          estimated_value: 9000,
          raw_source_data: { total, state, year: 2023 },
        });
      }
    }
  } catch (e) { console.error("[roofing] HMDA:", e); }

  // 5. NOAA SPC Daily Storm Reports — same-day hail/wind in MI
  try {
    const res = await fetch("https://www.spc.noaa.gov/climo/reports/today.csv", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (res.ok) {
      const csv = await res.text();
      let inWindSection = false;
      for (const line of csv.split("\n").slice(1)) {
        if (!line.trim()) continue;
        const parts = line.split(",");
        if (parts[0] === "Time") { inWindSection = true; continue; }
        if (parts[4]?.trim() !== "MI") continue;
        const isHail = !inWindSection;
        const sType = isHail ? "hail_damage_area" : "storm_wind_damage";
        const county = parts[3]?.trim() ?? "";
        signals.push({
          address: `${county} County, MI`, city: county, zip: "",
          signal_type: sType,
          signal_detail: `SPC storm report (today): ${isHail ? "hail" : "wind"} in ${county} County`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES[sType],
          source_method: "noaa_spc_reports",
          suggested_opener: OPENERS[sType].opener,
          best_call_window: OPENERS[sType].window,
          estimated_value: 10000,
          raw_source_data: { county, isHail, source: "spc_today" },
        });
      }
    }
  } catch (e) { console.error("[roofing] SPC today:", e); }

  // 6. NOAA SPC Archive — MI hail/wind last 14 days (unaddressed damage window)
  try {
    for (let daysAgo = 1; daysAgo <= 14; daysAgo++) {
      const dt = new Date(Date.now() - daysAgo * 86400_000);
      const yy = String(dt.getFullYear()).slice(2);
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const res = await fetch(`https://www.spc.noaa.gov/climo/reports/${yy}${mm}${dd}_rpts.csv`, {
        headers: { "User-Agent": "DWA-TradeRadar/1.0" },
      });
      if (!res.ok) continue;
      const csv = await res.text();
      const dateStr = dt.toISOString().split("T")[0];
      let inWind = false;
      let miHits = 0;
      for (const line of csv.split("\n").slice(1)) {
        if (!line.trim()) continue;
        const parts = line.split(",");
        if (parts[0] === "Time") { inWind = true; continue; }
        if (parts[4]?.trim() !== "MI") continue;
        if (miHits++ >= 3) break;
        const isHail = !inWind;
        const sType = isHail ? "hail_damage_area" : "storm_wind_damage";
        const county = parts[3]?.trim() ?? "";
        signals.push({
          address: `${county} County, MI`, city: county, zip: "",
          signal_type: sType,
          signal_detail: `SPC archive (${daysAgo}d ago): ${isHail ? "hail" : "wind"} in ${county} County — homes may have unaddressed damage`,
          signal_date: dateStr,
          score: Math.max(5, BASE_SCORES[sType] - Math.floor(daysAgo / 5)),
          source_method: "noaa_spc_archive",
          suggested_opener: OPENERS[sType].opener,
          best_call_window: OPENERS[sType].window,
          estimated_value: 10000,
          raw_source_data: { daysAgo, county, isHail },
        });
      }
    }
  } catch (e) { console.error("[roofing] SPC archive:", e); }

  // 7. CFPB HMDA Refinance Loans — equity-tapping homeowners = active renovation buyers
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
          signal_detail: `CFPB HMDA: ${total.toLocaleString()} refinance originations in ${state} (2023) — equity-flush homeowners are high-probability roofing buyers`,
          signal_date: new Date().toISOString().split("T")[0],
          score: 5,
          source_method: "ffiec_hmda",
          suggested_opener: "You recently refinanced — many homeowners use that equity for roofing that adds 5-10% to resale value. Want a free inspection?",
          best_call_window: "Within 90 days of refinance close",
          estimated_value: 10000,
          raw_source_data: { total, state, year: 2023, loan_purpose: "refinance" },
        });
      }
    }
  } catch (e) { console.error("[roofing] CFPB refi:", e); }

  // 8. NOAA SPC Day-1 Convective Outlook — severe thunderstorm / tornado risk polygons
  // This fires BEFORE the storm, enabling outreach while homeowner is already worried.
  try {
    const res = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? [])) {
        const props = feat?.properties ?? {};
        const label: string = props.LABEL2 ?? props.LABEL ?? "";
        // Only act on Slight Risk (SLGT) or higher — general tstm is too broad
        if (!["SLGT", "ENH", "MDT", "HIGH"].some((r) => props.LABEL?.includes(r))) continue;
        const valid = (props.VALID_ISO ?? new Date().toISOString()).slice(0, 10);
        signals.push({
          address: "Michigan region",
          city: state, zip: "",
          signal_type: "hail_damage_area",
          signal_detail: `NOAA SPC Day-1 Outlook: ${label} — severe thunderstorm/hail risk in next 24 hours. Pre-storm outreach window: reach homeowners before they start calling contractors post-storm`,
          signal_date: valid,
          score: BASE_SCORES.hail_damage_area + 1, // higher than archive — same-day pre-storm
          source_method: "noaa_spc_day1_outlook",
          suggested_opener: "Severe thunderstorm and hail risk is forecast for your area today — if a storm hits, roofing contractors are booked 4-6 weeks out. We're reserving inspection slots right now for homeowners who want priority scheduling.",
          best_call_window: "Before the storm event — 24-hour pre-storm window",
          estimated_value: 12000,
          raw_source_data: { label, valid, forecaster: props.FORECASTER },
        });
      }
    }
  } catch (e) { console.error("[roofing] SPC day-1:", e); }

  // 9. Detroit Assessor property sales — new homeowners in last 90 days
  try {
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`sale_date >= '${cutoff}' AND amt_sale_price > 10000`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${where}&outFields=address,zip_code,sale_date,amt_sale_price,grantee&resultRecordCount=40&orderByFields=sale_date+DESC&f=json`,
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
          signal_type: "new_homeowner_roof",
          signal_detail: `Detroit property sale: ${a.grantee ?? "New owner"} purchased for $${(a.amt_sale_price || 0).toLocaleString()} — new homeowners in older Detroit homes have unaddressed roof issues from previous owner`,
          signal_date: a.sale_date ? new Date(a.sale_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessor_sales",
          suggested_opener: "Congratulations on your new home — most buyers don't get a roof inspection during the sale process and discover issues within the first year. We offer a free 30-minute inspection for new homeowners.",
          best_call_window: "Within 90 days of purchase",
          estimated_value: 12000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[roofing] assessor sales:", e); }

  return signals;
}
