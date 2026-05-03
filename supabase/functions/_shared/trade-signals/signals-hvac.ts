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

  // 5. US Drought Monitor — D1+ drought pushes AC/heating to continuous-run failure
  try {
    const res = await fetch("https://usdm.climate.gov/currentConditions/usdm_counties.json", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (res.ok) {
      const counties: any[] = await res.json();
      const miDrought = counties.filter((c: any) => c.fips?.startsWith("26") && Number(c.dm ?? 0) >= 1);
      if (miDrought.length > 0) {
        signals.push({
          address: `Michigan — ${miDrought.length} counties in drought`,
          city: state, zip: "",
          signal_type: "extreme_weather_hvac",
          signal_detail: `US Drought Monitor: ${miDrought.length} MI counties in D1+ drought — HVAC systems running continuously under heat stress, accelerating compressor failure`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.extreme_weather_hvac - 1,
          source_method: "drought_monitor",
          suggested_opener: OPENERS.extreme_weather_hvac.opener,
          best_call_window: "During drought period",
          estimated_value: 7000,
          raw_source_data: { drought_counties: miDrought.length },
        });
      }
    }
  } catch (e) { console.error("[hvac] drought monitor:", e); }

  // 6. CFPB HMDA Refinance Loans — equity-flush homeowners fund HVAC replacement
  try {
    const res = await fetch(
      `https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?states=${state}&years=2023&actions_taken=1&loan_purposes=3`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const total = (d?.aggregations ?? []).reduce((n: number, r: any) => n + (r.count || 0), 0);
      if (total > 0) {
        signals.push({
          address: `${state} — ${total.toLocaleString()} refinances (2023)`,
          city: state, zip: "",
          signal_type: "homeowner_equity_area",
          signal_detail: `CFPB HMDA: ${total.toLocaleString()} refinance originations in ${state} (2023) — homeowners with tapped equity often fund HVAC replacement as first major upgrade`,
          signal_date: new Date().toISOString().split("T")[0],
          score: 5,
          source_method: "ffiec_hmda",
          suggested_opener: "You recently refinanced — a 15-year-old HVAC system costs $400/yr more to run than a new one. Many homeowners use that equity to upgrade before it fails. Want a free efficiency check?",
          best_call_window: "Within 90 days of refinance close",
          estimated_value: 7000,
          raw_source_data: { total, state, year: 2023, loan_purpose: "refinance" },
        });
      }
    }
  } catch (e) { console.error("[hvac] CFPB refi:", e); }

  // 7. NOAA NWS 7-Day Forecast — extreme temps incoming (advance outreach before the spike)
  try {
    const res = await fetch("https://api.weather.gov/gridpoints/DTX/65,33/forecast", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)", Accept: "application/geo+json" },
    });
    if (res.ok) {
      const geo = await res.json();
      const periods: any[] = geo?.properties?.periods ?? [];
      for (const p of periods.slice(0, 14)) {
        const temp: number = p?.temperature ?? 0;
        const isDaytime: boolean = p?.isDaytime ?? true;
        if ((isDaytime && temp >= 92) || (!isDaytime && temp <= 10)) {
          const forecastDate = p?.startTime ? new Date(p.startTime).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0];
          const isHeat = temp >= 92;
          signals.push({
            address: "SE Michigan — forecast extreme temperature",
            city: state, zip: "",
            signal_type: "extreme_weather_hvac",
            signal_detail: `NWS 7-day forecast: ${p.name} ${temp}°F — ${isHeat ? "heat wave" : "polar vortex"} in ${Math.round((new Date(p.startTime).getTime() - Date.now()) / 86400000)} days. HVAC systems that haven't been serviced fail under extreme load.`,
            signal_date: forecastDate,
            score: BASE_SCORES.extreme_weather_hvac,
            source_method: "noaa_nws_forecast",
            suggested_opener: isHeat
              ? `A heat wave is forecast for ${p.name} — HVAC systems that haven't been serviced fail exactly when you need them most. We're doing pre-season tune-ups this week before slots fill up.`
              : `A severe cold snap is forecast for ${p.name} — heating systems that haven't been serviced fail on the coldest nights. We're doing pre-storm checks this week.`,
            best_call_window: "3-5 days before extreme temperature event",
            estimated_value: 7000,
            raw_source_data: { name: p.name, temp, isDaytime, forecastDate },
          });
          break; // one pre-storm signal per run is enough
        }
      }
    }
  } catch (e) { console.error("[hvac] NWS 7-day forecast:", e); }

  // 8. Detroit Assessor property sales — new homeowners need HVAC assessment
  try {
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`sale_date >= '${cutoff}' AND amt_sale_price > 10000`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${where}&outFields=address,zip_code,sale_date,amt_sale_price,grantee&resultRecordCount=30&orderByFields=sale_date+DESC&f=json`,
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
          signal_type: "aging_system_proxy",
          signal_detail: `Detroit property sale: ${a.grantee ?? "New owner"} purchased for $${(a.amt_sale_price || 0).toLocaleString()} — HVAC system age is unknown to new owner; pre-1980 homes often have original equipment`,
          signal_date: a.sale_date ? new Date(a.sale_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessor_sales",
          suggested_opener: "Welcome to your new home — the HVAC system age is rarely disclosed during sale. A free assessment tells you the equipment's life expectancy before you have a problem in the middle of summer.",
          best_call_window: "Within 90 days of purchase",
          estimated_value: 7000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[hvac] assessor sales:", e); }

  // 9. BSEED Rental Registrations — landlords actively registering properties need HVAC service contracts
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_rental_registrations/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,issued_date,registration_type,neighborhood&resultRecordCount=50&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "aging_system_proxy",
          signal_detail: `BSEED Rental Registration (${a.registration_type ?? "rental"}): landlord at ${addr} — rental properties in Detroit average 50+ years old with original HVAC. City registration = actively managed, decision-maker reachable`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "bseed_rental_registrations",
          suggested_opener: "Your rental property at this address is registered with the city — most Detroit rental properties haven't had an HVAC inspection in years. Tenant comfort complaints and emergency breakdowns cost landlords $500-2k more than preventive service contracts.",
          best_call_window: "Within 60 days of registration",
          estimated_value: 4000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[hvac] rental registrations:", e); }

  return signals;
}
