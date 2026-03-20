import { useState, memo, useCallback, useEffect } from "react";
import { Trash2, ChevronDown, ChevronUp, Plus, Minus, Link, MessageSquare, Lock, Info, Crosshair, Check } from "lucide-react";
import VoiceNoteButton from "./VoiceNoteButton";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTierAccess } from "@/hooks/useTierAccess";
import { EliteUpsellModal } from "@/components/PaywallGate";
import ExerciseVideoEmbed from "@/components/exercise/ExerciseVideoEmbed";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { LoggedExerciseData } from "./WorkoutLogger";

interface ExerciseCardProps {
  exercise: LoggedExerciseData;
  index: number;
  onUpdate: (index: number, data: Partial<LoggedExerciseData>) => void;
  onRemove: (index: number) => void;
  onOpenFormTracker: (exerciseTitle: string) => void;
  onSetCompleted?: () => void;
}

interface GhostSet {
  weight: number;
  reps: number;
}

const ExerciseCard = memo(({ exercise, index, onUpdate, onRemove, onOpenFormTracker, onSetCompleted }: ExerciseCardProps) => {
  const { user } = useAuth();
  const [showExtras, setShowExtras] = useState(false);
  const [showCoachNotes, setShowCoachNotes] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { hasAccess: canFlag } = useTierAccess("flag_coach");
  const [ghostData, setGhostData] = useState<GhostSet[]>([]);
  const [completedSets, setCompletedSets] = useState<Set<number>>(new Set());
  const [justPopped, setJustPopped] = useState<number | null>(null);
  const [confettiSet, setConfettiSet] = useState<number | null>(null);

  // Fetch ghost data (previous performance) for this exercise
  useEffect(() => {
    if (!user || !exercise.exerciseId) return;
    (supabase
      .from("logged_exercises")
      .select("sets_reps_weight")
      .eq("exercise_id", exercise.exerciseId)
      .order("created_at", { ascending: false })
      .limit(1) as any)
      .then(({ data }: { data: any[] | null }) => {
        if (data && data.length > 0) {
          const raw = data[0].sets_reps_weight;
          const sets = Array.isArray(raw) ? raw : [];
          setGhostData(
            sets.map((s: any) => ({
              weight: s.weight || 0,
              reps: s.reps || 0,
            }))
          );
        }
      });
  }, [user, exercise.exerciseId]);

  const updateSet = useCallback((setIndex: number, field: "reps" | "weight", value: number) => {
    const newSets = [...exercise.sets];
    newSets[setIndex] = { ...newSets[setIndex], [field]: Math.max(0, value) };
    onUpdate(index, { sets: newSets });
  }, [exercise.sets, index, onUpdate]);

  const completeSet = useCallback((setIndex: number) => {
    const newSets = [...exercise.sets];
    const ghost = ghostData[setIndex];
    const current = newSets[setIndex];
    if (current.weight === 0 && ghost?.weight) {
      newSets[setIndex] = { ...current, weight: ghost.weight, reps: ghost.reps || current.reps };
      onUpdate(index, { sets: newSets });
    }
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50);
    // Pulse animation
    setJustPopped(setIndex);
    setTimeout(() => setJustPopped(null), 500);

    setCompletedSets(prev => {
      const next = new Set(prev);
      const wasCompleted = next.has(setIndex);
      if (wasCompleted) next.delete(setIndex);
      else next.add(setIndex);
      // Confetti on last set completion
      if (!wasCompleted && next.size === exercise.sets.length) {
        setConfettiSet(setIndex);
        setTimeout(() => setConfettiSet(null), 1000);
      }
      return next;
    });
    onSetCompleted?.();
  }, [exercise.sets, ghostData, index, onUpdate, onSetCompleted]);

  const addSet = useCallback(() => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    onUpdate(index, {
      sets: [...exercise.sets, { set: exercise.sets.length + 1, reps: lastSet?.reps || 0, weight: lastSet?.weight || 0 }],
    });
  }, [exercise.sets, index, onUpdate]);

  const removeSet = useCallback(() => {
    if (exercise.sets.length <= 1) return;
    onUpdate(index, { sets: exercise.sets.slice(0, -1) });
  }, [exercise.sets, index, onUpdate]);

  const handleFlagToggle = useCallback((checked: boolean) => {
    if (!canFlag) {
      setShowUpsell(true);
      return;
    }
    onUpdate(index, { flagForCoach: checked });
  }, [canFlag, index, onUpdate]);

  return (
    <>
      <div
        className={cn(
          "rounded-2xl overflow-hidden transition-all duration-300 shadow-lg",
          "bg-gradient-to-b from-card to-card/80 border border-white/[0.06]",
          exercise.flagForCoach && "ring-2 ring-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
        )}
      >
        {/* Exercise Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
              {index + 1}
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold text-foreground truncate block leading-tight">{exercise.exerciseTitle}</span>
              <span className="text-[11px] text-muted-foreground">{exercise.sets.length} sets</span>
            </div>
            {(exercise.exerciseTheWhy || exercise.exerciseVideoUrl) && (
              <button
                onClick={() => setShowCoachNotes(!showCoachNotes)}
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-full transition-colors",
                  showCoachNotes ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title="Coach notes & form cues"
              >
                <Info size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onOpenFormTracker && (
              <button
                onClick={() => onOpenFormTracker(exercise.exerciseTitle)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Live Form Tracker"
              >
                <Crosshair size={16} />
              </button>
            )}
            <button onClick={() => onRemove(index)} className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Coach's Eye: Collapsible video + form cues */}
        {showCoachNotes && (
          <div className="px-4 pb-3 space-y-3">
            {exercise.exerciseVideoUrl && (
              <div className="rounded-xl overflow-hidden">
                <ExerciseVideoEmbed
                  videoUrl={exercise.exerciseVideoUrl}
                  exerciseTitle={exercise.exerciseTitle}
                />
              </div>
            )}
            {exercise.exerciseTheWhy && (
              <div className="bg-primary/8 border border-primary/20 p-3.5 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Info size={11} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Coach's Notes</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{exercise.exerciseTheWhy}</p>
              </div>
            )}
          </div>
        )}

        {/* Set Rows */}
        <div className="px-4 pb-3">
          {/* Column Headers */}
          <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center mb-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-center">Set</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-center">Lbs</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-center">Reps</span>
            <span />
          </div>
          {exercise.sets.map((s, si) => {
            const ghost = ghostData[si];
            const isCompleted = completedSets.has(si) || (s.weight > 0 && s.reps > 0);
            return (
              <div
                key={si}
                className={cn(
                  "grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center mb-1.5 px-1 py-1 rounded-xl transition-all duration-300",
                  isCompleted && "bg-emerald-500/10"
                )}
              >
                <span className={cn(
                  "text-xs font-bold text-center rounded-full h-6 w-6 flex items-center justify-center mx-auto",
                  isCompleted ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground/50"
                )}>
                  {s.set}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.weight || ""}
                  onChange={(e) => updateSet(si, "weight", parseInt(e.target.value) || 0)}
                  placeholder={ghost?.weight ? String(ghost.weight) : "0"}
                  className={cn(
                    "bg-background/60 border border-white/[0.08] rounded-xl text-center font-mono text-foreground text-sm h-12 w-full",
                    "focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all",
                    "placeholder:text-muted-foreground/30"
                  )}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.reps || ""}
                  onChange={(e) => updateSet(si, "reps", parseInt(e.target.value) || 0)}
                  placeholder={ghost?.reps ? String(ghost.reps) : "0"}
                  className={cn(
                    "bg-background/60 border border-white/[0.08] rounded-xl text-center font-mono text-foreground text-sm h-12 w-full",
                    "focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all",
                    "placeholder:text-muted-foreground/30"
                  )}
                />
                <button
                  onClick={() => completeSet(si)}
                  className={cn(
                    "h-10 w-10 flex items-center justify-center rounded-full transition-all duration-300 mx-auto",
                    isCompleted
                      ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-105"
                      : "border border-white/[0.1] text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60"
                  )}
                >
                  <Check size={16} strokeWidth={isCompleted ? 3 : 2} />
                </button>
              </div>
            );
          })}

          {/* Add/Remove Set */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={addSet}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 h-10 px-4 bg-primary/10 rounded-full transition-all"
            >
              <Plus size={14} /> Add Set
            </button>
            {exercise.sets.length > 1 && (
              <button
                onClick={removeSet}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive h-10 px-4 bg-muted/50 rounded-full transition-all"
              >
                <Minus size={14} /> Remove
              </button>
            )}
          </div>
        </div>

        {/* Notes & Form Check */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowExtras(!showExtras)}
            className={cn(
              "flex items-center gap-2 text-xs font-semibold transition-all rounded-full px-3 py-2",
              showExtras
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {showExtras ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <MessageSquare size={13} /> Notes / Form Check
          </button>
          {showExtras && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <textarea
                  placeholder="How did this feel? Any pain or issues?"
                  value={exercise.clientNotes}
                  onChange={(e) => onUpdate(index, { clientNotes: e.target.value })}
                  className="w-full bg-background/60 border border-white/[0.08] rounded-xl p-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/40 outline-none min-h-[72px] resize-none transition-all"
                />
                <VoiceNoteButton
                  onTranscript={(t) => onUpdate(index, { clientNotes: (exercise.clientNotes ? exercise.clientNotes + " " : "") + t })}
                  className="absolute top-3 right-3"
                />
              </div>
              <div className="flex items-center bg-background/60 border border-white/[0.08] rounded-xl px-4 h-12">
                <Link size={14} className="text-muted-foreground mr-2 flex-shrink-0" />
                <input
                  type="url"
                  placeholder="Form check video link…"
                  value={exercise.videoUrl}
                  onChange={(e) => onUpdate(index, { videoUrl: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Flag for Coach */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3.5 border-t border-white/[0.05] cursor-pointer rounded-b-2xl transition-all",
            exercise.flagForCoach && canFlag && "bg-primary/8",
            !canFlag && "opacity-70"
          )}
          onClick={() => !canFlag && setShowUpsell(true)}
        >
          <label
            htmlFor={canFlag ? `flag-${index}` : undefined}
            className="text-xs font-semibold text-foreground cursor-pointer select-none flex items-center gap-2"
          >
            {canFlag ? "🏴" : <Lock size={12} className="text-muted-foreground" />}
            Flag for Coach Matt
          </label>
          <Switch
            id={`flag-${index}`}
            checked={exercise.flagForCoach}
            onCheckedChange={handleFlagToggle}
            disabled={!canFlag}
          />
        </div>
      </div>

      <EliteUpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} />
    </>
  );
});

ExerciseCard.displayName = "ExerciseCard";

export default ExerciseCard;
