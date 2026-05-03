// Exterior Radar signal scanner (Painting + Windows + Siding combined).
// Buyer: exterior remodelers who replace/repaint/re-side homes.
// Folded from standalone Painting Radar — larger buyer pool, same signal stack.
//
// Sources:
//   Per-address: BSEED exterior/siding/window permits, FSBO listings,
//                foreclosure notices (pre-REO repaint), Wayne County deeds (new owners)
//   Area: NOAA storm/hail events (siding damage)

import { scrapeZillowFSBO } from "../scrapers-public-listings.ts";
import { scrapeForeclosureNotices } from "../scrapers-county-records.ts";

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  storm_siding_damage: 8,
  exterior_permit: 8,
  siding_window_permit: 9,
  fsbo_exterior: 7,
  foreclosure_exterior: 6,
  new_owner_exterior: 8,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  storm_siding_damage: {
    opener: "The hail and wind this week is the leading cause of siding and window damage in Michigan. We're doing free damage assessments in your area — most insurance claims cover full replacement.",
    window: "Within 14 days of storm event",
  },
  exterior_permit: {
    opener: "An exterior renovation permit was filed at your address — if you're already doing exterior work, adding siding or window replacement to the same project usually costs 30–40% less than a separate job.",
    window: "While permit is active",
  },
  siding_window_permit: {
    opener: "A siding or window replacement permit was just pulled on your street — neighbors often piggyback on the same contractor schedule for a lower price per unit. Want us to quote while we're in the area?",
    window: "Within 21 days of permit",
  },
  fsbo_exterior: {
    opener: "Painting and fresh siding add $8–18k to your sale price according to Zillow data — we can quote a full exterior package within 24 hours and have you on the market by the weekend.",
    window: "While FSBO listing is active",
  },
  foreclosure_exterior: {
    opener: "Bank-owned properties always need an exterior refresh before REO listing — we work directly with REO agents and can turn a quote around same day.",
    window: "Before REO listing goes active",
  },
  new_owner_exterior: {
    opener: "Congratulations on the new home — most buyers do an exterior refresh in the first 60 days while the house is empty. We can quote the full package within 24 hours.",
    window: "Within 90 days of deed transfer",
  },
};

