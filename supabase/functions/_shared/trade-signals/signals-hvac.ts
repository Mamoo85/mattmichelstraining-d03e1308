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
  commercial_compliance_hvac: 8,
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

  // 10. Wayne County Parcel Sales — new owner + old house in Wayne County suburbs (non-Detroit)
  try {
    const since180 = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://utility.waynecountymi.gov/arcgis/rest/services/Property/FeatureServer/0/query?where=SALE_DATE+%3E%3D+DATE+%27${since180}%27+AND+YEAR_BUILT+%3C+1990&outFields=ADDRESS,ZIPCODE,YEAR_BUILT,SALE_DATE&resultRecordCount=60&orderByFields=SALE_DATE+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.ADDRESS ?? "";
        const zip: string = String(a.ZIPCODE ?? "").replace(/[^0-9]/g, "").slice(0, 5);
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const yearBuilt: number = a.YEAR_BUILT ?? 0;
        signals.push({
          address: addr, city: "Wayne County", zip,
          signal_type: "aging_system_proxy",
          signal_detail: `Wayne County new owner: ${addr} built ${yearBuilt > 0 ? yearBuilt : "pre-1990"} — HVAC systems in homes this age are 30-40+ years old, well past the 15-20 year expected lifespan`,
          signal_date: a.SALE_DATE ? String(a.SALE_DATE).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "wayne_county_parcel",
          suggested_opener: `Congrats on the new home at ${addr}! Homes of that age typically have HVAC systems at or past end of life. We offer a free system assessment — most new owners are surprised at what they find.`,
          best_call_window: "Within 90 days of purchase",
          estimated_value: 8000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[hvac] Wayne County parcel:", e); }

  // 11. Oakland County Parcel Sales — new owner + old house in Oakland County suburbs
  try {
    const since180 = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://www.oakgov.com/egis/rest/services/Property/ParcelInfo/FeatureServer/0/query?where=SALE_DATE+%3E%3D+DATE+%27${since180}%27+AND+YEAR_BUILT+%3C+1990&outFields=SITUS_ADDRESS,ZIP,YEAR_BUILT,SALE_DATE&resultRecordCount=60&orderByFields=SALE_DATE+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.SITUS_ADDRESS ?? "";
        const zip: string = String(a.ZIP ?? "").replace(/[^0-9]/g, "").slice(0, 5);
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: "Oakland County", zip,
          signal_type: "aging_system_proxy",
          signal_detail: `Oakland County new owner: ${addr} built ${a.YEAR_BUILT > 0 ? a.YEAR_BUILT : "pre-1990"} — HVAC systems in older Oakland County homes are commonly original equipment`,
          signal_date: a.SALE_DATE ? String(a.SALE_DATE).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "oakland_county_parcel",
          suggested_opener: `New home at ${addr}? Homes built in that era typically have HVAC systems approaching or past end of life. Free system assessment with no obligation.`,
          best_call_window: "Within 90 days of purchase",
          estimated_value: 8000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[hvac] Oakland County parcel:", e); }

  // 12. Detroit Assessment Roll 2026 — recently sold pre-1980 Detroit homes (aging HVAC)
  try {
    const since = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/tentative_assessment_roll_2026/FeatureServer/0/query?where=sale_date+%3E%3D+'${since}'+AND+residential_year_built+%3C+1980+AND+residential_year_built+%3E+1880+AND+is_improved+%3D+1&outFields=address,zip_code,residential_year_built,sale_date,taxpayer_1&resultRecordCount=40&orderByFields=sale_date+DESC&f=json`,
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
        const hvacAge = 2026 - yrBuilt;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "aging_system_proxy",
          signal_detail: `Detroit new owner: ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — ${hvacAge}-year-old home typically has original or once-replaced HVAC. New owners discover failing systems within the first heating/cooling season`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: BASE_SCORES.aging_system_proxy + (yrBuilt < 1960 ? 1 : 0),
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Congrats on ${addr}! Built ${yrBuilt} means the HVAC system is at or past its useful life — new owners often don't find out until it fails on the hottest or coldest day. Free system assessment this week?`,
          best_call_window: "Within 90 days of purchase, before seasonal peak",
          estimated_value: 8000,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[hvac] Detroit assessment roll:", e); }

  // 13. BSEED Residential Compliance Certificates expiring in 60 days — pre-inspection HVAC window
  try {
    const certWhere = encodeURIComponent(`num_days_until_expired <= 60 AND num_days_until_expired > 0`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_residential_compliance_certificates/FeatureServer/0/query?where=${certWhere}&outFields=address,zip_code,expired_date,num_days_until_expired&resultRecordCount=40&orderByFields=num_days_until_expired+ASC&f=json`,
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
        const daysLeft = Number(a.num_days_until_expired) || 60;
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "aging_system_proxy",
          signal_detail: `Detroit residential CofC expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${a.expired_date ?? ""}): ${addr}. Rental inspection requires functional heating — landlords scramble before the deadline`,
          signal_date: new Date().toISOString().split("T")[0],
          score: daysLeft <= 7 ? 9 : daysLeft <= 30 ? 8 : 7,
          source_method: "bseed_residential_cert_expiry",
          suggested_opener: `Your rental certificate at ${addr} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — a functioning heating system is required to pass the city re-inspection. We do same-week furnace assessments and repairs so you're not scrambling at the deadline.`,
          best_call_window: `Within ${Math.min(daysLeft, 30)} days`,
          estimated_value: 5000,
          raw_source_data: { addr, zip, days_left: daysLeft, expired_date: a.expired_date },
        });
      }
    }
  } catch (e) { console.error("[hvac] residential cert expiry:", e); }

  // 14. BSEED Presale Inspections — FAIL results (HVAC is frequently cited)
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
          signal_type: "aging_system_proxy",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — furnace/HVAC performance and carbon monoxide testing are standard presale inspection items. Seller must repair before closing`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 9,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — HVAC systems are inspected for safety and operation. We can assess and repair fast so you can get your re-inspection scheduled before losing the buyer.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 7000,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[hvac] presale inspections:", e); }

  // 14. Detroit commercial building compliance failures (YELLOW/RED) — commercial HVAC demand
  try {
    const complianceWhere = encodeURIComponent(`commercial_compliance_indicator = 'YELLOW' OR commercial_compliance_indicator = 'RED'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_commercial_building_compliance/FeatureServer/0/query?where=${complianceWhere}&outFields=parcel_address,taxpayer_1,commercial_compliance_indicator,commercial_compliance_detail,latest_inspection_result,amt_balance_due,longitude,latitude&resultRecordCount=40&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.parcel_address || "").trim();
        if (!addr) continue;
        const status = a.commercial_compliance_indicator ?? "YELLOW";
        const detail = (a.commercial_compliance_detail || "").slice(0, 100);
        const owner = (a.taxpayer_1 || "").trim();
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "commercial_compliance_hvac",
          signal_detail: `Detroit commercial compliance ${status}: ${addr}. ${detail}${owner ? ` — Owner: ${owner}` : ""}. Failing commercial inspection often means outdated HVAC that doesn't meet current energy code`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.commercial_compliance_hvac - (status === "YELLOW" ? 1 : 0),
          source_method: "bseed_commercial_compliance",
          suggested_opener: `Your commercial property at ${addr} is flagged ${status} in the city compliance system — HVAC code compliance is a top reason commercial buildings fail inspection. We do commercial HVAC audits and can document everything for your CofC renewal.`,
          best_call_window: "Any time — compliance deadline creates urgency",
          estimated_value: 15000,
          raw_source_data: { addr, status, detail, owner, amt_balance_due: a.amt_balance_due },
        });
      }
    }
  } catch (e) { console.error("[hvac] commercial compliance:", e); }

  // 14. Detroit commercial compliance certificates expiring in 90 days — pre-inspection window
  try {
    const certWhere = encodeURIComponent(`num_days_until_expired <= 90 AND num_days_until_expired > 0`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_commercial_compliance_certificates/FeatureServer/0/query?where=${certWhere}&outFields=address,zip_code,expired_date,num_days_until_expired&resultRecordCount=40&orderByFields=num_days_until_expired+ASC&f=json`,
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
        const daysLeft = Number(a.num_days_until_expired) || 90;
        const expDate = a.expired_date ? String(a.expired_date).slice(0, 10) : "";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "commercial_compliance_hvac",
          signal_detail: `Detroit commercial CofC expires in ${daysLeft} days${expDate ? " (" + expDate + ")" : ""}: ${addr}. Pre-inspection HVAC tune-up prevents re-inspection delays and failed CofC`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.commercial_compliance_hvac - (daysLeft > 45 ? 1 : 0),
          source_method: "bseed_commercial_cert_expiry",
          suggested_opener: `Your Certificate of Compliance at ${addr} expires in ${daysLeft} days — a failing HVAC system is one of the top reasons commercial buildings don't pass re-inspection. We can do a pre-inspection audit this week so you're not scrambling at the deadline.`,
          best_call_window: `Within ${Math.min(daysLeft, 60)} days`,
          estimated_value: 12000,
          raw_source_data: { addr, zip, days_left: daysLeft, expired_date: expDate },
        });
      }
    }
  } catch (e) { console.error("[hvac] commercial cert expiry:", e); }

  // 15. Multifamily Housing Construction Sites — new builds needing fresh HVAC installs
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/multifamily_housing_construction_sites/FeatureServer/0/query?where=construction_status+IN+('Under+Construction','Construction+Not+Started')&outFields=address,zip_code,owner_developer_name,legal_entity,total_units,construction_status,construction_start_year&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json",
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
        const units = a.total_units || 0;
        const developer = a.owner_developer_name || a.legal_entity || "developer";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "commercial_compliance_hvac",
          signal_detail: `Multifamily construction site: ${addr} (${units} units, ${a.construction_status}) — ${developer}. New construction requires full HVAC system specification and installation`,
          signal_date: new Date().toISOString().split("T")[0],
          score: units >= 20 ? BASE_SCORES.commercial_compliance_hvac + 1 : BASE_SCORES.commercial_compliance_hvac,
          source_method: "multifamily_construction_sites",
          suggested_opener: `I noticed ${addr} is under construction — ${units} units of new multifamily housing needs full HVAC specification and installation. Are you locked in with a mechanical contractor yet?`,
          best_call_window: "During construction phase — pre-drywall for new builds",
          estimated_value: units * 3500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[hvac] multifamily construction:", e); }

  // 16. Existing Multifamily Housing — aging HVAC in regulated affordable housing
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/existing_multifamily_housing_sites/FeatureServer/0/query?where=regulatory_status+%3D+'Regulated'+AND+total_units+%3E+10&outFields=address,zip_code,owner_developer_name,legal_entity,total_units,regulatory_status&resultRecordCount=50&orderByFields=OBJECTID+DESC&f=json",
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
        const units = a.total_units || 0;
        const developer = a.owner_developer_name || a.legal_entity || "property manager";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "aging_system_proxy",
          signal_detail: `Existing regulated multifamily: ${addr} (${units} units) — ${developer}. Regulated affordable housing has deferred HVAC maintenance and compliance-mandated upgrade schedules`,
          signal_date: new Date().toISOString().split("T")[0],
          score: units >= 25 ? BASE_SCORES.aging_system_proxy + 1 : BASE_SCORES.aging_system_proxy,
          source_method: "existing_multifamily_sites",
          suggested_opener: `We work with property managers at ${addr}-type regulated multifamily buildings — HVAC service contracts with priority emergency response. Are you currently contracted?`,
          best_call_window: "Any time — multifamily HVAC is evergreen B2B",
          estimated_value: units * 1200,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[hvac] existing multifamily:", e); }

  // 17. Energy/Water Benchmarking — high EUI buildings need HVAC upgrades
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/energy_water_benchmarking_ordinance_-_buildings/FeatureServer/0/query?where=is_municipal+%3D+0+AND+site_total_eui+%3E+100&outFields=parcel_address,zip_code,energystar_name,assessor_year_built,site_total_eui,energystar_score,square_footage_category&resultRecordCount=40&orderByFields=site_total_eui+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.parcel_address || "").trim();
        const zip = String(a.zip_code || "").trim();
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const eui = a.site_total_eui || 0;
        const score = a.energystar_score;
        const name = a.energystar_name || "";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "commercial_compliance_hvac",
          signal_detail: `Energy benchmarking: ${addr} (${name}) — EUI ${eui}, Energy Star score ${score ?? "not rated"}, built ${a.assessor_year_built || "unknown"}. High energy use = inefficient HVAC system needing replacement/upgrade`,
          signal_date: new Date().toISOString().split("T")[0],
          score: eui > 200 ? BASE_SCORES.commercial_compliance_hvac + 1 : BASE_SCORES.commercial_compliance_hvac,
          source_method: "energy_benchmarking_ordinance",
          suggested_opener: `${name || addr} shows a high energy use intensity score in Detroit's benchmarking database — buildings with high EUI almost always have aging, inefficient HVAC as the primary driver. We do free commercial HVAC energy audits.`,
          best_call_window: "Any time — energy cost is always top of mind for property managers",
          estimated_value: 25000,
          raw_source_data: { addr, zip, eui, energystar_score: score, year_built: a.assessor_year_built },
        });
      }
    }
  } catch (e) { console.error("[hvac] energy benchmarking:", e); }

  // 18. BSEED Rental Compliance — non-compliant rentals need HVAC service contracts
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_rental_compliance_public_view/FeatureServer/0/query?where=current_cofc_expired_date+IS+NULL+OR+current_reg_issued_date+IS+NULL&outFields=record_addresses,parcel_address,current_cofc_issued_date,current_cofc_expired_date,current_reg_issued_date&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.record_addresses || a.parcel_address || "").trim();
        if (!addr) continue;
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "aging_system_proxy",
          signal_detail: `Rental compliance gap: ${addr} — missing or expired CofC/registration. Non-compliant rentals frequently have deferred HVAC maintenance as root cause of inspection failures`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.aging_system_proxy,
          source_method: "bseed_rental_compliance_view",
          suggested_opener: `Your rental property at ${addr} has a gap in its compliance certificate history — HVAC failures are the most common reason rental inspections fail in Detroit. We offer same-week service and documentation for re-inspection.`,
          best_call_window: "Immediately — compliance gap creates urgency",
          estimated_value: 4000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[hvac] rental compliance view:", e); }

  // 17. BSEED Plan Reviews — approved HVAC/mechanical plans (installation imminent)
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%HVAC%' OR work_description LIKE '%MECHANICAL%' OR work_description LIKE '%FURNACE%' OR work_description LIKE '%BOILER%' OR work_description LIKE '%AIR CONDITION%') AND task_status LIKE '%Approved%'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permit_plan_reviews/FeatureServer/0/query?where=${where}&outFields=address,zip_code,submitted_date,work_description,task_status&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json`,
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
          signal_type: "aging_system_proxy",
          signal_detail: `BSEED HVAC plan review approved: ${(a.work_description ?? "HVAC project").slice(0, 100)} — plans approved means installation is imminent`,
          signal_date: a.submitted_date ? new Date(a.submitted_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.aging_system_proxy + 2,
          source_method: "bseed_plan_reviews",
          suggested_opener: `Your HVAC project at ${addr} has plans approved — we can often provide same-week installation once the permit clears. Want a parallel bid before the contractor order is finalized?`,
          best_call_window: "Immediately — plans approved means permit imminent",
          estimated_value: 8000,
          raw_source_data: { addr, zip, desc: a.work_description, status: a.task_status },
        });
      }
    }
  } catch (e) { console.error("[hvac] plan reviews:", e); }

  // BSEED Trades Permits — Mechanical Permits (HVAC/furnace/AC replacements) with owner name
  // Separate service from bseed_building_permits — trade-specific permits only
  try {
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const where = encodeURIComponent(
      `permit_type = 'Mechanical Permit' AND address IS NOT NULL AND issued_date >= '${since90}'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,permit_type,work_description,owner_name&resultRecordCount=50&orderByFields=issued_date+DESC&f=json`,
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
        const desc = (a.work_description || "").toLowerCase();
        const isFurnace = /furnace|heat|boiler|heater/.test(desc);
        const isAC = /a\/c|ac |air.cond|cooling|cool/.test(desc);
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "aging_system_proxy",
          signal_detail: `BSEED Mechanical Permit: ${a.owner_name ?? "owner"} — ${a.work_description ?? "HVAC work"} at ${addr}. New ${isFurnace ? "heating" : isAC ? "cooling" : "HVAC"} install is the ideal time to add a maintenance contract`,
          signal_date: a.issued_date ? a.issued_date.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 8,
          source_method: "bseed_trades_permits_hvac",
          suggested_opener: `You just had ${a.work_description ?? "an HVAC system"} installed at ${addr} — the first year is the most critical for catching install issues. Our maintenance contract covers one annual tune-up plus emergency priority service all year.`,
          best_call_window: "Within 30 days of permit issuance",
          estimated_value: 1200,
          raw_source_data: { addr, zip, desc: a.work_description, owner: a.owner_name, issued: a.issued_date },
        });
      }
    }
  } catch (e) { console.error("[hvac] trades permits:", e); }

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
          signal_type: "cofc_hvac_inspection",
          signal_detail: `CofC expires in ${daysLeft} days — BSEED inspects heating & cooling systems at renewal. ${addr} landlord needs HVAC in working condition`,
          signal_date: today,
          score,
          source_method: "bseed_cofc_expiring",
          suggested_opener: `Your rental at ${addr} has a Certificate of Compliance expiring in ${daysLeft} days — BSEED checks that heating is functional and CO detectors are installed. We can do a pre-inspection furnace/AC tune-up so you're ready.`,
          best_call_window: "Immediately — renewal deadline",
          estimated_value: 4500,
          raw_source_data: { addr, zip, days_left: daysLeft, expires: a.expired_date },
        });
      }
    }
  } catch (e) { console.error("[hvac] cofc expiring:", e); }

  return signals;
}
