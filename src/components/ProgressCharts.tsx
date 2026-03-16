import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionHeader from "./SectionHeader";
import { Loader2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LIFT_CATEGORIES, ALL_LIFTS, getLiftConfig } from "./progress/liftConfig";
import TronChart from "./progress/TronChart";
import BodyAvatar from "./progress/BodyAvatar";
import { toast } from "@/hooks/use-toast";

interface ProgressChartsProps {
  /** When set (admin mode), view/log for this user instead of self */
  targetUserId?: string;
  targetUserName?: string;
}

const ProgressCharts = ({ targetUserId, targetUserName }: ProgressChartsProps) => {
  const { user } = useAuth();
  const [activeLift, setActiveLift] = useState(ALL_LIFTS[0].name);
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Logging state
  const [logWeight, setLogWeight] = useState("");
  const [logReps, setLogReps] = useState("");
  const [logDate, setLogDate] = useState<Date>(new Date());
  const [logging, setLogging] = useState(false);

  const effectiveUserId = targetUserId || user?.id;

  const config = getLiftConfig(activeLift);
  const repMax = config?.repMax ?? 3;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(false);
  }, [user]);

  const fetchData = async () => {
    if (!effectiveUserId) return;
    const { data: logs } = await supabase
      .from("progress_logs")
      .select("estimated_1rm, logged_at")
      .eq("user_id", effectiveUserId)
      .eq("exercise_name", activeLift)
      .order("logged_at");
    if (logs) {
      setData(
        logs.map((l) => ({
          date: new Date(l.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          value: l.estimated_1rm ?? 0,
        }))
      );
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId, activeLift]);

  const handleLog = async () => {
    if (!effectiveUserId || !user) return;
    const weight = parseFloat(logWeight);
    const reps = parseInt(logReps) || repMax;
    if (!weight || weight <= 0) {
      toast({ title: "Enter a valid weight", variant: "destructive" });
      return;
    }
    setLogging(true);
    const estimated1rm = Math.round(weight * (1 + reps / 30) * 10) / 10;

    const { error } = await supabase.from("progress_logs").insert({
      user_id: effectiveUserId,
      exercise_name: activeLift,
      weight,
      reps,
      estimated_1rm: estimated1rm,
      logged_at: logDate.toISOString(),
    });

    if (error) {
      toast({ title: "Failed to log", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Logged", description: `${activeLift}: ${weight} lbs × ${reps}` });
      setLogWeight("");
      setLogReps("");
      await fetchData();
    }
    setLogging(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  const current = data.length > 0 ? data[data.length - 1].value : 0;
  const previous = data.length > 1 ? data[data.length - 2].value : current;
  const delta = Math.round((current - previous) * 10) / 10;
  const max = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;

  return (
    <div>
      <SectionHeader
        title={targetUserName ? `${targetUserName} — Lift Tracker` : "Lift Tracker"}
        timestamp={targetUserId ? "Admin view — logging for this client" : "Track your maxes and watch them climb"}
      />

      {/* Lift category selector */}
      {LIFT_CATEGORIES.map((cat) => (
        <div key={cat.label} className="mb-3">
          <span
            className="text-[9px] font-mono font-bold uppercase tracking-widest mb-1.5 block"
            style={{ color: "hsl(24, 80%, 55%)", textShadow: "0 0 6px hsl(24, 80%, 50%, 0.3)" }}
          >
            {cat.label}
          </span>
          <div className="flex gap-1 flex-wrap">
            {cat.lifts.map((lift) => (
              <button
                key={lift.name}
                onClick={() => setActiveLift(lift.name)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                  activeLift === lift.name
                    ? "text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                style={
                  activeLift === lift.name
                    ? {
                        background: "hsl(24, 80%, 50%)",
                        boxShadow: "0 0 12px hsl(24, 80%, 50%, 0.3), inset 0 0 8px hsl(24, 80%, 60%, 0.2)",
                      }
                    : {}
                }
              >
                {lift.name}
                <span className="ml-1 opacity-50">
                  {lift.repMax === 1 ? "1RM" : `${lift.repMax}RM`}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Log weight inline */}
      <div className="mt-4 mb-4 p-4 bg-card border border-border">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
          Log {activeLift}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 w-[130px] justify-start text-left font-mono text-sm px-2",
                  !logDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                {format(logDate, "MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={logDate}
                onSelect={(d) => d && setLogDate(d)}
                disabled={(d) => d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <input
            type="number"
            placeholder="Weight (lbs)"
            value={logWeight}
            onChange={(e) => setLogWeight(e.target.value)}
            className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-9 w-28"
          />
          <input
            type="number"
            placeholder={`Reps (${repMax})`}
            value={logReps}
            onChange={(e) => setLogReps(e.target.value)}
            className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-9 w-20"
          />
          <button
            onClick={handleLog}
            disabled={logging}
            className="bg-primary text-primary-foreground px-5 h-9 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
          >
            {logging ? "…" : "Log"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: `Current ${repMax === 1 ? "1RM" : `${repMax}RM`}`, val: `${current}`, unit: "lbs" },
          { label: "Δ Last", val: `${delta >= 0 ? "+" : ""}${delta}`, unit: "lbs", color: delta >= 0 },
          { label: "All-Time PR", val: `${max}`, unit: "lbs" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-3"
            style={{
              background: "linear-gradient(180deg, hsl(220, 15%, 8%) 0%, hsl(220, 15%, 11%) 100%)",
              border: "1px solid hsl(24, 80%, 50%, 0.1)",
              boxShadow: "inset 0 0 15px hsl(24, 80%, 50%, 0.02)",
            }}
          >
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1">
              {s.label}
            </span>
            <span
              className="text-2xl font-mono font-bold"
              style={{
                color: s.color === false ? "hsl(0, 70%, 55%)" : s.color === true ? "hsl(24, 80%, 55%)" : "hsl(36, 6%, 93%)",
                textShadow: s.color !== undefined ? `0 0 10px ${s.color ? "hsl(24, 80%, 50%, 0.4)" : "hsl(0, 70%, 55%, 0.4)"}` : "none",
              }}
            >
              {s.val}
              <span className="text-sm text-muted-foreground"> {s.unit}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Chart + Avatar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <TronChart data={data} repMax={repMax} />
        </div>
        <div>
          <BodyAvatar activeLift={activeLift} />
        </div>
      </div>
    </div>
  );
};

export default ProgressCharts;
