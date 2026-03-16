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
    { week: "W1", e1rm: 195 }, { week: "W2", e1rm: 198 }, { week: "W3", e1rm: 200 },
    { week: "W4", e1rm: 197 }, { week: "W5", e1rm: 203 }, { week: "W6", e1rm: 207 },
    { week: "W7", e1rm: 205 }, { week: "W8", e1rm: 210 },
  ],
  bench: [
    { week: "W1", e1rm: 130 }, { week: "W2", e1rm: 132 }, { week: "W3", e1rm: 131 },
    { week: "W4", e1rm: 135 }, { week: "W5", e1rm: 137 }, { week: "W6", e1rm: 136 },
    { week: "W7", e1rm: 140 }, { week: "W8", e1rm: 142 },
  ],
  deadlift: [
    { week: "W1", e1rm: 230 }, { week: "W2", e1rm: 232 }, { week: "W3", e1rm: 235 },
    { week: "W4", e1rm: 233 }, { week: "W5", e1rm: 238 }, { week: "W6", e1rm: 240 },
    { week: "W7", e1rm: 242 }, { week: "W8", e1rm: 245 },
  ],
};

const liftLabels: Record<string, string> = {
  squat: "SQUAT", bench: "BENCH", deadlift: "DEADLIFT",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card shadow-m2 border border-border px-3 py-2">
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
      <SectionHeader title="1RM Progression" timestamp="Matt tracks your PRs and adjusts load">
        <div className="flex gap-1">
          {Object.keys(liftLabels).map((key) => (
            <button
              key={key}
              onClick={() => setActiveLift(key)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                activeLift === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {liftLabels[key]}
            </button>
          ))}
        </div>
      </SectionHeader>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-card shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Current E1RM</span>
          <span className="text-2xl font-mono font-bold text-foreground">{current}<span className="text-sm text-muted-foreground">kg</span></span>
        </div>
        <div className="bg-card shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Δ Last Week</span>
          <span className={`text-2xl font-mono font-bold ${delta >= 0 ? "text-primary" : "text-destructive"}`}>
            {delta >= 0 ? "+" : ""}{delta}<span className="text-sm text-muted-foreground">kg</span>
          </span>
        </div>
        <div className="bg-card shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">8-Week High</span>
          <span className="text-2xl font-mono font-bold text-foreground">{Math.max(...data.map(d => d.e1rm))}<span className="text-sm text-muted-foreground">kg</span></span>
        </div>
      </div>

      <div className="bg-card shadow-m2 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid stroke="hsl(40,5%,18%)" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="week" tick={{ fill: "hsl(36,6%,66%)", fontSize: 10, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(36,6%,66%)", fontSize: 10, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="e1rm" stroke="#e8621a" strokeWidth={3} dot={{ fill: "#e8621a", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#e8621a", strokeWidth: 2, stroke: "#111110" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProgressCharts;
