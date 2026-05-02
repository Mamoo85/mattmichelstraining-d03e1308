// Universal source caller. Any radar / waterfall imports `useSource(sb, id, params)`
// and gets a typed FetchResult that's been cached + audit-logged.
//
// Usage:
//   import { useSource, useSourcesParallel } from "../_shared/sources/use.ts";
//   const r = await useSource(sb, "dol_warn", { state: "MI" });
//   const all = await useSourcesParallel(sb, [
//     { id: "fema_disasters", params: { state: "MI" } },
//     { id: "noaa_storm_events", params: { state: "MI" } },
//   ]);
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cachedFetch, dispatchFetch, getSource, listByRadar, type FetchResult, type SourceMeta } from "./index.ts";

export type SourceCall = { id: string; params?: Record<string, string> };

export async function useSource<T = unknown>(
  sb: SupabaseClient,
  sourceId: string,
  params: Record<string, string> = {},
): Promise<FetchResult<T>> {
  const cacheKey = JSON.stringify(params);
  return cachedFetch<T>(sb as any, sourceId, cacheKey, () => dispatchFetch(sourceId, params) as Promise<T[]>);
}

// Run many sources in parallel. Failures are isolated — one bad source doesn't break the others.
export async function useSourcesParallel<T = unknown>(
  sb: SupabaseClient,
  calls: SourceCall[],
): Promise<Record<string, FetchResult<T>>> {
  const out: Record<string, FetchResult<T>> = {};
  const results = await Promise.all(
    calls.map(async (c): Promise<[string, FetchResult<T>]> => {
      try {
        const r = await useSource<T>(sb, c.id, c.params ?? {});
        return [c.id, r];
      } catch (e) {
        return [c.id, {
          source_id: c.id,
          cache_key: JSON.stringify(c.params ?? {}),
          data: [],
          fetched_at: new Date().toISOString(),
          cached: false,
          cost_cents: 0,
          error: e instanceof Error ? e.message : String(e),
        }];
      }
    }),
  );
  for (const [id, r] of results) out[id] = r;
  return out;
}

// Convenience: pull every free source for a given radar in parallel with sane default params.
export async function useRadarSources<T = unknown>(
  sb: SupabaseClient,
  radar: SourceMeta["radar"],
  defaultParams: Record<string, string> = {},
): Promise<Record<string, FetchResult<T>>> {
  const sources = listByRadar(radar).filter((s) => s.free);
  return useSourcesParallel<T>(sb, sources.map((s) => ({ id: s.id, params: defaultParams })));
}

export { getSource, listByRadar };
