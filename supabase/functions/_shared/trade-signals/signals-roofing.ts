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

  // 3. BSEED roof permits (ArcGIS — same server as mortgage scanner)
  try {
    const since = new Date(Date.now() - 14 * 86400_000).toISOString().split("T")[0];
    const where = encodeURIComponent(
      `work_description LIKE '%ROOF%' AND issued_date >= DATE '${since}'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_permits/FeatureServer/0/query?where=${where}&outFields=address,issued_date,work_description,amt_estimated_contractor_cost&resultRecordCount=50&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip = addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr,
          city: "Detroit",
          zip,
          signal_type: "roof_permit_upsell",
          signal_detail: `BSEED permit: ${(a.work_description ?? "").slice(0, 100)} — Est. $${a.amt_estimated_contractor_cost ?? "?"}`,
          signal_date: a.issued_date
            ? new Date(a.issued_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.roof_permit_upsell,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.roof_permit_upsell.opener.replace("[address]", addr),
          best_call_window: OPENERS.roof_permit_upsell.window,
          estimated_value: Number(a.amt_estimated_contractor_cost ?? 8000),
          raw_source_data: a,
        });
      }
    }
  } catch (e) { console.error("[roofing] BSEED:", e); }

  return signals;
}
