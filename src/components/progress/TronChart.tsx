import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

interface DataPoint {
  date: string;
  value: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 text-xs font-mono"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--primary) / 0.4)",
        boxShadow: "0 0 15px hsl(var(--primary) / 0.15), inset 0 0 10px hsl(var(--primary) / 0.05)",
      }}
    >
      <p className="text-muted-foreground text-[10px] mb-0.5">{label}</p>
      <p className="font-bold text-primary">
        Est. {payload[0].value} lbs
      </p>
    </div>
  );
};

interface TronChartProps {
  data: DataPoint[];
  repMax: number;
}

const TronChart = ({ data, repMax }: TronChartProps) => {
  if (data.length === 0) {
    return (
      <div
        className="p-8 text-center bg-card border border-border"
        style={{
          boxShadow: "inset 0 0 30px hsl(var(--primary) / 0.03)",
        }}
      >
        <p className="text-sm text-muted-foreground">No data yet. Log your first session.</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value));

  return (
    <div
      className="p-4 bg-card border border-border"
    >
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary"
          style={{ textShadow: "0 0 8px hsl(var(--primary) / 0.4)" }}
        >
          {repMax === 1 ? "1RM" : `${repMax}RM`} Progression
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {data.length} session{data.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="tronGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(18, 82%, 50%)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="hsl(18, 82%, 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="hsl(18, 82%, 50%, 0.06)"
            strokeDasharray="none"
            vertical={true}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(36,6%,45%)", fontSize: 9, fontFamily: "monospace" }}
            axisLine={{ stroke: "hsl(18, 82%, 50%, 0.15)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(36,6%,45%)", fontSize: 9, fontFamily: "monospace" }}
            axisLine={{ stroke: "hsl(18, 82%, 50%, 0.15)" }}
            tickLine={false}
            domain={["dataMin - 10", "dataMax + 10"]}
          />
          {/* PR line */}
          <ReferenceLine
            y={maxVal}
            stroke="hsl(18, 82%, 50%)"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{ value: `PR: ${maxVal}`, position: "right", fill: "hsl(18, 82%, 55%)", fontSize: 9, fontFamily: "monospace" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(18, 82%, 50%)"
            strokeWidth={2}
            fill="url(#tronGradient)"
            dot={{
              fill: "hsl(18, 82%, 50%)",
              r: 3,
              strokeWidth: 0,
            }}
            activeDot={{
              r: 5,
              fill: "hsl(18, 82%, 50%)",
              strokeWidth: 2,
              stroke: "hsl(0, 0%, 9%)",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TronChart;
