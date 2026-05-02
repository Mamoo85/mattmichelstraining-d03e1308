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

  return signals;
}
