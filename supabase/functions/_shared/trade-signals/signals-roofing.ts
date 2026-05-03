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

  // 10. BSEED Occupancy Certificates — completed renovations = adjacent homes need same roof work
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_occupancy_certificates/FeatureServer/0/query?where=task_status+%3D+'Completed'+AND+(work_description+LIKE+'%25ROOF%25'+OR+work_description+LIKE+'%25REROOF%25'+OR+permit_type+LIKE+'%25ROOF%25')&outFields=address,zip_code,issued_date,work_description,permit_type&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json",
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
          signal_detail: `BSEED Occupancy: roof work completed at ${addr} — neighboring homes on the same block/era were built at the same time and have the same remaining roof life`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "bseed_occupancy_certs",
          suggested_opener: "A home on your block just had a full roof replacement. Homes built in the same era have the same roof life — we're doing free block inspections this week while our crew is in the area.",
          best_call_window: "Within 30 days of occupancy certificate",
          estimated_value: 12000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[roofing] occupancy certs:", e); }

  // 11. BSEED Acceptance Certificates (CofA) — just-completed renovations trigger neighborhood demand
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/acceptance_certificates/FeatureServer/0/query?where=task_status+%3D+'CofA+Issued'+AND+is_residential+%3D+'True'&outFields=address,zip_code,issued_date,record_type&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json",
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
          signal_detail: `BSEED Certificate of Acceptance: ${addr} — full renovation completion certificate issued (${(a.record_type ?? "permit").replace("Building Permit", "").trim()}). Neighbors on the same block with same-era homes now see their roof by comparison`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "bseed_cofa",
          suggested_opener: "A home on your block just completed a full renovation and received a certificate of acceptance — we're offering free roof assessments to neighbors while our crew is in the area.",
          best_call_window: "Within 30 days of CofA issuance",
          estimated_value: 12000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[roofing] CofA:", e); }

  // 12. NOAA CDO Historical Hail Events — Wayne/Oakland/Macomb counties (past 12 months)
  // Uses existing NOAA_API_KEY. WT09 = hail occurred on that date.
  try {
    const noaaKey = Deno.env.get("NOAA_API_KEY");
    if (noaaKey) {
      const twelveMonthsAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const counties = [
        { fips: "FIPS:26163", name: "Wayne County" },
        { fips: "FIPS:26125", name: "Oakland County" },
        { fips: "FIPS:26099", name: "Macomb County" },
      ];
      let hailDays = 0;
      const hailCounties: string[] = [];
      for (const county of counties) {
        const res = await fetch(
          `https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&locationid=${county.fips}&datatypeid=WT09&startdate=${twelveMonthsAgo}&enddate=${today}&limit=100`,
          { headers: { token: noaaKey, "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
        );
        if (res.ok) {
          const d = await res.json();
          const results: any[] = d?.results ?? [];
          const days = results.filter((r) => r.value === 1 || r.value === "1").length;
          if (days > 0) { hailDays += days; hailCounties.push(`${county.name} (${days} days)`); }
        }
      }
      if (hailDays > 0) {
        signals.push({
          address: `SE Michigan — ${hailDays} hail days in past 12 months`,
          city: state, zip: "",
          signal_type: "hail_damage_area",
          signal_detail: `NOAA CDO: ${hailCounties.join("; ")} — hail events in past year leave unaddressed damage on roofs not inspected post-storm`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.hail_damage_area,
          source_method: "noaa_cdo_historical",
          suggested_opener: "SE Michigan had multiple hail events this past year — many homeowners had minor damage that wasn't worth an insurance claim but is accelerating roof wear. We do free damage assessments.",
          best_call_window: "Evergreen — historical hail creates ongoing demand",
          estimated_value: 12000,
          raw_source_data: { hail_days: hailDays, counties: hailCounties },
        });
      }
    }
  } catch (e) { console.error("[roofing] NOAA CDO:", e); }

  // 13. Wayne County Parcel Sales — recently sold suburban Wayne County properties (non-Detroit)
  // New owner + house built pre-1980 in Dearborn/Livonia/Plymouth/Canton = roof inspection opportunity
  try {
    const since180 = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://utility.waynecountymi.gov/arcgis/rest/services/Property/FeatureServer/0/query?where=SALE_DATE+%3E%3D+DATE+%27${since180}%27+AND+YEAR_BUILT+%3C+1990&outFields=ADDRESS,ZIPCODE,YEAR_BUILT,SALE_DATE,OWNER_NAME&resultRecordCount=60&orderByFields=SALE_DATE+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.ADDRESS ?? "";
        const zip: string = String(a.ZIPCODE ?? "").replace(/[^0-9]/g, "").slice(0, 5);
        if (!addr || addr.length < 5) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const yearBuilt: number = a.YEAR_BUILT ?? 0;
        const saleDate: string = a.SALE_DATE ? String(a.SALE_DATE).slice(0, 10) : new Date().toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Wayne County", zip,
          signal_type: "roof_permit_upsell",
          signal_detail: `Wayne County new owner: ${addr} sold ${saleDate}. Home built ${yearBuilt > 0 ? yearBuilt : "pre-1990"} — new owner likely hasn't inspected a roof that's 35+ years old`,
          signal_date: saleDate,
          score: yearBuilt < 1970 ? BASE_SCORES.new_homeowner_roof + 1 : BASE_SCORES.new_homeowner_roof,
          source_method: "wayne_county_parcel",
          suggested_opener: `Welcome to the neighborhood! You recently purchased the home at ${addr} — homes of that vintage typically need a professional roof inspection to identify any hidden wear. We offer a free 30-minute inspection.`,
          best_call_window: "Within 90 days of purchase",
          estimated_value: 12000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[roofing] Wayne County parcel:", e); }

  // 14. Oakland County Parcel Sales — recently sold Oakland County properties
  try {
    const since180 = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://www.oakgov.com/egis/rest/services/Property/ParcelInfo/FeatureServer/0/query?where=SALE_DATE+%3E%3D+DATE+%27${since180}%27+AND+YEAR_BUILT+%3C+1990&outFields=SITUS_ADDRESS,ZIP,YEAR_BUILT,SALE_DATE&resultRecordCount=60&orderByFields=SALE_DATE+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.SITUS_ADDRESS ?? "";
        const zip: string = String(a.ZIP ?? "").replace(/[^0-9]/g, "").slice(0, 5);
        if (!addr || addr.length < 5) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const yearBuilt: number = a.YEAR_BUILT ?? 0;
        const saleDate: string = a.SALE_DATE ? String(a.SALE_DATE).slice(0, 10) : new Date().toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Oakland County", zip,
          signal_type: "roof_permit_upsell",
          signal_detail: `Oakland County new owner: ${addr} sold ${saleDate}. Home built ${yearBuilt > 0 ? yearBuilt : "pre-1990"} — new owner likely hasn't inspected a roof that's 35+ years old`,
          signal_date: saleDate,
          score: yearBuilt < 1970 ? BASE_SCORES.new_homeowner_roof + 1 : BASE_SCORES.new_homeowner_roof,
          source_method: "oakland_county_parcel",
          suggested_opener: `Welcome to the neighborhood! You recently purchased the home at ${addr} — homes of that vintage typically need a professional roof inspection. We offer a free 30-minute assessment with no obligation.`,
          best_call_window: "Within 90 days of purchase",
          estimated_value: 12000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[roofing] Oakland County parcel:", e); }

  // 15. Detroit Assessment Roll 2026 — recently sold pre-1980 Detroit homes
  try {
    const since = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/tentative_assessment_roll_2026/FeatureServer/0/query?where=sale_date+%3E%3D+'${since}'+AND+residential_year_built+%3C+1980+AND+residential_year_built+%3E+1880+AND+is_improved+%3D+1&outFields=address,zip_code,residential_year_built,sale_date,taxpayer_1&resultRecordCount=50&orderByFields=sale_date+DESC&f=json`,
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
        const roofAge = 2026 - yrBuilt;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "roof_permit_upsell",
          signal_detail: `Detroit new owner: ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — roof is approximately ${roofAge} years old. New owners of pre-1980 Detroit homes routinely discover aging shingles, failed flashing, and storm damage in the first inspection`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: BASE_SCORES.roof_permit_upsell + (yrBuilt < 1960 ? 2 : 1),
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Congrats on ${addr}! Built ${yrBuilt} means the roof has seen 45+ winters — a free inspection takes 20 minutes and can catch water damage before your first spring. Want to schedule this week?`,
          best_call_window: "Within 90 days of purchase",
          estimated_value: 12000,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[roofing] Detroit assessment roll:", e); }

  // 16. Multifamily Construction Sites — new builds need full roofing packages
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
          signal_type: "roof_permit_upsell",
          signal_detail: `Multifamily construction site: ${addr} (${units} units, ${a.construction_status}) — ${developer}. New multifamily construction requires full commercial roofing installation and inspection`,
          signal_date: new Date().toISOString().split("T")[0],
          score: units >= 20 ? BASE_SCORES.roof_permit_upsell + 2 : BASE_SCORES.roof_permit_upsell + 1,
          source_method: "multifamily_construction_sites",
          suggested_opener: `We saw ${addr} is in active construction — ${units}-unit multifamily projects require commercial roofing specs and installation. Have you sourced a roofing contractor for this build?`,
          best_call_window: "During construction — pre-sheathing to close-in phase",
          estimated_value: units * 4000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[roofing] multifamily construction:", e); }

  // 17. ROW Permits (utility work) — disrupted roof penetrations = inspection opportunity
  try {
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/ROW_Permits/FeatureServer/0/query?where=issued_date+%3E%3D+%27${since90}%27+AND+(description+LIKE+%27%25DTE+Energy%25%27+OR+description+LIKE+%27%25gas%25%27+OR+description+LIKE+%27%25utility%25%27)&outFields=permit_address,permit_type,issued_date,description,contractor&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.permit_address || "").trim();
        if (!addr || addr.length < 5) continue;
        const issued = a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0];
        const desc = (a.description || "").slice(0, 100);
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "roof_permit_upsell",
          signal_detail: `ROW utility permit at ${addr}: ${desc}. Utility work near a property often requires roof penetration access and can expose pre-existing roof damage homeowners weren't aware of`,
          signal_date: issued,
          score: BASE_SCORES.roof_permit_upsell - 1,
          source_method: "row_permits",
          suggested_opener: `Utility work was permitted on your block recently — when crews are in the area working near rooflines, it's a good time to check for any unsealed penetrations or damage. We're doing free block inspections this week.`,
          best_call_window: "Within 30 days of ROW permit",
          estimated_value: 8000,
          raw_source_data: { addr, permit_type: a.permit_type, issued, contractor: a.contractor },
        });
      }
    }
  } catch (e) { console.error("[roofing] ROW permits:", e); }

  // 17. NOAA SPC Day-2 Convective Outlook — 48-hour pre-storm outreach window
  try {
    const res = await fetch("https://www.spc.noaa.gov/products/outlook/day2otlk_cat.nolyr.geojson", {
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
          signal_type: "hail_damage_area",
          signal_detail: `NOAA SPC Day-2 Outlook: ${label} — severe thunderstorm/hail risk in 24–48 hours. Two-day window gives roofing contractors the longest pre-booking lead time`,
          signal_date: valid,
          score: BASE_SCORES.hail_damage_area,
          source_method: "noaa_spc_day2_outlook",
          suggested_opener: "Hail and severe weather is in the 48-hour forecast for your area — we're filling pre-storm inspection slots now. Contractors get slammed after a storm; locking in early saves you weeks of wait time.",
          best_call_window: "48-hour pre-storm window",
          estimated_value: 12000,
          raw_source_data: { label, valid },
        });
      }
    }
  } catch (e) { console.error("[roofing] SPC day-2:", e); }

  // 18. BSEED Presale Inspections — FAIL results (seller must repair before closing)
  try {
    const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`(inspection_result = 'FAIL' OR inspection_result = '***Failed Insp') AND inspection_date >= '${since}'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_presale_inspections/FeatureServer/0/query?where=${where}&outFields=address,zip_code,inspection_date,inspection_result&resultRecordCount=30&orderByFields=inspection_date+DESC&f=json`,
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
          signal_type: "roof_permit_upsell",
          signal_detail: `Detroit presale inspection FAILED: ${addr} (${a.inspection_date ?? "recent"}) — property failed city inspection before sale. Seller must remediate to close; roof condition is commonly cited`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 9,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — roofing deficiencies are one of the most common reasons Detroit homes fail. We can assess and repair fast so you don't lose the buyer. Free inspection this week.`,
          best_call_window: "Within 14 days of fail — seller has closing deadline",
          estimated_value: 12000,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[roofing] presale inspections:", e); }

  // 19. Detroit Historic District Violations — open cases with roof/gutter/chimney flags
  try {
    const where = encodeURIComponent(`case_status = 'Open' AND has_roof_gutter_chimney_violati = 'True'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Historic_District_Violations/FeatureServer/0/query?where=${where}&outFields=address,zip_code,intake_date,historic_district,violation_scope&resultRecordCount=30&orderByFields=OBJECTID+DESC&f=json`,
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
          signal_detail: `Detroit Historic District Violation (Open): ${addr} in ${district} — roof/gutter/chimney violation. Historic district repairs require certified contractors and period-appropriate materials`,
          signal_date: a.intake_date ? String(a.intake_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.roof_permit_upsell + 2,
          source_method: "historic_district_violations",
          suggested_opener: `Your property at ${addr} is in ${district} and has an open city violation for roof or chimney — historic district compliance requires an approved contractor. We're certified for historic restoration work and can close the violation quickly.`,
          best_call_window: "Any time — open violation creates compliance urgency",
          estimated_value: 15000,
          raw_source_data: { addr, zip, district, scope: a.violation_scope },
        });
      }
    }
  } catch (e) { console.error("[roofing] historic violations:", e); }

  // 20. BSEED Plan Reviews — approved roof plans (job is definitely happening, target before bid is placed)
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%ROOF%' OR work_description LIKE '%RE-ROOF%' OR work_description LIKE '%REROOFING%') AND task_status LIKE '%Approved%'`,
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
          signal_type: "roof_permit_upsell",
          signal_detail: `BSEED plan review approved: ${(a.work_description ?? "roof project").slice(0, 100)} — plans approved means a permit is imminent and work will start within days`,
          signal_date: a.submitted_date ? new Date(a.submitted_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.roof_permit_upsell + 3,
          source_method: "bseed_plan_reviews",
          suggested_opener: `Your roof project at ${addr} just got plans approved — we can often slot in same-week once permitting clears. Want a parallel quote before the contractor order is finalized?`,
          best_call_window: "Immediately — plans approved means permit will be pulled within days",
          estimated_value: 12000,
          raw_source_data: { addr, zip, desc: a.work_description, status: a.task_status },
        });
      }
    }
  } catch (e) { console.error("[roofing] plan reviews:", e); }

  return signals;
}
