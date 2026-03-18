import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import ExercisePicker from "./ExercisePicker";
import ExerciseCard from "./ExerciseCard";
import RecoveryInput, { type RecoveryData } from "./RecoveryInput";

interface SetData {
  set: number;
  reps: number;
  weight: number;
}

export interface LoggedExerciseData {
  exerciseId: string;
  exerciseTitle: string;
  sets: SetData[];
  clientNotes: string;
  videoUrl: string;
  flagForCoach: boolean;
  exerciseVideoUrl?: string | null;
  exerciseTheWhy?: string | null;
}

const WorkoutLogger = () => {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [sessionNotes, setSessionNotes] = useState("");
  const [exercises, setExercises] = useState<LoggedExerciseData[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pastLogs, setPastLogs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryData>({
    sleepHours: "",
    sleepQuality: null,
    soreness: null,
    energy: null,
    recoveryNotes: "",
  });

  useEffect(() => {
    if (user) fetchPastLogs();
  }, [user]);

  const fetchPastLogs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("workout_logs")
      .select("id, date, session_notes")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(20);
    if (data) setPastLogs(data);
  };

  const addExercise = (id: string, title: string) => {
    setExercises((prev) => [
      ...prev,
      { exerciseId: id, exerciseTitle: title, sets: [{ set: 1, reps: 0, weight: 0 }], clientNotes: "", videoUrl: "", flagForCoach: false },
    ]);
    setShowPicker(false);
  };

  const updateExercise = (index: number, data: Partial<LoggedExerciseData>) => {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, ...data } : e)));
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || exercises.length === 0) {
      toast({ title: "Add at least one exercise", variant: "destructive" });
      return;
    }
    setSaving(true);

    const recoveryPayload: Record<string, any> = {};
    if (recovery.sleepHours) recoveryPayload.sleep_hours = parseFloat(recovery.sleepHours);
    if (recovery.sleepQuality && recovery.sleepQuality > 0) recoveryPayload.sleep_quality = recovery.sleepQuality;
    if (recovery.soreness && recovery.soreness > 0) recoveryPayload.soreness = recovery.soreness;
    if (recovery.energy && recovery.energy > 0) recoveryPayload.energy = recovery.energy;
    if (recovery.recoveryNotes) recoveryPayload.recovery_notes = recovery.recoveryNotes;

    const { data: log, error: logErr } = await supabase
      .from("workout_logs")
      .insert({ user_id: user.id, date: date.toISOString(), session_notes: sessionNotes || null, ...recoveryPayload } as any)
      .select("id")
      .single();

    if (logErr || !log) {
      toast({ title: "Failed to save workout", description: logErr?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const rows = exercises.map((e) => ({
      log_id: log.id,
      exercise_id: e.exerciseId,
      sets_reps_weight: e.sets as any,
      client_notes: e.clientNotes || null,
      video_url: e.videoUrl || null,
      flag_for_coach: e.flagForCoach,
    }));

    const { error: exErr } = await supabase.from("logged_exercises").insert(rows);
    if (exErr) {
      toast({ title: "Exercises failed to save", description: exErr.message, variant: "destructive" });
    } else {
      toast({ title: "Workout saved! 💪", description: `${exercises.length} exercise${exercises.length > 1 ? "s" : ""} logged` });
      setExercises([]);
      setSessionNotes("");
      setRecovery({ sleepHours: "", sleepQuality: null, soreness: null, energy: null, recoveryNotes: "" });
      fetchPastLogs();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-12 flex-1 justify-start text-left font-mono text-base px-4">
              <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
              {format(date, "EEEE, MMM d")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              disabled={(d) => d > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Exercise cards */}
      {exercises.map((ex, i) => (
        <ExerciseCard
          key={i}
          exercise={ex}
          index={i}
          onUpdate={(data) => updateExercise(i, data)}
          onRemove={() => removeExercise(i)}
        />
      ))}

      {/* Add exercise */}
      {showPicker ? (
        <ExercisePicker onSelect={addExercise} onCancel={() => setShowPicker(false)} />
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full h-14 border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest transition-all"
        >
          <Plus size={18} /> Add Exercise
        </button>
      )}

      {/* Recovery check-in */}
      {exercises.length > 0 && (
        <RecoveryInput value={recovery} onChange={setRecovery} />
      )}

      {/* Session notes */}
      {exercises.length > 0 && (
        <textarea
          placeholder="Session notes (optional)…"
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          className="w-full bg-card border border-border p-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[60px] resize-none"
        />
      )}

      {/* Save */}
      {exercises.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-14 bg-primary text-primary-foreground text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? "Saving…" : `Save Workout (${exercises.length} exercise${exercises.length > 1 ? "s" : ""})`}
        </button>
      )}

      {/* Past workout history */}
      {pastLogs.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all mb-3"
          >
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Recent Workouts ({pastLogs.length})
          </button>
          {showHistory && <PastWorkoutList logs={pastLogs} />}
        </div>
      )}
    </div>
  );
};

const PastWorkoutList = ({ logs }: { logs: any[] }) => {
  return (
    <div className="bg-card border border-border divide-y divide-border">
      {logs.map((log) => (
        <PastWorkoutItem key={log.id} log={log} />
      ))}
    </div>
  );
};

const PastWorkoutItem = ({ log }: { log: any }) => {
  const [expanded, setExpanded] = useState(false);
  const [exercises, setExercises] = useState<any[]>([]);

  const loadExercises = async () => {
    if (exercises.length > 0) {
      setExpanded(!expanded);
      return;
    }
    const { data } = await supabase
      .from("logged_exercises")
      .select("*, exercise_library(title)")
      .eq("log_id", log.id);
    if (data) setExercises(data);
    setExpanded(true);
  };

  return (
    <div className="p-3">
      <button onClick={loadExercises} className="w-full flex items-center justify-between text-left">
        <div>
          <span className="text-xs font-mono text-muted-foreground">{format(new Date(log.date), "MMM d, yyyy")}</span>
          {log.session_notes && <p className="text-xs text-foreground/70 mt-0.5 line-clamp-1">{log.session_notes}</p>}
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      {expanded && exercises.length > 0 && (
        <div className="mt-2 space-y-2">
          {exercises.map((ex: any) => (
            <div key={ex.id} className={cn("p-2 border border-border text-xs space-y-1", ex.flag_for_coach && "border-l-2 border-l-primary")}>
              <div className="font-bold text-foreground">{ex.exercise_library?.title || "Unknown"}</div>
              <div className="font-mono text-muted-foreground">
                {(ex.sets_reps_weight as any[])?.map((s: any) => `${s.weight}×${s.reps}`).join(" · ")}
              </div>
              {ex.client_notes && <p className="text-foreground/70">{ex.client_notes}</p>}
              {ex.coach_reply && (
                <div className="mt-1 p-2 bg-primary/10 border border-primary/20">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Coach Matt</span>
                  <p className="text-foreground text-xs mt-0.5">{ex.coach_reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkoutLogger;
