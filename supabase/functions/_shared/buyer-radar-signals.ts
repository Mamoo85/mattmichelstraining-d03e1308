// buyer-radar-signals.ts
// New signal sources for the Buyer Radar manufacturer rep tier.
// Sources: OSHA violations (new equipment signal), SBA loans (purchasing budget),
// building permit volume by ZIP (contractor workload = material demand).

const enc = encodeURIComponent;

export interface BuyerRadarSignal {
  signal_type: string;
  signal_detail: string;
  company_name?: string;
  city?: string;
  state?: string;
  zip?: string;
  source: string;
  signal_date: string;
  score: number;
}

// OSHA violations in MI construction/manufacturing — companies investing post-violation
export async function scanOshaSignals(state = "MI"): Promise<BuyerRadarSignal[]> {
  const results: BuyerRadarSignal[] = [];
  try {
    const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const url = `https://data.dol.gov/api/v1/compliance/osha/inspections?state_plan_code=${enc(state)}&per_page=50&open_date_start=${enc(since)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BuyerRadar matt@detroitwebagent.com" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return results;
    const data = await res.json() as { data?: Array<{ establishment_name?: string; site_address?: string; city?: string; open_date?: string; naics_code?: string }> };
    for (const r of data?.data || []) {
      const naics = String(r.naics_code || "");
      // Construction (23x) + manufacturing (3xx) — likely equipment/safety upgrade buyers
      if (!naics.startsWith("23") && !naics.startsWith("3")) continue;
      results.push({
        signal_type: "osha_violation",
        signal_detail: `OSHA inspection at ${r.establishment_name || "unknown"} — compliance investment likely`,
        company_name: r.establishment_name || undefined,
        city: r.city || undefined,
        state,
        source: "osha_dol",
        signal_date: r.open_date ? new Date(r.open_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        score: 7,
      });
    }
  } catch (e) {
    console.error("[buyer-radar-signals] OSHA scan error:", e instanceof Error ? e.message : e);
  }
  return results.slice(0, 25);
}

// SBA loan recipients in MI — growth capital = purchasing budget expansion
export async function scanSbaSignals(state = "MI"): Promise<BuyerRadarSignal[]> {
  const results: BuyerRadarSignal[] = [];
  try {
    const url = `https://data.sba.gov/api/3/action/datastore_search?resource_id=aab2e42a-d2a6-4fc5-b2d6-c2d3f9f0c46e&q=${enc(state)}&limit=50`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BuyerRadar matt@detroitwebagent.com" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return results;
    const data = await res.json() as { result?: { records?: Array<{ BorrowerName?: string; BorrowerCity?: string; BorrowerState?: string; BorrowerZip?: string; LoanAmount?: string; ApprovalDate?: string; NAICSCode?: string }> } };
    for (const r of data?.result?.records || []) {
      if (r.BorrowerState !== state) continue;
      const naics = String(r.NAICSCode || "");
      if (!naics.startsWith("23") && !naics.startsWith("3")) continue;
      const loanK = r.LoanAmount ? Math.round(Number(r.LoanAmount.replace(/[^0-9]/g, "")) / 1000) : 0;
      results.push({
        signal_type: "sba_loan",
        signal_detail: `SBA loan ${loanK > 0 ? `$${loanK}k` : "received"} by ${r.BorrowerName || "company"} — expansion capital`,
        company_name: r.BorrowerName || undefined,
        city: r.BorrowerCity || undefined,
        state: r.BorrowerState || state,
        zip: r.BorrowerZip?.slice(0, 5) || undefined,
        source: "sba_gov",
        signal_date: r.ApprovalDate ? new Date(r.ApprovalDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        score: loanK >= 100 ? 8 : 6,
      });
    }
  } catch (e) {
    console.error("[buyer-radar-signals] SBA scan error:", e instanceof Error ? e.message : e);
  }
  return results.slice(0, 25);
}

// Building permit volume trend by ZIP — high permit activity = contractor needs materials
export async function scanBuildingPermitVolume(zipCodes: string[]): Promise<BuyerRadarSignal[]> {
  const results: BuyerRadarSignal[] = [];
  try {
    // Census Building Permits Survey — county-level new residential units (free, no key)
    const year = new Date().getFullYear();
    const url = `https://api.census.gov/data/${year}/cbp?get=EMP,PAYANN,ESTAB&for=county:*&in=state:26&NAICS2017=236`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return results;
    const rows = await res.json() as string[][];
    if (!rows?.length) return results;
    const headers = rows[0];
    const empIdx = headers.indexOf("EMP");
    const countyIdx = headers.indexOf("county");
    for (const row of rows.slice(1, 26)) {
      const emp = Number(row[empIdx] || 0);
      if (emp < 50) continue; // skip micro-markets
      const county = row[countyIdx];
      results.push({
        signal_type: "permit_volume_area",
        signal_detail: `County ${county} MI: ${emp} residential construction employees — active material demand`,
        state: "MI",
        source: "census_cbp",
        signal_date: new Date().toISOString().slice(0, 10),
        score: emp >= 500 ? 8 : emp >= 200 ? 7 : 6,
      });
    }
  } catch (e) {
    console.error("[buyer-radar-signals] permit volume scan error:", e instanceof Error ? e.message : e);
  }
  return results.slice(0, 15);
}
