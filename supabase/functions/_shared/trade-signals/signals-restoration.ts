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

  // 4. Detroit Blight Violations — per-address city citations for structural/water issues
  try {
    const where = encodeURIComponent(
      `ordinance_description LIKE '%water%' OR ordinance_description LIKE '%structural%' OR ordinance_description LIKE '%collapse%' OR ordinance_description LIKE '%mold%' OR ordinance_description LIKE '%sewage%'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/blight_tickets/FeatureServer/0/query?where=${where}&outFields=address,zip_code,ordinance_description,latitude,longitude&resultRecordCount=30&orderByFields=OBJECTID+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = `${a.address ?? ""}`.trim();
        const zip: string = a.zip_code ?? "";
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "water_damage_permit",
          signal_detail: `Detroit blight citation: ${(a.ordinance_description ?? "").slice(0, 120)}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit - 1,
          source_method: "detroit_blight_arcgis",
          suggested_opener: OPENERS.water_damage_permit.opener,
          best_call_window: OPENERS.water_damage_permit.window,
          estimated_value: 6000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[restoration] blight:", e); }

  // 5. USGS Real-Time Streamflow — Michigan river gauges at/above flood stage
  try {
    const res = await fetch(
      "https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=mi&parameterCd=00065&period=P1D&siteStatus=active",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const sites: any[] = d?.value?.timeSeries ?? [];
      const flooded = sites.filter((s: any) => {
        const val = Number(s?.values?.[0]?.value?.[0]?.value);
        const action = Number(s?.variable?.actionStage?.value ?? s?.variable?.floodStage?.value ?? 999);
        return val > 0 && action < 999 && val >= action;
      });
      if (flooded.length > 0) {
        const siteNames = flooded.slice(0, 3).map((s: any) => s?.sourceInfo?.siteName ?? "").join("; ");
        signals.push({
          address: `Michigan — ${flooded.length} river gauge(s) at/above flood stage`,
          city: state, zip: "",
          signal_type: "flood_warning",
          signal_detail: `USGS streamflow: ${flooded.length} MI gauges at or above action stage — ${siteNames}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.flood_warning,
          source_method: "usgs_streamflow",
          suggested_opener: OPENERS.flood_warning.opener,
          best_call_window: OPENERS.flood_warning.window,
          estimated_value: 8000,
          raw_source_data: { flooded_count: flooded.length, sites: siteNames },
        });
      }
    }
  } catch (e) { console.error("[restoration] USGS streamflow:", e); }

  // 6. OpenFEMA Public Assistance Projects — infrastructure repair = adjacent private damage
  try {
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/PublicAssistanceFundedProjectsDetails?$filter=state eq '${state}'&$orderby=projectDeclarationDate desc&$top=20`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const proj of (d?.PublicAssistanceFundedProjectsDetails ?? []).slice(0, 5)) {
        if (!proj.damageCategory?.match(/water|flood|fire|debris|infrastructure/i)) continue;
        signals.push({
          address: proj.countyCode ?? proj.applicantName ?? state,
          city: proj.countyCode ?? state, zip: "",
          signal_type: "fema_disaster",
          signal_detail: `FEMA PA Project: ${proj.damageCategory} — $${(Number(proj.federalShareObligated) || 0).toLocaleString()} funded in ${proj.countyCode ?? state}`,
          signal_date: proj.projectDeclarationDate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
          score: BASE_SCORES.fema_disaster - 1,
          source_method: "fema_pa_projects",
          suggested_opener: OPENERS.fema_disaster.opener,
          best_call_window: OPENERS.fema_disaster.window,
          estimated_value: 10000,
          raw_source_data: proj,
        });
      }
    }
  } catch (e) { console.error("[restoration] FEMA PA:", e); }

  // 7. DLBA For Sale properties — vacant structures listed for sale = restoration opportunity
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/DLBA_For_Sale/FeatureServer/0/query?where=1%3D1&outFields=address,neighborhood,listing_date,program&resultRecordCount=40&orderByFields=listing_date+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = [a.street_number, a.street_direction, a.street_name, a.street_type].filter(Boolean).join(" ").trim() || a.address || "";
        if (!addr) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "water_damage_permit",
          signal_detail: `DLBA For Sale: ${addr} (${a.neighborhood ?? "Detroit"}, program: ${a.program ?? "DLBA"}) — DLBA vacant properties sold to investors always require full interior restoration before occupancy`,
          signal_date: a.listing_date ? new Date(a.listing_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit - 1,
          source_method: "detroit_dlba_for_sale",
          suggested_opener: "You're purchasing a DLBA property — these homes need full interior assessment before renovation begins. Water damage, mold, and fire damage are almost guaranteed after years of vacancy. We offer restoration assessments for DLBA buyers.",
          best_call_window: "Within 30 days of DLBA listing",
          estimated_value: 12000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[restoration] DLBA for sale:", e); }

  // 9. Historic District Violations — per-address violations in designated historic districts
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Historic_District_Violations/FeatureServer/0/query?where=case_status+%3C%3E+'Closed'&outFields=address,zip_code,intake_date,historic_district,case_status,has_roof_gutter_chimney_violati,has_siding_walls_violation,has_paint_violation,has_construction_new_violation,has_demolition_violation&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json",
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
        const violationTypes: string[] = [];
        if (a.has_roof_gutter_chimney_violati) violationTypes.push("roof/chimney");
        if (a.has_siding_walls_violation) violationTypes.push("siding/walls");
        if (a.has_paint_violation) violationTypes.push("paint");
        if (a.has_construction_new_violation) violationTypes.push("construction");
        if (a.has_demolition_violation) violationTypes.push("demolition risk");
        if (!violationTypes.length) violationTypes.push("historic compliance");
        const signalType = (a.has_roof_gutter_chimney_violati || a.has_siding_walls_violation)
          ? "water_damage_permit" : "mold_remediation_permit";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: signalType,
          signal_detail: `Historic District Violation (${a.historic_district ?? "Detroit"}): ${violationTypes.join(", ")} — historic properties require preservation-compliant contractors to avoid fines`,
          signal_date: a.intake_date ? new Date(a.intake_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES[signalType],
          source_method: "detroit_historic_violations",
          suggested_opener: `Your property in the ${a.historic_district ?? "historic"} district has an open violation — standard contractors can void your tax credits. We specialize in preservation-compliant restoration and can resolve the citation with HPC-approved methods.`,
          best_call_window: "While violation is open",
          estimated_value: 15000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[restoration] historic violations:", e); }

  // 10. DLBA Auction Sales — investor buyers need full interior restoration before occupancy
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/dlba_auction_sales/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,sale_closed_date,amt_final_sale_price,sale_program,neighborhood&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "water_damage_permit",
          signal_detail: `DLBA Auction Sale: ${addr} sold for $${(a.amt_final_sale_price || 0).toLocaleString()} (${a.sale_program ?? "auction"}) — DLBA properties have 90%+ rate of water intrusion, mold, and structural damage after years of vacancy`,
          signal_date: a.sale_closed_date ? new Date(a.sale_closed_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit,
          source_method: "dlba_auction_sales",
          suggested_opener: "You just bought a DLBA property — these homes almost always have hidden water damage and mold from years of vacancy. A full restoration assessment before renovation starts saves 30-40% in change orders.",
          best_call_window: "Within 30 days of auction close",
          estimated_value: 15000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[restoration] DLBA auction:", e); }

  // 11. BSEED Building Permit Plan Reviews — pending remediation work signals upcoming demand
  try {
    const where = encodeURIComponent(
      `work_description LIKE '%WATER%' OR work_description LIKE '%FIRE%' OR work_description LIKE '%MOLD%' OR work_description LIKE '%FLOOD%' OR work_description LIKE '%REMEDIATION%'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permit_plan_reviews/FeatureServer/0/query?where=${where}&outFields=address,zip_code,submitted_date,task,task_status,work_description&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json`,
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
        const desc = (a.work_description ?? "").toUpperCase();
        const signalType = desc.includes("FIRE") || desc.includes("SMOKE")
          ? "fire_damage_permit"
          : desc.includes("MOLD") || desc.includes("REMEDIATION")
            ? "mold_remediation_permit"
            : "water_damage_permit";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: signalType,
          signal_detail: `BSEED Plan Review (${a.task_status ?? "pending"}): ${(a.work_description ?? "").slice(0, 100)} — permit under review = work authorized but contractor not yet selected`,
          signal_date: a.submitted_date ? new Date(a.submitted_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES[signalType] - 1,
          source_method: "bseed_plan_reviews",
          suggested_opener: OPENERS[signalType].opener,
          best_call_window: "While plan review is pending — 2-4 week window",
          estimated_value: 8000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[restoration] plan reviews:", e); }

  // 8. National Register of Historic Places — historic structures require preservation-compliant restoration
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/national_register_of_historic_places/FeatureServer/0/query?where=1%3D1&outFields=resource_name,address,city,period_of_significance&resultRecordCount=40&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        if (!addr) continue;
        signals.push({
          address: addr, city: a.city ?? "Detroit", zip: "",
          signal_type: "mold_remediation_permit",
          signal_detail: `National Register Historic Place: ${a.resource_name ?? addr} — historic properties require preservation-compliant restoration contractors. Period: ${a.period_of_significance ?? "pre-1960"}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.mold_remediation_permit - 1,
          source_method: "detroit_historic_register",
          suggested_opener: "Your property is on the National Register of Historic Places — standard restoration contractors can void your historic designation and tax credits. We specialize in preservation-compliant fire, water, and mold remediation.",
          best_call_window: "Evergreen — historic properties need specialized contractors",
          estimated_value: 18000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[restoration] historic register:", e); }

  return signals;
}
