interface StatsRowProps {
  current: number;
  delta: number;
  max: number;
  repMax: number;
}

const StatsRow = ({ current, delta, max, repMax }: StatsRowProps) => {
  const stats = [
    { label: `Current ${repMax === 1 ? "1RM" : `${repMax}RM`}`, val: `${Math.round(current)}`, unit: "lbs", accent: "cyan" as const },
    { label: "Δ Last", val: `${delta >= 0 ? "+" : ""}${Math.round(delta)}`, unit: "lbs", accent: delta >= 0 ? "cyan" as const : "pink" as const },
    { label: "All-Time PR", val: `${Math.round(max)}`, unit: "lbs", accent: "orange" as const },
  ];

  const accentMap = {
    cyan: { color: "hsl(var(--synth-cyan))", border: "hsl(var(--synth-cyan) / 0.2)", hoverBorder: "hsl(var(--synth-cyan) / 0.5)", shadow: "0 4px 20px -4px hsl(185 100% 48% / 0.15)" },
    pink: { color: "hsl(var(--synth-pink))", border: "hsl(var(--synth-pink) / 0.2)", hoverBorder: "hsl(var(--synth-pink) / 0.5)", shadow: "0 4px 20px -4px hsl(300 100% 46% / 0.15)" },
    orange: { color: "hsl(var(--synth-orange))", border: "hsl(var(--synth-orange) / 0.2)", hoverBorder: "hsl(var(--synth-orange) / 0.5)", shadow: "0 4px 20px -4px hsl(14 100% 57% / 0.15)" },
  };

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {stats.map((s) => {
        const a = accentMap[s.accent];
        return (
          <div
            key={s.label}
            className="p-3 transition-all duration-300 group"
            style={{
              background: "hsl(var(--synth-card))",
              border: `1px solid ${a.border}`,
              boxShadow: a.shadow,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = a.hoverBorder; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = a.border; }}
          >
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">
              {s.label}
            </span>
            <span
              className="text-2xl font-mono font-bold"
              style={{ color: a.color }}
            >
              {s.val}
              <span className="text-sm text-muted-foreground"> {s.unit}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default StatsRow;
