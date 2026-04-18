// Pure permit velocity scoring. Items #24, #26, #28, #29, #30.
// Read-only helper used by permit-velocity-scorer background job.

export interface PermitRecord {
  contractor_name: string;
  permit_value?: number | null;
  permit_type?: string | null;
  description?: string | null;
  issued_at: string | Date;
  county?: string | null;
}

export interface VelocityResult {
  permits_30d: number;
  permits_60d: number;
  permits_90d: number;
  avg_permit_value: number;
  permit_velocity_score: number;
  growth_trajectory: "emerging_volume_buyer" | "stable" | "declining" | "unknown";
  contractor_status: "active" | "dormant" | "new" | "unknown";
  trade_mix: Record<string, number>;
  last_permit_at: Date | null;
}

export function computeVelocity(permits: PermitRecord[]): VelocityResult {
  if (!permits.length) {
    return {
      permits_30d: 0, permits_60d: 0, permits_90d: 0,
      avg_permit_value: 0, permit_velocity_score: 0,
      growth_trajectory: "unknown", contractor_status: "unknown",
      trade_mix: {}, last_permit_at: null,
    };
  }

  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;
  const sorted = [...permits].sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());
  const lastPermitAt = new Date(sorted[0].issued_at);
  const daysSinceLast = (now - lastPermitAt.getTime()) / day;

  const within = (d: number) => permits.filter(p => (now - new Date(p.issued_at).getTime()) / day <= d);
  const p30 = within(30);
  const p60 = within(60);
  const p90 = within(90);

  const avgValue = p90.length
    ? p90.reduce((s, p) => s + (Number(p.permit_value) || 0), 0) / p90.length
    : 0;

  // Velocity formula: permits_30d × (avg_permit_value / 10000)
  const velocityScore = Math.round(p30.length * (avgValue / 10000) * 100) / 100;

  // Trade mix
  const tradeMix: Record<string, number> = {};
  for (const p of p90) {
    const t = (p.permit_type ?? "unknown").toLowerCase().trim();
    tradeMix[t] = (tradeMix[t] ?? 0) + 1;
  }

  // Trajectory: compare 30d vs 60-30d window
  const prior30 = p60.length - p30.length;
  let trajectory: VelocityResult["growth_trajectory"] = "stable";
  if (p30.length > prior30 * 1.4 && p30.length >= 3) trajectory = "emerging_volume_buyer";
  else if (p30.length < prior30 * 0.5) trajectory = "declining";

  // Status
  let status: VelocityResult["contractor_status"] = "active";
  if (daysSinceLast > 60 && (p60.length - p30.length) >= 3) status = "dormant";
  else if (p90.length === p30.length && p30.length <= 2) status = "new";

  return {
    permits_30d: p30.length,
    permits_60d: p60.length,
    permits_90d: p90.length,
    avg_permit_value: Math.round(avgValue * 100) / 100,
    permit_velocity_score: velocityScore,
    growth_trajectory: trajectory,
    contractor_status: status,
    trade_mix: tradeMix,
    last_permit_at: lastPermitAt,
  };
}
