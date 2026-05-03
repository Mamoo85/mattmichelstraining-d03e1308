// Foundation Radar signal scanner.
// Highest close rate of any restoration-adjacent vertical (~50%).
// Michigan-specific: freeze/thaw cycles, high water table near Great Lakes,
// millions of homes built pre-1960 with no waterproofing.
//
// Sources:
//   Area: FEMA flood zone / NFIP data, NWS flood/heavy-rain events
//   Per-address: BSEED foundation/structural permits

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  foundation_flood_risk: 8,
  heavy_rain_foundation: 7,
  fema_flood_foundation: 9,
  foundation_repair_permit: 9,
  structural_permit: 8,
  nfip_foundation: 7,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  foundation_flood_risk: {
    opener: "Your home is in a FEMA-designated flood zone — that means your foundation has above-average hydrostatic pressure risk. A free assessment tells you exactly what you're dealing with before a $40k problem develops.",
    window: "Evergreen — flood zone designation is permanent",
  },
  heavy_rain_foundation: {
    opener: "The heavy rain this week is when foundation issues show themselves. If you're seeing any water intrusion, efflorescence, or cracks you haven't noticed before, now is the time to get it looked at before it worsens.",
    window: "Within 7 days of rain event",
  },
  fema_flood_foundation: {
    opener: "Your area has a federal disaster declaration — foundation damage from flooding often isn't visible for 30–90 days as the soil dries and shifts. A structural assessment now protects your FEMA claim window.",
    window: "Within 60 days of declaration",
  },
  foundation_repair_permit: {
    opener: "A foundation repair permit was just filed on your street — these are often neighborhood-wide issues where the same soil conditions affect multiple homes. We're offering free assessments to neighbors this week.",
    window: "Within 21 days of permit",
  },
  structural_permit: {
    opener: "A structural permit was filed nearby — major structural work often reveals underlying foundation issues in adjacent properties. A free 20-minute assessment tells you exactly where you stand.",
    window: "Within 30 days of permit",
  },
  nfip_foundation: {
    opener: "Flood insurance claims in your area are at elevated levels — NFIP data shows repeated payouts in your zip code, which is a strong indicator of chronic foundation water intrusion. We can assess yours at no charge.",
    window: "Anytime — area is actively flood-prone",
  },
};

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. NOAA NWS — flood and heavy rain events (area signals)
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
        if (!["Flood", "Flash Flood", "Excessive Rain", "Heavy Rain", "Lakeshore", "Coastal"].some((e) => event.includes(e))) continue;
        const areaDesc: string = props.areaDesc ?? "";
        const effective = (props.effective ?? props.onset ?? new Date().toISOString()).split("T")[0];
        signals.push({
          address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
          city: areaDesc.split(",")[0]?.trim() ?? state,
          zip: "",
          signal_type: event.includes("Flood") ? "fema_flood_foundation" : "heavy_rain_foundation",
          signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 120) ?? ""}`,
          signal_date: effective,
          score: BASE_SCORES[event.includes("Flood") ? "fema_flood_foundation" : "heavy_rain_foundation"],
          source_method: "noaa_nws_alerts",
          suggested_opener: OPENERS[event.includes("Flood") ? "fema_flood_foundation" : "heavy_rain_foundation"].opener,
          best_call_window: OPENERS[event.includes("Flood") ? "fema_flood_foundation" : "heavy_rain_foundation"].window,
          estimated_value: 12000,
          raw_source_data: { event, areaDesc },
        });
      }
    }
  } catch (e) { console.error("[foundation] NWS:", e); }

  // 2. FEMA disaster declarations (flood-type)
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq '${state}' and declarationDate ge '${since}'&$top=15`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const dec of (d?.DisasterDeclarationsSummaries ?? [])) {
        if (!dec.incidentType?.match(/Flood|Severe Storm|Hurricane/i)) continue;
        signals.push({
          address: dec.designatedArea ?? state,
          city: dec.designatedArea?.split(" County")[0] ?? state,
          zip: "",
          signal_type: "fema_flood_foundation",
          signal_detail: `FEMA DR-${dec.disasterNumber}: ${dec.incidentType} — ${dec.designatedArea}`,
          signal_date: dec.declarationDate?.split("T")[0] ?? since,
          score: BASE_SCORES.fema_flood_foundation,
          source_method: "fema_api",
          suggested_opener: OPENERS.fema_flood_foundation.opener,
          best_call_window: OPENERS.fema_flood_foundation.window,
          estimated_value: 15000,
          raw_source_data: dec,
        });
      }
    }
  } catch (e) { console.error("[foundation] FEMA:", e); }

  // 3. OpenFEMA NfipMultipleLossProperties — repeat-flood properties by zip = foundation risk.
  // nfipPolicies endpoint was removed (returns 404). NfipMultipleLossProperties is the
  // correct dataset — properties with 2+ paid claims, indexed by zip. Filter: stateAbbreviation.
  try {
    const res = await fetch(
      `https://www.fema.gov/api/open/v1/NfipMultipleLossProperties?$filter=stateAbbreviation eq '${state}'&$select=stateAbbreviation,county,zipCode,totalLosses,floodZone,mostRecentDateofLoss&$top=20`,
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
          signal_type: "nfip_foundation",
          signal_detail: `OpenFEMA NFIP Multiple-Loss Properties: ${props.length} properties in ${state} with 2+ flood claims. Highest-risk zip: ${topZip?.zipCode ?? "?"} (${topZip?.totalLosses ?? "?"} claims, zone ${topZip?.floodZone ?? "?"}). Chronic repeat flooding = foundation water intrusion.`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.nfip_foundation,
          source_method: "fema_nfip_api",
          suggested_opener: OPENERS.nfip_foundation.opener,
          best_call_window: OPENERS.nfip_foundation.window,
          estimated_value: 14000,
          raw_source_data: { state, properties_count: props.length, total_losses: totalLosses, top_zip: topZip },
        });
      }
    }
  } catch (e) { console.error("[foundation] NFIP:", e); }

  // 4. BSEED foundation/structural permits — per-address (confirmed service)
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%FOUNDATION%' OR work_description LIKE '%STRUCTURAL%' OR work_description LIKE '%WATERPROOF%' OR work_description LIKE '%BASEMENT%' OR work_description LIKE '%UNDERPINNING%' OR work_description LIKE '%CRAWL SPACE%')`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,work_description,amt_estimated_contractor_cost,latitude,longitude&resultRecordCount=40&orderByFields=issued_date+DESC&f=json`,
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
        const signalType = desc.includes("STRUCTURAL") ? "structural_permit" : "foundation_repair_permit";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: signalType,
          signal_detail: `BSEED permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES[signalType],
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS[signalType].opener,
          best_call_window: OPENERS[signalType].window,
          estimated_value: Number(a.amt_estimated_contractor_cost) || 12000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[foundation] BSEED:", e); }

  // 5. USGS Real-Time Streamflow — Michigan rivers at/above flood stage
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
          signal_type: "heavy_rain_foundation",
          signal_detail: `USGS streamflow: ${flooded.length} MI gauges at or above action stage — saturated soil creates hydrostatic pressure on foundations. Sites: ${siteNames}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.heavy_rain_foundation,
          source_method: "usgs_streamflow",
          suggested_opener: OPENERS.heavy_rain_foundation.opener,
          best_call_window: OPENERS.heavy_rain_foundation.window,
          estimated_value: 12000,
          raw_source_data: { flooded_count: flooded.length, sites: siteNames },
        });
      }
    }
  } catch (e) { console.error("[foundation] USGS streamflow:", e); }

  // 6. USGS Earthquake Catalog — seismic events within 400km of SE Michigan
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const res = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${since}&minmagnitude=2.5&maxradiuskm=400&latitude=42.33&longitude=-83.05`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? []).slice(0, 3)) {
        const props = feat?.properties ?? {};
        const [lon, lat] = feat?.geometry?.coordinates ?? [];
        const mag: number = props.mag ?? 0;
        signals.push({
          address: props.place ?? `${state} region`,
          city: props.place?.split(", ").pop() ?? state, zip: "",
          signal_type: "foundation_flood_risk",
          signal_detail: `USGS M${mag} earthquake: ${props.place} — seismic events cause foundation cracking and joint separation in older homes`,
          signal_date: new Date(props.time).toISOString().split("T")[0],
          score: Math.min(9, BASE_SCORES.foundation_flood_risk - 1 + Math.floor(mag)),
          source_method: "usgs_earthquakes",
          suggested_opener: OPENERS.foundation_flood_risk.opener,
          best_call_window: "Within 30 days of seismic event",
          estimated_value: 12000,
          raw_source_data: { mag, place: props.place, lat, lon, time: props.time },
        });
      }
    }
  } catch (e) { console.error("[foundation] USGS earthquakes:", e); }

  // 7. US Drought Monitor — D2+ drought causes clay soil shrinkage → foundation movement
  try {
    const res = await fetch("https://usdm.climate.gov/currentConditions/usdm_counties.json", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (res.ok) {
      const counties: any[] = await res.json();
      const miDrought = counties.filter((c: any) => c.fips?.startsWith("26") && Number(c.dm ?? 0) >= 2);
      if (miDrought.length > 0) {
        const worst = [...miDrought].sort((a: any, b: any) => Number(b.dm) - Number(a.dm))[0];
        signals.push({
          address: `Michigan — ${miDrought.length} counties in D${worst.dm}+ drought`,
          city: state, zip: "",
          signal_type: "foundation_flood_risk",
          signal_detail: `US Drought Monitor: ${miDrought.length} MI counties in D2+ drought — severe clay soil shrinkage causes foundation settlement and new cracking`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foundation_flood_risk,
          source_method: "drought_monitor",
          suggested_opener: OPENERS.foundation_flood_risk.opener,
          best_call_window: "During and 60 days after drought period",
          estimated_value: 12000,
          raw_source_data: { drought_counties: miDrought.length, worst_level: worst.dm },
        });
      }
    }
  } catch (e) { console.error("[foundation] drought monitor:", e); }

  // 8. Detroit Assessor property sales — new homeowners discover foundation issues first season
  try {
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`sale_date >= '${cutoff}' AND amt_sale_price > 10000`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${where}&outFields=address,zip_code,sale_date,grantee&resultRecordCount=30&orderByFields=sale_date+DESC&f=json`,
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
          signal_type: "heavy_rain_foundation",
          signal_detail: `Detroit property sale: ${a.grantee ?? "New owner"} — foundation issues in Detroit's older housing stock are almost never disclosed during sale. New owners discover them at first heavy rain`,
          signal_date: a.sale_date ? new Date(a.sale_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessor_sales",
          suggested_opener: "Congratulations on your new home — foundation issues in Detroit's older homes are rarely visible until the first heavy rain. A 30-minute assessment before spring identifies problems before they cost $40k.",
          best_call_window: "Within 90 days of purchase, especially before spring rains",
          estimated_value: 12000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[foundation] assessor sales:", e); }

  // 9. National Register of Historic Places — historic homes require specialized foundation work
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/national_register_of_historic_places/FeatureServer/0/query?where=1%3D1&outFields=resource_name,address,city,period_of_significance,area_of_significance,listed_date&resultRecordCount=40&f=json",
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
          signal_type: "foundation_flood_risk",
          signal_detail: `National Register of Historic Places: ${a.resource_name ?? addr} — historic structures require specialized masonry and foundation techniques. Period: ${a.period_of_significance ?? "pre-1960"}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.foundation_flood_risk - 1,
          source_method: "detroit_historic_register",
          suggested_opener: "Your home is on the National Register of Historic Places — standard foundation contractors can void historic designation. We specialize in preservation-compliant waterproofing that protects the structure and your historic tax credits.",
          best_call_window: "Evergreen — historic homes always need specialized work",
          estimated_value: 15000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[foundation] historic register:", e); }

  return signals;
}
