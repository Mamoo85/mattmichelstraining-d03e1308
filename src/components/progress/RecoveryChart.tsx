import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

interface RecoveryPoint {
  date: string;
  sleep: number | null;
  sleepQuality: number | null;
  soreness: number | null;
  energy: number | null;
}

interface RecoveryChartProps {
  userId: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-4 py-3 text-sm font-mono"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="text-sm">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const RecoveryChart = ({ userId }: RecoveryChartProps) => {
  const [data, setData] = useState<RecoveryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("date, sleep_hours, sleep_quality, soreness, energy")
        .eq("user_id", userId)
        .order("date", { ascending: true })
        .limit(60);

      if (logs) {
        const withData = logs.filter(
          (l: any) => l.sleep_hours || l.sleep_quality || l.soreness || l.energy
        );
        setData(
          withData.map((l: any) => ({
            date: new Date(l.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            sleep: l.sleep_hours ? Number(l.sleep_hours) : null,
            sleepQuality: l.sleep_quality,
            soreness: l.soreness,
            energy: l.energy,
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading || data.length === 0) return null;

  return (
    <div className="p-6 bg-card border border-border mt-4 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-primary" />
        <span className="text-sm font-mono font-bold uppercase tracking-widest text-primary">
          Recovery Trends
        </span>
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {data.length} session{data.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3 flex-wrap">
        {[
          { key: "sleep", color: "hsl(220, 70%, 55%)", label: "Sleep (hrs)" },
          { key: "energy", color: "hsl(140, 60%, 45%)", label: "Energy" },
          { key: "soreness", color: "hsl(0, 60%, 50%)", label: "Soreness" },
          { key: "sleepQuality", color: "hsl(270, 50%, 55%)", label: "Sleep Quality" },
        ].map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
            <span className="text-xs font-mono text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="none" />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(36,6%,45%)", fontSize: 11, fontFamily: "monospace" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(36,6%,45%)", fontSize: 11, fontFamily: "monospace" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
            domain={[0, "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="sleep" name="Sleep" stroke="hsl(220, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="energy" name="Energy" stroke="hsl(140, 60%, 45%)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="soreness" name="Soreness" stroke="hsl(0, 60%, 50%)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="sleepQuality" name="Sleep Quality" stroke="hsl(270, 50%, 55%)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RecoveryChart;
