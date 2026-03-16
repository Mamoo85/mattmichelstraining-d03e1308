import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionHeader from "./SectionHeader";
import { Loader2, CalendarIcon, Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LIFT_CATEGORIES, ALL_LIFTS, getLiftConfig } from "./progress/liftConfig";
import TronChart from "./progress/TronChart";
import BodyAvatar from "./progress/BodyAvatar";
import { toast } from "@/hooks/use-toast";

interface ProgressLog {
  id: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  logged_at: string;
}

interface ProgressChartsProps {
  targetUserId?: string;
  targetUserName?: string;
}

const ProgressCharts = ({ targetUserId, targetUserName }: ProgressChartsProps) => {
  const { user } = useAuth();
  const [activeLift, setActiveLift] = useState(ALL_LIFTS[0].name);
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Logging state
  const [logWeight, setLogWeight] = useState("");
  const [logReps, setLogReps] = useState("");
  const [logDate, setLogDate] = useState<Date>(new Date());
  const [logging, setLogging] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const effectiveUserId = targetUserId || user?.id;
  const config = getLiftConfig(activeLift);
  const repMax = config?.repMax ?? 3;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(false);
  }, [user]);

  const fetchData = async () => {
    if (!effectiveUserId) return;
    const { data: rawLogs } = await supabase
      .from("progress_logs")
      .select("id, weight, reps, estimated_1rm, logged_at")
      .eq("user_id", effectiveUserId)
      .eq("exercise_name", activeLift)
      .order("logged_at");
    if (rawLogs) {
      setLogs(rawLogs);
      setData(
        rawLogs.map((l) => ({
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

  const startEdit = (log: ProgressLog) => {
    setEditingId(log.id);
    setEditWeight(String(log.weight));
    setEditReps(String(log.reps));
    setEditDate(new Date(log.logged_at));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditWeight("");
    setEditReps("");
  };

  const handleUpdate = async (id: string) => {
    const weight = parseFloat(editWeight);
    const reps = parseInt(editReps);
    if (!weight || weight <= 0 || !reps || reps <= 0) {
      toast({ title: "Enter valid values", variant: "destructive" });
      return;
    }
    setSaving(true);
    const estimated1rm = Math.round(weight * (1 + reps / 30) * 10) / 10;

    const { error } = await supabase
      .from("progress_logs")
      .update({ weight, reps, estimated_1rm: estimated1rm, logged_at: editDate.toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated" });
      setEditingId(null);
      await fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase
      .from("progress_logs")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      await fetchData();
    }
    setDeletingId(null);
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

      {/* Log History */}
      {logs.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2 mb-3"
          >
            {showHistory ? "▾ Hide" : "▸ Show"} Log History ({logs.length} entries)
          </button>

          {showHistory && (
            <div className="bg-card border border-border divide-y divide-border">
              {[...logs].reverse().map((log) => {
                const isEditing = editingId === log.id;
                const isDeleting = deletingId === log.id;

                return (
                  <div key={log.id} className="p-3 flex items-center gap-3 flex-wrap">
                    {isEditing ? (
                      <>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 w-[120px] text-xs font-mono px-2">
                              <CalendarIcon className="mr-1 h-3 w-3 text-primary" />
                              {format(editDate, "MMM d, yy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={editDate}
                              onSelect={(d) => d && setEditDate(d)}
                              disabled={(d) => d > new Date()}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <input
                          type="number"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          className="bg-background border border-border text-right pr-2 font-mono text-primary text-xs focus:ring-1 focus:ring-primary outline-none h-8 w-20"
                        />
                        <span className="text-[10px] text-muted-foreground">lbs ×</span>
                        <input
                          type="number"
                          value={editReps}
                          onChange={(e) => setEditReps(e.target.value)}
                          className="bg-background border border-border text-right pr-2 font-mono text-primary text-xs focus:ring-1 focus:ring-primary outline-none h-8 w-14"
                        />
                        <div className="flex gap-1 ml-auto">
                          <button
                            onClick={() => handleUpdate(log.id)}
                            disabled={saving}
                            className="h-8 w-8 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="h-8 w-8 flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-mono text-muted-foreground w-[80px] flex-shrink-0">
                          {format(new Date(log.logged_at), "MMM d, yy")}
                        </span>
                        <span className="text-sm font-mono font-bold text-foreground">
                          {log.weight} <span className="text-muted-foreground text-xs">lbs</span>
                        </span>
                        <span className="text-xs text-muted-foreground">×</span>
                        <span className="text-sm font-mono font-bold text-foreground">{log.reps}</span>
                        <span className="text-[10px] text-primary font-mono ml-1">
                          est. {log.estimated_1rm} 1RM
                        </span>
                        <div className="flex gap-1 ml-auto">
                          <button
                            onClick={() => startEdit(log)}
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-primary transition-all"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
                            disabled={isDeleting}
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
                            title="Delete"
                          >
                            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressCharts;
