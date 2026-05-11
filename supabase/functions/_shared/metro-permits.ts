// Wave 1 Batch 1D — Metro permit ArcGIS / Socrata layers for Trade Radar.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { withSourceHealth } from "./source-health.ts";
// 10 sources across Grand Rapids, Ann Arbor, Chicago, Cleveland, Columbus,
// Indianapolis, Milwaukee, Nashville. Returns per-address signals that flow
// through validateLead into trade_radar_leads.
//
// Gating: each city scraper is only invoked when the scanner's client list
// for the vertical includes a coverage_regions entry naming that metro.
// (See trade-radar-scanner — it queries trade_radar_clients then passes
//  the union of coverage_regions into runMetroPermitSignals().)
//
// All sources are fail-graceful (try/catch around each fetch).

type Vertical =
  | "roofing" | "hvac" | "plumbing" | "electrical" | "pest_control"
  | "gutters" | "exterior" | "tree" | "restoration" | "demo_junk" | "foundation";

export type MetroSignal = {
  address: string;
  city?: string;
  zip?: string;
  state?: string;
  signal_type: string;
  signal_detail?: string;
  signal_date?: string;
  signal_url?: string;
  score?: number;
  source_method: "scraper";
  suggested_opener?: string;
  best_call_window?: string;
  estimated_value?: number;
  raw_source_data?: Record<string, unknown>;
};

// Vertical → keyword regex used to filter free-text work-description fields.
const VERTICAL_KEYWORDS: Record<Vertical, RegExp> = {
  roofing: /\broof|reroof|shingle/i,
  hvac: /\bhvac|furnace|boiler|heat\s*pump|air\s*condition|mechanical|a\/?c\b/i,
  plumbing: /\bplumb|sewer|water\s*heater|drain|backflow|gas\s*line/i,
  electrical: /\belectric|panel|service\s*upgrade|wiring|generator/i,
  gutters: /\bgutter|downspout|leader/i,
  exterior: /\bsiding|window|exterior\s*paint|stucco|fa[cç]ade/i,
  foundation: /\bfoundation|basement|waterproof|underpin|footing/i,
  demo_junk: /\bdemo|demolition|wreck|raze/i,
  restoration: /\bwater\s*damage|fire\s*damage|smoke\s*damage|mold|remediation|restoration/i,
  tree: /\btree|stump|prune/i,
  pest_control: /__never_matches__/, // permits aren't a pest signal
};

const SIGNAL_TYPE_BY_VERTICAL: Record<Vertical, string> = {
  roofing: "metro_roof_permit",
  hvac: "metro_hvac_permit",
  plumbing: "metro_plumbing_permit",
  electrical: "metro_electrical_permit",
  gutters: "metro_gutter_permit",
  exterior: "metro_exterior_permit",
  foundation: "metro_foundation_permit",
  demo_junk: "metro_demo_permit",
  restoration: "metro_restoration_permit",
  tree: "metro_tree_permit",
  pest_control: "metro_pest_signal",
};

const ESTIMATED_VALUE: Record<Vertical, number> = {
  roofing: 12000, hvac: 8000, plumbing: 5000, electrical: 6000,
  gutters: 2500, exterior: 8000, foundation: 15000, demo_junk: 4500,
  restoration: 10000, tree: 1500, pest_control: 400,
};

function opener(vertical: Vertical, city: string, address: string): string {
  return `Hi — saw a recent permit for work at ${address} (${city}). We do ${vertical.replace("_", " ")} in this neighborhood. Want a quick free walkthrough this week?`;
}

