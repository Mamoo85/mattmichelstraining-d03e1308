// Restoration Radar signal scanner (Water Damage + Fire + Mold combined).
// Buyers: SERVPRO-type restoration contractors who pay $80-200/lead.
//
// HONEST POSITIONING: Most signals here are AREA-level market intelligence
// (flood warnings, fire weather zones, heavy rain events), not hot incidents.
// Per-address signals come from post-event BSEED remediation permits.
// Clients who buy this product understand they're getting advance positioning
// intel + neighborhood follow-up addresses, not live dispatch feeds.
//
// Sources:
//   Area: NWS flood/flash-flood warnings, FEMA disaster declarations,
//          NWS fire weather, heavy rain events
//   Per-address: BSEED permits for water damage / fire repair / mold remediation

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  flood_warning: 9,
  heavy_rain_event: 7,
  fema_disaster: 8,
  fire_incident_area: 8,
  water_damage_permit: 9,
  fire_damage_permit: 9,
  mold_remediation_permit: 8,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  flood_warning: {
    opener: "Flash flood warnings are active in your area — flooded basements can develop mold in 24–48 hours if not dried out immediately. We're deploying crews now and have same-day availability.",
    window: "During and within 72 hours of flood warning",
  },
  heavy_rain_event: {
    opener: "The heavy rain this week is exactly when we start seeing basement backup and sump failure calls — we're doing free assessments in your area before small problems become $30k remediation jobs.",
    window: "Within 5 days of rain event",
  },
  fema_disaster: {
    opener: "Your area has a federal disaster declaration — FEMA assistance can cover water or fire damage restoration. We specialize in the documentation required and can start your claim within 24 hours.",
    window: "Within 30 days of declaration",
  },
  fire_incident_area: {
    opener: "Fire damage restoration needs to start within 72 hours to prevent permanent soot penetration. If your property was affected or you're a neighbor dealing with smoke odor, call us now.",
    window: "Within 72 hours of fire event",
  },
  water_damage_permit: {
    opener: "A neighbor just pulled a water damage remediation permit — that usually means a pipe burst or basement flood affected more than one property. We're offering free assessments on adjacent homes this week.",
    window: "Within 21 days of permit",
  },
  fire_damage_permit: {
    opener: "A fire repair permit was just filed nearby — if your home had any smoke or water exposure from a neighboring fire, now is the time to get it documented for insurance before the window closes.",
    window: "Within 30 days of permit",
  },
  mold_remediation_permit: {
    opener: "A mold remediation permit was filed on your street — mold spreads through shared HVAC and wall cavities in attached homes. A free assessment takes 20 minutes and could save you $15,000.",
    window: "Within 30 days of permit",
  },
};

const FLOOD_EVENTS = ["Flash Flood", "Flood", "Coastal Flood", "Lakeshore Flood"];
const FIRE_EVENTS = ["Fire Weather", "Red Flag", "Extreme Fire"];
const RAIN_EVENTS = ["Excessive Rainfall", "Heavy Rain"];

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. NOAA NWS — flood warnings (area signal)
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?area=${state}&status=actual`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)", Accept: "application/geo+json" } },
    );
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? []).slice(0, 50)) {
        const props = feat?.properties ?? {};
        const event: string = props.event ?? "";
        const areaDesc: string = props.areaDesc ?? "";
        const effective = (props.effective ?? props.onset ?? new Date().toISOString()).split("T")[0];

        if (FLOOD_EVENTS.some((e) => event.includes(e))) {
          signals.push({
            address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
            city: areaDesc.split(",")[0]?.trim() ?? state,
            zip: "",
            signal_type: "flood_warning",
            signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 120) ?? ""}`,
            signal_date: effective,
            score: BASE_SCORES.flood_warning,
            source_method: "noaa_nws_alerts",
            suggested_opener: OPENERS.flood_warning.opener,
            best_call_window: OPENERS.flood_warning.window,
            estimated_value: 8000,
            raw_source_data: { event, areaDesc },
          });
        } else if (FIRE_EVENTS.some((e) => event.includes(e))) {
          signals.push({
            address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
            city: areaDesc.split(",")[0]?.trim() ?? state,
            zip: "",
            signal_type: "fire_incident_area",
            signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 120) ?? ""}`,
            signal_date: effective,
            score: BASE_SCORES.fire_incident_area,
            source_method: "noaa_nws_alerts",
            suggested_opener: OPENERS.fire_incident_area.opener,
            best_call_window: OPENERS.fire_incident_area.window,
            estimated_value: 12000,
            raw_source_data: { event, areaDesc },
          });
        } else if (RAIN_EVENTS.some((e) => event.includes(e))) {
          signals.push({
            address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
            city: areaDesc.split(",")[0]?.trim() ?? state,
            zip: "",
            signal_type: "heavy_rain_event",
            signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 120) ?? ""}`,
            signal_date: effective,
            score: BASE_SCORES.heavy_rain_event,
            source_method: "noaa_nws_alerts",
            suggested_opener: OPENERS.heavy_rain_event.opener,
            best_call_window: OPENERS.heavy_rain_event.window,
            estimated_value: 5000,
            raw_source_data: { event, areaDesc },
          });
        }
      }
    }
  } catch (e) { console.error("[restoration] NWS:", e); }

  // 2. FEMA disaster declarations (floods, fires, storms)
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq '${state}' and declarationDate ge '${since}'&$top=20`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const dec of (d?.DisasterDeclarationsSummaries ?? [])) {
        if (!dec.incidentType?.match(/Flood|Fire|Severe Storm|Hurricane|Tornado|Typhoon/i)) continue;
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
          estimated_value: 10000,
          raw_source_data: dec,
        });
      }
    }
  } catch (e) { console.error("[restoration] FEMA:", e); }

  // 3. BSEED remediation permits — per-address (confirmed service: bseed_building_permits)
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%WATER DAMAGE%' OR work_description LIKE '%FLOOD%' OR work_description LIKE '%FIRE DAMAGE%' OR work_description LIKE '%MOLD%' OR work_description LIKE '%REMEDIATION%' OR work_description LIKE '%SMOKE%')`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,work_description,amt_estimated_contractor_cost,latitude,longitude&resultRecordCount=50&orderByFields=issued_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = a.zip_code ?? addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const desc = (a.work_description ?? "").toUpperCase();
        const signalType = desc.includes("FIRE") || desc.includes("SMOKE")
          ? "fire_damage_permit"
          : desc.includes("MOLD") || desc.includes("REMEDIATION")
            ? "mold_remediation_permit"
            : "water_damage_permit";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: signalType,
          signal_detail: `BSEED permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES[signalType],
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS[signalType].opener,
          best_call_window: OPENERS[signalType].window,
          estimated_value: signalType === "fire_damage_permit" ? 15000 : 8000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[restoration] BSEED:", e); }

  return signals;
}
