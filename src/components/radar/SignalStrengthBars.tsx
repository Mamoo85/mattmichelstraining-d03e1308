// 5-bar Signal Strength indicator (replaces the 1000% conf bug).
// `value` is a 0–10 integer (matches `signals.confidence`).

interface Props {
  value?: number | null;
  className?: string;
  showLabel?: boolean;
}

export default function SignalStrengthBars({ value, className = "", showLabel = true }: Props) {
  const v = Math.max(0, Math.min(10, Math.round(value ?? 0)));
  const filled = Math.max(1, Math.round(v / 2)); // 1..5
  const color =
    v >= 9 ? "#22c55e" : v >= 7 ? "#00d4ff" : v >= 5 ? "#f59e0b" : v >= 1 ? "#ef4444" : "#475569";
  const heights = [6, 9, 12, 15, 18];

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={`Signal strength ${v}/10`}
      aria-label={`Signal strength ${v} of 10`}
    >
      <span className="inline-flex items-end gap-[2px] h-[18px]">
        {heights.map((h, i) => (
          <span
            key={i}
            style={{
              height: `${h}px`,
              width: "3px",
              borderRadius: "1px",
              background: i < filled ? color : "#1e3a5f",
            }}
          />
        ))}
      </span>
      {showLabel && (
        <span className="text-[10px] font-mono tabular-nums" style={{ color: v > 0 ? color : "#64748b" }}>
          {v}/10
        </span>
      )}
    </span>
  );
}
