// Plumbing Radar signal scanner.
// Sources: BSEED plumbing permits, Foreclosure notices (LegalNews), FFIEC HMDA new homeowners.

import { scrapeForeclosureNotices } from "../scrapers-county-records.ts";

export interface RawSignal {
  address: string; city: string; zip: string;
  signal_type: string; signal_detail: string; signal_date: string;
  score: number; source_method: string;
  suggested_opener: string; best_call_window: string;
  estimated_value: number; raw_source_data?: Record<string, unknown>;
}

export const BASE_SCORES: Record<string, number> = {
  plumbing_permit_major: 8,
  foreclosure_deferred: 7,
  lead_line_area: 6,
};

export const OPENERS: Record<string, { opener: string; window: string }> = {
  plumbing_permit_major: {
    opener: "We saw a major plumbing permit recently pulled in your area — often that means neighboring homes have the same aging pipes. We're offering free inspections this week.",
    window: "Within 30 days of permit",
  },
  foreclosure_deferred: {
    opener: "Properties in foreclosure often have years of deferred maintenance — we specialize in getting plumbing up to code quickly so owners can sell or refinance.",
    window: "Within 60 days of filing",
  },
  lead_line_area: {
    opener: "The EPA recently flagged your ZIP for lead service lines — we can assess and replace yours, and the city may cover part of the cost.",
    window: "Any time while area is flagged",
  },
};

