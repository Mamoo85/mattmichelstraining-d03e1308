// US Census ACS 5-Year housing age data by ZIP.
// Returns Michigan ZIPs where median year built < cutoff — identifies
// high-density target markets for ALL trade verticals (old homes need everything).
// No API key required. Uses ACS 2022 5-Year estimates.

const ACS_BASE = "https://api.census.gov/data/2022/acs/acs5";
const UA = "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)";

export interface ZipHousingAge {
  zip: string;
  medianYearBuilt: number;
  preWarUnits: number; // units built 1939 or earlier
}

let _miCache: ZipHousingAge[] | null = null;
let _miCacheTs = 0;
const CACHE_TTL = 86400_000; // 24h — ACS data is annual

export async function getMichiganOldHousingZips(
  cutoffYear = 1965,
  maxResults = 30,
): Promise<ZipHousingAge[]> {
  if (_miCache && Date.now() - _miCacheTs < CACHE_TTL) {
    return _miCache.filter((z) => z.medianYearBuilt <= cutoffYear).slice(0, maxResults);
  }
  try {
    // B25035_001E = median year structure built
    // B25034_002E = units built 1939 or earlier
    const res = await fetch(
      `${ACS_BASE}?get=B25035_001E,B25034_002E&for=zip+code+tabulation+area:*&in=state:26`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return [];
    const rows: string[][] = await res.json();
    const [header, ...data] = rows;
    const medianIdx = header.indexOf("B25035_001E");
    const preWarIdx = header.indexOf("B25034_002E");
    const zipIdx = header.indexOf("zip code tabulation area");
    _miCache = data
      .filter((r) => Number(r[medianIdx]) > 1800 && Number(r[medianIdx]) < 2030)
      .map((r) => ({
        zip: r[zipIdx],
        medianYearBuilt: Number(r[medianIdx]),
        preWarUnits: Number(r[preWarIdx]) || 0,
      }))
      .sort((a, b) => a.medianYearBuilt - b.medianYearBuilt);
    _miCacheTs = Date.now();
    return _miCache.filter((z) => z.medianYearBuilt <= cutoffYear).slice(0, maxResults);
  } catch {
    return [];
  }
}

// Returns a single summary area signal string for use in signal_detail
export function housingAgeSummary(zips: ZipHousingAge[]): string {
  if (!zips.length) return "";
  const oldest = zips[0];
  const avg = Math.round(zips.reduce((s, z) => s + z.medianYearBuilt, 0) / zips.length);
  return `Census ACS: ${zips.length} MI ZIPs with median year built ≤ ${avg} — oldest: ZIP ${oldest.zip} (median ${oldest.medianYearBuilt}, ${oldest.preWarUnits.toLocaleString()} pre-war units)`;
}
