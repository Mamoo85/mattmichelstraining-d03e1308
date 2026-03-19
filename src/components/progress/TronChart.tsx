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
      className="px-3 py-2 text-xs font-mono backdrop-blur-md"
      style={{
        background: "hsl(240 12% 7% / 0.85)",
        border: "1px solid hsl(185 100% 48% / 0.5)",
        boxShadow: "0 0 12px hsl(185 100% 48% / 0.2)",
      }}
    >
      <p className="text-muted-foreground text-[10px] mb-0.5">{label}</p>
      <p className="font-bold" style={{ color: "hsl(185, 100%, 48%)" }}>
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
        className="p-8 text-center border"
        style={{
          background: "hsl(var(--synth-card))",
          borderColor: "hsl(var(--synth-cyan) / 0.15)",
        }}
      >
        <p className="text-sm text-muted-foreground">No data yet. Log your first session.</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value));

  return (
    <div
      className="p-6 border rounded-xl"
      style={{
        background: "hsl(var(--synth-card))",
        borderColor: "hsl(var(--synth-cyan) / 0.15)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-widest"
          style={{ color: "hsl(var(--synth-cyan))" }}
        >
          {repMax === 1 ? "1RM" : `${repMax}RM`} Progression
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {data.length} session{data.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="synthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(300, 100%, 46%)" stopOpacity={0.35} />
              <stop offset="60%" stopColor="hsl(300, 100%, 46%)" stopOpacity={0.08} />
              <stop offset="100%" stopColor="hsl(300, 100%, 46%)" stopOpacity={0} />
            </linearGradient>
            <filter id="glowLine">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid
            stroke="hsl(0, 0%, 20%)"
            strokeDasharray="4 8"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(0,0%,40%)", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(0,0%,40%)", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            domain={["dataMin - 10", "dataMax + 10"]}
          />
          {/* PR line */}
          <ReferenceLine
            y={maxVal}
            stroke="hsl(14, 100%, 57%)"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: `PR: ${maxVal}`,
              position: "right",
              fill: "hsl(14, 100%, 57%)",
              fontSize: 9,
              fontFamily: "monospace",
            }}
          />
          <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 10 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(185, 100%, 48%)"
            strokeWidth={2.5}
            fill="url(#synthGradient)"
            filter="url(#glowLine)"
            dot={{
              fill: "hsl(185, 100%, 48%)",
              r: 3,
              strokeWidth: 0,
            }}
            activeDot={{
              r: 6,
              fill: "hsl(300, 100%, 46%)",
              strokeWidth: 2,
              stroke: "hsl(185, 100%, 48%)",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TronChart;
