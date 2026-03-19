import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Plus, X, Timer, CheckCircle, Loader2, CalendarIcon, Pause, Play, Dumbbell } from "lucide-react";
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
import VoiceNoteButton from "./VoiceNoteButton";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import PostWorkoutSummary from "./PostWorkoutSummary";
import LiveFormTracker from "./LiveFormTracker";
import ReadinessGate, { calculateAdjustments, type ReadinessResult } from "./ReadinessGate";
import type { LoggedExerciseData } from "./WorkoutLogger";

/* ─── Context types ─── */
export interface WorkoutZoneContext {
  title?: string;
  source?: "program" | "community" | "custom" | "manual";
  programId?: string;
  // Pre-populated exercises from programs/community
  exercises?: Array<{
    exerciseId?: string;
    exerciseTitle: string;
    prescribedSets?: number;
    prescribedReps?: number;
    notes?: string;
    videoUrl?: string | null;
    theWhy?: string | null;
  }>;
  // Resumed state
  resumed?: boolean;
  resumedExercises?: LoggedExerciseData[];
  resumedNotes?: string;
  resumedRecovery?: RecoveryData;
  resumedElapsed?: number;
  resumedDate?: string;
}

interface ActiveWorkoutZoneProps {
  onFinish: () => void;
  onPause?: () => void;
  initialContext?: WorkoutZoneContext | null;
}

const DEFAULT_RECOVERY: RecoveryData = {
  sleepHours: "",
  sleepQuality: null,
  soreness: null,
  energy: null,
  recoveryNotes: "",
};

