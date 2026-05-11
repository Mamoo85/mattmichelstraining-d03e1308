// _shared/techalert-federal-scanners.ts
// Wave 1 — Batch 1A federal API scanners for TechAlert.
// All five sources are fully open APIs (no paid keys, no scrape budget).
// Each is wrapped in withSourceHealth() so a failing endpoint auto-pauses
// after 7 days of zero yield instead of silently burning resources.

import { withSourceHealth } from "./source-health.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface FederalPosting {
  company_name: string;
  city?: string;
  state?: string;
  role: string;
  source_url?: string;
  source_label: string;
  is_boiler: boolean;
  signal_type?: string;
  signal_strength?: number; // 1-10
}

const TRADES_NAICS_PREFIXES = ["236", "237", "238"]; // construction
const CONSTRUCTION_SIC = ["1623", "1629", "1711", "1731"]; // water, heavy, plumbing/HVAC, electrical
const UA = { "User-Agent": "M2-DWA-Hiring-Monitor matt@detroitwebagent.com" };

// #36 — DOT FMCSA carrier registrations (fleet repair signals)
export async function scanFMCSACarriers(sb: SupabaseClient): Promise<FederalPosting[]> {
  return withSourceHealth(sb, "fmcsa_carriers", async () => {
    // FMCSA carrier search by state; filter to MI/OH/IN/IL.
    // Public API: https://mobile.fmcsa.dot.gov/qc/services/carriers/...
    // No auth required for the public webservice; rate-limit gentle.
    const states = ["MI", "OH", "IN", "IL"];
    const out: FederalPosting[] = [];
    for (const st of states) {
      const url = `https://mobile.fmcsa.dot.gov/qc/services/carriers/state/${st}?webKey=public`;
      const r = await fetch(url, { headers: UA });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      const list: any[] = j?.content ?? [];
      for (const c of list.slice(0, 25)) {
        const car = c?.carrier;
        if (!car?.legalName) continue;
        out.push({
          company_name: car.legalName,
          city: car.phyCity || undefined,
          state: car.phyState || st,
          role: "fleet_signal",
          source_label: "FMCSA Carrier Registry",
          is_boiler: false,
          signal_type: "fleet_carrier_registered",
          signal_strength: 5,
        });
      }
    }
    return out;
  }, { product: "techalert", source_type: "api", daily_cap: 100, notes: "DOT FMCSA carrier signals" });
}

// #37 — OSHA enforcement / inspection details (NAICS 23 construction)
export async function scanOSHAInspections(sb: SupabaseClient): Promise<FederalPosting[]> {
  return withSourceHealth(sb, "osha_inspections", async () => {
    // DOL Enforcement Data — public, no key.
    // We use the SODA-style endpoint that filters by NAICS prefix.
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const url = `https://enforcedata.dol.gov/views/data_summary.php?format=json&naics=23&date_received=${since}`;
    const r = await fetch(url, { headers: UA });
    if (!r.ok) return [];
    const j = await r.json().catch(() => null);
    const rows: any[] = Array.isArray(j) ? j : (j?.results ?? []);
    const out: FederalPosting[] = [];
    for (const row of rows.slice(0, 50)) {
      const name = row?.estab_name || row?.legal_name;
      if (!name) continue;
      // Only flag trades NAICS (236/237/238)
      const naics = String(row?.naics_code ?? "");
      if (!TRADES_NAICS_PREFIXES.some(p => naics.startsWith(p))) continue;
      out.push({
        company_name: String(name).trim(),
        city: row?.site_city,
        state: row?.site_state,
        role: "osha_signal",
        source_label: "OSHA Enforcement",
        is_boiler: false,
        signal_type: "osha_inspection",
        signal_strength: 7, // recent inspection = active operations + scaling risk
      });
    }
    return out;
  }, { product: "techalert", source_type: "api", daily_cap: 100, notes: "OSHA construction inspections" });
}

