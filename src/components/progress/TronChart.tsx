import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
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
        background: "hsl(220, 15%, 8%)",
        border: "1px solid hsl(24, 80%, 50%, 0.4)",
        boxShadow: "0 0 15px hsl(24, 80%, 50%, 0.15), inset 0 0 10px hsl(24, 80%, 50%, 0.05)",
      }}
    >
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className="font-bold" style={{ color: "hsl(24, 80%, 55%)", textShadow: "0 0 8px hsl(24, 80%, 50%, 0.5)" }}>
        {payload[0].value} lbs
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
        className="p-8 text-center"
        style={{
          background: "linear-gradient(180deg, hsl(220, 15%, 6%) 0%, hsl(220, 15%, 10%) 100%)",
          border: "1px solid hsl(24, 80%, 50%, 0.15)",
          boxShadow: "inset 0 0 30px hsl(24, 80%, 50%, 0.03)",
        }}
      >
        <p className="text-sm text-muted-foreground">No data yet. Log your first session.</p>
      </div>
    );
  }

  return (
    <div
      className="p-4"
      style={{
        background: "linear-gradient(180deg, hsl(220, 15%, 6%) 0%, hsl(220, 15%, 10%) 100%)",
        border: "1px solid hsl(24, 80%, 50%, 0.15)",
        boxShadow: "inset 0 0 30px hsl(24, 80%, 50%, 0.03), 0 0 20px hsl(24, 80%, 50%, 0.05)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-widest"
          style={{ color: "hsl(24, 80%, 55%)", textShadow: "0 0 8px hsl(24, 80%, 50%, 0.4)" }}
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
              <stop offset="0%" stopColor="hsl(24, 80%, 50%)" stopOpacity={0.3} />
              <stop offset="50%" stopColor="hsl(24, 80%, 50%)" stopOpacity={0.08} />
              <stop offset="100%" stopColor="hsl(24, 80%, 50%)" stopOpacity={0} />
            </linearGradient>
            <filter id="chartGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid
            stroke="hsl(24, 80%, 50%, 0.06)"
            strokeDasharray="none"
            vertical={true}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(36,6%,45%)", fontSize: 9, fontFamily: "monospace" }}
            axisLine={{ stroke: "hsl(24, 80%, 50%, 0.15)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(36,6%,45%)", fontSize: 9, fontFamily: "monospace" }}
            axisLine={{ stroke: "hsl(24, 80%, 50%, 0.15)" }}
            tickLine={false}
            domain={["dataMin - 10", "dataMax + 10"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(24, 80%, 50%)"
            strokeWidth={2}
            fill="url(#tronGradient)"
            dot={{
              fill: "hsl(24, 80%, 55%)",
              r: 3,
              strokeWidth: 0,
              filter: "url(#chartGlow)",
            }}
            activeDot={{
              r: 6,
              fill: "hsl(24, 80%, 55%)",
              strokeWidth: 2,
              stroke: "hsl(220, 15%, 8%)",
              filter: "url(#chartGlow)",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TronChart;
