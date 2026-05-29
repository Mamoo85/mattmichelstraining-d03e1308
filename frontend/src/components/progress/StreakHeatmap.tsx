import { useMemo } from "react";

interface StreakHeatmapProps {
  logs: { logged_at: string }[];
}

const StreakHeatmap = ({ logs }: StreakHeatmapProps) => {
  const cells = useMemo(() => {
    const now = new Date();
    const dayMap = new Map<string, number>();
    logs.forEach((l) => {
      const key = new Date(l.logged_at).toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    });

    const result: { date: string; count: number; dayOfWeek: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, count: dayMap.get(key) ?? 0, dayOfWeek: d.getDay() });
    }
    return result;
  }, [logs]);

  const getColor = (count: number) => {
    if (count === 0) return "rgba(255,255,255,0.04)";
    if (count === 1) return "hsl(120, 60%, 25%)";
    if (count === 2) return "hsl(120, 65%, 35%)";
    return "hsl(120, 70%, 45%)";
  };

  // Arrange into columns of 7 (weeks)
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "linear-gradient(160deg, rgba(34,197,94,0.06), rgba(10,10,10,0.95))",
        border: "1px solid rgba(34,197,94,0.15)",
      }}
    >
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#22c55e" }}>
        🗓️ 12-Week Activity
      </p>
      <div className="flex gap-[3px] justify-center">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <div
                key={cell.date}
                className="w-3 h-3 rounded-[2px] transition-colors"
                title={`${cell.date}: ${cell.count} log${cell.count !== 1 ? "s" : ""}`}
                style={{
                  background: getColor(cell.count),
                  boxShadow: cell.count > 0 ? `0 0 4px ${getColor(cell.count)}` : "none",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-[8px]" style={{ color: "#525252" }}>Less</span>
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="w-2.5 h-2.5 rounded-[2px]" style={{ background: getColor(n) }} />
        ))}
        <span className="text-[8px]" style={{ color: "#525252" }}>More</span>
      </div>
    </div>
  );
};

export default StreakHeatmap;
