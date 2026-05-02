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

  return signals;
}
