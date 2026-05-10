// Shared types for counsel-search source modules
export interface IntelHit {
  source: string;
  source_url?: string;
  category: string;
  title: string;
  summary: string;
  date?: string;
  location?: string;
  severity?: "high" | "medium" | "low" | "info";
  alias_match?: string;
}

export const COMMON_FETCH = { signal: AbortSignal.timeout(10_000) } as const;
export const UA = { "User-Agent": "DWA-CounselSearch/1.0 (research)" };

export function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ");
  return { first, last };
}