const EXTERIOR_STORM_EVENTS = ["Hail", "Thunderstorm Wind", "Tornado", "High Wind", "Wind Advisory"];

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. NOAA NWS storm/hail events — siding damage area signal
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?area=${state}&status=actual`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)", Accept: "application/geo+json" } },
    );
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? []).slice(0, 30)) {
        const props = feat?.properties ?? {};
        const event: string = props.event ?? "";
        if (!EXTERIOR_STORM_EVENTS.some((e) => event.includes(e))) continue;
        const areaDesc: string = props.areaDesc ?? "";
        const effective = (props.effective ?? props.onset ?? new Date().toISOString()).split("T")[0];
        signals.push({
          address: areaDesc.split(";")[0]?.trim() ?? areaDesc,
          city: areaDesc.split(",")[0]?.trim() ?? state,
          zip: "",
          signal_type: "storm_siding_damage",
          signal_detail: `${event}: ${props.headline ?? props.description?.slice(0, 120) ?? ""}`,
          signal_date: effective,
          score: BASE_SCORES.storm_siding_damage,
          source_method: "noaa_nws_alerts",
          suggested_opener: OPENERS.storm_siding_damage.opener,
          best_call_window: OPENERS.storm_siding_damage.window,
          estimated_value: 8000,
          raw_source_data: { event, areaDesc },
        });
      }
    }
  } catch (e) { console.error("[exterior] NWS:", e); }

  // 2. BSEED exterior/siding/window permits — per-address (confirmed service: bseed_building_permits)
  //    Replaces unverified bseed_presale_inspections service from original painting scanner.
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%SIDING%' OR work_description LIKE '%EXTERIOR%' OR work_description LIKE '%WINDOW%' OR work_description LIKE '%PAINT%' OR work_description LIKE '%REPLACE WINDOWS%')`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,work_description,amt_estimated_contractor_cost,latitude,longitude&resultRecordCount=40&orderByFields=issued_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr: string = a.address ?? "";
        const zip: string = a.zip_code ?? addr.match(/\b(4\d{4})\b/)?.[1] ?? "";
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        const desc = (a.work_description ?? "").toUpperCase();
        const signalType = (desc.includes("SIDING") || desc.includes("WINDOW"))
          ? "siding_window_permit" : "exterior_permit";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: signalType,
          signal_detail: `BSEED permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES[signalType],
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS[signalType].opener,
          best_call_window: OPENERS[signalType].window,
          estimated_value: Number(a.amt_estimated_contractor_cost) || 6000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[exterior] BSEED:", e); }

  // 3. Zillow FSBO listings — pre-sale exterior prep opportunity
  try {
    const fsboResults = await scrapeZillowFSBO({ perCityCap: 5 });
    for (const s of fsboResults) {
      if (zipFilter?.length && s.zip && !zipFilter.includes(s.zip)) continue;
      signals.push({
        address: s.address,
        city: s.city ?? "Detroit",
        zip: s.zip ?? "",
        signal_type: "fsbo_exterior",
        signal_detail: `Zillow FSBO (${s.signal_source}): ${s.address}`,
        signal_date: s.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.fsbo_exterior,
        source_method: "zillow_fsbo_scrape",
        suggested_opener: OPENERS.fsbo_exterior.opener,
        best_call_window: OPENERS.fsbo_exterior.window,
        estimated_value: 5000,
        raw_source_data: { address: s.address, source: s.signal_source },
      });
    }
  } catch (e) { console.error("[exterior] FSBO:", e); }

  // 4. Foreclosure notices — pre-REO exterior refresh
  try {
    const foreclosures = await scrapeForeclosureNotices({ perSourceCap: 6 });
    for (const f of foreclosures) {
      if (zipFilter?.length && f.zip && !zipFilter.includes(f.zip)) continue;
      signals.push({
        address: f.address,
        city: f.city ?? "Detroit",
        zip: f.zip ?? "",
        signal_type: "foreclosure_exterior",
        signal_detail: `Foreclosure (${f.signal_source}): ${f.signal_detail ?? f.address}`,
        signal_date: f.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.foreclosure_exterior,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.foreclosure_exterior.opener,
        best_call_window: OPENERS.foreclosure_exterior.window,
        estimated_value: 4500,
        raw_source_data: { address: f.address, source: f.signal_source },
      });
    }
  } catch (e) { console.error("[exterior] foreclosure:", e); }

  // 5. NOAA SPC Daily Storm Reports — same-day siding/window damage in MI
  try {
    const res = await fetch("https://www.spc.noaa.gov/climo/reports/today.csv", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (res.ok) {
      const csv = await res.text();
      let inWind = false;
      for (const line of csv.split("\n").slice(1)) {
        if (!line.trim()) continue;
        const parts = line.split(",");
        if (parts[0] === "Time") { inWind = true; continue; }
        if (parts[4]?.trim() !== "MI") continue;
        const county = parts[3]?.trim() ?? "";
        signals.push({
          address: `${county} County, MI`, city: county, zip: "",
          signal_type: "storm_siding_damage",
          signal_detail: `SPC storm report (today): ${inWind ? "wind" : "hail"} in ${county} County — siding/window damage likely`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.storm_siding_damage,
          source_method: "noaa_spc_reports",
          suggested_opener: OPENERS.storm_siding_damage.opener,
          best_call_window: OPENERS.storm_siding_damage.window,
          estimated_value: 8000,
          raw_source_data: { county, inWind, source: "spc_today" },
        });
      }
    }
  } catch (e) { console.error("[exterior] SPC today:", e); }

  // 6. CFPB HMDA Home Improvement Loans — direct renovation intent signal
  try {
    const res = await fetch(
      `https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?states=${state}&years=2023&actions_taken=1&loan_purposes=2`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const total = (d?.aggregations ?? []).reduce((n: number, r: any) => n + (r.count || 0), 0);
      if (total > 0) {
        signals.push({
          address: `${state} — ${total.toLocaleString()} home improvement loans (2023)`,
          city: state, zip: "",
          signal_type: "home_improvement_loan_area",
          signal_detail: `CFPB HMDA: ${total.toLocaleString()} approved home improvement loans in ${state} (2023) — borrowers are actively funding exterior renovations`,
          signal_date: new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "ffiec_hmda",
          suggested_opener: "You recently took out a home improvement loan — exterior work like siding and painting delivers the highest ROI on those dollars. Want a free quote?",
          best_call_window: "Within 60 days of loan close",
          estimated_value: 6000,
          raw_source_data: { total, state, year: 2023, loan_purpose: "home_improvement" },
        });
      }
    }
  } catch (e) { console.error("[exterior] CFPB HI:", e); }

  // 7. NOAA SPC Day-1 Convective Outlook — hail/wind damages siding before homeowners realize
  try {
    const res = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? [])) {
        const props = feat?.properties ?? {};
        if (!["SLGT", "ENH", "MDT", "HIGH"].some((r) => props.LABEL?.includes(r))) continue;
        const label: string = props.LABEL2 ?? props.LABEL ?? "";
        const valid = (props.VALID_ISO ?? new Date().toISOString()).slice(0, 10);
        signals.push({
          address: "Michigan region",
          city: state, zip: "",
          signal_type: "storm_siding_damage",
          signal_detail: `NOAA SPC Day-1 Outlook: ${label} — hail and damaging winds forecast. Vinyl and wood siding damage from hail is invisible from the street but voids manufacturer warranties if not documented within 12 months`,
          signal_date: valid,
          score: BASE_SCORES.storm_siding_damage + 1,
          source_method: "noaa_spc_day1_outlook",
          suggested_opener: "Severe weather is forecast for your area today — hail damage to siding is invisible from the street but voids manufacturer warranties. We're reserving inspection slots now for homeowners who want priority service.",
          best_call_window: "Day of / day after storm event",
          estimated_value: 8000,
          raw_source_data: { label, valid, forecaster: props.FORECASTER },
        });
      }
    }
  } catch (e) { console.error("[exterior] SPC day-1:", e); }

  // 8. Detroit Assessor property sales — new homeowners notice deferred exterior work
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
          signal_type: "foreclosure_exterior",
          signal_detail: `Detroit property sale: ${a.grantee ?? "New owner"} purchased for $${(a.amt_sale_price || 0).toLocaleString()} — new homeowners typically repaint, reside, or update windows within the first year`,
          signal_date: a.sale_date ? new Date(a.sale_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessor_sales",
          suggested_opener: "Congratulations on your new home — most new homeowners tackle exterior painting or siding within the first year. We're offering free estimates for new owners in your neighborhood this month.",
          best_call_window: "Within 90 days of purchase",
          estimated_value: 6000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[exterior] assessor sales:", e); }

  // 9. BSEED Acceptance Certificates — completed renovations = neighbors see fresh exterior, want same
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/acceptance_certificates/FeatureServer/0/query?where=task_status+%3D+'CofA+Issued'+AND+is_residential+%3D+'True'&outFields=address,zip_code,issued_date,record_type&resultRecordCount=25&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "foreclosure_exterior",
          signal_detail: `BSEED Certificate of Acceptance: ${addr} — new CofA issued for renovation completion. Newly renovated homes create an aesthetic contrast with adjacent properties, prompting neighbors to consider exterior updates`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "bseed_cofa",
          suggested_opener: "A home on your block just completed a full renovation — we're doing free exterior assessments for neighbors while our painters are in the area. New siding and fresh paint can add $10k+ to your home's value.",
          best_call_window: "Within 30 days of CofA issuance",
          estimated_value: 6000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[exterior] CofA:", e); }

  // 10. NOAA CDO Historical Hail + Wind — Wayne/Oakland/Macomb (past 12 months)
  // WT09 = hail occurred; WT11 = high/damaging winds. Uses existing NOAA_API_KEY.
  try {
    const noaaKey = Deno.env.get("NOAA_API_KEY");
    if (noaaKey) {
      const twelveMonthsAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const counties = [
        { fips: "FIPS:26163", name: "Wayne County" },
        { fips: "FIPS:26125", name: "Oakland County" },
      ];
      let stormDays = 0;
      const stormCounties: string[] = [];
      for (const county of counties) {
        for (const datatype of ["WT09", "WT11"]) {
          const res = await fetch(
            `https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&locationid=${county.fips}&datatypeid=${datatype}&startdate=${twelveMonthsAgo}&enddate=${today}&limit=100`,
            { headers: { token: noaaKey, "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
          );
          if (res.ok) {
            const d = await res.json();
            const results: any[] = d?.results ?? [];
            const days = results.filter((r) => r.value === 1 || r.value === "1").length;
            if (days > 0) { stormDays += days; stormCounties.push(`${county.name} ${datatype === "WT09" ? "hail" : "wind"} (${days}d)`); }
          }
        }
      }
      if (stormDays > 0) {
        signals.push({
          address: `SE Michigan — ${stormDays} hail/wind event days past year`,
          city: state, zip: "",
          signal_type: "storm_siding_damage",
          signal_detail: `NOAA CDO: ${stormCounties.join("; ")} — hail and high winds cause siding dents, fascia damage, and paint peeling that many homeowners don't address until they see the neighbor's fresh exterior`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.storm_siding_damage,
          source_method: "noaa_cdo_historical",
          suggested_opener: "SE Michigan had significant hail and wind this past year — siding dents and paint damage from storms are easy to miss but show up at resale inspection. We offer free storm damage assessments.",
          best_call_window: "Evergreen — post-storm siding/paint demand builds over months",
          estimated_value: 6000,
          raw_source_data: { storm_days: stormDays, counties: stormCounties },
        });
      }
    }
  } catch (e) { console.error("[exterior] NOAA CDO:", e); }

  // (next source) Detroit Assessment Roll 2026 — recently sold pre-1970 homes (aging siding/paint)
  try {
    const since = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/tentative_assessment_roll_2026/FeatureServer/0/query?where=sale_date+%3E%3D+'${since}'+AND+residential_year_built+%3C+1970+AND+residential_year_built+%3E+1880+AND+is_improved+%3D+1&outFields=address,zip_code,residential_year_built,sale_date,taxpayer_1&resultRecordCount=50&orderByFields=sale_date+DESC&f=json`,
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
        const sidingNote = yrBuilt < 1960 ? "original asbestos or fiber cement siding — professional removal required" : yrBuilt < 1970 ? "aging aluminum siding with oxidation and chalking" : "dated exterior needing fresh curb appeal";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "new_owner_exterior",
          signal_detail: `Detroit new owner: ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — ${sidingNote}. New owners frequently want exterior work done within the first year`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: BASE_SCORES.new_owner_exterior,
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Welcome to ${addr}! Homes built in ${yrBuilt} have ${yrBuilt < 1960 ? "aging siding that may contain hazardous materials requiring licensed removal" : "original exterior that new owners usually refresh within the first year"}. Free exterior assessment with no obligation?`,
          best_call_window: "Within 120 days of purchase",
          estimated_value: 8000,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[exterior] Detroit assessment roll:", e); }

  // New: Multifamily Construction — new builds need exterior painting/cladding
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/multifamily_housing_construction_sites/FeatureServer/0/query?where=construction_status+IN+('Under+Construction','Construction+Not+Started')&outFields=address,zip_code,owner_developer_name,legal_entity,total_units,construction_status&resultRecordCount=30&orderByFields=OBJECTID+DESC&f=json",
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
          signal_type: "new_owner_exterior",
          signal_detail: `Multifamily construction: ${addr} (${units} units, ${a.construction_status}) — ${developer}. New multifamily requires commercial exterior painting, cladding, and waterproofing`,
          signal_date: new Date().toISOString().split("T")[0],
          score: units >= 20 ? BASE_SCORES.new_owner_exterior + 2 : BASE_SCORES.new_owner_exterior + 1,
          source_method: "multifamily_construction_sites",
          suggested_opener: `We saw ${addr} is in active construction — ${units}-unit multifamily projects need commercial exterior painting and cladding. Are you taking bids on the exterior package?`,
          best_call_window: "Late construction phase — before landscaping",
          estimated_value: units * 2000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[exterior] multifamily construction:", e); }

  // New: ROW Permits — street/utility work creates exterior disruption signal
  try {
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/ROW_Permits/FeatureServer/0/query?where=issued_date+%3E%3D+%27${since90}%27&outFields=permit_address,permit_type,issued_date,contractor&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.permit_address || "").trim();
        if (!addr || addr.length < 5) continue;
        const issued = a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0];
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "new_owner_exterior",
          signal_detail: `ROW permit issued at ${addr} — street/utility work disrupts exterior surfaces and exposes weathering on surrounding properties`,
          signal_date: issued,
          score: BASE_SCORES.new_owner_exterior - 1,
          source_method: "row_permits",
          suggested_opener: `Street work was recently permitted near your home — a good time to refresh the exterior before the neighborhood looks run-down again. We're doing free estimates this week for homes on your block.`,
          best_call_window: "Within 30 days of ROW permit",
          estimated_value: 5000,
          raw_source_data: { addr, permit_type: a.permit_type, issued },
        });
      }
    }
  } catch (e) { console.error("[exterior] ROW permits:", e); }

  // BSEED Presale Inspections — FAIL results (exterior condition commonly cited)
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
          signal_type: "new_owner_exterior",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — peeling paint, damaged siding, and deteriorated windows are the most visible exterior deficiencies in presale inspection`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 9,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — exterior condition is one of the first things an inspector cites. Fresh paint, repaired siding, and sealed windows can often turn a fail into a pass quickly. We're fast and document everything for re-inspection.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 6000,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[exterior] presale inspections:", e); }

  // Day-2 SPC Convective Outlook — 48-hour pre-storm siding/exterior window
  try {
    const res = await fetch("https://www.spc.noaa.gov/products/outlook/day2otlk_cat.nolyr.geojson", {
      headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" },
    });
    if (res.ok) {
      const geo = await res.json();
      for (const feat of (geo?.features ?? [])) {
        const props = feat?.properties ?? {};
        if (!["SLGT", "ENH", "MDT", "HIGH"].some((r) => props.LABEL?.includes(r))) continue;
        const label: string = props.LABEL2 ?? props.LABEL ?? "";
        const valid = (props.VALID_ISO ?? new Date().toISOString()).slice(0, 10);
        signals.push({
          address: "Michigan region",
          city: state, zip: "",
          signal_type: "storm_siding_damage",
          signal_detail: `SPC Day-2 Outlook: ${label} — hail/high-wind risk in 24–48 hours. Pre-storm exterior check + booking window`,
          signal_date: valid,
          score: BASE_SCORES.storm_siding_damage - 1,
          source_method: "noaa_spc_day2_outlook",
          suggested_opener: "Severe weather including hail is in the 48-hour forecast — siding and exterior damage from hail is often invisible until paint starts failing. We do fast free exterior checks and can book you in before the rush.",
          best_call_window: "48-hour pre-storm window",
          estimated_value: 8000,
          raw_source_data: { label, valid },
        });
      }
    }
  } catch (e) { console.error("[exterior] SPC day-2:", e); }

  // Detroit Historic District Violations — siding, paint, windows, doors violations (open cases)
  try {
    const where = encodeURIComponent(`case_status = 'Open' AND (has_siding_walls_violation = 'True' OR has_paint_violation = 'True' OR has_windows_violation = 'True' OR has_doors_violation = 'True')`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Historic_District_Violations/FeatureServer/0/query?where=${where}&outFields=address,zip_code,intake_date,historic_district,violation_scope,has_siding_walls_violation,has_paint_violation,has_windows_violation&resultRecordCount=30&orderByFields=OBJECTID+DESC&f=json`,
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
        const violationType = a.has_paint_violation === "True" ? "paint" : a.has_windows_violation === "True" ? "windows" : "siding";
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "new_owner_exterior",
          signal_detail: `Historic District Violation (Open): ${addr} in ${district} — ${a.violation_scope ?? violationType}. Historic exterior repairs require period-accurate materials and approved contractors — premium job size`,
          signal_date: a.intake_date ? String(a.intake_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.new_owner_exterior + 1,
          source_method: "historic_district_violations",
          suggested_opener: `Your property at ${addr} in ${district} has an open ${violationType} violation — historic district compliance requires approved materials and certified contractors. We specialize in historic exterior restoration and can close the violation quickly with work that won't get re-cited.`,
          best_call_window: "Any time — open violation creates compliance urgency",
          estimated_value: 12000,
          raw_source_data: { addr, zip, district, scope: a.violation_scope },
        });
      }
    }
  } catch (e) { console.error("[exterior] historic violations:", e); }

  // Detroit Commercial Corridor Blight — properties flagged for exterior repair
  try {
    const where = encodeURIComponent(`repair_exterior_damage = 'yes' OR graffiti = 'yes' OR boarding = 'yes'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Commercial_Corridor_Blight_Work_Completed_(View)/FeatureServer/0/query?where=${where}&outFields=address,owner,repair_exterior_damage,graffiti,boarding,wall_damage&resultRecordCount=40&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.address || "").trim();
        if (!addr) continue;
        const owner = (a.owner || "").trim();
        const issues = [
          a.repair_exterior_damage === "yes" ? "exterior damage" : "",
          a.graffiti === "yes" ? "graffiti" : "",
          a.boarding === "yes" ? "boarding" : "",
          a.wall_damage === "yes" ? "wall damage" : "",
        ].filter(Boolean).join(", ");
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "new_owner_exterior",
          signal_detail: `Commercial corridor blight survey: ${addr} — flagged for: ${issues}. ${owner ? "Owner: " + owner : ""}`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.new_owner_exterior,
          source_method: "commercial_corridor_blight",
          suggested_opener: `Your property at ${addr} was flagged by the city for ${issues}. We specialize in commercial exterior restoration — painting, siding repair, and graffiti removal — and can give you a quote within 24 hours.`,
          best_call_window: "Any time — city survey creates compliance pressure",
          estimated_value: 8000,
          raw_source_data: { addr, owner, issues },
        });
      }
    }
  } catch (e) { console.error("[exterior] commercial corridor blight:", e); }

  // BSEED Plan Reviews — approved exterior/siding/window/addition plans
  try {
    const where = encodeURIComponent(
      `(work_description LIKE '%SIDING%' OR work_description LIKE '%EXTERIOR%' OR work_description LIKE '%WINDOW%' OR work_description LIKE '%ADDITION%' OR work_description LIKE '%PAINT%') AND task_status LIKE '%Approved%'`,
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
          signal_type: "new_owner_exterior",
          signal_detail: `BSEED plan review approved: ${(a.work_description ?? "exterior project").slice(0, 100)} — approved exterior plans mean the work is starting within days`,
          signal_date: a.submitted_date ? new Date(a.submitted_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.new_owner_exterior + 2,
          source_method: "bseed_plan_reviews",
          suggested_opener: `Your exterior project at ${addr} has approved plans — we can provide same-week painting, siding, or window installation once the permit clears.`,
          best_call_window: "Immediately — plans approved means permit imminent",
          estimated_value: 7000,
          raw_source_data: { addr, zip, desc: a.work_description, status: a.task_status },
        });
      }
    }
  } catch (e) { console.error("[exterior] plan reviews:", e); }

  return signals;
}
