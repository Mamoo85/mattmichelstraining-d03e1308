import { useState, memo, useCallback } from "react";
import { Trash2, ChevronDown, ChevronUp, Plus, Minus, Link, MessageSquare, Lock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTierAccess } from "@/hooks/useTierAccess";
import { EliteUpsellModal } from "@/components/PaywallGate";
import ExerciseVideoEmbed from "@/components/exercise/ExerciseVideoEmbed";
import type { LoggedExerciseData } from "./WorkoutLogger";

interface ExerciseCardProps {
  exercise: LoggedExerciseData;
  index: number;
  onUpdate: (data: Partial<LoggedExerciseData>) => void;
  onRemove: () => void;
}

const ExerciseCard = memo(({ exercise, index, onUpdate, onRemove }: ExerciseCardProps) => {
  const [showExtras, setShowExtras] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { hasAccess: canFlag } = useTierAccess("flag_coach");

  const updateSet = (setIndex: number, field: "reps" | "weight", value: number) => {
    const newSets = [...exercise.sets];
    newSets[setIndex] = { ...newSets[setIndex], [field]: Math.max(0, value) };
    onUpdate({ sets: newSets });
  };

  const addSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    onUpdate({
      sets: [...exercise.sets, { set: exercise.sets.length + 1, reps: lastSet?.reps || 0, weight: lastSet?.weight || 0 }],
    });
  };

  const removeSet = () => {
    if (exercise.sets.length <= 1) return;
    onUpdate({ sets: exercise.sets.slice(0, -1) });
  };

  const handleFlagToggle = (checked: boolean) => {
    if (!canFlag) {
      setShowUpsell(true);
      return;
    }
    onUpdate({ flagForCoach: checked });
  };

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
          </div>
          <button onClick={onRemove} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
            <Trash2 size={14} />
          </button>
        </div>

        {/* 2. Video Player — full width, rounded, no autoplay */}
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

        {/* 3. The Why + Coach's Instructions */}
        {exercise.exerciseTheWhy && (
          <div className="px-3 pb-3">
            <div className="bg-primary/5 border-l-2 border-primary/40 p-3 rounded-sm">
              <div className="flex items-center gap-1 mb-1">
                <Info size={10} className="text-primary" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary">The Why</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{exercise.exerciseTheWhy}</p>
            </div>
          </div>
        )}

        {/* 4. Sets / Reps / Weight inputs */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1 items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            <span>Set</span>
            <span className="text-center">Weight (lbs)</span>
            <span className="text-center">Reps</span>
          </div>
          {exercise.sets.map((s, si) => (
            <div key={si} className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1 items-center mb-1">
              <span className="text-xs font-mono text-muted-foreground w-6 text-center">{s.set}</span>
              <input
                type="number"
                inputMode="numeric"
                value={s.weight || ""}
                onChange={(e) => updateSet(si, "weight", parseInt(e.target.value) || 0)}
                placeholder="0"
                className="bg-background border border-border rounded-sm text-center font-mono text-foreground text-base h-12 w-full focus:ring-1 focus:ring-primary outline-none"
              />
              <input
                type="number"
                inputMode="numeric"
                value={s.reps || ""}
                onChange={(e) => updateSet(si, "reps", parseInt(e.target.value) || 0)}
                placeholder="0"
                className="bg-background border border-border rounded-sm text-center font-mono text-foreground text-base h-12 w-full focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          ))}
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
              <textarea
                placeholder="How did this feel? Any pain or issues?"
                value={exercise.clientNotes}
                onChange={(e) => onUpdate({ clientNotes: e.target.value })}
                className="w-full bg-background border border-border rounded-sm p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[60px] resize-none"
              />
              <div className="flex items-center bg-background border border-border rounded-sm px-3 h-12">
                <Link size={14} className="text-muted-foreground mr-2 flex-shrink-0" />
                <input
                  type="url"
                  placeholder="Form check video link…"
                  value={exercise.videoUrl}
                  onChange={(e) => onUpdate({ videoUrl: e.target.value })}
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
