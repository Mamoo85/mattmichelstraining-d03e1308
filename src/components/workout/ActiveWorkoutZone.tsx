import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Plus, X, CheckCircle, Loader2, CalendarIcon, Clock, Camera, Info, Crosshair, Trash2, Check, MessageSquare, HelpCircle } from "lucide-react";
import m2Logo from "@/assets/m2-logo.jpg";
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

/** Small collapsible key showing what each icon does */
const ButtonKeyLegend = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle size={12} />
        Button Key
        {open ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 pb-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><Check size={10} className="text-emerald-400" /> Complete set</span>
          <span className="flex items-center gap-1.5"><Info size={10} className="text-primary" /> Coach notes / video</span>
          <span className="flex items-center gap-1.5"><Crosshair size={10} className="text-primary" /> Live form tracker</span>
          <span className="flex items-center gap-1.5"><Trash2 size={10} className="text-destructive" /> Remove exercise</span>
          <span className="flex items-center gap-1.5"><MessageSquare size={10} /> Notes / form check</span>
          <span className="flex items-center gap-1.5"><Camera size={10} /> Adapt to equipment</span>
          <span className="flex items-center gap-1.5"><Clock size={10} /> Interval timer</span>
          <span className="flex items-center gap-1.5"><Plus size={10} className="text-primary" /> Add set / exercise</span>
        </div>
      )}
    </div>
  );
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
  const [adaptLoading, setAdaptLoading] = useState(false);
  const [adaptBanner, setAdaptBanner] = useState<string | null>(null);
  const adaptInputRef = useRef<HTMLInputElement>(null);

  // Auto rest timer
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

  // Adapt to Equipment (Vision AI)
  const handleAdaptCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || exercises.length === 0) return;
    e.target.value = "";

    setAdaptLoading(true);
    setAdaptBanner(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);

      const workoutJson = exercises.map((ex) => ({
        title: ex.exerciseTitle,
        sets: ex.sets.length,
        reps: ex.sets[0]?.reps || 0,
        notes: ex.clientNotes || "",
      }));

      const { data, error } = await supabase.functions.invoke("adapt-workout-vision", {
        body: { imageBase64, workout: workoutJson },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const adaptedExercises = data?.exercises;
      if (!adaptedExercises?.length) throw new Error("No adapted exercises returned");

      let swapCount = 0;
      const updated = exercises.map((ex, i) => {
        const adapted = adaptedExercises[i];
        if (!adapted) return ex;
        if (adapted.was_swapped) {
          swapCount++;
          return {
            ...ex,
            exerciseId: "",
            exerciseTitle: adapted.adapted_title,
            clientNotes: adapted.swap_reason
              ? `Adapted: ${adapted.swap_reason}${ex.clientNotes ? " | " + ex.clientNotes : ""}`
              : ex.clientNotes,
            sets: Array.from({ length: adapted.sets || ex.sets.length }, (_, si) => ({
              set: si + 1,
              reps: adapted.reps || ex.sets[0]?.reps || 0,
              weight: 0,
            })),
          };
        }
        return ex;
      });

      setExercises(updated);
      const summary = data.summary || `${swapCount} exercise${swapCount !== 1 ? "s" : ""} adapted`;
      setAdaptBanner(summary);
      toast.success("Workout adapted for available equipment");
    } catch (err: any) {
      toast.error(err.message || "Failed to adapt workout");
    } finally {
      setAdaptLoading(false);
    }
  }, [exercises]);

  useEffect(() => {
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, []);

  useEffect(() => {
    if (!user) { setAutoRegulateEnabled(false); return; }
    if (initialContext?.resumed) { setPhase("active"); setAutoRegulateEnabled(false); return; }
    supabase
      .from("profiles")
      .select("auto_regulate")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        const enabled = (data as any)?.auto_regulate === true;
        setAutoRegulateEnabled(enabled);
        if (!enabled && hasInitialContent) setPhase("active");
      });
  }, [user, initialContext?.resumed, hasInitialContent]);

  const applyReadinessAdjustments = useCallback(async (result: ReadinessResult, currentExercises: LoggedExerciseData[]) => {
    if (result.weightAdjustmentPct === 0 && !result.swapsApplied) return currentExercises;

    let adjusted = [...currentExercises];

    if (result.weightAdjustmentPct !== 0) {
      adjusted = adjusted.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => ({
          ...s,
          weight: s.weight > 0 ? Math.round(s.weight * (1 + result.weightAdjustmentPct / 100)) : 0,
        })),
      }));
    }

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
    const adjustedExercises = await applyReadinessAdjustments(result, exercises);
    setExercises(adjustedExercises);
    setRecovery(prev => ({ ...prev, sleepHours: String(result.hoursSlept) }));
    setPhase("active");
  }, [exercises, applyReadinessAdjustments]);

  const handleReadinessSkip = useCallback(() => {
    setPhase("active");
  }, []);

  const elapsedRef = useRef(initialContext?.resumedElapsed || 0);
  const [timerAutoStart, setTimerAutoStart] = useState(hasInitialContent);

  const handleElapsedChange = useCallback((seconds: number) => {
    elapsedRef.current = seconds;
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (initialContext?.resumed) return;
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

  const handleQuickLogParsed = useCallback((parsedSets: Array<{ exercise_name: string; weight_lbs: number; reps: number; rpe: number }>) => {
    setExercises((prev) => {
      const updated = [...prev];

      for (const parsed of parsedSets) {
        const matchIdx = parsed.exercise_name
          ? updated.findIndex((ex) =>
              ex.exerciseTitle.toLowerCase().includes(parsed.exercise_name.toLowerCase()) ||
              parsed.exercise_name.toLowerCase().includes(ex.exerciseTitle.toLowerCase())
            )
          : -1;

        if (matchIdx >= 0) {
          const ex = updated[matchIdx];
          const emptySetIdx = ex.sets.findIndex((s) => s.weight === 0 && s.reps === 0);
          if (emptySetIdx >= 0) {
            ex.sets[emptySetIdx] = { ...ex.sets[emptySetIdx], weight: parsed.weight_lbs, reps: parsed.reps };
          } else {
            ex.sets.push({ set: ex.sets.length + 1, weight: parsed.weight_lbs, reps: parsed.reps });
          }
        } else if (updated.length > 0) {
          const ex = updated[0];
          const emptySetIdx = ex.sets.findIndex((s) => s.weight === 0 && s.reps === 0);
          if (emptySetIdx >= 0) {
            ex.sets[emptySetIdx] = { ...ex.sets[emptySetIdx], weight: parsed.weight_lbs, reps: parsed.reps };
          } else {
            ex.sets.push({ set: ex.sets.length + 1, weight: parsed.weight_lbs, reps: parsed.reps });
          }
        }
      }

      return updated;
    });
  }, []);

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

  // Rest timer progress (circular)
  const restProgress = restSeconds > 0 ? (restSeconds / 90) * 100 : 0;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        {/* Modern Header */}
        <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-background to-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <img src={m2Logo} alt="M² Training" className="h-8 w-8 rounded-full object-cover" />
            <div className="min-w-0">
              <span className="text-sm font-bold text-foreground truncate block leading-tight">
                {workoutTitle}
              </span>
              {readinessResult && readinessResult.weightAdjustmentPct !== 0 && (
                <span className="text-[10px] font-medium text-primary">
                  {Math.abs(readinessResult.weightAdjustmentPct)}% adjusted
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {exercises.length > 0 && (
              <button
                onClick={() => adaptInputRef.current?.click()}
                disabled={adaptLoading}
                className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Adapt to Equipment"
              >
                {adaptLoading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              </button>
            )}
            <input
              ref={adaptInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleAdaptCapture}
            />
            <button
              onClick={() => setShowIntervalTimer(true)}
              className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Interval Timer"
            >
              <Clock size={16} />
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-9 flex items-center gap-1.5 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <CalendarIcon size={14} />
                  {format(date, "MMM d")}
                </button>
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
          {/* Adapt to Equipment Banner */}
          {adaptBanner && (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                <Camera size={14} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-semibold text-emerald-400 truncate">{adaptBanner}</span>
              </div>
              <button onClick={() => setAdaptBanner(null)} className="text-muted-foreground hover:text-foreground rounded-full h-7 w-7 flex items-center justify-center">
                <X size={12} />
              </button>
            </div>
          )}
          {adaptLoading && (
            <div className="flex items-center justify-center gap-2 py-4 bg-muted/30 border border-white/[0.06] rounded-xl">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Analyzing equipment & adapting workout…</span>
            </div>
          )}

          {exercises.length === 0 && !showPicker && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-5">
              <img src={m2Logo} alt="M² Training" className="h-16 w-16 rounded-full object-cover opacity-60" />
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">Ready to train</h3>
                <p className="text-sm text-muted-foreground">Add exercises from the library to start logging.</p>
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold",
                  "bg-primary text-primary-foreground",
                  "shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.5)]",
                  "transition-all active:scale-95"
                )}
              >
                <Plus size={16} /> Add Exercise
              </button>
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
              defaultExpanded={i < 2}
            />
          ))}

          {showPicker && (
            <ExercisePicker onSelect={addExercise} onCancel={() => setShowPicker(false)} />
          )}

          {exercises.length > 0 && (
            <ButtonKeyLegend />
          )}

          {exercises.length > 0 && (
            <div className="flex flex-col items-center gap-1 py-4 opacity-20">
              <img src={m2Logo} alt="M²" className="h-6 w-6 rounded-full object-cover" />
              <span className="text-[9px] font-bold uppercase tracking-[3px] text-muted-foreground">M² Training</span>
            </div>
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
                className="w-full bg-card/80 border border-white/[0.06] rounded-2xl p-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/40 outline-none min-h-[72px] resize-none shadow-lg transition-all"
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
          <div className="fixed bottom-[80px] left-0 right-0 z-50 px-4 pb-1">
            <QuickLogBar exercises={exercises} onApplyParsed={handleQuickLogParsed} />
          </div>
        )}

        {/* Frosted Glass Command Bar */}
        <footer className="fixed bottom-0 w-full z-50 bg-card/60 backdrop-blur-xl border-t border-white/[0.06] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {/* Circular Rest Timer */}
          {restSeconds > 0 && (
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="relative h-12 w-12">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                  <circle
                    cx="24" cy="24" r="20" fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - restProgress / 100)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono text-primary">
                  {restSeconds}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground block">Rest Timer</span>
                <button
                  onClick={clearRestTimer}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Skip →
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            {/* Timer pill */}
            <WorkoutTimer
              initialElapsed={initialContext?.resumedElapsed || 0}
              autoStart={timerAutoStart}
              onElapsedChange={handleElapsedChange}
            />

            {/* Add Exercise */}
            <button
              onClick={() => setShowPicker(true)}
              disabled={showPicker}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all",
                "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.3)]",
                "hover:shadow-[0_0_24px_hsl(var(--primary)/0.5)] active:scale-95",
                showPicker && "opacity-50"
              )}
            >
              <Plus size={14} /> Add
            </button>

            {/* Exit */}
            <button
              onClick={handleFinishClick}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wide border border-white/[0.1] text-foreground hover:bg-muted/50 transition-all active:scale-95"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              Exit
            </button>
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
