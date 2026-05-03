// Tree Service Radar signal scanner.
// Sources: NOAA NWS wind/storm alerts (area), FEMA disasters (area),
// BSEED tree-removal/stump permits (per-address),
// SeeClickFix 311 tree service requests (request_type=6636, per-address).

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  tree_hazard_area: 8,
  fema_disaster: 7,
  tree_removal_permit: 9,
  tree_311_request: 7,
  storm_tree_damage: 8,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  tree_hazard_area: {
    opener: "The storm this week knocked down trees all over your neighborhood — we're doing free hazard assessments in your area while our crew is already nearby.",
    window: "Within 5 days of storm event",
  },
  fema_disaster: {
    opener: "Your area was declared a federal disaster zone — downed trees and storm debris qualify for FEMA assistance. We can assess, document, and clear yours this week.",
    window: "Within 30 days of declaration",
  },
  tree_removal_permit: {
    opener: "A neighbor at your address just pulled a tree removal permit — while our crew is in the area, we're offering free hazard assessments on surrounding properties.",
    window: "Within 14 days of permit",
  },
  tree_311_request: {
    opener: "We saw a tree service request was filed for your street — we're already scheduled in the area and can add your property to today's route.",
    window: "Within 7 days of request",
  },
  storm_tree_damage: {
    opener: "High winds this week are the #1 cause of tree failure in Michigan. A free 10-minute visual check now prevents a $10k emergency call at 2am.",
    window: "Within 7 days of storm event",
  },
};

