// HVAC Radar signal scanner.
// Sources: NOAA NWS Alerts (extreme heat/cold/ice), FEMA declarations, BSEED/Oakland aging-system permits.

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  extreme_weather_hvac: 9,
  fema_disaster: 8,
  aging_system_proxy: 6,
  nfip_flood_hvac: 8,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  extreme_weather_hvac: {
    opener: "With the extreme temps this week, a lot of HVAC systems are failing under the load — we're doing free efficiency checks in your area. Is yours keeping up?",
    window: "During/within 5 days of weather event",
  },
  fema_disaster: {
    opener: "Your area was hit hard — FEMA assistance may cover HVAC replacement. We can help you file and get a new system installed this week.",
    window: "Within 30 days of declaration",
  },
  aging_system_proxy: {
    opener: "We noticed your home had significant renovation work done — older homes in your area often have HVAC systems that are 15–20 years past their expected life. Worth a free check?",
    window: "Anytime within 60 days of permit",
  },
  nfip_flood_hvac: {
    opener: "Flood-damaged HVAC systems often look fine but have hidden electrical and mold issues — we offer a post-flood assessment and can document damage for your NFIP claim.",
    window: "Within 60 days of flood claim",
  },
};

const HVAC_WEATHER_EVENTS = ["Excessive Heat", "Wind Chill", "Freeze", "Ice Storm", "Winter Storm", "Extreme Cold"];

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. NOAA NWS extreme weather alerts
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
        if (!HVAC_WEATHER_EVENTS.some((e) => event.includes(e))) continue;
        const areaDesc: string = props.areaDesc ?? "";
        const effective = (props.effective ?? props.onset ?? new Date().toISOString()).split("T")[0];
        signals.push({
          address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
          city: areaDesc.split(",")[0]?.trim() ?? state,
          zip: "",
          signal_type: "extreme_weather_hvac",
          signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 120) ?? ""}`,
          signal_date: effective,
          score: BASE_SCORES.extreme_weather_hvac,
          source_method: "noaa_nws_alerts",
          suggested_opener: OPENERS.extreme_weather_hvac.opener,
          best_call_window: OPENERS.extreme_weather_hvac.window,
          estimated_value: 7000,
          raw_source_data: { event, areaDesc, effective },
        });
      }
    }
  } catch (e) { console.error("[hvac] NWS:", e); }

  // 2. FEMA disaster declarations
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq '${state}' and declarationDate ge '${since}'&$top=15`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const dec of (d?.DisasterDeclarationsSummaries ?? [])) {
        if (!dec.incidentType?.match(/Hurricane|Severe Storm|Flood|Freeze|Winter Storm/i)) continue;
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
          estimated_value: 8000,
          raw_source_data: dec,
        });
      }
    }
  } catch (e) { console.error("[hvac] FEMA:", e); }

  // 3. BSEED Mechanical Permits (service: bseed_trades_permits, permit_type = Mechanical)
  try {
    const where = encodeURIComponent(`permit_type = 'Mechanical Permit'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,permit_type,work_description,latitude,longitude&resultRecordCount=40&orderByFields=issued_date+DESC&f=json`,
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
          signal_type: "aging_system_proxy",
          signal_detail: `BSEED Mechanical Permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.aging_system_proxy,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.aging_system_proxy.opener,
          best_call_window: OPENERS.aging_system_proxy.window,
          estimated_value: 6000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[hvac] BSEED:", e); }

  // 4. OpenFEMA NfipMultipleLossProperties — flood-damaged homes need HVAC replacement.
  // nfipPolicies endpoint removed by FEMA (returns 404). Use NfipMultipleLossProperties
  // (repeat-flood properties by zip) as area signal for flood-prone HVAC replacement market.
  try {
    const res = await fetch(
      `https://www.fema.gov/api/open/v1/NfipMultipleLossProperties?$filter=stateAbbreviation eq '${state}'&$select=stateAbbreviation,county,zipCode,totalLosses,floodZone&$top=10`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const props: any[] = d?.NfipMultipleLossProperties ?? [];
      if (props.length > 0) {
        const totalLosses = props.reduce((n, p) => n + (Number(p.totalLosses) || 0), 0);
        const sorted = [...props].sort((a, b) => (b.totalLosses ?? 0) - (a.totalLosses ?? 0));
        const topZip = sorted[0];
        signals.push({
          address: `${state} — ${props.length} NFIP repeat-loss properties`,
          city: state,
          zip: "",
          signal_type: "nfip_flood_hvac",
          signal_detail: `OpenFEMA NFIP Multiple-Loss Properties: ${props.length} properties in ${state} with repeat flood claims — flood damage always requires HVAC replacement. Top zip: ${topZip?.zipCode ?? "?"} (${topZip?.totalLosses ?? "?"} losses)`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.nfip_flood_hvac,
          source_method: "fema_nfip_api",
          suggested_opener: OPENERS.nfip_flood_hvac.opener,
          best_call_window: OPENERS.nfip_flood_hvac.window,
          estimated_value: 8500,
          raw_source_data: { state, properties_count: props.length, total_losses: totalLosses, top_zip: topZip },
        });
      }
    }
  } catch (e) { console.error("[hvac] NFIP:", e); }

  return signals;
}
