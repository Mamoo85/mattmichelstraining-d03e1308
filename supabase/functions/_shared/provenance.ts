// Provenance + confidence scoring helpers for radar leads.

export interface SourceRef {
  source_id: string;       // e.g. "bseed_permits", "noaa_storm", "zillow_fsbo"
  fetched_at: string;      // ISO timestamp
  raw_quality?: number;    // 0-1, quality of the underlying record (address completeness, etc.)
  url?: string;
}

export interface Provenance {
  sources: SourceRef[];
  primary_source: string;
  corroboration_count: number;
}

export function buildProvenance(sources: SourceRef[]): Provenance {
  const unique = Array.from(new Map(sources.map(s => [s.source_id, s])).values());
  return {
    sources: unique,
    primary_source: unique[0]?.source_id ?? "unknown",
    corroboration_count: unique.length,
  };
}

/**
 * Compute confidence 0-100 from:
 *  - Source trust tier (registry/permit > LLM > scrape)
 *  - Recency (newer = higher)
 *  - Corroboration count (more sources confirming = higher)
 *  - Raw quality (avg of source raw_quality)
 */
const TRUST_TIERS: Record<string, number> = {
  // Tier A — official registries / permits (50 base)
  bseed_permits: 50, county_permits: 50, lara_licenses: 50, sec_edgar: 50,
  uspto_patents: 50, fema_disasters: 50, court_records: 50, sos_records: 50,
  // Tier B — deterministic scrapers (35 base)
  zillow_fsbo: 35, estatesales_net: 35, realtor_com: 35, foreclosure_listings: 35,
  arcgis_permits: 35, noaa_storm: 35, nws_alerts: 35,
  // Tier C — enrichment APIs (25 base)
  apollo: 25, hunter: 25, hubspot_breeze: 25, google_places: 25,
  // Tier D — LLM/inference (10 base)
  sonar: 10, perplexity: 10, llm_inference: 10,
};

export function computeConfidence(prov: Provenance): number {
  const tierScore = Math.max(...prov.sources.map(s => TRUST_TIERS[s.source_id] ?? 15), 15);
  const corroborationBonus = Math.min(prov.corroboration_count - 1, 3) * 10; // up to +30
  const qualityAvg = prov.sources.reduce((a, s) => a + (s.raw_quality ?? 0.7), 0) / Math.max(prov.sources.length, 1);
  const qualityScore = qualityAvg * 20; // up to +20
  // Recency: newest source within 7 days = full credit; >30 days = 0
  const newest = Math.max(...prov.sources.map(s => new Date(s.fetched_at).getTime()));
  const ageDays = (Date.now() - newest) / 86_400_000;
  const recencyScore = Math.max(0, 1 - ageDays / 30) * 10; // up to +10
  return Math.min(100, Math.round(tierScore + corroborationBonus + qualityScore + recencyScore));
}