// #63 — Federal NPI Registry (medical trades: HVAC/plumbing in healthcare facilities)
export async function scanNPIMedicalTrades(sb: SupabaseClient): Promise<FederalPosting[]> {
  return withSourceHealth(sb, "npi_medical_trades", async () => {
    // NPI Registry public API. Filter by taxonomy codes for facility services.
    // Healthcare facility ops contractors. https://npiregistry.cms.hhs.gov/api/
    const states = ["MI", "OH", "IN", "IL"];
    const out: FederalPosting[] = [];
    for (const st of states) {
      const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&state=${st}&enumeration_type=NPI-2&limit=50&taxonomy_description=Hospital`;
      const r = await fetch(url, { headers: UA });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      const rows: any[] = j?.results ?? [];
      for (const row of rows.slice(0, 15)) {
        const name = row?.basic?.organization_name;
        if (!name) continue;
        const addr = row?.addresses?.[0] ?? {};
        out.push({
          company_name: String(name).trim(),
          city: addr.city,
          state: addr.state || st,
          role: "medical_facility_signal",
          source_label: "NPI Registry (facility ops)",
          is_boiler: false,
          signal_type: "medical_facility_target",
          signal_strength: 4, // ICP indicator, not urgent hire signal
        });
      }
    }
    return out;
  }, { product: "techalert", source_type: "api", daily_cap: 80, notes: "NPI medical facility cross-ref" });
}

// #73 — DOL WHD wage violations (contractor distress signal)
export async function scanDOLWHDViolations(sb: SupabaseClient): Promise<FederalPosting[]> {
  return withSourceHealth(sb, "dol_whd_violations", async () => {
    // DOL Wage and Hour Division enforcement data; filter to construction NAICS prefix 23.
    const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const url = `https://enfxfr.dol.gov/data_catalog/WHD/whd_whisard.json?case_violtn_cnt_gt=0&naic_cd=23&findings_start_date=${since}`;
    const r = await fetch(url, { headers: UA });
    if (!r.ok) return [];
    const j = await r.json().catch(() => null);
    const rows: any[] = Array.isArray(j) ? j : (j?.results ?? []);
    const out: FederalPosting[] = [];
    for (const row of rows.slice(0, 50)) {
      const name = row?.trade_nm || row?.legal_name;
      if (!name) continue;
      const st = row?.st_cd;
      if (st && !["MI", "OH", "IN", "IL", "WI", "PA", "TN", "KY"].includes(st)) continue;
      out.push({
        company_name: String(name).trim(),
        city: row?.cty_nm,
        state: st,
        role: "dol_violation_signal",
        source_label: "DOL WHD Enforcement",
        is_boiler: false,
        signal_type: "dol_wage_violation",
        signal_strength: 6,
      });
    }
    return out;
  }, { product: "techalert", source_type: "api", daily_cap: 100, notes: "DOL WHD wage violations" });
}

// #59 — Wisconsin DSPS credentials (new + expiring)
export async function scanWisconsinDSPS(sb: SupabaseClient): Promise<FederalPosting[]> {
  return withSourceHealth(sb, "wi_dsps_credentials", async () => {
    // WI DSPS has a public credential lookup. We pull recent issuances for HVAC/electrical/plumbing.
    // Endpoint: https://app.wi.gov/licensesearch — limited public JSON; fall back to gentle scrape.
    const trades = ["HVAC%20Qualifier", "Electrical%20Contractor", "Plumbing%20Contractor"];
    const out: FederalPosting[] = [];
    for (const t of trades) {
      const url = `https://app.wi.gov/api/licensesearch/recent?credential=${t}&limit=25`;
      const r = await fetch(url, { headers: UA });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      const rows: any[] = Array.isArray(j) ? j : (j?.results ?? []);
      for (const row of rows.slice(0, 15)) {
        const name = row?.business_name || row?.full_name;
        if (!name) continue;
        out.push({
          company_name: String(name).trim(),
          city: row?.city,
          state: "WI",
          role: "license_signal",
          source_label: "WI DSPS",
          is_boiler: t.includes("HVAC"),
          signal_type: "license_new_or_expiring",
          signal_strength: 5,
        });
      }
    }
    return out;
  }, { product: "techalert", source_type: "api", daily_cap: 75, notes: "Wisconsin DSPS credentials (Milwaukee expansion)" });
}

/**
 * Run all five Batch 1A scanners in parallel.
 * Returns flat array of FederalPostings; caller handles upsert + dedup.
 */
export async function runBatch1AFederal(sb: SupabaseClient): Promise<{
  postings: FederalPosting[];
  by_source: Record<string, number>;
}> {
  const results = await Promise.allSettled([
    scanFMCSACarriers(sb),
    scanOSHAInspections(sb),
    scanNPIMedicalTrades(sb),
    scanDOLWHDViolations(sb),
    scanWisconsinDSPS(sb),
  ]);
  const names = ["fmcsa", "osha", "npi", "dol_whd", "wi_dsps"];
  const postings: FederalPosting[] = [];
  const by_source: Record<string, number> = {};
  results.forEach((r, i) => {
    const arr = r.status === "fulfilled" ? r.value : [];
    by_source[names[i]] = arr.length;
    postings.push(...arr);
  });
  return { postings, by_source };
}
