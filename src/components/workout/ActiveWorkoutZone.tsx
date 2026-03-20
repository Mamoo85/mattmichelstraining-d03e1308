import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Plus, X, CheckCircle, Loader2, CalendarIcon, Dumbbell, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkoutSave } from "@/hooks/useWorkoutSave";
import { toast } from "sonner";
import ExercisePicker from "./ExercisePicker";
import ExerciseCard from "./ExerciseCard";
import RecoveryInput, { type RecoveryData } from "./RecoveryInput";
import VoiceNoteButton from "./VoiceNoteButton";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import InterceptGateway from "./InterceptGateway";
import IntervalTimer from "./IntervalTimer";
import PostWorkoutSummary from "./PostWorkoutSummary";
import WorkoutTimer from "./WorkoutTimer";
import LiveFormTracker from "./LiveFormTracker";
import ReadinessGate, { calculateAdjustments, type ReadinessResult } from "./ReadinessGate";
import QuickLogBar from "./QuickLogBar";
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
  const hasInitialContent = !!(initialContext?.exercises?.length || initialContext?.resumed);
  const [phase, setPhase] = useState<"intercept" | "readiness" | "active" | "summary">(
    hasInitialContent ? "readiness" : "intercept"
  );
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);
  const [autoRegulateEnabled, setAutoRegulateEnabled] = useState<boolean | null>(null);
  const [date, setDate] = useState<Date>(
    initialContext?.resumedDate ? new Date(initialContext.resumedDate) : new Date()
  );
  const [sessionNotes, setSessionNotes] = useState(initialContext?.resumedNotes || "");
  const [exercises, setExercises] = useState<LoggedExerciseData[]>(
    initialContext?.resumedExercises || []
  );
  const { save: saveWorkout, saving } = useWorkoutSave();
  const [showPicker, setShowPicker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryData>(
    initialContext?.resumedRecovery || { ...DEFAULT_RECOVERY }
  );
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [formTrackerExercise, setFormTrackerExercise] = useState<string | null>(null);
  const [showIntervalTimer, setShowIntervalTimer] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [workoutTitle, setWorkoutTitle] = useState(initialContext?.title || "Workout");

  // Auto rest timer — countdown triggered by set completion
  const startRestTimer = useCallback((duration = 90) => {
    if (restRef.current) clearInterval(restRef.current);
    setRestSeconds(duration);
    restRef.current = setInterval(() => {
      setRestSeconds((prev) => {
        if (prev <= 1) {
          if (restRef.current) clearInterval(restRef.current);
          restRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const clearRestTimer = useCallback(() => {
    if (restRef.current) clearInterval(restRef.current);
    restRef.current = null;
    setRestSeconds(0);
  }, []);

  useEffect(() => {
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, []);

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
        // Only advance past intercept if we already have content loaded
        if (!enabled && hasInitialContent) setPhase("active");
      });
  }, [user, initialContext?.resumed, hasInitialContent]);

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

  // Timer — elapsed stored in ref, only synced on pause/unmount to avoid re-renders
  const elapsedRef = useRef(initialContext?.resumedElapsed || 0);
  const [timerAutoStart, setTimerAutoStart] = useState(hasInitialContent);

  const handleElapsedChange = useCallback((seconds: number) => {
    elapsedRef.current = seconds;
  }, []);

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

  const updateExercise = useCallback((index: number, data: Partial<LoggedExerciseData>) => {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, ...data } : e)));
  }, []);

  const removeExercise = useCallback((index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // NLP Quick Log: auto-populate parsed sets into exercises
  const handleQuickLogParsed = useCallback((parsedSets: Array<{ exercise_name: string; weight_lbs: number; reps: number; rpe: number }>) => {
    setExercises((prev) => {
      const updated = [...prev];

      for (const parsed of parsedSets) {
        // Try to match by exercise name (case-insensitive partial match)
        const matchIdx = parsed.exercise_name
          ? updated.findIndex((ex) =>
              ex.exerciseTitle.toLowerCase().includes(parsed.exercise_name.toLowerCase()) ||
              parsed.exercise_name.toLowerCase().includes(ex.exerciseTitle.toLowerCase())
            )
          : -1;

        if (matchIdx >= 0) {
          // Find the first empty set (weight === 0) or append a new set
          const ex = updated[matchIdx];
          const emptySetIdx = ex.sets.findIndex((s) => s.weight === 0 && s.reps === 0);
          if (emptySetIdx >= 0) {
            ex.sets[emptySetIdx] = {
              ...ex.sets[emptySetIdx],
              weight: parsed.weight_lbs,
              reps: parsed.reps,
            };
          } else {
            ex.sets.push({
              set: ex.sets.length + 1,
              weight: parsed.weight_lbs,
              reps: parsed.reps,
            });
          }
        } else if (updated.length > 0) {
          // No name match — fill the first exercise with an empty set
          const ex = updated[0];
          const emptySetIdx = ex.sets.findIndex((s) => s.weight === 0 && s.reps === 0);
          if (emptySetIdx >= 0) {
            ex.sets[emptySetIdx] = {
              ...ex.sets[emptySetIdx],
              weight: parsed.weight_lbs,
              reps: parsed.reps,
            };
          } else {
            ex.sets.push({
              set: ex.sets.length + 1,
              weight: parsed.weight_lbs,
              reps: parsed.reps,
            });
          }
        }
      }

      return updated;
    });
  }, []);

  // Pause handler
  const handlePause = useCallback(() => {
    const state = {
      title: workoutTitle,
      source: initialContext?.source,
      resumedExercises: exercises,
      resumedNotes: sessionNotes,
      resumedRecovery: recovery,
      resumedElapsed: elapsedRef.current,
      resumedDate: date.toISOString(),
      resumed: true,
    };
    localStorage.setItem("m2-paused-workout", JSON.stringify(state));
    toast.info("Workout paused. Resume anytime from your dashboard.");
    onPause?.();
  }, [exercises, sessionNotes, recovery, date, workoutTitle, initialContext, onPause]);

  // Finish handler
  const handleFinishClick = () => {
    if (saving) return;

    if (exercises.length === 0) {
      localStorage.removeItem("m2-paused-workout");
      onFinish();
      return;
    }

    setShowConfirm(true);
  };

  const handleFinishConfirmed = async () => {
    if (!user) return;
    setShowConfirm(false);

    const logId = await saveWorkout({
      userId: user.id,
      date,
      sessionNotes,
      exercises,
      recovery,
    });

    if (logId) {
      setWorkoutLogId(logId);
      setPhase("summary");
    }
  };

  // Intercept gateway phase
  if (phase === "intercept") {
    return (
      <InterceptGateway
        onSelect={(ctx) => {
          if (ctx.exercises?.length) {
            const mapped: LoggedExerciseData[] = ctx.exercises.map((ex) => ({
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
          }
          setWorkoutTitle(ctx.title || "Workout");
          // Check auto-regulate
          if (autoRegulateEnabled) {
            setPhase("readiness");
          } else {
            setPhase("active");
            setTimerAutoStart(true);
          }
        }}
        onExit={onFinish}
      />
    );
  }

  // Readiness gate phase
  if (phase === "readiness" && autoRegulateEnabled) {
    return (
      <ReadinessGate
        onComplete={(result) => {
          handleReadinessComplete(result);
          setTimerAutoStart(true);
        }}
        onSkip={() => {
          handleReadinessSkip();
          setTimerAutoStart(true);
        }}
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
        duration={elapsedRef.current}
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowIntervalTimer(true)}
              className="text-xs gap-1 text-muted-foreground hover:text-primary"
              title="Interval Timer"
            >
              <Clock size={14} />
            </Button>
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
        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-[160px]">
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
              onUpdate={updateExercise}
              onRemove={removeExercise}
              onOpenFormTracker={setFormTrackerExercise}
              onSetCompleted={() => startRestTimer(90)}
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

        {/* Quick Log NLP Bar */}
        {exercises.length > 0 && (
          <div className="fixed bottom-[72px] left-0 right-0 z-50 px-4 pb-1">
            <QuickLogBar exercises={exercises} onApplyParsed={handleQuickLogParsed} />
          </div>
        )}

        {/* Command Bar */}
        <footer className="fixed bottom-0 w-full z-50 bg-background/95 backdrop-blur-md border-t border-border px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {/* Rest Timer Banner */}
          {restSeconds > 0 && (
            <div className="flex items-center justify-between mb-2 bg-primary/10 border border-primary/30 rounded-sm px-3 py-2 max-w-lg mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Rest</span>
              <span className="text-lg font-mono font-bold text-primary">
                {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
              </span>
              <button
                onClick={clearRestTimer}
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
            {/* Left: Timer readout */}
            <WorkoutTimer
              initialElapsed={initialContext?.resumedElapsed || 0}
              autoStart={timerAutoStart}
              onElapsedChange={handleElapsedChange}
            />

            {/* Center: Add Exercise */}
            <Button
              onClick={() => setShowPicker(true)}
              size="sm"
              className="gap-1 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground"
              disabled={showPicker}
            >
              <Plus size={14} /> Add Exercise
            </Button>

            {/* Right: EXIT */}
            <Button
              onClick={handleFinishClick}
              disabled={saving}
              size="sm"
              variant="outline"
              className="gap-1 text-xs font-bold uppercase tracking-widest border-primary text-primary hover:border-primary/80 hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              Exit
            </Button>
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

      {showIntervalTimer && (
        <IntervalTimer onClose={() => setShowIntervalTimer(false)} />
      )}
    </>
  );
};

export default ActiveWorkoutZone;
