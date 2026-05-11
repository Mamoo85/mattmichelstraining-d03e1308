// _shared/source-health.ts
// Records per-run yield for every external data source and auto-pauses sources
// that return zero results for 7 consecutive days. Used by all Wave 1+ sources.
//
// Usage:
//   import { recordSourceRun, isSourcePaused } from "../_shared/source-health.ts";
//   if (await isSourcePaused(sb, "fmcsa_carriers")) return [];
//   try {
//     const rows = await fetchFmcsa();
//     await recordSourceRun(sb, "fmcsa_carriers", rows.length);
//     return rows;
//   } catch (e) {
//     await recordSourceRun(sb, "fmcsa_carriers", 0, String(e?.message ?? e));
//     return [];
//   }

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const ZERO_DAYS_BEFORE_PAUSE = 7;

export async function recordSourceRun(
  sb: SupabaseClient,
  source_name: string,
  yieldCount: number,
  errorMsg?: string,
  opts?: { product?: string; source_type?: string; daily_cap?: number; notes?: string }
): Promise<void> {
  try {
    const { data: existing } = await sb
      .from("source_health")
      .select("id, consecutive_zero_days, total_runs, paused")
      .eq("source_name", source_name)
      .maybeSingle();

    const isZero = yieldCount === 0 && !errorMsg; // errors don't increment zero-day counter
    const newConsecutiveZero = isZero
      ? (existing?.consecutive_zero_days ?? 0) + 1
      : 0;
    const shouldPause = newConsecutiveZero >= ZERO_DAYS_BEFORE_PAUSE;

    if (existing) {
      await sb
        .from("source_health")
        .update({
          last_run_at: new Date().toISOString(),
          last_yield: yieldCount,
          total_runs: (existing.total_runs ?? 0) + 1,
          consecutive_zero_days: newConsecutiveZero,
          paused: existing.paused || shouldPause,
          paused_reason: shouldPause && !existing.paused
            ? `auto-paused: ${ZERO_DAYS_BEFORE_PAUSE} consecutive zero-yield days`
            : undefined,
          last_error: errorMsg ?? null,
        })
        .eq("id", existing.id);
    } else {
      await sb.from("source_health").insert({
        source_name,
        product: opts?.product,
        source_type: opts?.source_type,
        last_run_at: new Date().toISOString(),
        last_yield: yieldCount,
        total_runs: 1,
        consecutive_zero_days: isZero ? 1 : 0,
        daily_cap: opts?.daily_cap ?? 200,
        notes: opts?.notes,
        last_error: errorMsg ?? null,
      });
    }
  } catch (e) {
    // Never let source_health bookkeeping break the scanner
    console.error("[source-health] record failed:", source_name, e);
  }
}

export async function isSourcePaused(
  sb: SupabaseClient,
  source_name: string
): Promise<boolean> {
  try {
    const { data } = await sb
      .from("source_health")
      .select("paused")
      .eq("source_name", source_name)
      .maybeSingle();
    return !!data?.paused;
  } catch {
    return false; // fail-open
  }
}

/**
 * Wraps any source fetch with health tracking + auto-skip when paused.
 * Returns [] on error so callers can keep going.
 */
export async function withSourceHealth<T>(
  sb: SupabaseClient,
  source_name: string,
  fetcher: () => Promise<T[]>,
  opts?: { product?: string; source_type?: string; daily_cap?: number; notes?: string }
): Promise<T[]> {
  if (await isSourcePaused(sb, source_name)) return [];
  try {
    const rows = await fetcher();
    const count = Array.isArray(rows) ? rows.length : 0;
    await recordSourceRun(sb, source_name, count, undefined, opts);
    return rows ?? [];
  } catch (e) {
    await recordSourceRun(sb, source_name, 0, String((e as Error)?.message ?? e), opts);
    return [];
  }
}
