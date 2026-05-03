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

  // 10. BSEED Active Residential Compliance Certificates expiring — reinspection = must fix issues first
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_residential_compliance_certificates/FeatureServer/0/query?where=num_days_until_expired+%3C%3D+60+AND+num_days_until_expired+%3E%3D+0&outFields=address,zip_code,issued_date,expired_date,num_days_until_expired&resultRecordCount=40&orderByFields=num_days_until_expired+ASC&f=json",
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
          signal_detail: `BSEED Compliance Cert expiring in ${a.num_days_until_expired ?? "?"} days: ${addr} — reinspection requires all structural issues resolved. Foundation cracks, water intrusion, and settlement must be remediated before certificate renewal`,
          signal_date: a.expired_date ? new Date(a.expired_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 8,
          source_method: "bseed_compliance_certs",
          suggested_opener: "Your BSEED compliance certificate expires soon — the reinspection will flag any foundation or structural issues. We offer a pre-inspection assessment so you know what to fix before the city inspector arrives.",
          best_call_window: "30-60 days before certificate expiration",
          estimated_value: 10000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[foundation] compliance certs:", e); }

  // 11. SeeClickFix 311 — Detroit flooding, sinkhole, and structural collapse reports (keyword-routed)
  try {
    const res = await fetch(
      "https://seeclickfix.com/api/v2/issues?place_url=detroit&per_page=50&sort=created_at&direction=desc",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) {
      const d = await res.json();
      for (const issue of (d?.issues ?? [])) {
        const summary: string = (issue?.summary ?? issue?.description ?? "").toLowerCase();
        if (!/flood|sinkhole|collapse|settling|crack|sink hole|basement.*water|water.*basement|foundation/i.test(summary)) continue;
        const addr: string = issue?.address ?? issue?.location_name ?? "";
        const zip: string = (addr.match(/\b(4\d{4})\b/) ?? [])[1] ?? "";
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: issue?.city ?? "Detroit", zip,
          signal_type: "heavy_rain_foundation",
          signal_detail: `SeeClickFix 311 foundation/flood report: "${issue.summary ?? "issue"}" — ${issue.status ?? "open"}. Resident-reported flooding, settling, or structural issue = active foundation concern`,
          signal_date: issue.created_at ? issue.created_at.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 8,
          source_method: "seeclickfix_foundation",
          suggested_opener: "A flooding or sinking issue was recently reported at your address — Detroit clay soil causes seasonal foundation movement that only gets worse without intervention. We do free assessments and most repairs are covered by homeowner's insurance.",
          best_call_window: "Within 30 days of report",
          estimated_value: 12000,
          raw_source_data: { id: issue.id, summary: issue.summary, status: issue.status },
        });
      }
    }
  } catch (e) { console.error("[foundation] SeeClickFix:", e); }

  // 12. Detroit Assessment Roll 2026 — recently sold pre-1950 Detroit homes (clay soil + age)
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
        const age = 2026 - yrBuilt;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "heavy_rain_foundation",
          signal_detail: `Detroit new owner: ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — ${age}-year-old Detroit home on expansive clay soil. Pre-1950 foundations used mortar that carbonates and crumbles; new owners first notice cracks after spring thaw`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: 8,
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Congrats on ${addr}! Pre-1950 Detroit foundations on clay soil develop cracks after 75+ years of freeze-thaw cycles. A free inspection before spring will catch water intrusion early — most repairs are still minor at that stage.`,
          best_call_window: "Within 90 days of purchase, before spring thaw",
          estimated_value: 10000,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[foundation] Detroit assessment roll:", e); }

  // New: Residential Inspections — failed or pending results signal structural/foundation issues
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Residential_Inspections_%28combined%29/FeatureServer/0/query?where=result+IS+NOT+NULL+AND+(result+LIKE+%27%25FAIL%25%27+OR+result+LIKE+%27%25REJECT%25%27+OR+result+LIKE+%27%25NOT+PASS%25%27)&outFields=address,zipcode,date,result,record_id&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").replace(/-+/g, " ").trim();
        if (!addr || addr.length < 5) continue;
        const zip = String(a.zipcode || "").trim();
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const inspDate = a.date ? String(a.date).slice(0, 10) : new Date().toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "heavy_rain_foundation",
          signal_detail: `Residential inspection failed/rejected: ${addr} (record ${a.record_id || "?"}) — ${a.result || "failed inspection"}. Failed inspections frequently cite foundation cracks, water intrusion, or structural settling`,
          signal_date: inspDate,
          score: 7,
          source_method: "residential_inspections",
          suggested_opener: `Your property at ${addr} had a failed city inspection on record — foundation and structural issues are the most common reason Detroit homes fail inspection. We offer free foundation assessments and can help you get the property cleared.`,
          best_call_window: "Within 60 days of failed inspection",
          estimated_value: 8000,
          raw_source_data: { addr, zip, result: a.result, record_id: a.record_id, date: inspDate },
        });
      }
    }
  } catch (e) { console.error("[foundation] residential inspections:", e); }

  // New: ROW Permits — utility excavation near foundations = vibration/settlement signal
  try {
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/ROW_Permits/FeatureServer/0/query?where=issued_date+%3E%3D+%27${since90}%27+AND+(description+LIKE+%27%25excavat%25%27+OR+description+LIKE+%27%25sewer%25%27+OR+description+LIKE+%27%25water+main%25%27)&outFields=permit_address,permit_type,issued_date,description,contractor&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json`,
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
          signal_type: "heavy_rain_foundation",
          signal_detail: `ROW excavation permit near ${addr}: ${desc}. Underground excavation for sewers and water mains causes soil settlement and vibration that can open existing foundation cracks in adjacent properties`,
          signal_date: issued,
          score: 6,
          source_method: "row_permits",
          suggested_opener: `Excavation work was recently permitted near ${addr} — underground utility work causes soil movement that can trigger foundation settlement in adjacent homes built on Detroit's clay soil. A free inspection now catches any movement early.`,
          best_call_window: "Within 60 days of ROW permit",
          estimated_value: 8000,
          raw_source_data: { addr, permit_type: a.permit_type, issued, desc },
        });
      }
    }
  } catch (e) { console.error("[foundation] ROW permits:", e); }

  // BSEED Presale Inspections — FAIL results (structural/foundation issues block sale)
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
          signal_type: "heavy_rain_foundation",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — structural/foundation issues are among the top reasons older Detroit homes fail presale inspection. Seller must repair to close`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 9,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its city presale inspection — foundation cracks, water intrusion, and structural movement are commonly cited. We can assess fast and document repairs for re-inspection. Don't lose your buyer over foundation issues.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 10000,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[foundation] presale inspections:", e); }

  // Plan Reviews — approved foundation/basement/structural plans (work imminent)
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%FOUNDATION%' OR work_description LIKE '%BASEMENT%' OR work_description LIKE '%STRUCTURAL%' OR work_description LIKE '%WATERPROOF%' OR work_description LIKE '%CRAWL%') AND task_status LIKE '%Approved%'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permit_plan_reviews/FeatureServer/0/query?where=${where}&outFields=address,zip_code,submitted_date,work_description,task_status&resultRecordCount=25&orderByFields=ObjectId+DESC&f=json`,
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
          signal_type: "heavy_rain_foundation",
          signal_detail: `BSEED plan review approved: ${(a.work_description ?? "foundation project").slice(0, 100)} — approved plans mean foundation/basement work is imminent`,
          signal_date: a.submitted_date ? new Date(a.submitted_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.heavy_rain_foundation + 2,
          source_method: "bseed_plan_reviews",
          suggested_opener: `Your foundation project at ${addr} has approved plans — we can provide a same-week assessment and often coordinate directly with your contractor for seamless waterproofing integration.`,
          best_call_window: "Immediately — plans approved means permit imminent",
          estimated_value: 10000,
          raw_source_data: { addr, zip, desc: a.work_description, status: a.task_status },
        });
      }
    }
  } catch (e) { console.error("[foundation] plan reviews:", e); }

  // FEMA Repetitive Loss Properties — multi-flood-claim addresses = highest foundation risk in Detroit
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Repetitive_Loss/FeatureServer/0/query?where=1%3D1&outFields=address,City&resultRecordCount=100&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").trim();
        if (!addr) continue;
        signals.push({
          address: addr, city: a.City || "Detroit", zip: "",
          signal_type: "heavy_rain_foundation",
          signal_detail: `FEMA Repetitive Loss: ${addr} — this address has filed multiple flood insurance claims with FEMA. Repeated flooding = the foundation waterproofing has failed. These homeowners spend thousands on insurance but haven't fixed the root cause`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.heavy_rain_foundation + 2,
          source_method: "fema_repetitive_loss",
          suggested_opener: `Your address at ${addr} appears on FEMA's repetitive flood loss list — that means multiple flood insurance claims. We specialize in permanent basement waterproofing that stops the flooding instead of just paying for cleanup every year. Want a free estimate?`,
          best_call_window: "Any time — these homeowners have chronic flooding and are actively looking for solutions",
          estimated_value: 12000,
          raw_source_data: { address: addr, city: a.City },
        });
      }
    }
  } catch (e) { console.error("[foundation] repetitive loss:", e); }

  // Detroit Demo Pipeline — demolition vibration damages neighboring foundations
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Demo_Pipeline/FeatureServer/0/query?where=commercial_building%3D'No'&outFields=address,neighborhood,council_district&resultRecordCount=50&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").trim();
        if (!addr) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "heavy_rain_foundation",
          signal_detail: `Demo Pipeline: ${addr} (${a.neighborhood ?? "Detroit"}) — scheduled for city demolition. Mechanical demolition equipment causes ground vibration that can widen existing foundation cracks in neighboring homes`,
          signal_date: new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "detroit_demo_pipeline",
          suggested_opener: `A house near you is on the city's demolition list — the heavy equipment used in teardown creates ground vibration that can widen existing cracks in nearby foundations. A quick inspection now costs nothing; missing it can cost $15,000 to fix later.`,
          best_call_window: "Before demolition equipment arrives on block",
          estimated_value: 8000,
          raw_source_data: { addr, neighborhood: a.neighborhood, district: a.council_district },
        });
      }
    }
  } catch (e) { console.error("[foundation] demo pipeline:", e); }

  // BSEED Rental Registrations — new landlords need foundation inspection for rental compliance
  try {
    const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`issued_date >= '${since60}'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_rental_registrations/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,registration_type&resultRecordCount=25&orderByFields=issued_date+DESC&f=json`,
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
          signal_type: "heavy_rain_foundation",
          signal_detail: `New rental registration: ${addr} — pre-1980 Detroit homes registered for rental often have undisclosed basement water intrusion that becomes a landlord liability after tenant move-in`,
          signal_date: a.issued_date ? a.issued_date.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "bseed_rental_registration",
          suggested_opener: `You just registered ${addr} as a rental — basement water intrusion is the #1 undisclosed defect that landlords get called on after tenant move-in. A waterproofing inspection before occupancy protects you from liability.`,
          best_call_window: "Before first tenant occupancy",
          estimated_value: 7000,
          raw_source_data: { addr, zip, reg_type: a.registration_type, issued: a.issued_date },
        });
      }
    }
  } catch (e) { console.error("[foundation] rental registrations:", e); }

  // --- BSEED Residential CofC Expiring ---
  try {
    const where = encodeURIComponent(`num_days_until_expired <= 90 AND num_days_until_expired >= 0`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_residential_compliance_certificates/FeatureServer/0/query?where=${where}&outFields=address,zip_code,num_days_until_expired,expired_date&resultRecordCount=50&orderByFields=num_days_until_expired+ASC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const today = new Date().toISOString().split("T")[0];
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").trim();
        const zip = String(a.zip_code || "").trim();
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const daysLeft = a.num_days_until_expired ?? 90;
        const score = daysLeft <= 7 ? 9 : daysLeft <= 30 ? 8 : 7;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "cofc_foundation_inspection",
          signal_detail: `CofC expires in ${daysLeft} days — BSEED inspects basement/crawlspace conditions including water infiltration and structural cracking at renewal. ${addr} foundation issues are a common CofC failure`,
          signal_date: today,
          score,
          source_method: "bseed_cofc_expiring",
          suggested_opener: `Your rental at ${addr} has a Certificate of Compliance expiring in ${daysLeft} days — BSEED inspectors check basements for water seepage and structural cracks. A pre-inspection waterproofing assessment prevents a CofC failure.`,
          best_call_window: "Immediately — renewal deadline",
          estimated_value: 8000,
          raw_source_data: { addr, zip, days_left: daysLeft, expires: a.expired_date },
        });
      }
    }
  } catch (e) { console.error("[foundation] cofc expiring:", e); }

  return signals;
}
