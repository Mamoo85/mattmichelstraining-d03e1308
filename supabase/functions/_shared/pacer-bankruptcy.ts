// Wave 1 Batch 1F — PACER bankruptcy court RSS for Trade Radar.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { withSourceHealth } from "./source-health.ts";
//
// Sources (all free, public RSS, no key):
//   #45 PACER NDIL (N. District Illinois)  bankruptcy filings
//   #46 PACER NDOH (N. District Ohio)      bankruptcy filings
//   #47 PACER SDIN (S. District Indiana)   bankruptcy filings
//
// Emits ONE `bankruptcy_distress` area signal per district per scan with a
// distress score scaled by recent filing count. PACER RSS returns case names,
// NOT property addresses → these are area-scoped signals (must be in
// AREA_ALERT_TYPES in the scanner) routed to `trade_radar_area_signals`.
//
// Verticals that benefit: restoration, foundation, demo_junk, pest_control —
// distressed homeowners often defer maintenance → service opportunity once
// the area stabilizes.

type Vertical =
  | "roofing" | "hvac" | "plumbing" | "electrical" | "pest_control"
  | "gutters" | "exterior" | "tree" | "restoration" | "demo_junk" | "foundation";

export type CourtSignal = {
  scope: "region" | "state" | "county" | "zip";
  scope_value: string;
  state?: string;
  signal_type: string;
  signal_detail?: string;
  signal_date?: string;
  signal_url?: string;
  score?: number;
  source_method: "api";
  raw_source_data?: Record<string, unknown>;
};

const TARGET_VERTICALS = new Set<Vertical>([
  "restoration", "foundation", "demo_junk", "pest_control",
]);

const DISTRICTS = [
  {
    slug: "ndil",
    name: "N.D. Illinois",
    state: "IL",
    scope_value: "N.D. Illinois",
    url: "https://ecf.ilnb.uscourts.gov/cgi-bin/rss_outside.pl",
  },
  {
    slug: "ndoh",
    name: "N.D. Ohio",
    state: "OH",
    scope_value: "N.D. Ohio",
    url: "https://ecf.ohnb.uscourts.gov/cgi-bin/rss_outside.pl",
  },
  {
    slug: "sdin",
    name: "S.D. Indiana",
    state: "IN",
    scope_value: "S.D. Indiana",
    url: "https://ecf.insb.uscourts.gov/cgi-bin/rss_outside.pl",
  },
  {
    slug: "mied",
    name: "E.D. Michigan",
    state: "MI",
    scope_value: "E.D. Michigan",
    url: "https://ecf.mieb.uscourts.gov/cgi-bin/rss_outside.pl",
  },
];

async function fetchDistrictCount(url: string): Promise<number> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "TradeRadar/1.0 (free public RSS reader)" },
    });
    if (!r.ok) return 0;
    const xml = await r.text();
    const matches = xml.match(/<item\b/gi);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

export async function runPacerBankruptcySignals(
  vertical: Vertical,
  coverageRegions: string[],
  sb?: SupabaseClient,
): Promise<CourtSignal[]> {
  if (!TARGET_VERTICALS.has(vertical)) return [];
  const joined = (coverageRegions ?? []).join(" ").toLowerCase();

  const active = DISTRICTS.filter((d) => {
    if (d.slug === "ndil" && /chicago|illinois|\bil\b/.test(joined)) return true;
    if (d.slug === "ndoh" && /cleveland|columbus|ohio|\boh\b/.test(joined)) return true;
    if (d.slug === "sdin" && /indianapolis|indiana|\bin\b/.test(joined)) return true;
    if (d.slug === "mied" && /detroit|wayne|oakland|macomb|se\s*michigan|michigan|\bmi\b/.test(joined)) return true;
    return false;
  });
  if (active.length === 0) return [];

  const results = await Promise.allSettled(
    active.map(async (d) => {
      const slug = `pacer_${d.slug}`;
      const exec = async (): Promise<CourtSignal[]> => {
        const count = await fetchDistrictCount(d.url);
        if (count <= 0) return [];
        const score = count >= 25 ? 8 : count >= 10 ? 7 : 5;
        return [{
          scope: "region",
          scope_value: d.scope_value,
          state: d.state,
          signal_type: "bankruptcy_distress",
          signal_detail: `${count} recent bankruptcy filings in ${d.name}`,
          signal_date: new Date().toISOString().slice(0, 10),
          signal_url: d.url,
          score,
          source_method: "api",
          raw_source_data: { district: d.slug, filing_count: count },
        }];
      };
      return sb
        ? await withSourceHealth(sb, slug, exec, { product: "trade_radar", source_type: "api" })
        : await exec();
    }),
  );
  const out = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  console.info(`[trade-scanner:yield] pacer vertical=${vertical} sources=${active.length} rows=${out.length}`);
  return out;
}
