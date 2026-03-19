import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Plus, X, Timer, CheckCircle, Loader2, CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ExercisePicker from "./ExercisePicker";
import ExerciseCard from "./ExerciseCard";
import RecoveryInput, { type RecoveryData } from "./RecoveryInput";
import type { LoggedExerciseData } from "./WorkoutLogger";

/* ─── Inline Timer ─── */
const ZoneTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setRunning(!running)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-all",
          running
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <Timer size={14} />
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </button>
      {seconds > 0 && (
        <button
          onClick={() => { setSeconds(0); setRunning(false); }}
          className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest"
        >
          Reset
        </button>
      )}
    </div>
  );
};

/* ─── Active Workout Zone ─── */
interface ActiveWorkoutZoneProps {
  onFinish: () => void;
}

const ActiveWorkoutZone = ({ onFinish }: ActiveWorkoutZoneProps) => {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [sessionNotes, setSessionNotes] = useState("");
  const [exercises, setExercises] = useState<LoggedExerciseData[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryData>({
    sleepHours: "",
    sleepQuality: null,
    soreness: null,
    energy: null,
    recoveryNotes: "",
  });

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const addExercise = useCallback(async (id: string, title: string) => {
    const { data: exData } = await supabase
      .from("exercise_library")
      .select("video_url, the_why")
      .eq("id", id)
      .single();

    setExercises((prev) => [
      ...prev,
      {
        exerciseId: id,
        exerciseTitle: title,
        sets: [{ set: 1, reps: 0, weight: 0 }],
        clientNotes: "",
        videoUrl: "",
        flagForCoach: false,
        exerciseVideoUrl: exData?.video_url || null,
        exerciseTheWhy: exData?.the_why || null,
      },
    ]);
    setShowPicker(false);
  }, []);

  const updateExercise = (index: number, data: Partial<LoggedExerciseData>) => {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, ...data } : e)));
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    if (!user) return;

    // If no exercises, just close
    if (exercises.length === 0) {
      onFinish();
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
      toast.error(logErr?.message || "Failed to save workout");
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
      toast.error(exErr.message || "Exercises failed to save");
    } else {
      toast.success(`Workout saved — ${exercises.length} exercise${exercises.length > 1 ? "s" : ""} logged 💪`);
    }

    setSaving(false);
    onFinish();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Top header - minimal */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">Active Workout</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs font-mono gap-1">
              <CalendarIcon size={12} />
              {format(date, "MMM d")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              disabled={(d) => d > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={i}
            exercise={ex}
            index={i}
            onUpdate={(data) => updateExercise(i, data)}
            onRemove={() => removeExercise(i)}
          />
        ))}

        {showPicker ? (
          <ExercisePicker onSelect={addExercise} onCancel={() => setShowPicker(false)} />
        ) : null}

        {exercises.length > 0 && (
          <RecoveryInput value={recovery} onChange={setRecovery} />
        )}

        {exercises.length > 0 && (
          <textarea
            placeholder="Session notes (optional)…"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            className="w-full bg-card border border-border p-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[60px] resize-none"
          />
        )}

        {/* Spacer for bottom bar */}
        <div className="h-24" />
      </main>

      {/* Sticky bottom bar */}
      <footer className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <ZoneTimer />

          {!showPicker && (
            <Button
              onClick={() => setShowPicker(true)}
              size="sm"
              variant="outline"
              className="gap-1 text-xs font-bold uppercase tracking-widest"
            >
              <Plus size={14} /> Add Set / Log
            </Button>
          )}

          <Button
            onClick={handleFinish}
            disabled={saving}
            size="sm"
            className="gap-1 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Finish & Exit
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ActiveWorkoutZone;