function within(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": "DWA-Trade-Radar/1.0", Accept: "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

function pushIfKeyword(
  out: MetroSignal[],
  vertical: Vertical,
  base: Omit<MetroSignal, "signal_type" | "score" | "source_method" | "estimated_value" | "suggested_opener" | "best_call_window">,
  workText: string,
): void {
  const re = VERTICAL_KEYWORDS[vertical];
  if (!re.test(workText)) return;
  out.push({
    ...base,
    signal_type: SIGNAL_TYPE_BY_VERTICAL[vertical],
    score: 7,
    source_method: "scraper",
    estimated_value: ESTIMATED_VALUE[vertical],
    suggested_opener: opener(vertical, base.city ?? "", base.address),
    best_call_window: "Within 7 days of permit issue",
  });
}

// ─── #1 Grand Rapids permits — Kent County ArcGIS ─────────────────────────
async function scanGrandRapidsPermits(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  const url = "https://services.arcgis.com/Civ51eWS47Y0NPgg/arcgis/rest/services/GR_Permits_Public/FeatureServer/0/query"
    + "?where=1=1&outFields=*&f=json&resultRecordCount=200&orderByFields=ISSUE_DATE+DESC";
  const j: any = await fetchJson(url);
  for (const a of (j?.features ?? [])) {
    const p = a.attributes ?? {};
    const issued = p.ISSUE_DATE ? new Date(p.ISSUE_DATE).toISOString() : undefined;
    if (issued && issued < within(30)) continue;
    pushIfKeyword(out, vertical, {
      address: p.ADDRESS || p.SITE_ADDRESS, city: "Grand Rapids", zip: p.ZIP, state: "MI",
      signal_detail: p.DESCRIPTION || p.WORK_DESC, signal_date: issued,
      raw_source_data: { source: "grand_rapids_permits", permit_no: p.PERMIT_NO },
    }, `${p.DESCRIPTION ?? ""} ${p.WORK_DESC ?? ""} ${p.PERMIT_TYPE ?? ""}`);
  }
  return out;
}

// ─── #2 Grand Rapids CofC expirations ─────────────────────────────────────
async function scanGrandRapidsCofCExpirations(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  const url = "https://services.arcgis.com/Civ51eWS47Y0NPgg/arcgis/rest/services/GR_Rental_Certificates/FeatureServer/0/query"
    + "?where=EXPIRATION_DATE>CURRENT_TIMESTAMP&outFields=*&f=json&resultRecordCount=200&orderByFields=EXPIRATION_DATE+ASC";
  const j: any = await fetchJson(url);
  for (const a of (j?.features ?? []).slice(0, 100)) {
    const p = a.attributes ?? {};
    const exp = p.EXPIRATION_DATE ? new Date(p.EXPIRATION_DATE) : null;
    if (!exp) continue;
    const daysLeft = Math.round((exp.getTime() - Date.now()) / 86400_000);
    if (daysLeft < 0 || daysLeft > 90) continue;
    out.push({
      address: p.ADDRESS || p.SITE_ADDRESS, city: "Grand Rapids", zip: p.ZIP, state: "MI",
      signal_type: `cofc_${vertical}_inspection`,
      signal_detail: `Rental CofC expires in ${daysLeft} days`,
      signal_date: new Date().toISOString(),
      score: daysLeft <= 7 ? 9 : daysLeft <= 30 ? 8 : 7,
      source_method: "scraper",
      estimated_value: ESTIMATED_VALUE[vertical],
      suggested_opener: `Hi — your rental Certificate of Compliance at ${p.ADDRESS ?? "this property"} expires in ${daysLeft} days. Want a free pre-inspection so it passes the first time?`,
      best_call_window: "Within 14 days",
      raw_source_data: { source: "grand_rapids_cofc", parcel: p.PARCEL_NO },
    });
  }
  return out;
}

// ─── Generic Socrata helper ──────────────────────────────────────────────
async function fetchSocrata(host: string, dataset: string, params: Record<string, string>): Promise<any[]> {
  const q = new URLSearchParams(params).toString();
  const url = `https://${host}/resource/${dataset}.json?${q}`;
  const j = await fetchJson<any[]>(url);
  return Array.isArray(j) ? j : [];
}

// ─── #4 Ann Arbor permits — A2OpenData Socrata ───────────────────────────
async function scanAnnArborPermits(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  // a2gov publishes building permits at 6gnm-uern (best-known dataset id;
  // fail-graceful if id changes)
  const rows = await fetchSocrata("data.a2gov.org", "6gnm-uern", {
    $limit: "200", $order: "issue_date DESC",
    $where: `issue_date > '${within(30).slice(0, 10)}'`,
  });
  for (const p of rows) {
    pushIfKeyword(out, vertical, {
      address: p.address || p.site_address, city: "Ann Arbor", zip: p.zip, state: "MI",
      signal_detail: p.description || p.work_description, signal_date: p.issue_date,
      raw_source_data: { source: "ann_arbor_permits", permit_no: p.permit_number },
    }, `${p.description ?? ""} ${p.work_description ?? ""} ${p.permit_type ?? ""}`);
  }
  return out;
}

// ─── #11 Chicago building permits ────────────────────────────────────────
async function scanChicagoPermits(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  const rows = await fetchSocrata("data.cityofchicago.org", "ydr8-5enu", {
    $limit: "300", $order: "issue_date DESC",
    $where: `issue_date > '${within(30).slice(0, 10)}'`,
  });
  for (const p of rows) {
    pushIfKeyword(out, vertical, {
      address: [p.street_number, p.street_direction, p.street_name, p.suffix].filter(Boolean).join(" "),
      city: "Chicago", zip: p.zip_code, state: "IL",
      signal_detail: p.work_description, signal_date: p.issue_date,
      raw_source_data: { source: "chicago_permits", permit_no: p.permit_ },
    }, `${p.work_description ?? ""} ${p.permit_type ?? ""}`);
  }
  return out;
}

// ─── #12 Chicago code violations (foreclosure/distress proxy) ────────────
async function scanChicagoViolations(vertical: Vertical): Promise<MetroSignal[]> {
  if (vertical !== "restoration" && vertical !== "demo_junk" && vertical !== "pest_control") return [];
  const out: MetroSignal[] = [];
  const rows = await fetchSocrata("data.cityofchicago.org", "22u3-xenr", {
    $limit: "200", $order: "violation_date DESC",
    $where: `violation_date > '${within(30).slice(0, 10)}'`,
  });
  for (const p of rows) {
    const desc = `${p.violation_description ?? ""} ${p.violation_code ?? ""}`.toLowerCase();
    const isVacant = /vacant|abandoned|secur/i.test(desc);
    if (!isVacant) continue;
    out.push({
      address: p.address, city: "Chicago", zip: p.property_zip, state: "IL",
      signal_type: "foreclosure_vacant",
      signal_detail: p.violation_description, signal_date: p.violation_date,
      score: 7, source_method: "scraper",
      estimated_value: ESTIMATED_VALUE[vertical],
      suggested_opener: `Hi — saw a city violation at ${p.address}. If you're handling cleanup or repairs, we can help.`,
      best_call_window: "Within 14 days",
      raw_source_data: { source: "chicago_violations", id: p.id },
    });
  }
  return out;
}

// ─── #13 Cleveland building permits — Cuyahoga ArcGIS ────────────────────
async function scanClevelandPermits(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  const url = "https://services1.arcgis.com/X4Vr7m1FjzFvOLpu/arcgis/rest/services/Cleveland_Building_Permits/FeatureServer/0/query"
    + "?where=1=1&outFields=*&f=json&resultRecordCount=200&orderByFields=ISSUE_DATE+DESC";
  const j: any = await fetchJson(url);
  for (const a of (j?.features ?? [])) {
    const p = a.attributes ?? {};
    const issued = p.ISSUE_DATE ? new Date(p.ISSUE_DATE).toISOString() : undefined;
    if (issued && issued < within(30)) continue;
    pushIfKeyword(out, vertical, {
      address: p.ADDRESS, city: "Cleveland", zip: p.ZIP, state: "OH",
      signal_detail: p.WORK_DESC || p.DESCRIPTION, signal_date: issued,
      raw_source_data: { source: "cleveland_permits", permit_no: p.PERMIT_NO },
    }, `${p.WORK_DESC ?? ""} ${p.DESCRIPTION ?? ""} ${p.PERMIT_TYPE ?? ""}`);
  }
  return out;
}

// ─── #15 Columbus permits — opendata.columbus.gov Socrata ────────────────
async function scanColumbusPermits(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  const rows = await fetchSocrata("opendata.columbus.gov", "qbz4-d4kx", {
    $limit: "200", $order: "issue_date DESC",
    $where: `issue_date > '${within(30).slice(0, 10)}'`,
  });
  for (const p of rows) {
    pushIfKeyword(out, vertical, {
      address: p.address, city: "Columbus", zip: p.zip, state: "OH",
      signal_detail: p.description || p.work_description, signal_date: p.issue_date,
      raw_source_data: { source: "columbus_permits", permit_no: p.permit_number },
    }, `${p.description ?? ""} ${p.work_description ?? ""} ${p.permit_type ?? ""}`);
  }
  return out;
}

// ─── #18 Indianapolis permits — data.indy.gov Socrata ────────────────────
async function scanIndianapolisPermits(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  const rows = await fetchSocrata("data.indy.gov", "p2vj-jr2q", {
    $limit: "200", $order: "issued_date DESC",
    $where: `issued_date > '${within(30).slice(0, 10)}'`,
  });
  for (const p of rows) {
    pushIfKeyword(out, vertical, {
      address: p.address, city: "Indianapolis", zip: p.zip, state: "IN",
      signal_detail: p.description || p.work_description, signal_date: p.issued_date,
      raw_source_data: { source: "indy_permits", permit_no: p.permit_number },
    }, `${p.description ?? ""} ${p.work_description ?? ""} ${p.permit_type ?? ""}`);
  }
  return out;
}

// ─── #19 Milwaukee permits — data.milwaukee.gov Socrata ──────────────────
async function scanMilwaukeePermits(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  const rows = await fetchSocrata("data.milwaukee.gov", "x88s-kp4n", {
    $limit: "200", $order: "issued_date DESC",
    $where: `issued_date > '${within(30).slice(0, 10)}'`,
  });
  for (const p of rows) {
    pushIfKeyword(out, vertical, {
      address: p.address, city: "Milwaukee", zip: p.zip_code, state: "WI",
      signal_detail: p.description || p.work_description, signal_date: p.issued_date,
      raw_source_data: { source: "milwaukee_permits", permit_no: p.permit_number },
    }, `${p.description ?? ""} ${p.work_description ?? ""} ${p.permit_type ?? ""}`);
  }
  return out;
}

// ─── #21 Nashville permits — data.nashville.gov Socrata ──────────────────
async function scanNashvillePermits(vertical: Vertical): Promise<MetroSignal[]> {
  const out: MetroSignal[] = [];
  const rows = await fetchSocrata("data.nashville.gov", "3h5w-q8b7", {
    $limit: "200", $order: "date_issued DESC",
    $where: `date_issued > '${within(30).slice(0, 10)}'`,
  });
  for (const p of rows) {
    pushIfKeyword(out, vertical, {
      address: p.address_full || p.address, city: "Nashville", zip: p.zip, state: "TN",
      signal_detail: p.description || p.purpose, signal_date: p.date_issued,
      raw_source_data: { source: "nashville_permits", permit_no: p.permit_number },
    }, `${p.description ?? ""} ${p.purpose ?? ""} ${p.permit_type ?? ""}`);
  }
  return out;
}

// ─── Metro registry ───────────────────────────────────────────────────────
// Each metro has a list of region/coverage keywords that match
// trade_radar_clients.coverage_regions (case-insensitive substring).
const METROS: Array<{
  name: string;
  matches: RegExp;
  scanners: Array<{ slug: string; fn: (v: Vertical) => Promise<MetroSignal[]> }>;
}> = [
  { name: "Grand Rapids", matches: /grand\s*rapids|west\s*michigan|kent/i,
    scanners: [
      { slug: "kent_arcgis_permits", fn: scanGrandRapidsPermits },
      { slug: "kent_arcgis_cofc", fn: scanGrandRapidsCofCExpirations },
    ] },
  { name: "Ann Arbor", matches: /ann\s*arbor|washtenaw/i,
    scanners: [{ slug: "a2_opendata_permits", fn: scanAnnArborPermits }] },
  { name: "Chicago", matches: /chicago|cook\s*county|illinois/i,
    scanners: [
      { slug: "socrata_chicago_permits", fn: scanChicagoPermits },
      { slug: "socrata_chicago_violations", fn: scanChicagoViolations },
    ] },
  { name: "Cleveland", matches: /cleveland|cuyahoga/i,
    scanners: [{ slug: "cuyahoga_arcgis_permits", fn: scanClevelandPermits }] },
  { name: "Columbus", matches: /columbus|franklin\s*county/i,
    scanners: [{ slug: "socrata_columbus_permits", fn: scanColumbusPermits }] },
  { name: "Indianapolis", matches: /indianapolis|marion\s*county|indiana/i,
    scanners: [{ slug: "socrata_indy_permits", fn: scanIndianapolisPermits }] },
  { name: "Milwaukee", matches: /milwaukee|wisconsin/i,
    scanners: [{ slug: "socrata_milwaukee_permits", fn: scanMilwaukeePermits }] },
  { name: "Nashville", matches: /nashville|davidson|tennessee/i,
    scanners: [{ slug: "socrata_nashville_permits", fn: scanNashvillePermits }] },
];

/**
 * Run all metro permit scanners matching coverage regions.
 * Pass `sb` to enable per-source health tracking via withSourceHealth.
 */
export async function runMetroPermitSignals(
  vertical: Vertical,
  coverageRegions: string[],
  sb?: SupabaseClient,
): Promise<MetroSignal[]> {
  if (!coverageRegions?.length) return [];
  const haystack = coverageRegions.join(" | ");
  const active = METROS.filter((m) => m.matches.test(haystack));
  if (!active.length) return [];

  const runs = active.flatMap((m) =>
    m.scanners.map((s) => {
      const exec = () => s.fn(vertical);
      const wrapped: Promise<MetroSignal[]> = sb
        ? withSourceHealth(sb, s.slug, exec, { product: "trade_radar", source_type: "scraper" })
        : exec();
      return wrapped.catch((e) => {
        console.warn(`[metro-permits] ${s.slug} (${vertical}) failed:`, e instanceof Error ? e.message : String(e));
        return [] as MetroSignal[];
      });
    })
  );
  const results = await Promise.all(runs);
  console.info(`[trade-scanner:yield] metro-permits vertical=${vertical} sources=${runs.length} rows=${results.flat().length}`);
  return results.flat();
}
