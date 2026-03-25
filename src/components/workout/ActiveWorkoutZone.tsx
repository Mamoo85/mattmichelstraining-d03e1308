import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Plus, X, CheckCircle, Loader2, CalendarIcon, Clock, Camera, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
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
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";
import InterceptGateway from "./InterceptGateway";
import IntervalTimer from "./IntervalTimer";
import PostWorkoutSummary from "./PostWorkoutSummary";
import PRCelebrationModal, { type DetectedPR } from "./PRCelebrationModal";
import WorkoutTimer from "./WorkoutTimer";
import LiveFormTracker from "./LiveFormTracker";
import ReadinessGate, { calculateAdjustments, type ReadinessResult } from "./ReadinessGate";
import QuickLogBar from "./QuickLogBar";
import type { LoggedExerciseData } from "./WorkoutLogger";
import { safeLocalStorage } from "@/lib/browserStorage";

/* ─── Context types ─── */
export interface WorkoutZoneContext {
  title?: string;
  source?: "program" | "community" | "custom" | "manual" | "ai-suggest";
  programId?: string;
  isTimedCircuit?: boolean;
  timerConfig?: { work: number; rest: number; rounds: number; prep: number };
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

/* ButtonKeyLegend removed — cyberpunk purge */

const ActiveWorkoutZone = ({ onFinish, onPause, initialContext }: ActiveWorkoutZoneProps) => {
  const { user } = useAuth();
  const hasInitialContent = !!(initialContext?.exercises?.length || initialContext?.resumed);
  const [phase, setPhase] = useState<"intercept" | "readiness" | "active" | "pr" | "summary">(
    hasInitialContent ? "readiness" : "intercept"
  );
  const [detectedPRs, setDetectedPRs] = useState<DetectedPR[]>([]);
  const [athleteDisplayName, setAthleteDisplayName] = useState("Athlete");
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
  const [showIntervalTimer, setShowIntervalTimer] = useState(
    !!(initialContext?.isTimedCircuit && initialContext?.timerConfig)
  );
  const [restSeconds, setRestSeconds] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [workoutTitle, setWorkoutTitle] = useState(initialContext?.title || "Workout");
  const [adaptLoading, setAdaptLoading] = useState(false);
  const [adaptBanner, setAdaptBanner] = useState<string | null>(null);
  const adaptInputRef = useRef<HTMLInputElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

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
    safeLocalStorage.setItem("m2-paused-workout", JSON.stringify(state));
    toast.info("Workout paused. Resume anytime from your dashboard.");
    onPause?.();
  }, [exercises, sessionNotes, recovery, date, workoutTitle, initialContext, onPause]);

  // PR detection: check progress_logs for previous bests
  const detectPRs = useCallback(async (loggedExercises: LoggedExerciseData[]): Promise<DetectedPR[]> => {
    if (!user) return [];
    const prs: DetectedPR[] = [];

    for (const ex of loggedExercises) {
      const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
      const maxVolume = Math.max(...ex.sets.map(s => (s.weight || 0) * (s.reps || 0)));
      const bestRepsAtMax = Math.max(...ex.sets.filter(s => s.weight === maxWeight).map(s => s.reps || 0));

      if (maxWeight <= 0) continue;

      // Query previous best for this exercise
      const { data: prevLogs } = await supabase
        .from("progress_logs")
        .select("weight, reps")
        .eq("user_id", user.id)
        .eq("exercise_name", ex.exerciseTitle)
        .order("weight", { ascending: false })
        .limit(1);

      const prevBest = prevLogs?.[0]?.weight || 0;

      if (maxWeight > prevBest) {
        prs.push({
          exerciseTitle: ex.exerciseTitle,
          weight: maxWeight,
          reps: bestRepsAtMax,
          prType: "weight",
          previousBest: prevBest || undefined,
        });
      }
    }
    return prs;
  }, [user]);

  // Fetch athlete display name
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("athlete_name, full_name").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) setAthleteDisplayName((data as any).athlete_name || (data as any).full_name || "Athlete");
      });
  }, [user]);

  const finishWithPRCheck = useCallback(async (logId: string) => {
    setWorkoutLogId(logId);
    const prs = await detectPRs(exercises);
    if (prs.length > 0) {
      setDetectedPRs(prs);
      setPhase("pr");
    } else {
      setPhase("summary");
    }
  }, [exercises, detectPRs]);

  const handleFinishClick = async () => {
    if (saving) return;
    if (exercises.length === 0) {
      safeLocalStorage.removeItem("m2-paused-workout");
      onFinish();
      return;
    }
    if (!user) return;
    const logId = await saveWorkout({
      userId: user.id,
      date,
      sessionNotes,
      exercises,
      recovery,
    });
    if (logId) {
      await finishWithPRCheck(logId);
    } else {
      onFinish();
    }
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
      await finishWithPRCheck(logId);
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

  // PR celebration phase
  if (phase === "pr" && detectedPRs.length > 0) {
    return (
      <PRCelebrationModal
        prs={detectedPRs}
        athleteName={athleteDisplayName}
        date={date}
        onClose={() => setPhase("summary")}
      />
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
          safeLocalStorage.removeItem("m2-paused-workout");
          onFinish();
        }}
      />
    );
  }

  const restMins = Math.floor(restSeconds / 60);
  const restSecs = restSeconds % 60;

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-[#050505] flex flex-col">
        {/* ─── STEALTH HEADER ─── */}
        <header className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#050505]/90 backdrop-blur-md border-b border-white/[0.04] z-10">
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={workoutTitle}
                onChange={(e) => setWorkoutTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
                autoFocus
                className="text-base font-bold text-foreground bg-transparent border-b border-white/20 px-0 py-0.5 outline-none w-full max-w-[180px]"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="text-base font-bold text-foreground truncate max-w-[180px] hover:opacity-70 transition-opacity"
                title="Tap to edit title"
              >
                {workoutTitle}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Glowing digital watch timer */}
            <WorkoutTimer
              initialElapsed={initialContext?.resumedElapsed || 0}
              autoStart={timerAutoStart}
              onElapsedChange={handleElapsedChange}
            />
            {/* Muted Finish text */}
            <button
              onClick={handleFinishClick}
              disabled={saving}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Finish"}
            </button>
          </div>
        </header>

        {/* ─── FLOATING NEON REST TIMER ─── */}
        {restSeconds > 0 && (
          <div className="absolute top-[52px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2 rounded-full bg-black/80 border border-[hsl(var(--synth-cyan))] shadow-[var(--synth-glow-cyan)]">
            <span
              className="font-mono text-lg font-bold tabular-nums"
              style={{ color: "hsl(var(--synth-cyan))", textShadow: "var(--synth-glow-cyan)" }}
            >
              {String(restMins).padStart(2, "0")}:{String(restSecs).padStart(2, "0")}
            </span>
            <button
              onClick={clearRestTimer}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
          </div>
        )}

        {/* Readiness adjustment banner */}
        {readinessResult && readinessResult.weightAdjustmentPct !== 0 && (
          <div className="px-3 py-1.5 bg-primary/10 text-center">
            <span className="text-[10px] font-bold text-primary">
              Auto-regulated: {readinessResult.weightAdjustmentPct > 0 ? "+" : ""}{readinessResult.weightAdjustmentPct}% weight adjustment applied
            </span>
          </div>
        )}

        {/* ─── SCROLLABLE CONTENT ─── */}
        <main className="flex-1 overflow-y-auto px-3 py-3 space-y-3 pb-[160px]">
          {/* Adapt to Equipment Banner */}
          {adaptBanner && (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Camera size={12} className="text-emerald-500 shrink-0" />
                <span className="text-[11px] font-semibold text-emerald-400 truncate">{adaptBanner}</span>
              </div>
              <button onClick={() => setAdaptBanner(null)} className="text-muted-foreground hover:text-foreground h-6 w-6 flex items-center justify-center">
                <X size={10} />
              </button>
            </div>
          )}
          {adaptLoading && (
            <div className="flex items-center justify-center gap-2 py-3 bg-muted/30 border border-white/[0.06] rounded-lg">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span className="text-[11px] font-medium text-muted-foreground">Analyzing equipment…</span>
            </div>
          )}

          {exercises.length === 0 && !showPicker && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="h-12 w-12 rounded-full border border-white/[0.08] flex items-center justify-center">
                <Plus size={20} className="text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-1">Ready to train</h3>
                <p className="text-sm text-muted-foreground">Add exercises to start logging.</p>
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[hsl(var(--synth-cyan))] border border-[hsl(var(--synth-cyan))]/30 rounded-full hover:bg-[hsl(var(--synth-cyan))]/10 transition-all active:scale-95"
              >
                <Plus size={14} /> Add Exercise
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
            <RecoveryInput value={recovery} onChange={setRecovery} />
          )}

          {exercises.length > 0 && (
            <div className="relative">
              <textarea
                placeholder="Session notes (optional)…"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="w-full bg-transparent border border-white/[0.06] rounded-lg p-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-[hsl(var(--synth-cyan))]/30 outline-none min-h-[60px] resize-none transition-all"
              />
              <VoiceNoteButton
                onTranscript={(t) => setSessionNotes((prev) => (prev ? prev + " " + t : t))}
                className="absolute top-2 right-2"
              />
            </div>
          )}
        </main>

        {/* Hidden file input for adapt */}
        <input
          ref={adaptInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleAdaptCapture}
        />

        {/* ─── QUICK LOG BAR (terminal style) — floats above command pill ─── */}
        {exercises.length > 0 && (
          <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg">
            <QuickLogBar exercises={exercises} onApplyParsed={handleQuickLogParsed} />
          </div>
        )}

        {/* ─── COMMAND PILL (Dynamic Island footer) ─── */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pb-safe">
          <div className="flex items-center gap-3 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/[0.08] rounded-full px-4 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
            {/* Intervals */}
            <button
              onClick={() => setShowIntervalTimer(true)}
              className="h-8 w-8 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
              title="Interval Timer"
            >
              <Timer size={14} />
            </button>

            {/* + Add Exercise */}
            <button
              onClick={() => setShowPicker(true)}
              disabled={showPicker}
              className="text-sm font-semibold text-[hsl(var(--synth-cyan))] hover:opacity-80 transition-opacity active:scale-95 px-2"
              style={{ textShadow: "0 0 8px hsl(185 100% 48% / 0.3)" }}
            >
              + Add Exercise
            </button>

            {/* Camera / Adapt */}
            {exercises.length > 0 && (
              <button
                onClick={() => adaptInputRef.current?.click()}
                disabled={adaptLoading}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
                title="Adapt to Equipment"
              >
                {adaptLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
            )}

            {/* Pause */}
            <button
              onClick={handlePause}
              className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              Pause
            </button>
          </div>
        </div>
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
        <IntervalTimer
          onClose={() => setShowIntervalTimer(false)}
          initialConfig={initialContext?.timerConfig ? {
            prep: initialContext.timerConfig.prep,
            work: initialContext.timerConfig.work,
            rest: initialContext.timerConfig.rest,
            rounds: initialContext.timerConfig.rounds,
            warning: 5,
          } : undefined}
          exercises={initialContext?.isTimedCircuit ? exercises.map(e => e.exerciseTitle) : undefined}
          isCircuit={initialContext?.isTimedCircuit}
        />
      )}
    </>
  );
};

export default ActiveWorkoutZone;
