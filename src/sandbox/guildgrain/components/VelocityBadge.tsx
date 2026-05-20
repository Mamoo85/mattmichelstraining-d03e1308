import { VelocityResult } from "../state/useVelocityPrice";

export default function VelocityBadge({ v }: { v: VelocityResult }) {
  if (v.tier === "established") {
    return <span className="gg-badge gg-badge--cream">Established Pricing</span>;
  }
  const color = v.tier === "penetration" ? "gg-badge--clay" : "gg-badge--forest";
  return (
    <div className="space-y-1" data-testid="gg-velocity">
      <span className={`gg-badge ${color}`}>{v.label} Active</span>
      {v.unitsUntilNext != null && (
        <p className="text-xs text-[var(--gg-mute)]">
          <strong className="text-[var(--gg-ink)]">{v.unitsUntilNext} more {v.unitsUntilNext === 1 ? "sale" : "sales"}</strong> until price rises to ${(v.basePrice * (v.tier === "penetration" ? 0.9 : 1)).toFixed(2)}
        </p>
      )}
    </div>
  );
}
