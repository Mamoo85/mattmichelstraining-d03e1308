import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

interface NutritionLog {
  logged_at: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

interface WeeklyMacroChartProps {
  logs: NutritionLog[];
  calorieGoal?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 text-xs font-mono rounded-lg shadow-lg"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      <p className="text-muted-foreground text-[10px] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {Math.round(p.value)}
          {p.dataKey === "calories" ? "" : "g"}
        </p>
      ))}
    </div>
  );
};

const WeeklyMacroChart = ({ logs, calorieGoal }: WeeklyMacroChartProps) => {
  const chartData = useMemo(() => {
    const days: { label: string; dateKey: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      days.push({
        label: format(d, "EEE"),
        dateKey: format(startOfDay(d), "yyyy-MM-dd"),
      });
    }

    return days.map(({ label, dateKey }) => {
      const dayLogs = logs.filter((l) => l.logged_at?.startsWith(dateKey));
      return {
        name: label,
        calories: dayLogs.reduce((s, l) => s + (l.total_calories || 0), 0),
        protein: dayLogs.reduce((s, l) => s + Number(l.total_protein_g || 0), 0),
        carbs: dayLogs.reduce((s, l) => s + Number(l.total_carbs_g || 0), 0),
        fat: dayLogs.reduce((s, l) => s + Number(l.total_fat_g || 0), 0),
      };
    });
  }, [logs]);

  const hasData = chartData.some((d) => d.calories > 0);
  if (!hasData) return null;

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="proGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="calories"
            name="Calories"
            stroke="hsl(25, 95%, 53%)"
            fill="url(#calGrad)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="protein"
            name="Protein"
            stroke="hsl(0, 72%, 51%)"
            fill="url(#proGrad)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeeklyMacroChart;
