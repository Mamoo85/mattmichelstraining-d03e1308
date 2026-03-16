interface StatsRowProps {
  current: number;
  delta: number;
  max: number;
  repMax: number;
}

const StatsRow = ({ current, delta, max, repMax }: StatsRowProps) => {
  const stats = [
    { label: `Current ${repMax === 1 ? "1RM" : `${repMax}RM`}`, val: `${Math.round(current)}`, unit: "lbs" },
    { label: "Δ Last", val: `${delta >= 0 ? "+" : ""}${Math.round(delta)}`, unit: "lbs", color: delta >= 0 },
    { label: "All-Time PR", val: `${Math.round(max)}`, unit: "lbs" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="p-3 bg-card border border-border"
          style={{
            boxShadow: "inset 0 0 15px hsl(var(--primary) / 0.02)",
          }}
        >
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">
            {s.label}
          </span>
          <span
            className="text-2xl font-mono font-bold"
            style={{
              color:
                s.color === false
                  ? "hsl(var(--destructive))"
                  : s.color === true
                  ? "hsl(var(--primary))"
                  : "hsl(var(--foreground))",
              textShadow:
                s.color !== undefined
                  ? `0 0 10px ${s.color ? "hsl(var(--primary) / 0.4)" : "hsl(var(--destructive) / 0.4)"}`
                  : "none",
            }}
          >
            {s.val}
            <span className="text-sm text-muted-foreground"> {s.unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

export default StatsRow;
