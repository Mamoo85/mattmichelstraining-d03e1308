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
    // Mark set as completed visually (copy ghost data if empty)
    const newSets = [...exercise.sets];
    const ghost = ghostData[setIndex];
    const current = newSets[setIndex];
    if (current.weight === 0 && ghost?.weight) {
      newSets[setIndex] = { ...current, weight: ghost.weight, reps: ghost.reps || current.reps };
      onUpdate(index, { sets: newSets });
    }
    // Trigger auto rest timer
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
          "bg-card border border-border transition-all rounded-md overflow-hidden",
          exercise.flagForCoach && "border-l-4 border-l-primary bg-primary/5"
        )}
      >
        {/* 1. Exercise Title */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono text-muted-foreground">{index + 1}</span>
            <span className="text-sm font-bold text-foreground truncate">{exercise.exerciseTitle}</span>
            {/* Coach's Eye: info/video icon for form cues */}
            {(exercise.exerciseTheWhy || exercise.exerciseVideoUrl) && (
              <button
                onClick={() => setShowCoachNotes(!showCoachNotes)}
                className="h-6 w-6 flex items-center justify-center text-primary/60 hover:text-primary transition-colors"
                title="Coach notes & form cues"
              >
                <Info size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onOpenFormTracker && (
              <button
                onClick={() => onOpenFormTracker(exercise.exerciseTitle)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                title="Live Form Tracker"
              >
                <Crosshair size={14} />
              </button>
            )}
            <button onClick={() => onRemove(index)} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Coach's Eye: Collapsible video + form cues */}
        {showCoachNotes && (
          <>
            {exercise.exerciseVideoUrl && (
              <div className="px-3 pb-3">
                <div className="rounded-md overflow-hidden">
                  <ExerciseVideoEmbed
                    videoUrl={exercise.exerciseVideoUrl}
                    exerciseTitle={exercise.exerciseTitle}
                  />
                </div>
              </div>
            )}
            {exercise.exerciseTheWhy && (
              <div className="px-3 pb-3">
                <div className="bg-primary/5 border-l-2 border-primary/40 p-3 rounded-sm">
                  <div className="flex items-center gap-1 mb-1">
                    <Info size={10} className="text-primary" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Coach's Notes</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{exercise.exerciseTheWhy}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* 4. Dense tabular layout: Set # | Previous | Lbs | Reps | Check */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem] gap-x-1 items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            <span className="text-center">Set</span>
            <span className="text-center">Previous</span>
            <span className="text-center">Lbs</span>
            <span className="text-center">Reps</span>
            <span className="text-center">✓</span>
          </div>
          {exercise.sets.map((s, si) => {
            const ghost = ghostData[si];
            const isCompleted = s.weight > 0 && s.reps > 0;
            return (
              <div key={si} className="grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem] gap-x-1 items-center mb-1">
                <span className="text-xs font-mono text-muted-foreground text-center">{s.set}</span>
                {/* Ghost Data: previous performance */}
                <span className="text-xs font-mono text-muted-foreground/50 text-center truncate">
                  {ghost ? `${ghost.weight}×${ghost.reps}` : "—"}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.weight || ""}
                  onChange={(e) => updateSet(si, "weight", parseInt(e.target.value) || 0)}
                  placeholder={ghost?.weight ? String(ghost.weight) : "0"}
                  className="bg-background border border-border rounded-sm text-center font-mono text-foreground text-sm h-10 w-full focus:ring-1 focus:ring-primary outline-none"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.reps || ""}
                  onChange={(e) => updateSet(si, "reps", parseInt(e.target.value) || 0)}
                  placeholder={ghost?.reps ? String(ghost.reps) : "0"}
                  className="bg-background border border-border rounded-sm text-center font-mono text-foreground text-sm h-10 w-full focus:ring-1 focus:ring-primary outline-none"
                />
                {/* Checkmark — completes set + triggers auto rest timer */}
                <button
                  onClick={() => completeSet(si)}
                  className={cn(
                    "h-10 w-full flex items-center justify-center rounded-sm border transition-all",
                    isCompleted
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60"
                  )}
                >
                  <Check size={14} />
                </button>
              </div>
            );
          })}
          <div className="flex gap-2 mt-2">
            <button onClick={addSet} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 h-9 px-3 bg-primary/10 rounded-sm">
              <Plus size={12} /> Set
            </button>
            {exercise.sets.length > 1 && (
              <button onClick={removeSet} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive h-9 px-3 bg-muted rounded-sm">
                <Minus size={12} /> Set
              </button>
            )}
          </div>
        </div>

        {/* 5. Notes & Form Check Video */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowExtras(!showExtras)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
          >
            {showExtras ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <MessageSquare size={11} /> Notes / Form Check
          </button>
          {showExtras && (
            <div className="mt-2 space-y-2">
              <div className="relative">
                <textarea
                  placeholder="How did this feel? Any pain or issues?"
                  value={exercise.clientNotes}
                  onChange={(e) => onUpdate(index, { clientNotes: e.target.value })}
                  className="w-full bg-background border border-border rounded-sm p-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[60px] resize-none"
                />
                <VoiceNoteButton
                  onTranscript={(t) => onUpdate(index, { clientNotes: (exercise.clientNotes ? exercise.clientNotes + " " : "") + t })}
                  className="absolute top-2 right-2"
                />
              </div>
              <div className="flex items-center bg-background border border-border rounded-sm px-3 h-12">
                <Link size={14} className="text-muted-foreground mr-2 flex-shrink-0" />
                <input
                  type="url"
                  placeholder="Form check video link…"
                  value={exercise.videoUrl}
                  onChange={(e) => onUpdate(index, { videoUrl: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. Flag for Coach */}
        <div
          className={cn(
            "flex items-center justify-between px-3 py-3 border-t border-border cursor-pointer",
            exercise.flagForCoach && canFlag && "bg-primary/10",
            !canFlag && "opacity-70"
          )}
          onClick={() => !canFlag && setShowUpsell(true)}
        >
          <label
            htmlFor={canFlag ? `flag-${index}` : undefined}
            className="text-xs font-bold uppercase tracking-widest text-foreground cursor-pointer select-none flex items-center gap-2"
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
