import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionHeader from "./SectionHeader";
import { Loader2 } from "lucide-react";

const LIFTS = ["Goblet Squats", "Push-Ups", "Plank"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card shadow-m2 border border-border px-3 py-2">
      <p className="text-[10px] text-muted-foreground font-mono">{label}</p>
      <p className="text-sm font-mono text-primary font-bold">{payload[0].value} lbs</p>
    </div>
  );
};

const ProgressCharts = () => {
  const { user } = useAuth();
  const [activeLift, setActiveLift] = useState(LIFTS[0]);
  const [data, setData] = useState<{ date: string; e1rm: number }[]>([]);
  const [allLifts, setAllLifts] = useState<string[]>(LIFTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchLifts = async () => {
      const { data: logs } = await supabase
        .from("progress_logs")
        .select("exercise_name")
        .eq("user_id", user.id);
      if (logs && logs.length > 0) {
        const unique = [...new Set(logs.map((l) => l.exercise_name))];
        setAllLifts(unique.length > 0 ? unique : LIFTS);
        if (!unique.includes(activeLift) && unique.length > 0) setActiveLift(unique[0]);
      }
      setLoading(false);
    };
    fetchLifts();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: logs } = await supabase
        .from("progress_logs")
        .select("estimated_1rm, logged_at")
        .eq("user_id", user.id)
        .eq("exercise_name", activeLift)
        .order("logged_at");
      if (logs) {
        setData(
          logs.map((l) => ({
            date: new Date(l.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            e1rm: l.estimated_1rm ?? 0,
          }))
        );
      }
    };
    fetchData();
  }, [user, activeLift]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  const current = data.length > 0 ? data[data.length - 1].e1rm : 0;
  const previous = data.length > 1 ? data[data.length - 2].e1rm : current;
  const delta = Math.round((current - previous) * 10) / 10;
  const max = data.length > 0 ? Math.max(...data.map((d) => d.e1rm)) : 0;

  return (
    <div>
      <SectionHeader title="1RM Progression" timestamp="Matt tracks your PRs and adjusts load">
        <div className="flex gap-1 flex-wrap">
          {allLifts.map((lift) => (
            <button
              key={lift}
              onClick={() => setActiveLift(lift)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                activeLift === lift
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {lift}
            </button>
          ))}
        </div>
      </SectionHeader>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-card shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Current E1RM</span>
          <span className="text-2xl font-mono font-bold text-foreground">{current}<span className="text-sm text-muted-foreground"> lbs</span></span>
        </div>
        <div className="bg-card shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">Δ Last</span>
          <span className={`text-2xl font-mono font-bold ${delta >= 0 ? "text-primary" : "text-destructive"}`}>
            {delta >= 0 ? "+" : ""}{delta}<span className="text-sm text-muted-foreground"> lbs</span>
          </span>
        </div>
        <div className="bg-card shadow-m2 p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">All-Time PR</span>
          <span className="text-2xl font-mono font-bold text-foreground">{max}<span className="text-sm text-muted-foreground"> lbs</span></span>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="bg-card shadow-m2 p-4">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid stroke="hsl(40,5%,18%)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "hsl(36,6%,66%)", fontSize: 10, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(36,6%,66%)", fontSize: 10, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="e1rm" stroke="#e8621a" strokeWidth={3} dot={{ fill: "#e8621a", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#e8621a", strokeWidth: 2, stroke: "#111110" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-card shadow-m2 p-5 text-center">
          <p className="text-sm text-muted-foreground">No progress data yet. Log your first session to see your chart.</p>
        </div>
      )}
    </div>
  );
};

export default ProgressCharts;