const ActiveWorkoutZone = ({ onFinish, onPause, initialContext }: ActiveWorkoutZoneProps) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"readiness" | "active" | "summary">("readiness");
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);
  const [autoRegulateEnabled, setAutoRegulateEnabled] = useState<boolean | null>(null);
  const [date, setDate] = useState<Date>(
    initialContext?.resumedDate ? new Date(initialContext.resumedDate) : new Date()
  );
  const [sessionNotes, setSessionNotes] = useState(initialContext?.resumedNotes || "");
  const [exercises, setExercises] = useState<LoggedExerciseData[]>(
    initialContext?.resumedExercises || []
  );
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryData>(
    initialContext?.resumedRecovery || { ...DEFAULT_RECOVERY }
  );
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [formTrackerExercise, setFormTrackerExercise] = useState<string | null>(null);
  const workoutTitle = initialContext?.title || "Workout";

  // Check if auto-regulate is enabled for this user
  useEffect(() => {
    if (!user) { setAutoRegulateEnabled(false); return; }
    // If resuming, skip readiness gate
    if (initialContext?.resumed) { setPhase("active"); setAutoRegulateEnabled(false); return; }
    supabase
      .from("profiles")
      .select("auto_regulate")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        const enabled = (data as any)?.auto_regulate === true;
        setAutoRegulateEnabled(enabled);
        if (!enabled) setPhase("active");
      });
  }, [user, initialContext?.resumed]);

  // Apply readiness adjustments to exercises
  const applyReadinessAdjustments = useCallback(async (result: ReadinessResult, currentExercises: LoggedExerciseData[]) => {
    if (result.weightAdjustmentPct === 0 && !result.swapsApplied) return currentExercises;

    let adjusted = [...currentExercises];

    // Apply weight reduction based on logged 3RM/5RM or prescribed weight
    if (result.weightAdjustmentPct !== 0) {
      adjusted = adjusted.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => ({
          ...s,
          weight: s.weight > 0 ? Math.round(s.weight * (1 + result.weightAdjustmentPct / 100)) : 0,
        })),
      }));
    }

    // Swap barbell exercises for alternatives if sleep < 5h
    if (result.swapsApplied) {
      const exerciseIds = adjusted.filter(e => e.exerciseId).map(e => e.exerciseId);
      if (exerciseIds.length > 0) {
        const { data: libData } = await supabase
          .from("exercise_library")
          .select("id, title, barbell_alternative_id, video_url, the_why")
          .in("id", exerciseIds);

        if (libData) {
          const altIds = (libData as any[]).filter(e => e.barbell_alternative_id).map(e => e.barbell_alternative_id);
          let altMap: Record<string, any> = {};
          if (altIds.length > 0) {
            const { data: alts } = await supabase
              .from("exercise_library")
              .select("id, title, video_url, the_why")
              .in("id", altIds);
            if (alts) {
              alts.forEach((a: any) => { altMap[a.id] = a; });
            }
          }

          adjusted = adjusted.map(ex => {
            const libEntry = (libData as any[]).find(l => l.id === ex.exerciseId);
            if (libEntry?.barbell_alternative_id && altMap[libEntry.barbell_alternative_id]) {
              const alt = altMap[libEntry.barbell_alternative_id];
              return {
                ...ex,
                exerciseId: alt.id,
                exerciseTitle: `${alt.title} ⚡`,
                exerciseVideoUrl: alt.video_url || null,
                exerciseTheWhy: alt.the_why || null,
              };
            }
            return ex;
          });
        }
      }
    }

    return adjusted;
  }, []);

  const handleReadinessComplete = useCallback(async (result: ReadinessResult) => {
    setReadinessResult(result);
    // Apply adjustments to pre-loaded exercises
    const adjustedExercises = await applyReadinessAdjustments(result, exercises);
    setExercises(adjustedExercises);
    // Pre-fill recovery sleep hours from readiness check
    setRecovery(prev => ({ ...prev, sleepHours: String(result.hoursSlept) }));
    setPhase("active");
  }, [exercises, applyReadinessAdjustments]);

  const handleReadinessSkip = useCallback(() => {
    setPhase("active");
  }, []);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(initialContext?.resumedElapsed || 0);
  const [timerRunning, setTimerRunning] = useState(true);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Auto-populate exercises from context on mount
  useEffect(() => {
    if (initialContext?.resumed) return; // Already restored above
    if (!initialContext?.exercises || initialContext.exercises.length === 0) return;

    const mapped: LoggedExerciseData[] = initialContext.exercises.map((ex) => ({
      exerciseId: ex.exerciseId || "",
      exerciseTitle: ex.exerciseTitle,
      sets: Array.from({ length: ex.prescribedSets || 3 }, (_, i) => ({
        set: i + 1,
        reps: ex.prescribedReps || 0,
        weight: 0,
      })),
      clientNotes: ex.notes || "",
      videoUrl: "",
      flagForCoach: false,
      exerciseVideoUrl: ex.videoUrl || null,
      exerciseTheWhy: ex.theWhy || null,
    }));
    setExercises(mapped);
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

  // Pause handler
  const handlePause = useCallback(() => {
    setTimerRunning(false);
    const state = {
      title: workoutTitle,
      source: initialContext?.source,
      resumedExercises: exercises,
      resumedNotes: sessionNotes,
      resumedRecovery: recovery,
      resumedElapsed: elapsedSeconds,
      resumedDate: date.toISOString(),
      resumed: true,
    };
    localStorage.setItem("m2-paused-workout", JSON.stringify(state));
    toast.info("Workout paused. Resume anytime from your dashboard.");
    onPause?.();
  }, [exercises, sessionNotes, recovery, elapsedSeconds, date, workoutTitle, initialContext, onPause]);

  // Finish handler
  const handleFinishClick = () => {
    if (exercises.length === 0) {
      onFinish();
      return;
    }
    setShowConfirm(true);
  };

  const handleFinishConfirmed = async () => {
    if (!user) return;
    setShowConfirm(false);
    setSaving(true);

    const recoveryPayload: Record<string, any> = {};
    if (recovery.sleepHours) recoveryPayload.sleep_hours = parseFloat(recovery.sleepHours);
    if (recovery.sleepQuality && recovery.sleepQuality > 0) recoveryPayload.sleep_quality = recovery.sleepQuality;
    if (recovery.soreness && recovery.soreness > 0) recoveryPayload.soreness = recovery.soreness;
    if (recovery.energy && recovery.energy > 0) recoveryPayload.energy = recovery.energy;
    if (recovery.recoveryNotes) recoveryPayload.recovery_notes = recovery.recoveryNotes;

    const { data: log, error: logErr } = await supabase
      .from("workout_logs")
      .insert({
        user_id: user.id,
        date: date.toISOString(),
        session_notes: sessionNotes || null,
        ...recoveryPayload,
      } as any)
      .select("id")
      .single();

    if (logErr || !log) {
      toast.error(logErr?.message || "Failed to save workout");
      setSaving(false);
      return;
    }

    const rows = exercises.map((e) => ({
      log_id: log.id,
      exercise_id: e.exerciseId || null,
      sets_reps_weight: e.sets as any,
      client_notes: e.clientNotes || null,
      video_url: e.videoUrl || null,
      flag_for_coach: e.flagForCoach,
    }));

    const { error: exErr } = await supabase.from("logged_exercises").insert(rows);
    if (exErr) {
      toast.error(exErr.message || "Exercises failed to save");
    }

    // Clear paused state
    localStorage.removeItem("m2-paused-workout");

    setWorkoutLogId(log.id);
    setSaving(false);
    setPhase("summary");
  };

  // Readiness gate phase
  if (phase === "readiness" && autoRegulateEnabled) {
    return (
      <ReadinessGate
        onComplete={handleReadinessComplete}
        onSkip={handleReadinessSkip}
      />
    );
  }

  // Still loading auto_regulate preference
  if (autoRegulateEnabled === null) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Summary phase
  if (phase === "summary" && workoutLogId) {
    return (
      <PostWorkoutSummary
        exercises={exercises}
        duration={elapsedSeconds}
        workoutLogId={workoutLogId}
        workoutTitle={workoutTitle}
        date={date}
        sessionNotes={sessionNotes}
        recovery={recovery}
        onClose={() => {
          localStorage.removeItem("m2-paused-workout");
          onFinish();
        }}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        {/* Top header */}
        <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2 min-w-0">
            <Dumbbell size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary truncate">
              {workoutTitle}
            </span>
            {readinessResult && readinessResult.weightAdjustmentPct !== 0 && (
              <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 border border-primary/30 shrink-0">
                {Math.abs(readinessResult.weightAdjustmentPct)}% adjusted
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28">
          {exercises.length === 0 && !showPicker && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <Dumbbell size={32} className="text-muted-foreground/30" />
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">Ready to train</h3>
                <p className="text-xs text-muted-foreground">Add exercises from the library to start logging your workout.</p>
              </div>
              <Button
                onClick={() => setShowPicker(true)}
                className="gap-1.5 text-xs font-bold uppercase tracking-widest"
              >
                <Plus size={14} /> Add Exercise
              </Button>
            </div>
          )}

          {exercises.map((ex, i) => (
            <ExerciseCard
              key={i}
              exercise={ex}
              index={i}
              onUpdate={(data) => updateExercise(i, data)}
              onRemove={() => removeExercise(i)}
              onOpenFormTracker={(title) => setFormTrackerExercise(title)}
            />
          ))}

          {showPicker && (
            <ExercisePicker onSelect={addExercise} onCancel={() => setShowPicker(false)} />
          )}

          {exercises.length > 0 && (
            <RecoveryInput value={recovery} onChange={setRecovery} />
          )}

          {exercises.length > 0 && (
            <div className="relative">
              <textarea
                placeholder="Session notes (optional)…"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="w-full bg-card border border-border p-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[60px] resize-none"
              />
              <VoiceNoteButton
                onTranscript={(t) => setSessionNotes((prev) => (prev ? prev + " " + t : t))}
                className="absolute top-3 right-3"
              />
            </div>
          )}
        </main>

        {/* Sticky bottom bar */}
        <footer className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
            {/* Timer */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-all",
                  timerRunning
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Timer size={14} />
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Pause */}
              <Button
                onClick={handlePause}
                size="sm"
                variant="outline"
                className="gap-1 text-xs font-bold uppercase tracking-widest"
              >
                <Pause size={14} /> Pause
              </Button>

              {/* Add Exercise */}
              {!showPicker && exercises.length > 0 && (
                <Button
                  onClick={() => setShowPicker(true)}
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs font-bold uppercase tracking-widest"
                >
                  <Plus size={14} /> Add
                </Button>
              )}

              {/* Finish */}
              <Button
                onClick={handleFinishClick}
                disabled={saving}
                size="sm"
                className="gap-1 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Finish
              </Button>
            </div>
          </div>
        </footer>
      </div>

      <ConfirmActionModal
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Finish Workout?"
        description={`Save ${exercises.length} exercise${exercises.length !== 1 ? "s" : ""} and view your workout analysis.`}
        confirmLabel="Finish & Save"
        onConfirm={handleFinishConfirmed}
        loading={saving}
        icon={<CheckCircle size={16} />}
      />

      {formTrackerExercise && (
        <LiveFormTracker
          exerciseTitle={formTrackerExercise}
          onClose={() => setFormTrackerExercise(null)}
        />
      )}
    </>
  );
};

export default ActiveWorkoutZone;