export async function scanSignals(state = "MI", zipFilter?: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // 1. BSEED Plumbing Permits (service: bseed_trades_permits, permit_type = Plumbing)
  try {
    const where = encodeURIComponent(`permit_type = 'Plumbing Permit'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=${where}&outFields=address,zip_code,issued_date,permit_type,work_description,latitude,longitude&resultRecordCount=50&orderByFields=issued_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
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
          signal_type: "plumbing_permit_major",
          signal_detail: `BSEED Plumbing Permit: ${(a.work_description ?? "").slice(0, 100)}`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.plumbing_permit_major,
          source_method: "bseed_arcgis",
          suggested_opener: OPENERS.plumbing_permit_major.opener,
          best_call_window: OPENERS.plumbing_permit_major.window,
          estimated_value: 3000,
          raw_source_data: { ...a, lat: a.latitude, lon: a.longitude },
        });
      }
    }
  } catch (e) { console.error("[plumbing] BSEED:", e); }

  // 2. Foreclosure notices (deferred maintenance signal)
  try {
    const foreclosures = await scrapeForeclosureNotices({ perSourceCap: 8 });
    for (const f of foreclosures) {
      if (zipFilter?.length && f.zip && !zipFilter.includes(f.zip)) continue;
      signals.push({
        address: f.address,
        city: f.city ?? "Detroit",
        zip: f.zip ?? "",
        signal_type: "foreclosure_deferred",
        signal_detail: `Foreclosure notice (${f.signal_source}): ${f.signal_detail ?? f.address}`,
        signal_date: f.signal_date ?? new Date().toISOString().split("T")[0],
        score: BASE_SCORES.foreclosure_deferred,
        source_method: "legalnews_scrape",
        suggested_opener: OPENERS.foreclosure_deferred.opener,
        best_call_window: OPENERS.foreclosure_deferred.window,
        estimated_value: 2500,
        raw_source_data: { address: f.address, source: f.signal_source },
      });
    }
  } catch (e) { console.error("[plumbing] foreclosure scrape:", e); }

  // 3. FFIEC HMDA — new homeowners as lead-pipe replacement targets.
  // EPA ECHO get_facilities uses a 2-step QueryID pattern; d?.Results?.Facilities is always
  // empty on the first call. Replaced with HMDA purchase loan originations — homes bought in
  // the last year are the highest-probability lead service line replacement market.
  try {
    const res = await fetch(
      `https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?states=${state}&years=2023&actions_taken=1&loan_purposes=1`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      const rows: any[] = d?.aggregations ?? [];
      const total = rows.reduce((n, r) => n + (r.count || 0), 0);
      if (total > 0) {
        signals.push({
          address: `${state} — ${total.toLocaleString()} new purchase loans (2023)`,
          city: state,
          zip: "",
          signal_type: "lead_line_area",
          signal_detail: `FFIEC HMDA: ${total.toLocaleString()} home purchases in ${state} in 2023 — new owners in pre-1986 homes likely have lead service lines eligible for city replacement programs`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.lead_line_area,
          source_method: "ffiec_hmda",
          suggested_opener: OPENERS.lead_line_area.opener,
          best_call_window: OPENERS.lead_line_area.window,
          estimated_value: 4000,
          raw_source_data: { total, state, year: 2023 },
        });
      }
    }
  } catch (e) { console.error("[plumbing] HMDA:", e); }

  // 4. Detroit 311 — water main breaks and flooding near an address
  try {
    const where = encodeURIComponent(`issue_type LIKE '%WATER%' OR issue_type LIKE '%FLOOD%' OR issue_type LIKE '%SEWER%'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/311_Service_Requests/FeatureServer/0/query?where=${where}&outFields=address,zip_code,created_at,issue_type&resultRecordCount=30&orderByFields=created_at+DESC&f=json`,
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
          signal_type: "lead_line_area",
          signal_detail: `Detroit 311: ${(a.issue_type ?? "water/sewer issue").slice(0, 100)} — aging infrastructure signal for plumbing replacement`,
          signal_date: a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.lead_line_area - 1,
          source_method: "detroit_311_arcgis",
          suggested_opener: OPENERS.lead_line_area.opener,
          best_call_window: OPENERS.lead_line_area.window,
          estimated_value: 3500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[plumbing] 311:", e); }

  // 5. CFPB HMDA Home Improvement Loans — homeowners actively borrowing for renovation = plumbing upgrade market
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
          signal_detail: `CFPB HMDA: ${total.toLocaleString()} home improvement loan originations in ${state} (2023) — homeowners already borrowing for renovation are prime plumbing upgrade prospects`,
          signal_date: new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "ffiec_hmda",
          suggested_opener: "You're renovating your home — most contractors don't tell you that updating supply lines and shutoff valves during a remodel costs 60% less than doing it separately. Want a free estimate on what plumbing is worth bundling in?",
          best_call_window: "Within 90 days of loan origination",
          estimated_value: 3500,
          raw_source_data: { total, state, year: 2023, loan_purpose: "home_improvement" },
        });
      }
    }
  } catch (e) { console.error("[plumbing] CFPB HI:", e); }

  // 6. BSEED Lead Clearance Reports — active lead remediation = neighborhood lead pipe signal
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_lead_clearance_reports/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,task,task_status,task_status_date,neighborhood&resultRecordCount=40&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "lead_line_area",
          signal_detail: `BSEED Lead Clearance: ${a.task ?? "lead clearance"} at ${addr} (${a.task_status ?? "active"}) — lead remediation activity indicates neighborhood-wide lead service line risk`,
          signal_date: a.task_status_date ? new Date(a.task_status_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: BASE_SCORES.lead_line_area,
          source_method: "bseed_lead_clearance",
          suggested_opener: OPENERS.lead_line_area.opener,
          best_call_window: OPENERS.lead_line_area.window,
          estimated_value: 4500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[plumbing] lead clearance:", e); }

  // 7. Detroit Assessor property sales — new homeowners want plumbing inspected
  try {
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`sale_date >= '${cutoff}' AND amt_sale_price > 10000`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${where}&outFields=address,zip_code,sale_date,grantee&resultRecordCount=25&orderByFields=sale_date+DESC&f=json`,
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
          signal_type: "lead_line_area",
          signal_detail: `Detroit property sale: ${a.grantee ?? "New owner"} — pre-1960 Detroit homes have a near-100% rate of lead service lines. New owners are eligible for city replacement programs`,
          signal_date: a.sale_date ? new Date(a.sale_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessor_sales",
          suggested_opener: "Congratulations on your new home — Detroit homes built before 1960 almost certainly have a lead service line. The city has a replacement program and we can help you navigate it at no out-of-pocket cost.",
          best_call_window: "Within 90 days of purchase",
          estimated_value: 4500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[plumbing] assessor sales:", e); }

  return signals;
}
