import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import SectionHeader from "./SectionHeader";

const liftData: Record<string, { week: string; e1rm: number }[]> = {
  squat: [
    { week: "W1", e1rm: 195 },
    { week: "W2", e1rm: 198 },
    { week: "W3", e1rm: 200 },
    { week: "W4", e1rm: 197 },
    { week: "W5", e1rm: 203 },
    { week: "W6", e1rm: 207 },
    { week: "W7", e1rm: 205 },
    { week: "W8", e1rm: 210 },
  ],
  bench: [
    { week: "W1", e1rm: 130 },
    { week: "W2", e1rm: 132 },
    { week: "W3", e1rm: 131 },
    { week: "W4", e1rm: 135 },
    { week: "W5", e1rm: 137 },
    { week: "W6", e1rm: 136 },
    { week: "W7", e1rm: 140 },
    { week: "W8", e1rm: 142 },
  ],
  deadlift: [
    { week: "W1", e1rm: 230 },
    { week: "W2", e1rm: 232 },
    { week: "W3", e1rm: 235 },
    { week: "W4", e1rm: 233 },
    { week: "W5", e1rm: 238 },
    { week: "W6", e1rm: 240 },
    { week: "W7", e1rm: 242 },
    { week: "W8", e1rm: 245 },
  ],
};

const liftLabels: Record<string, string> = {
  squat: "SQUAT",
  bench: "BENCH PRESS",
  deadlift: "DEADLIFT",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-m2-surface shadow-m2 border border-m2-zinc-700 px-3 py-2">
      <p className="text-[10px] text-muted-foreground font-mono">{label}</p>
      <p className="text-sm font-mono text-primary font-bold">{payload[0].value}kg</p>
    </div>
  );
};

const ProgressCharts = () => {
  const [activeLift, setActiveLift] = useState("squat");
  const data = liftData[activeLift];
  const current = data[data.length - 1].e1rm;
  const previous = data[data.length - 2].e1rm;
  const delta = current - previous;

  return (
    <div>
      <SectionHeader title="1RM Progression" timestamp="Updated 2026-03-16">
        <div className="flex gap-1">
          {Object.keys(liftLabels).map((key) => (
            <button
              key={key}
              onClick={() => setActiveLift(key)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                activeLift === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-m2-zinc-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              {liftLabels[key]}
            </button>
          ))}
        </div>
      </SectionHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-m2-surface shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Current E1RM</span>
          <span className="text-2xl font-mono font-bold text-foreground">{current}<span className="text-sm text-muted-foreground">kg</span></span>
        </div>
        <div className="bg-m2-surface shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Δ Last Week</span>
          <span className={`text-2xl font-mono font-bold ${delta >= 0 ? "text-primary" : "text-destructive"}`}>
            {delta >= 0 ? "+" : ""}{delta}<span className="text-sm text-muted-foreground">kg</span>
          </span>
        </div>
        <div className="bg-m2-surface shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">8-Week High</span>
          <span className="text-2xl font-mono font-bold text-foreground">{Math.max(...data.map(d => d.e1rm))}<span className="text-sm text-muted-foreground">kg</span></span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-m2-surface shadow-m2 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid stroke="hsl(240,3.7%,15.9%)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: "hsl(240,5%,64.9%)", fontSize: 10, fontFamily: "Geist Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(240,5%,64.9%)", fontSize: 10, fontFamily: "Geist Mono" }}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 5", "dataMax + 5"]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="e1rm"
              stroke="#f97316"
              strokeWidth={3}
              dot={{ fill: "#f97316", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#f97316", strokeWidth: 2, stroke: "#000" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProgressCharts;
