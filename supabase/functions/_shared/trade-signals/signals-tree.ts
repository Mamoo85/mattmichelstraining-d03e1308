// Tree Service Radar signal scanner.
// Sources: NOAA NWS wind/storm alerts (area), FEMA disasters (area),
// BSEED tree-removal/trimming permits (per-address),
// Detroit 311 open data tree service requests (per-address).

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

  // 3. BSEED permits with TREE keyword — per-address (confirmed service: bseed_building_permits)
  try {
    const where = encodeURIComponent(`(work_description LIKE '%TREE%' OR work_description LIKE '%STUMP%' OR work_description LIKE '%TRIM%')`);
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

  // 4. Detroit 311 open data — tree service requests (Socrata, no key required)
  try {
    const res = await fetch(
      `https://data.detroitmi.gov/resource/irmj-sax8.json?$where=category=%27Trees%27%20OR%20issue_type%20LIKE%20%27%25tree%25%27&$limit=40&$order=created_at%20DESC`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)", "Accept": "application/json" } },
    );
    if (res.ok) {
      const rows: any[] = await res.json();
      for (const row of rows) {
        const addr: string = row.address ?? row.location_address ?? "";
        if (!addr) continue;
        const zip: string = row.zip_code ?? row.location?.zip ?? addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr,
          city: row.city ?? "Detroit",
          zip,
          signal_type: "tree_311_request",
          signal_detail: `Detroit 311: ${row.issue_type ?? row.description ?? "Tree service request"}`,
          signal_date: row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.tree_311_request,
          source_method: "detroit_311",
          suggested_opener: OPENERS.tree_311_request.opener,
          best_call_window: OPENERS.tree_311_request.window,
          estimated_value: 1500,
          raw_source_data: row,
        });
      }
    }
  } catch (e) { console.error("[tree] Detroit 311:", e); }

  return signals;
}
