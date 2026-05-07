import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp } from "lucide-react";

type Range = "30d" | "90d" | "6mo" | "1y" | "all";

const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "6mo", label: "6M", days: 182 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "ALL", days: null },
];

const BIG3 = ["Squat", "Bench Press", "Deadlift"] as const;
type Lift = (typeof BIG3)[number];

const COLORS: Record<Lift, string> = {
  Squat: "hsl(185, 100%, 48%)",
  "Bench Press": "hsl(300, 100%, 60%)",
  Deadlift: "hsl(40, 100%, 55%)",
};

interface Log {
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  logged_at: string;
}

interface Point {
  date: string;
  ts: number;
  Squat?: number;
  "Bench Press"?: number;
  Deadlift?: number;
}

interface Big3ProgressChartProps {
  targetUserId?: string;
}

const epley = (weight: number, reps: number) =>
  reps <= 1 ? weight : Math.round(weight * (1 + reps / 30));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 text-xs font-mono backdrop-blur-md rounded"
      style={{
        background: "hsl(240 12% 7% / 0.92)",
        border: "1px solid hsl(185 100% 48% / 0.4)",
      }}
    >
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-bold" style={{ color: p.color }}>
          {p.dataKey}: {p.value} lbs
        </p>
      ))}
    </div>
  );
};

const Big3ProgressChart = ({ targetUserId }: Big3ProgressChartProps) => {
  const [range, setRange] = useState<Range>("90d");
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const r = RANGES.find((x) => x.key === range)!;
      let q = supabase
        .from("progress_logs")
        .select("exercise_name, weight, reps, estimated_1rm, logged_at")
        .eq("user_id", targetUserId)
        .in("exercise_name", BIG3 as unknown as string[])
        .order("logged_at", { ascending: true })
        .limit(2000);
      if (r.days) {
        const since = new Date(Date.now() - r.days * 86400_000).toISOString();
        q = q.gte("logged_at", since);
      }
      const { data } = await q;
      if (!cancelled) {
        setLogs((data as Log[]) || []);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [targetUserId, range]);

  const { data, prs } = useMemo(() => {
    // For each day, take max estimated 1RM per lift
    const map = new Map<string, Point>();
    const prsLocal: Record<Lift, number> = {
      Squat: 0,
      "Bench Press": 0,
      Deadlift: 0,
    };
    for (const l of logs) {
      const lift = l.exercise_name as Lift;
      if (!BIG3.includes(lift)) continue;
      const d = new Date(l.logged_at);
      const key = d.toISOString().slice(0, 10);
      const e1rm =
        l.estimated_1rm && l.estimated_1rm > 0
          ? Math.round(l.estimated_1rm)
          : epley(l.weight, l.reps);
      if (e1rm > prsLocal[lift]) prsLocal[lift] = e1rm;
      const existing = map.get(key) ?? {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        ts: d.getTime(),
      };
      const prev = (existing as any)[lift] as number | undefined;
      if (prev == null || e1rm > prev) (existing as any)[lift] = e1rm;
      map.set(key, existing);
    }
    return {
      data: Array.from(map.values()).sort((a, b) => a.ts - b.ts),
      prs: prsLocal,
    };
  }, [logs]);

  const hasData = data.length > 0;

  return (
    <div
      className="p-5 border rounded-xl mb-4"
      style={{
        background: "hsl(var(--synth-card))",
        borderColor: "hsl(var(--synth-cyan) / 0.15)",
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} style={{ color: "hsl(var(--synth-cyan))" }} />
          <span
            className="text-sm font-mono font-bold uppercase tracking-widest"
            style={{ color: "hsl(var(--synth-cyan))" }}
          >
            Big 3 · Est. 1RM Progression
          </span>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                range === r.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={range === r.key}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* PR chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {BIG3.map((lift) => (
          <div
            key={lift}
            className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider border"
            style={{
              borderColor: `${COLORS[lift]} / 0.4`,
              color: COLORS[lift],
              background: "hsl(0 0% 0% / 0.25)",
            }}
          >
            {lift}: {prs[lift] || 0} lbs
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={18} className="text-primary animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="text-center py-10 text-sm text-muted-foreground font-mono">
          No squat / bench / deadlift logs in this range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="hsl(0, 0%, 20%)" strokeDasharray="4 8" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(0,0%,45%)", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "hsl(0,0%,45%)", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 15", "dataMax + 15"]}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 8 }}
              iconType="line"
            />
            {BIG3.map((lift) => (
              <Line
                key={lift}
                type="monotone"
                dataKey={lift}
                stroke={COLORS[lift]}
                strokeWidth={2.25}
                dot={{ r: 3, strokeWidth: 0, fill: COLORS[lift] }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(0 0% 100% / 0.6)" }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default Big3ProgressChart;
