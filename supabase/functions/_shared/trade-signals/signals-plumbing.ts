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
  commercial_compliance_plumb: 7,
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

  // 8. BSEED Rental Registrations — landlords need plumbing compliance inspections
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_rental_registrations/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,issued_date,registration_type&resultRecordCount=50&orderByFields=ObjectId+DESC&f=json",
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
          signal_type: "plumbing_permit_major",
          signal_detail: `BSEED Rental Registration: ${addr} — Detroit rental units built before 1986 must disclose lead service lines. Landlords registering older properties face city compliance requirements for lead testing`,
          signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 6,
          source_method: "bseed_rental_registrations",
          suggested_opener: "Your rental property registration triggers Detroit's lead service line disclosure requirement — we can test and replace your lead line under the city's program, often at no out-of-pocket cost to you.",
          best_call_window: "Within 60 days of registration",
          estimated_value: 4500,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[plumbing] rental registrations:", e); }

  // 9. SeeClickFix 311 — Detroit water/sewer service requests (keyword-routed from all-issue feed)
  try {
    const res = await fetch(
      "https://seeclickfix.com/api/v2/issues?place_url=detroit&per_page=50&sort=created_at&direction=desc",
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) {
      const d = await res.json();
      for (const issue of (d?.issues ?? [])) {
        const summary: string = (issue?.summary ?? issue?.description ?? "").toLowerCase();
        if (!/water|sewer|pipe|drain|plumb|leak|flood|backup|raw sewage|sewage/i.test(summary)) continue;
        const addr: string = issue?.address ?? issue?.location_name ?? "";
        const zip: string = (addr.match(/\b(4\d{4})\b/) ?? [])[1] ?? "";
        if (!addr) continue;
        if (zipFilter?.length && zip && !zipFilter.includes(zip)) continue;
        signals.push({
          address: addr, city: issue?.city ?? "Detroit", zip,
          signal_type: "plumbing_permit_major",
          signal_detail: `SeeClickFix 311 water/sewer report: "${issue.summary ?? "issue"}" — ${issue.status ?? "open"}. Resident-reported water or drainage issue = active plumbing problem`,
          signal_date: issue.created_at ? issue.created_at.slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "seeclickfix_water",
          suggested_opener: "We saw a water or sewer issue was recently reported at your address — these are often signs of a line failure or serious blockage. We can assess same-day and have repairs permitted within 48 hours.",
          best_call_window: "While issue is open or unresolved",
          estimated_value: 3500,
          raw_source_data: { id: issue.id, summary: issue.summary, status: issue.status },
        });
      }
    }
  } catch (e) { console.error("[plumbing] SeeClickFix:", e); }

  // 10. Detroit Assessment Roll 2026 — recently sold pre-1940 homes (galvanized pipe era)
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
          signal_type: "plumbing_permit_major",
          signal_detail: `Detroit new owner: ${addr} (built ${yrBuilt}, sold ${a.sale_date}) — pre-1940 Detroit homes have original galvanized steel or cast iron pipes. Galvanized pipe corrodes from the inside out; new owners typically hit critical pipe failure within 5 years`,
          signal_date: a.sale_date || new Date().toISOString().split("T")[0],
          score: 7,
          source_method: "detroit_assessment_roll",
          suggested_opener: `${owner ? owner + " — " : ""}Congrats on ${addr}! Built ${yrBuilt} means galvanized steel pipes — they fail silently until you have a flood. A $200 inspection now saves a $15,000 emergency later. We're in the area this week.`,
          best_call_window: "Within 90 days of purchase",
          estimated_value: 4000,
          raw_source_data: { address: addr, zip, year_built: yrBuilt, sale_date: a.sale_date, owner },
        });
      }
    }
  } catch (e) { console.error("[plumbing] Detroit assessment roll:", e); }

  // 11. BSEED Presale Inspections — FAIL results (plumbing commonly cited)
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
          signal_type: "plumbing_permit_major",
          signal_detail: `Detroit presale inspection FAILED: ${addr} — leaking pipes, low water pressure, and failed drain tests are standard plumbing items in presale inspection. Seller must resolve before closing`,
          signal_date: a.inspection_date ? String(a.inspection_date).slice(0, 10) : new Date().toISOString().split("T")[0],
          score: 9,
          source_method: "bseed_presale_inspection",
          suggested_opener: `Your property at ${addr} failed its presale inspection — plumbing issues are common in older Detroit homes. We can fix, re-test, and document the repairs for your re-inspection. Let's get your sale back on track.`,
          best_call_window: "Within 14 days — seller has closing deadline",
          estimated_value: 4500,
          raw_source_data: { addr, zip, inspection_date: a.inspection_date },
        });
      }
    }
  } catch (e) { console.error("[plumbing] presale inspections:", e); }

  // 12. Detroit commercial building compliance failures — plumbing code issues
  try {
    const complianceWhere = encodeURIComponent(`commercial_compliance_indicator = 'YELLOW' OR commercial_compliance_indicator = 'RED'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_commercial_building_compliance/FeatureServer/0/query?where=${complianceWhere}&outFields=parcel_address,taxpayer_1,commercial_compliance_indicator,commercial_compliance_detail,latest_inspection_result&resultRecordCount=40&f=json`,
      { headers: { "User-Agent": "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)" } },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        const addr = (a.parcel_address || "").trim();
        if (!addr) continue;
        const status = a.commercial_compliance_indicator ?? "YELLOW";
        const owner = (a.taxpayer_1 || "").trim();
        signals.push({
          address: addr, city: "Detroit", zip: "",
          signal_type: "commercial_compliance_plumb",
          signal_detail: `Detroit commercial compliance ${status}: ${addr}${owner ? " — " + owner : ""}. Plumbing code compliance (backflow prevention, fixture clearance, trap requirements) is frequently flagged during commercial CofC inspections`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.commercial_compliance_plumb - (status === "YELLOW" ? 1 : 0),
          source_method: "bseed_commercial_compliance",
          suggested_opener: `Your commercial property at ${addr} has a ${status} compliance flag in the city system — plumbing issues are commonly cited during CofC inspections. We specialize in commercial plumbing compliance and can get you cleared fast.`,
          best_call_window: "Any time — compliance deadline creates urgency",
          estimated_value: 5000,
          raw_source_data: { addr, status, owner, detail: a.commercial_compliance_detail },
        });
      }
    }
  } catch (e) { console.error("[plumbing] commercial compliance:", e); }

  // 12. Detroit commercial compliance certificates expiring in 90 days
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
        signals.push({
          address: addr, city: "Detroit", zip,
          signal_type: "commercial_compliance_plumb",
          signal_detail: `Detroit commercial CofC expires in ${daysLeft} days: ${addr}. Plumbing pre-inspection now prevents failed re-inspection and city fines`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.commercial_compliance_plumb - (daysLeft > 45 ? 1 : 0),
          source_method: "bseed_commercial_cert_expiry",
          suggested_opener: `Your Certificate of Compliance at ${addr} expires in ${daysLeft} days — we do commercial plumbing pre-inspections so you pass the first time and avoid delays that cost you tenants.`,
          best_call_window: `Within ${Math.min(daysLeft, 60)} days`,
          estimated_value: 4500,
          raw_source_data: { addr, zip, days_left: daysLeft },
        });
      }
    }
  } catch (e) { console.error("[plumbing] commercial cert expiry:", e); }

  // 13. Multifamily Construction Sites — new plumbing rough-in opportunity
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/multifamily_housing_construction_sites/FeatureServer/0/query?where=construction_status+IN+('Under+Construction','Construction+Not+Started')&outFields=address,zip_code,owner_developer_name,legal_entity,total_units,construction_status&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json",
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
          signal_type: "commercial_compliance_plumb",
          signal_detail: `Multifamily construction: ${addr} (${units} units, ${a.construction_status}) — ${developer}. New construction needs full plumbing rough-in, fixture installation, and city inspection sign-off`,
          signal_date: new Date().toISOString().split("T")[0],
          score: units >= 20 ? BASE_SCORES.commercial_compliance_plumb + 1 : BASE_SCORES.commercial_compliance_plumb,
          source_method: "multifamily_construction_sites",
          suggested_opener: `We saw ${addr} is in active construction — ${units} units of new multifamily means a major plumbing package. Do you have a licensed plumber bid for the rough-in and fixture installation?`,
          best_call_window: "During construction — foundation to drywall phase",
          estimated_value: units * 2800,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[plumbing] multifamily construction:", e); }

  // 14. BSEED Rental Compliance — missing CofC signals deferred plumbing maintenance
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
          signal_type: "plumbing_permit_major",
          signal_detail: `Rental compliance gap: ${addr} — missing Certificate of Compliance or registration. Plumbing violations (leaking pipes, failed backflow prevention, water heater issues) are top reasons Detroit rentals fail re-inspection`,
          signal_date: new Date().toISOString().split("T")[0],
          score: BASE_SCORES.plumbing_permit_major || 6,
          source_method: "bseed_rental_compliance_view",
          suggested_opener: `Your rental at ${addr} has a compliance certificate gap — plumbing is one of the most common reasons Detroit rentals fail inspection. We get landlords cleared fast with same-week service and all inspection documentation.`,
          best_call_window: "Immediately — compliance gap = hard deadline pressure",
          estimated_value: 3000,
          raw_source_data: { ...a },
        });
      }
    }
  } catch (e) { console.error("[plumbing] rental compliance view:", e); }

  return signals;
}
