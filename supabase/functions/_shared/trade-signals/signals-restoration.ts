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

  // 9. Detroit Fire Incidents — structure fires are the highest-value restoration leads
  try {
    const where = encodeURIComponent(
      `incident_type_description LIKE '%Structure Fire%' OR incident_type_description LIKE '%structure fire%'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Fire_Incidents/FeatureServer/0/query?where=${where}&outFields=address,zip_code,incident_type_description,called_at,property_use,latitude,longitude&resultRecordCount=30&orderByFields=called_at+DESC&f=json`,
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
          signal_type: "fire_damage_permit",
          signal_detail: `Detroit Fire Incident: ${a.incident_type_description ?? "structure fire"} at ${addr} — structural fire damage requires immediate professional assessment. Property use: ${a.property_use ?? "residential"}`,
          signal_date: a.called_at ? new Date(a.called_at).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.fire_damage_permit + 1, // live fire incident = highest priority
          source_method: "detroit_fire_incidents",
          suggested_opener: OPENERS.fire_incident_area.opener,
          best_call_window: "Within 48 hours of fire incident",
          estimated_value: 18000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[restoration] fire incidents:", e); }

  // 10. Historic District Violations — per-address violations in designated historic districts
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

  // 12. BSEED Vacant Property Registrations — owners planning to sell/rehab often need full restoration
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_vacant_property_registrations/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,issued_date,owner_name,neighborhood&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
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
          signal_detail: `BSEED Vacant Registration: ${addr} — owner: ${a.owner_name ?? "on file"}. Properties vacant for over a year in Detroit have near-certain water intrusion, mold, and vandalism damage that requires professional restoration before listing or occupancy`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit - 1,
          source_method: "bseed_vacant_registrations",
          suggested_opener: "Your vacant property at this address requires annual registration — most owners of registered vacants don't realize the extent of interior damage until they try to sell. We offer pre-listing restoration assessments.",
          best_call_window: "Within 60 days of registration or renewal",
          estimated_value: 8000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[restoration] vacant registrations:", e); }

  // 13. Detroit Commercial Properties for Sale — retail/commercial listings; buyers need pre-occupancy restoration
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Commercial_Properties_for_Sale/FeatureServer/0/query?where=1%3D1&outFields=address,title,size,price,property_type&resultRecordCount=30&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        if (!addr) continue;
        const isCommercial = (a.property_type ?? "").toLowerCase().includes("retail") || (a.property_type ?? "").toLowerCase().includes("commercial") || (a.property_type ?? "").toLowerCase().includes("industrial");
        if (!isCommercial) continue; // land goes to demo_junk
        if (zipFilter?.length) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "water_damage_permit",
          signal_detail: `City commercial property for sale: ${addr} — "${a.title ?? a.property_type}" listed at ${a.price ?? "TBD"} (${a.size ?? "?"}). City-owned commercial buildings held vacant for years almost always have water infiltration, mold, and structural damage requiring professional remediation before any tenant buildout`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit - 2,
          source_method: "detroit_commercial_for_sale",
          suggested_opener: `You're looking at the commercial property at ${addr} — buildings the city has held vacant for years almost always have water infiltration and mold issues. A pre-purchase remediation assessment protects your investment and speeds up the permitting process.`,
          best_call_window: "Before purchase closes or during due diligence period",
          estimated_value: 15000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[restoration] commercial for sale:", e); }

  // 14. Detroit City-Owned Development Buildings — city real estate buildings available for redevelopment
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/development_opportunities_city_real_estate_buildings/FeatureServer/0/query?where=1%3D1&outFields=address,street_number,street_prefix,street_name,street_type&resultRecordCount=40&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = a.address || [a.street_number, a.street_prefix, a.street_name, a.street_type].filter(Boolean).join(" ").trim();
        if (!addr) continue;
        if (zipFilter?.length) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "water_damage_permit",
          signal_detail: `City-owned development building: ${addr} — available for redevelopment. City-held buildings require full remediation assessment before occupancy permit can be issued; water, mold, and fire damage common in long-vacant structures`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit - 3,
          source_method: "detroit_city_buildings",
          suggested_opener: "This is a city-owned development building — before any tenant can occupy, a full remediation assessment and clearance is required. We do pre-permit water/mold assessments for developers and have experience navigating city inspections.",
          best_call_window: "During developer acquisition process",
          estimated_value: 12000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[restoration] city buildings:", e); }

  // 15. Detroit Fire Escrow Properties — insurance escrowed on fire-damaged homes
  // 1,131 residential properties with insurance funds withheld pending contractor repairs.
  // Owner has the insurance money locked up — they need us to release it.
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Fire_Escrow_Properties/FeatureServer/0/query?where=Amount_Withheld+%3E+5000+AND+Property_Class+LIKE+'%25Residential%25'&outFields=Loss_Address,Assessor_Taxpayer_Name,Assessor_Taxpayer_Zip,Date_Of_Loss,Amount_Withheld,No_of_Days_Outstanding&resultRecordCount=60&orderByFields=No_of_Days_Outstanding+ASC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.Loss_Address || "").trim();
        const zip = String(a.Assessor_Taxpayer_Zip || "").slice(0, 5);
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const withheld: number = a.Amount_Withheld || 0;
        const daysOut: number = a.No_of_Days_Outstanding || 0;
        const lossDate = a.Date_Of_Loss ? new Date(a.Date_Of_Loss).toISOString().split("T")[0] : null;
        const ownerName = (a.Assessor_Taxpayer_Name || "").replace(/,/, " ").trim();
        const urgencyNote = daysOut < 90 ? "URGENT — recent fire, insurance claim just filed" : daysOut < 365 ? "insurance claim open less than 1 year" : "long-outstanding claim — owner may have given up";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "water_damage_permit",
          signal_detail: `Detroit Fire Escrow: ${addr} — $${withheld.toLocaleString()} insurance funds held in escrow${lossDate ? ` since ${lossDate}` : ""} (${urgencyNote}). Owner needs licensed contractor to complete repairs before insurer releases funds`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit + (daysOut < 90 ? 3 : daysOut < 365 ? 2 : 1),
          source_method: "detroit_fire_escrow",
          suggested_opener: `${ownerName ? ownerName + " — " : ""}I saw that ${addr} has ${`$${withheld.toLocaleString()}`} in fire insurance escrow. The insurance company holds those funds until a licensed contractor completes the repairs and signs off. We do exactly this work — can we schedule an assessment this week?`,
          best_call_window: "Business hours, reference insurance escrow",
          estimated_value: Math.max(withheld * 1.2, 8000),
          raw_source_data: { address: addr, zip, owner: ownerName, withheld, days_outstanding: daysOut, loss_date: lossDate },
        });
      }
    }
  } catch (e) { console.error("[restoration] fire escrow:", e); }

  // 16. Detroit Fire Incidents — residential building fires (last 30 days)
  // Live 2025 data; filter client-side since ArcGIS timestamp WHERE can be unreliable
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Fire_Incidents/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,incident_type_description,property_use,called_at,latitude,longitude&resultRecordCount=100&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const cutoffMs = Date.now() - 30 * 86400_000;
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const calledMs: number | null = typeof a.called_at === "number" ? a.called_at : null;
        if (!calledMs || calledMs < cutoffMs) continue;
        const addr = (a.address || "").trim();
        const zip = String(a.zip_code || "").trim();
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const incType = (a.incident_type_description || "").toLowerCase();
        const propUse = (a.property_use || "").toLowerCase();
        const isResidential = /family|dwelling|residential|apartment|boarding|hotel|motel/.test(propUse);
        if (!isResidential) continue;
        const isFire = /fire|smoke|explosion|arson/.test(incType);
        const isWater = /water|flood|pipe|leak/.test(incType);
        if (!isFire && !isWater) continue;
        const signalType = isFire ? "fire_damage_permit" : "water_damage_permit";
        const humanDate = new Date(calledMs).toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "water_damage_permit",
          signal_detail: `Detroit Fire Department incident: ${a.incident_type_description || "fire/smoke"} at ${addr} (${a.property_use || "residential"}) on ${humanDate} — fire and smoke damage restoration required before re-occupancy`,
          signal_date: humanDate,
          score: BASE_SCORES.water_damage_permit + 2,
          source_method: "detroit_fire_incidents",
          suggested_opener: `There was a ${a.incident_type_description?.toLowerCase() || "fire incident"} at ${addr} on ${humanDate}. We handle fire and smoke damage remediation — board-up, contents removal, structural drying, and odor mitigation. Are they coordinating with insurance yet?`,
          best_call_window: "Within 48-72 hours of incident for emergency restoration",
          estimated_value: 18000,
          raw_source_data: { address: addr, zip, incident_type: a.incident_type_description, property_use: a.property_use, date: humanDate },
        });
      }
    }
  } catch (e) { console.error("[restoration] fire incidents:", e); }

  // 17. Detroit Assessment Roll 2026 — recently sold pre-1940 homes (hazardous materials + hidden damage)
  try {
    const since = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/tentative_assessment_roll_2026/FeatureServer/0/query?where=sale_date+%3E%3D+'${since}'+AND+residential_year_built+%3C+1940+AND+residential_year_built+%3E+1880+AND+is_improved+%3D+1&outFields=address,zip_code,residential_year_built,sale_date,taxpayer_1&resultRecordCount=40&orderByFields=sale_date+DESC&f=json`,
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
          signal_type: "water_damage_permit",
          signal_detail: `Detroit new owner: ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — pre-1940 homes contain asbestos insulation, lead paint, and decades of hidden water damage. New owners purchasing pre-war homes often discover concealed mold and rot during their first renovation`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit,
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Congrats on ${addr}! Pre-1940 Detroit homes almost universally have hidden moisture damage, asbestos insulation, and lead paint that need professional assessment before any renovation. A pre-reno assessment can also reduce your insurance premium.`,
          best_call_window: "Within 90 days of purchase, before renovation begins",
          estimated_value: 12000,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[restoration] Detroit assessment roll:", e); }

  // 18. Demolition Post-Abatement Reports — abatement clearance triggers remediation referrals
  try {
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Demolition_Post_Abatement_Verification_Reports/FeatureServer/0/query?where=pav_passed_date+%3E%3D+%27${since90}%27+AND+structure_type+%3D+'Residential'&outFields=address,structure_type,pav_passed_date,demolition_contractor,zip_code,neighborhood&resultRecordCount=30&orderByFields=OBJECTID+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").trim();
        if (!addr) continue;
        const zip = String(a.zip_code || "").trim();
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const passed = a.pav_passed_date ? String(a.pav_passed_date).slice(0, 10) : new Date().toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "water_damage_permit",
          signal_detail: `Post-abatement verification passed at ${addr} (${passed}) — residential demolition required abatement for hazardous materials (asbestos/lead). Adjacent properties with similar construction dates may need environmental assessments`,
          signal_date: passed,
          score: BASE_SCORES.water_damage_permit,
          source_method: "demo_post_abatement_reports",
          suggested_opener: `A home on your block was just demolished and required environmental abatement — neighboring homes built in the same era frequently have the same hazardous materials present. We offer free environmental assessments.`,
          best_call_window: "Within 60 days of abatement clearance",
          estimated_value: 15000,
          raw_source_data: { addr, zip, passed, contractor: a.demolition_contractor },
        });
      }
    }
  } catch (e) { console.error("[restoration] post-abatement reports:", e); }

  // 19. Fire Inspections — buildings that failed fire inspection often have water/mold damage
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Fire_Inspections/FeatureServer/0/query?where=InspWithinLastYear+%3D+'No'+AND+propusetype+NOT+LIKE+'%25Office%25'&outFields=Address,zip,OccupantName,InspectionType_Full,LatestInspDate,propusetypedescription&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.Address || "").trim();
        const zip = String(a.zip || "").trim();
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const occupant = a.OccupantName || "";
        const lastInspMs = typeof a.LatestInspDate === "number" ? a.LatestInspDate : null;
        const lastInsp = lastInspMs ? new Date(lastInspMs).toISOString().slice(0, 10) : "";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "water_damage_permit",
          signal_detail: `Fire inspection overdue: ${addr} (${occupant || a.propusetypedescription || "property"}) — last inspected ${lastInsp || "unknown"}. Buildings with lapsed fire inspections often have pre-existing water intrusion and mold that compound fire risk`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit - 1,
          source_method: "fire_inspections",
          suggested_opener: `${occupant ? occupant + " — " : ""}We noticed ${addr} is overdue for its fire inspection — buildings with deferred maintenance often have water damage and mold that creates additional fire risk. A free walk-through assessment can help you get ahead of it.`,
          best_call_window: "Any time — deferred maintenance compounds risk",
          estimated_value: 8000,
          raw_source_data: { addr, zip, occupant, last_insp: lastInsp, type: a.propusetypedescription },
        });
      }
    }
  } catch (e) { console.error("[restoration] fire inspections:", e); }

  // BSEED Presale Inspections — FAIL results (water damage and mold cited)
  try {
    const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`(inspection_result = 'FAIL' OR inspection_result = '***Failed Insp') AND inspection_date >= '${since}'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_presale_inspections/FeatureServer/0/query?where=${where}&outFields=address,zip_code,inspection_date&resultRecordCount=25&orderByFields=inspection_date+DESC&f=json`,
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
          signal_type: "water_damage_permit",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — water intrusion, active leaks, and visible mold are frequently cited items in presale inspection. Seller must remediate before closing`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 9,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — water damage and moisture intrusion are among the most common reasons. We specialize in fast water damage remediation and mold treatment, and we document everything so you can pass re-inspection and close on time.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 12000,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[restoration] presale inspections:", e); }

  // Detroit Historic District Violations — porch/deck and structural violations (open cases)
  try {
    const where = encodeURIComponent(`case_status = 'Open' AND (has_porch_deck_violati = 'True' OR has_addition_violation = 'True' OR has_construction_new_violation = 'True')`);
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
          signal_type: "water_damage_permit",
          signal_detail: `Historic District Violation (Open): ${addr} in ${district} — ${a.violation_scope ?? "structural violation"}. Porch, deck, and structural violations in historic districts require full restoration-grade repairs to pass re-inspection`,
          signal_date: a.intake_date ? String(a.intake_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.water_damage_permit,
          source_method: "historic_district_violations",
          suggested_opener: `Your property at ${addr} in ${district} has an open structural violation — historic district compliance requires restoration-grade repair by an approved contractor. We specialize in historic porch and structural restoration that passes city re-inspection.`,
          best_call_window: "Any time — open violation creates deadline pressure",
          estimated_value: 18000,
          raw_source_data: { addr, zip, district, scope: a.violation_scope },
        });
      }
    }
  } catch (e) { console.error("[restoration] historic violations:", e); }

  return signals;
}