const TREE_WEATHER_EVENTS = [
  "High Wind", "Wind Advisory", "Severe Thunderstorm", "Tornado", "Ice Storm", "Winter Storm", "Blizzard",
];

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. NOAA NWS — high-wind / severe storm alerts (tree hazard area signal)
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?area=${state}&status=actual`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)", Accept: "application/geo+json" } },
    );
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? []).slice(0, 40)) {
        const props = feat?.properties ?? {};
        const event: string = props.event ?? "";
        if (!TREE_WEATHER_EVENTS.some((e) => event.includes(e))) continue;
        const areaDesc: string = props.areaDesc ?? "";
        const effective = (props.effective ?? props.onset ?? new Date().toISOString()).split("T")[0];
        const isWind = event.includes("Wind") || event.includes("Thunderstorm");
        signals.push({
          address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
          city: areaDesc.split(",")[0]?.trim() ?? state,
          zip: "",
          signal_type: isWind ? "storm_tree_damage" : "tree_hazard_area",
          signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 120) ?? ""}`,
          signal_date: effective,
          score: BASE_SCORES[isWind ? "storm_tree_damage" : "tree_hazard_area"],
          source_method: "noaa_nws_alerts",
          suggested_opener: OPENERS[isWind ? "storm_tree_damage" : "tree_hazard_area"].opener,
          best_call_window: OPENERS[isWind ? "storm_tree_damage" : "tree_hazard_area"].window,
          estimated_value: 1800,
          raw_source_data: { event, areaDesc, effective },
        });
      }
    }
  } catch (e) { console.error("[tree] NWS:", e); }

  // 2. FEMA disaster declarations (storms/ice/wind → tree damage)
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq '${state}' and declarationDate ge '${since}'&$top=15`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const dec of (d?.DisasterDeclarationsSummaries ?? [])) {
        if (!dec.incidentType?.match(/Hurricane|Tornado|Severe Storm|Ice|Winter|Wind/i)) continue;
        signals.push({
          address: dec.designatedArea ?? state,
          city: dec.designatedArea?.split(" County")[0] ?? state,
          zip: "",
          signal_type: "fema_disaster",
          signal_detail: `FEMA DR-${dec.disasterNumber}: ${dec.incidentType} — ${dec.designatedArea}`,
          signal_date: dec.declarationDate?.split("T")[0] ?? since,
          score: BASE_SCORES.fema_disaster,
          source_method: "fema_api",
          suggested_opener: OPENERS.fema_disaster.opener,
          best_call_window: OPENERS.fema_disaster.window,
          estimated_value: 2500,
          raw_source_data: dec,
        });
      }
    }
  } catch (e) { console.error("[tree] FEMA:", e); }

  // 3. BSEED permits with TREE/STUMP keyword — per-address.
  // Note: TRIM is intentionally excluded — it matches "exterior trim" not tree trimming.
  try {
    const where = encodeURIComponent(`(work_description LIKE '%TREE%' OR work_description LIKE '%STUMP%')`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,work_description,latitude,longitude&resultRecordCount=40&orderByFields=issued_date+DESC&f=json`,
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
          signal_type: "tree_removal_permit",
          signal_detail: `BSEED permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.tree_removal_permit,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.tree_removal_permit.opener,
          best_call_window: OPENERS.tree_removal_permit.window,
          estimated_value: 2000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[tree] BSEED:", e); }

  // 4. SeeClickFix 311 — Detroit tree service requests (request_type=6636).
  // Replaces defunct Detroit Open Data Socrata endpoint (redirects to ArcGIS Hub HTML).
  try {
    const res = await fetch(
      `https://seeclickfix.com/api/v2/issues?request_types=6636&place_url=detroit&per_page=30&sort=created_at&direction=desc`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)", "Accept": "application/json" } },
    );
    if (res.ok) {
      const data = await res.json();
      const issues: any[] = data?.issues ?? [];
      for (const issue of issues) {
        const fullAddr: string = issue.address ?? "";
        if (!fullAddr) continue;
        // Address format: "1234 Main St Detroit, Michigan, 48208" or "...Detroit, MI, 48208, USA"
        const zipMatch = fullAddr.match(/\b(4[0-9]{4})\b/);
        const zip = zipMatch?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        // Strip state/country suffix to get street address
        const addr = fullAddr.split(",")[0]?.trim() ?? fullAddr;
        signals.push({
          address: addr,
          city: "Detroit",
          zip,
          signal_type: "tree_311_request",
          signal_detail: `SeeClickFix 311: ${issue.summary ?? "Tree service request"} — ${issue.status ?? "open"}`,
          signal_date: issue.created_at ? issue.created_at.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.tree_311_request,
          source_method: "seeclickfix_311",
          suggested_opener: OPENERS.tree_311_request.opener,
          best_call_window: OPENERS.tree_311_request.window,
          estimated_value: 1500,
          raw_source_data: { id: issue.id, address: fullAddr, status: issue.status, url: issue.html_url },
        });
      }
    }
  } catch (e) { console.error("[tree] SeeClickFix 311:", e); }

  // 5. NOAA SPC Daily Storm Reports — high-wind and tornado events = tree damage
  try {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const yy = String(today.getFullYear()).slice(2);
    const mm = pad(today.getMonth() + 1);
    const dd = pad(today.getDate());
    const csvUrl = `https://www.spc.noaa.gov/climo/reports/${yy}${mm}${dd}_rpts.csv`;
    const csvRes = await fetch(csvUrl, { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } });
    if (csvRes.ok) {
      const text = await csvRes.text();
      const lines = text.split("\n").slice(1);
      let inWind = false;
      for (const line of lines) {
        const parts = line.split(",");
        if (parts[0]?.trim() === "Time") { inWind = true; continue; }
        if (!inWind) continue;
        if (parts[4]?.trim() !== "MI") continue;
        const speed = Number(parts[1]) || 0;
        if (speed < 58) continue; // EF1+ equivalent (58 mph+ for tree damage)
        const lat = Number(parts[5]); const lon = Number(parts[6]);
        signals.push({
          address: `${parts[3]?.trim() ?? "MI"} County — ${speed} mph wind report`,
          city: parts[3]?.trim() ?? state, zip: "",
          signal_type: "storm_tree_damage",
          signal_detail: `NOAA SPC wind report: ${speed} mph wind in ${parts[3]?.trim() ?? "MI"} County — high-wind events cause significant tree damage requiring immediate removal`,
          signal_date: today.toISOString().split("T")[0],
          score: Math.min(9, BASE_SCORES.storm_tree_damage + (speed >= 75 ? 1 : 0)),
          source_method: "noaa_spc_storm_reports",
          suggested_opener: OPENERS.storm_tree_damage.opener,
          best_call_window: OPENERS.storm_tree_damage.window,
          estimated_value: 2500,
          raw_source_data: { speed, lat, lon, county: parts[3]?.trim() },
        });
      }
    }
  } catch (e) { console.error("[tree] SPC storm reports:", e); }

  // 6. US Drought Monitor — D1+ drought causes root stress and dead limb drop risk
  try {
    const dmRes = await fetch("https://usdm.climate.gov/currentConditions/usdm_counties.json", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (dmRes.ok) {
      const counties: any[] = await dmRes.json();
      const miDrought = counties.filter((c: any) => c.fips?.startsWith("26") && Number(c.dm ?? 0) >= 1);
      if (miDrought.length > 0) {
        signals.push({
          address: `Michigan — ${miDrought.length} counties in drought`,
          city: state, zip: "",
          signal_type: "tree_hazard_area",
          signal_detail: `US Drought Monitor: ${miDrought.length} MI counties in D1+ drought — drought-stressed trees lose root integrity and drop large limbs unpredictably, creating hazard tree removal market`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.tree_hazard_area - 1,
          source_method: "drought_monitor",
          suggested_opener: OPENERS.tree_hazard_area.opener,
          best_call_window: "During and 30 days after drought period",
          estimated_value: 2000,
          raw_source_data: { drought_counties: miDrought.length },
        });
      }
    }
  } catch (e) { console.error("[tree] drought monitor:", e); }

  // 7. NOAA SPC Day-1 Convective Outlook — tornado/severe thunderstorm = tree damage pre-alert
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
          signal_type: "storm_tree_damage",
          signal_detail: `NOAA SPC Day-1 Outlook: ${label} — severe thunderstorm/tornado risk. Property owners with large trees should know their removal options before a storm drops a limb on their roof`,
          signal_date: valid,
          score: BASE_SCORES.storm_tree_damage + 1,
          source_method: "noaa_spc_day1_outlook",
          suggested_opener: "Severe weather is forecast for your area today — if you have large trees near your home or power lines, now is the time to identify hazards before the storm makes it an emergency. We're doing free risk assessments this week.",
          best_call_window: "Day before / day of storm event",
          estimated_value: 3000,
          raw_source_data: { label, valid, forecaster: props.FORECASTER },
        });
      }
    }
  } catch (e) { console.error("[tree] SPC day-1:", e); }

  // 8. Detroit Assessor property sales — new homeowners assess trees they inherit
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
          signal_type: "tree_311_request",
          signal_detail: `Detroit property sale: ${a.grantee ?? "New owner"} — new homeowners routinely discover hazard trees and overgrowth that the previous owner ignored`,
          signal_date: a.sale_date ? new Date(a.sale_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "detroit_assessor_sales",
          suggested_opener: "Congratulations on your new home — many new owners discover trees that were ignored for years. A free hazard assessment takes 20 minutes and can prevent a $15,000 emergency removal.",
          best_call_window: "Within 90 days of purchase",
          estimated_value: 2000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[tree] assessor sales:", e); }

  // 9. BSEED Demolition Permits — trees near demolition sites are damaged during work
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_demolition_permits/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,issued_date,work_description&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "tree_permit_upsell",
          signal_detail: `BSEED Demolition Permit: ${addr} — demolition disturbs root systems of adjacent trees. Heavy equipment compacts soil, severs roots, and causes structural damage that appears 6-24 months after demo work completes`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 5,
          source_method: "bseed_demo_permits",
          suggested_opener: "A demolition permit was just filed next door — heavy equipment causes root compression and mechanical damage to adjacent trees. A post-demo tree health assessment takes 20 minutes and identifies risk before a tree fails into your property.",
          best_call_window: "During and within 6 months of demolition",
          estimated_value: 1500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[tree] demo permits:", e); }

  // (next source) Detroit Assessment Roll 2026 — recently sold pre-1950 homes (mature/overgrown trees)
  try {
    const since = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/tentative_assessment_roll_2026/FeatureServer/0/query?where=sale_date+%3E%3D+'${since}'+AND+residential_year_built+%3C+1950+AND+residential_year_built+%3E+1880+AND+is_improved+%3D+1&outFields=address,zip_code,residential_year_built,sale_date,taxpayer_1&resultRecordCount=40&orderByFields=sale_date+DESC&f=json`,
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
        const treeAge = 2026 - yrBuilt;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "tree_permit_upsell",
          signal_detail: `Detroit new owner: ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — ${treeAge}-year-old property typically has mature trees with dead limbs, root heave, and canopy overgrowth. New owners inherit tree liability the day they close`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Congrats on ${addr}! ${treeAge}-year-old property trees are at peak risk age — dead limbs over the roof and root heave under the driveway. As the new owner you're now liable for damage they cause. Free assessment?`,
          best_call_window: "Within 60 days of purchase, before first storm season",
          estimated_value: 1800,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[tree] Detroit assessment roll:", e); }

  // BSEED Presale Inspections — FAIL results (overgrown trees / root damage to foundation cited)
  try {
    const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`(inspection_result = 'FAIL' OR inspection_result = '***Failed Insp') AND inspection_date >= '${since}'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_presale_inspections/FeatureServer/0/query?where=${where}&outFields=address,zip_code,inspection_date&resultRecordCount=20&orderByFields=inspection_date+DESC&f=json`,
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
          signal_type: "tree_removal_permit",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — tree roots, overhanging limbs touching rooflines, and overgrown vegetation over structures are commonly cited in Detroit presale inspection`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 8,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — overhanging branches and root damage near the foundation are common citations. We can remove problem trees fast and provide a clearance letter for your re-inspection.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 2500,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[tree] presale inspections:", e); }

  // Day-2 SPC Convective Outlook — 48-hour pre-storm tree limb/safety window
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
          signal_type: "storm_tree_damage",
          signal_detail: `SPC Day-2 Outlook: ${label} — high wind and thunderstorm risk in 24–48 hours. Pre-storm tree limb removal prevents roof and fence damage`,
          signal_date: valid,
          score: BASE_SCORES.storm_tree_damage - 1,
          source_method: "noaa_spc_day2_outlook",
          suggested_opener: "Severe wind and storms are forecast for your area tomorrow — overhanging limbs are the #1 cause of roof and fence damage during windstorms. We can remove at-risk limbs today before the storm hits. Slots are filling fast.",
          best_call_window: "48-hour pre-storm window — before limbs become emergency",
          estimated_value: 1500,
          raw_source_data: { label, valid },
        });
      }
    }
  } catch (e) { console.error("[tree] SPC day-2:", e); }

  // Projected Tree Removals — city-assessed hazardous trees with failure probability ratings
  try {
    const where = encodeURIComponent(`Active = 1 AND (COND = 'Dead' OR COND = 'Poor' OR PFAIL = 'High' OR PFAIL = 'Extremely High')`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Projected_Tree_Removals/FeatureServer/0/query?where=${where}&outFields=Address,Street,SPP,DBH,COND,PFAIL,RATING,GROW,DISTRICT&resultRecordCount=50&orderByFields=RATING+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const streetNum = (a.Address || "").toString().trim();
        const streetName = (a.Street || "").trim();
        const addr = `${streetNum} ${streetName}`.trim();
        if (!addr || addr.length < 5) continue;
        const species = a.SPP || "tree";
        const dbh = a.DBH || 0;
        const condition = a.COND || "Poor";
        const failRisk = a.PFAIL || "High";
        const rating = Number(a.RATING) || 5;
        const score = rating >= 8 ? 9 : rating >= 6 ? 8 : 7;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "storm_tree_damage",
          signal_detail: `City-assessed hazardous tree: ${addr} — ${species} (${dbh}" DBH), condition: ${condition}, failure probability: ${failRisk}, hazard rating: ${rating}/10. City flagged for removal — homeowner needs private contractor`,
          signal_date: new Date().toISOString().split("T")[0],
          score,
          source_method: "projected_tree_removals",
          suggested_opener: `The city flagged a ${condition.toLowerCase()} ${species} at ${addr} with a ${failRisk.toLowerCase()} probability of failure — before it drops on your property or a car, we can take it down safely and have the debris hauled same-day.`,
          best_call_window: "Any time — hazardous tree is an active liability",
          estimated_value: dbh >= 30 ? 4000 : dbh >= 20 ? 2500 : 1500,
          raw_source_data: { addr, species, dbh, condition, failRisk, rating },
        });
      }
    }
  } catch (e) { console.error("[tree] projected removals:", e); }

  // BSEED Rental Registrations — new landlords need tree risk survey before tenant occupancy
  try {
    const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`issued_date >= '${since60}'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_rental_registrations/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date&resultRecordCount=25&orderByFields=issued_date+DESC&f=json`,
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
          signal_type: "storm_tree_damage",
          signal_detail: `New rental registration: ${addr} — landlords are liable for tenant injuries caused by hazardous trees on their property; a pre-occupancy tree risk survey provides documentation`,
          signal_date: a.issued_date ? a.issued_date.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "bseed_rental_registration",
          suggested_opener: `You just registered ${addr} as a rental — if a tree falls on a tenant's car or injures someone, documentation of a pre-rental tree risk survey is your protection. We do same-week property tree assessments for landlords.`,
          best_call_window: "Before first tenant move-in",
          estimated_value: 1500,
          raw_source_data: { addr, zip, issued: a.issued_date },
        });
      }
    }
  } catch (e) { console.error("[tree] rental registrations:", e); }

  return signals;
}
