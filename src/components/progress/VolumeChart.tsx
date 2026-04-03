import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

interface ProgressLog {
  weight: number;
  reps: number;
  logged_at: string;
}

interface VolumeChartProps {
  logs: ProgressLog[];
  liftName: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 text-sm font-mono backdrop-blur-md rounded-lg"
      style={{
        background: "rgba(10,10,10,0.95)",
        border: "1px solid rgba(168,85,247,0.4)",
        boxShadow: "0 0 16px rgba(168,85,247,0.2)",
      }}
    >
      <p className="text-[10px] mb-0.5" style={{ color: "#737373" }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: "#a855f7" }}>
        {payload[0].value >= 1000 ? `${(payload[0].value / 1000).toFixed(1)}k` : payload[0].value} lbs
      </p>
    </div>
  );
};

const VolumeChart = ({ logs, liftName }: VolumeChartProps) => {
  const data = useMemo(() => {
    if (logs.length === 0) return [];

    // Group by week
    const weekMap = new Map<string, number>();
    logs.forEach((l) => {
      const d = new Date(l.logged_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      weekMap.set(key, (weekMap.get(key) ?? 0) + l.weight * l.reps);
    });

    return Array.from(weekMap.entries())
      .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
      .slice(-12);
  }, [logs]);

  if (data.length < 2) return null;

  return (
    <div
      className="rounded-xl p-5 relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, rgba(168,85,247,0.06), rgba(10,10,10,0.95))",
        border: "1px solid rgba(168,85,247,0.2)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#a855f7" }}>
          📊 Weekly Volume — {liftName}
        </span>
        <span className="text-[10px] font-mono" style={{ color: "#525252" }}>{data.length} weeks</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <defs>
            <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: "#525252", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="volume"
            fill="url(#volumeGrad)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VolumeChart;
