// kpi-math.ts — pure functions extracted from enrichment-kpi-monitor for testability.

export interface KpiInput {
  attempted: number;
  enriched: number;
  failed: number;
  skipped: number;
  total_ms?: number;
}

export interface KpiOutput {
  attempted: number;
  enriched: number;
  failed: number;
  skipped: number;
  success_rate: number;     // 0..1
  failure_rate: number;     // 0..1
  skip_rate: number;        // 0..1
  avg_ms_per_lead: number;  // 0 when attempted == 0
}

export function calcKpis(input: KpiInput): KpiOutput {
  const attempted = Math.max(0, input.attempted | 0);
  const enriched = Math.max(0, input.enriched | 0);
  const failed = Math.max(0, input.failed | 0);
  const skipped = Math.max(0, input.skipped | 0);
  const total_ms = Math.max(0, input.total_ms || 0);

  return {
    attempted,
    enriched,
    failed,
    skipped,
    success_rate: attempted ? enriched / attempted : 0,
    failure_rate: attempted ? failed / attempted : 0,
    skip_rate: attempted ? skipped / attempted : 0,
    avg_ms_per_lead: attempted ? Math.round(total_ms / attempted) : 0,
  };
}
