// Batch 1C — Federal area signals for Trade Radar (Wave 1).
// Returns signal objects compatible with the trade-radar-scanner's
// AREA_ALERT_TYPES upsert path (vertical, scope inferred from city/zip).
//
// Sources:
//  #31  HUD/Census ACS aging-housing proxy (zip-level, B25034 pre-1980 share)
//  #32  FFIEC HMDA home-improvement / refi loan density (zip-level)
//  #33  FEMA NFIP repeat-loss zips (OpenFEMA NfipClaims)
//  #35  EPA ECHO SDWA water-system violations (zip/county)
//  #40  NOAA SPC mesoscale convective discussions (state-scope)
//
// Each function fails OPEN (returns []) on any upstream failure. Daily caps
// applied so we don't flood trade_radar_area_signals on one good fetch.

type AreaSignal = {
  address?: string; // unused for area; kept for parity with per-address shape
  city?: string;
  zip?: string;
  signal_type: string;
  signal_detail?: string;
  signal_date?: string;
  source_method: string;
  signal_url?: string;
  raw_source_data?: Record<string, unknown>;
};

const today = () => new Date().toISOString().slice(0, 10);

// ---- #31 HUD/Census ACS aging housing (zip-level B25034 pre-1980 share) ----
// Cached daily; flags zips where >60% of stock built pre-1980.
export async function fetchAgingHousingZips(zips: string[], cap = 30): Promise<AreaSignal[]> {
  if (!zips?.length) return [];
  try {
    const out: AreaSignal[] = [];
    // Census ACS 5-year B25034 — year structure built buckets.
    // get=B25034_001E,B25034_010E,B25034_011E (total, 1970-79, pre-1939 etc.)
    // Vintage 2022 is the latest reliable ACS5.
    const list = zips.slice(0, 50).join(",");
    const url = `https://api.census.gov/data/2022/acs/acs5?get=NAME,B25034_001E,B25034_010E,B25034_011E&for=zip%20code%20tabulation%20area:${list}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const rows = await r.json() as string[][];
    for (let i = 1; i < rows.length; i++) {
      const [, total, b1970, b1939] = rows[i];
      const z = rows[i][rows[i].length - 1];
      const t = Number(total) || 0;
      const old = (Number(b1970) || 0) + (Number(b1939) || 0);
      if (t < 50) continue;
      const share = old / t;
      if (share < 0.6) continue;
      out.push({
        zip: z,
        signal_type: "aging_housing_tract",
        signal_detail: `${Math.round(share * 100)}% of housing in ${z} built pre-1980 (${old.toLocaleString()} of ${t.toLocaleString()} units)`,
        signal_date: today(),
        source_method: "hud_acs",
        signal_url: `https://data.census.gov/cedsci/table?q=B25034&g=8600000US${z}`,
        raw_source_data: { total: t, pre_1980: old, share },
      });
      if (out.length >= cap) break;
    }
    return out;
  } catch (e) {
    console.warn("[fed-area #31 aging-housing]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// ---- #32 FFIEC HMDA loan-density (refi=31, home-improvement=32) ----
export async function fetchHmdaLoanDensity(state = "MI", cap = 30): Promise<AreaSignal[]> {
  try {
    // FFIEC v2 data browser: zip-level aggregations for 2024 by loan_purpose.
    const url = `https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?years=2024&states=${state}&loan_purposes=31,32`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json() as { aggregations?: Array<Record<string, unknown>> };
    const aggs = j.aggregations ?? [];
    const byZip: Record<string, { refi: number; hi: number }> = {};
    for (const a of aggs) {
      const zip = String((a as any).zip_code ?? (a as any).zip ?? "");
      const purpose = Number((a as any).loan_purpose ?? 0);
      const count = Number((a as any).count ?? (a as any).loan_count ?? 0);
      if (!zip || !count) continue;
      byZip[zip] ??= { refi: 0, hi: 0 };
      if (purpose === 31) byZip[zip].refi += count;
      else if (purpose === 32) byZip[zip].hi += count;
    }
    const out: AreaSignal[] = [];
    for (const [zip, { refi, hi }] of Object.entries(byZip)) {
      if (refi < 25 && hi < 15) continue;
      if (hi >= 15) {
        out.push({
          zip,
          signal_type: "home_improvement_loan_area",
          signal_detail: `${hi} home-improvement loans originated in ${zip} (2024 HMDA)`,
          signal_date: today(),
          source_method: "ffiec_hmda",
          signal_url: `https://ffiec.cfpb.gov/data-browser/data/2024?category=states&items=${state}`,
          raw_source_data: { hi, refi },
        });
      }
      if (refi >= 25) {
        out.push({
          zip,
          signal_type: "homeowner_equity_area",
          signal_detail: `${refi} refi originations in ${zip} — homeowners pulling cash (2024 HMDA)`,
          signal_date: today(),
          source_method: "ffiec_hmda",
          signal_url: `https://ffiec.cfpb.gov/data-browser/data/2024?category=states&items=${state}`,
          raw_source_data: { hi, refi },
        });
      }
      if (out.length >= cap) break;
    }
    return out;
  } catch (e) {
    console.warn("[fed-area #32 hmda]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// ---- #33 FEMA NFIP repeat-loss zips ----
export async function fetchNfipRepeatLossZips(state = "MI", cap = 20): Promise<AreaSignal[]> {
  try {
    // OpenFEMA NfipClaims — last 5 years, group by zip, threshold ≥3 claims.
    const since = new Date(Date.now() - 5 * 365 * 86400_000).toISOString().slice(0, 10);
    const url = `https://www.fema.gov/api/open/v2/FimaNfipClaims?$filter=state%20eq%20'${state}'%20and%20dateOfLoss%20ge%20'${since}'&$top=5000&$select=reportedZipcode,dateOfLoss,amountPaidOnBuildingClaim`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json() as { FimaNfipClaims?: Array<Record<string, unknown>> };
    const rows = j.FimaNfipClaims ?? [];
    const byZip: Record<string, { n: number; paid: number }> = {};
    for (const row of rows) {
      const z = String((row as any).reportedZipcode ?? "").trim();
      if (!z) continue;
      byZip[z] ??= { n: 0, paid: 0 };
      byZip[z].n++;
      byZip[z].paid += Number((row as any).amountPaidOnBuildingClaim) || 0;
    }
    const out: AreaSignal[] = [];
    for (const [zip, { n, paid }] of Object.entries(byZip)) {
      if (n < 3) continue;
      out.push({
        zip,
        signal_type: "nfip_repeat_loss_zip",
        signal_detail: `${n} NFIP flood claims in ${zip} since ${since.slice(0, 4)} ($${Math.round(paid).toLocaleString()} paid)`,
        signal_date: today(),
        source_method: "openfema_nfip",
        signal_url: "https://www.fema.gov/about/openfema/data-sets",
        raw_source_data: { claims: n, paid_total: paid },
      });
      if (out.length >= cap) break;
    }
    return out;
  } catch (e) {
    console.warn("[fed-area #33 nfip]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// ---- #35 EPA ECHO SDWA water-system violations ----
export async function fetchEpaWaterViolations(state = "MI", cap = 20): Promise<AreaSignal[]> {
  try {
    const url = `https://echodata.epa.gov/echo/sdw_rest_services.get_systems?output=JSON&p_st=${state}&p_act=Y&p_viol=Y`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json() as { Results?: { Results?: { SDWA?: Array<Record<string, unknown>> } } };
    const systems = j?.Results?.Results?.SDWA ?? [];
    const out: AreaSignal[] = [];
    for (const sys of systems) {
      const city = String((sys as any).CityServed ?? "").trim();
      const zip = String((sys as any).ZipCodeServed ?? "").trim();
      const name = String((sys as any).PWSName ?? "");
      const viols = Number((sys as any).ViolFlag ?? 0);
      if (!viols || (!city && !zip)) continue;
      out.push({
        city: city || undefined,
        zip: zip || undefined,
        signal_type: "epa_water_violation_area",
        signal_detail: `Active SDWA violation: ${name} (${city || zip})`,
        signal_date: today(),
        source_method: "epa_echo",
        signal_url: `https://echo.epa.gov/detailed-facility-report?fid=${(sys as any).PWSID ?? ""}`,
        raw_source_data: sys as Record<string, unknown>,
      });
      if (out.length >= cap) break;
    }
    return out;
  } catch (e) {
    console.warn("[fed-area #35 epa-echo]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// ---- #40 NOAA SPC mesoscale discussions (state-scope) ----
export async function fetchSpcMesoscale(state = "MI", cap = 5): Promise<AreaSignal[]> {
  try {
    // SPC current mesoscale discussions RSS — convective threats next 1-6h.
    const url = "https://www.spc.noaa.gov/products/spcmdrss.xml";
    const r = await fetch(url, { headers: { "User-Agent": "TradeRadar/1.0" } });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].slice(0, 10);
    const out: AreaSignal[] = [];
    const stateRegex = new RegExp(`\\b${state}\\b|MICH|MICHIGAN|MI\\b`, "i");
    for (const m of items) {
      const block = m[0];
      const title = (block.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "";
      const desc = (block.match(/<description>([\s\S]*?)<\/description>/) ?? [])[1] ?? "";
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? "";
      if (!stateRegex.test(title) && !stateRegex.test(desc)) continue;
      out.push({
        signal_type: "storm_wind_damage",
        signal_detail: title.trim() || "SPC mesoscale convective threat",
        signal_date: today(),
        source_method: "noaa_spc_mesoscale",
        signal_url: link.trim(),
        raw_source_data: { title, desc: desc.slice(0, 300) },
      });
      if (out.length >= cap) break;
    }
    return out;
  } catch (e) {
    console.warn("[fed-area #40 spc-meso]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Vertical → which federal sources to pull.
const FEDERAL_SOURCE_MAP: Record<string, Array<"aging" | "hmda_hi" | "hmda_refi" | "nfip" | "epa" | "spc">> = {
  roofing: ["aging", "hmda_hi", "spc"],
  hvac: ["aging", "hmda_refi"],
  plumbing: ["aging", "hmda_hi", "nfip", "epa"],
  electrical: ["aging", "hmda_hi"],
  pest_control: ["aging"],
  gutters: ["aging", "hmda_hi", "spc"],
  exterior: ["aging", "hmda_hi", "spc"],
  tree: ["spc"],
  restoration: ["nfip", "spc"],
  demo_junk: [],
  foundation: ["nfip", "epa"],
};

/**
 * Run Batch 1C federal area signals for a single vertical.
 * Returns AreaSignal[] ready to push into rawSignals (will route via AREA_ALERT_TYPES).
 */
export async function runFederalAreaSignals(
  vertical: string,
  state = "MI",
  clientZips: string[] = [],
): Promise<AreaSignal[]> {
  const sources = FEDERAL_SOURCE_MAP[vertical] ?? [];
  if (!sources.length) return [];

  const tasks: Array<Promise<AreaSignal[]>> = [];
  if (sources.includes("aging") && clientZips.length) tasks.push(fetchAgingHousingZips(clientZips));
  if (sources.includes("hmda_hi") || sources.includes("hmda_refi")) tasks.push(fetchHmdaLoanDensity(state));
  if (sources.includes("nfip")) tasks.push(fetchNfipRepeatLossZips(state));
  if (sources.includes("epa")) tasks.push(fetchEpaWaterViolations(state));
  if (sources.includes("spc")) tasks.push(fetchSpcMesoscale(state));

  const results = await Promise.allSettled(tasks);
  const merged: AreaSignal[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") merged.push(...r.value);
  }

  // Vertical filter for HMDA (refi vs HI)
  return merged.filter((s) => {
    if (s.signal_type === "home_improvement_loan_area") return sources.includes("hmda_hi");
    if (s.signal_type === "homeowner_equity_area") return sources.includes("hmda_refi");
    return true;
  });
}
