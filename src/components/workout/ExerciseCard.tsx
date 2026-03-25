import { useState, memo, useCallback, useEffect } from "react";
import { Trash2, Plus, Minus, Link, MessageSquare, Lock, Info, Crosshair, Check, MoreHorizontal, Target } from "lucide-react";
import VoiceNoteButton from "./VoiceNoteButton";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTierAccess } from "@/hooks/useTierAccess";
import { EliteUpsellModal } from "@/components/billing/PaywallGate";
import ExerciseVideoEmbed from "@/components/exercise/ExerciseVideoEmbed";
import AnatomyHologram from "./AnatomyHologram";
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
  defaultExpanded?: boolean;
}

interface GhostSet {
  weight: number;
  reps: number;
}

const ExerciseCard = memo(({ exercise, index, onUpdate, onRemove, onOpenFormTracker, onSetCompleted }: ExerciseCardProps) => {
  const { user } = useAuth();
  const [showCoachNotes, setShowCoachNotes] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showHologram, setShowHologram] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { hasAccess: canFlag } = useTierAccess("flag_coach");
  const [ghostData, setGhostData] = useState<GhostSet[]>([]);
  const [completedSets, setCompletedSets] = useState<Set<number>>(new Set());
  const [justPopped, setJustPopped] = useState<number | null>(null);
  const [confettiSet, setConfettiSet] = useState<number | null>(null);

  // Fetch ghost data (previous performance)
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
          setGhostData(sets.map((s: any) => ({ weight: s.weight || 0, reps: s.reps || 0 })));
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
    if (navigator.vibrate) navigator.vibrate(50);
    setJustPopped(setIndex);
    setTimeout(() => setJustPopped(null), 500);
    setCompletedSets(prev => {
      const next = new Set(prev);
      const wasCompleted = next.has(setIndex);
      if (wasCompleted) next.delete(setIndex); else next.add(setIndex);
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
    if (!canFlag) { setShowUpsell(true); return; }
    onUpdate(index, { flagForCoach: checked });
  }, [canFlag, index, onUpdate]);

  return (
    <>
      <div className="bg-transparent border-b border-white/[0.04] py-3">
        {/* ─── MINIMAL HEADER ─── */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowCoachNotes(!showCoachNotes)}
              className="text-muted-foreground/40 hover:text-[hsl(var(--synth-cyan))] transition-colors shrink-0"
              title="Exercise info"
            >
              <Target size={14} />
            </button>
            <span className="text-sm font-bold text-foreground truncate">{exercise.exerciseTitle}</span>
          </div>

          {/* ··· More Options Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors">
                <MoreHorizontal size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1 bg-[#0a0a0a] border border-white/[0.08]">
              {(exercise.exerciseTheWhy || exercise.exerciseVideoUrl) && (
                <button
                  onClick={() => setShowCoachNotes(!showCoachNotes)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-foreground hover:bg-white/[0.04] rounded transition-colors"
                >
                  <Info size={12} /> Coach Notes
                </button>
              )}
              <button
                onClick={() => onOpenFormTracker(exercise.exerciseTitle)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-foreground hover:bg-white/[0.04] rounded transition-colors"
              >
                <Crosshair size={12} /> Form Tracker
              </button>
              <button
                onClick={() => setShowExtras(!showExtras)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-foreground hover:bg-white/[0.04] rounded transition-colors"
              >
                <MessageSquare size={12} /> Notes / Video Link
              </button>
              <div
                className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] rounded transition-colors cursor-pointer"
                onClick={() => !canFlag && setShowUpsell(true)}
              >
                <span className="text-xs text-foreground flex items-center gap-2">
                  {canFlag ? "🏴" : <Lock size={11} className="text-muted-foreground" />}
                  Flag for Coach
                </span>
                <Switch
                  id={`flag-${index}`}
                  checked={exercise.flagForCoach}
                  onCheckedChange={handleFlagToggle}
                  disabled={!canFlag}
                  className="scale-75"
                />
              </div>
              {exercise.sets.length > 1 && (
                <button
                  onClick={removeSet}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-white/[0.04] rounded transition-colors"
                >
                  <Minus size={12} /> Remove Last Set
                </button>
              )}
              <button
                onClick={() => onRemove(index)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
              >
                <Trash2 size={12} /> Delete Exercise
              </button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Coach notes / video panel */}
        {showCoachNotes && (
          <div className="mb-3 space-y-2">
            {exercise.exerciseVideoUrl && (
              <div className="rounded-lg overflow-hidden">
                <ExerciseVideoEmbed videoUrl={exercise.exerciseVideoUrl} exerciseTitle={exercise.exerciseTitle} />
              </div>
            )}
            {exercise.exerciseTheWhy && (
              <div className="bg-primary/5 border border-primary/15 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Info size={10} className="text-primary" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Coach's Notes</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{exercise.exerciseTheWhy}</p>
              </div>
            )}
          </div>
        )}

        {/* Notes / Form Check inline */}
        {showExtras && (
          <div className="mb-3 space-y-1.5">
            <div className="relative">
              <textarea
                placeholder="How did this feel? Any pain or issues?"
                value={exercise.clientNotes}
                onChange={(e) => onUpdate(index, { clientNotes: e.target.value })}
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 pr-10 text-xs text-foreground placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-[hsl(var(--synth-cyan))]/30 outline-none min-h-[56px] resize-none transition-all"
              />
              <VoiceNoteButton
                onTranscript={(t) => onUpdate(index, { clientNotes: (exercise.clientNotes ? exercise.clientNotes + " " : "") + t })}
                className="absolute top-2 right-2"
              />
            </div>
            <div className="flex items-center bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 h-9">
              <Link size={12} className="text-muted-foreground mr-2 flex-shrink-0" />
              <input
                type="url"
                placeholder="Form check video link…"
                value={exercise.videoUrl}
                onChange={(e) => onUpdate(index, { videoUrl: e.target.value })}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
            </div>
          </div>
        )}

        {/* ─── SPREADSHEET HEADER ─── */}
        <div className="grid grid-cols-[2rem_1fr_4rem_4rem_3rem] gap-2 items-center mb-1 px-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 text-center">SET</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">PREVIOUS</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 text-center">LBS</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 text-center">REPS</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 text-center">
            <Check size={10} className="mx-auto" />
          </span>
        </div>

        {/* ─── SET ROWS ─── */}
        {exercise.sets.map((s, si) => {
          const ghost = ghostData[si];
          const isCompleted = completedSets.has(si) || (s.weight > 0 && s.reps > 0);
          return (
            <div
              key={si}
              className="grid grid-cols-[2rem_1fr_4rem_4rem_3rem] gap-2 items-center mb-1 px-0.5"
            >
              {/* Set # */}
              <span className="text-xs font-mono text-muted-foreground/40 text-center">{s.set}</span>

              {/* Ghost / Previous */}
              <span className="text-[10px] text-muted-foreground/40 font-mono truncate">
                {ghost ? `${ghost.weight} × ${ghost.reps}` : "—"}
              </span>

              {/* Weight input */}
              <input
                type="number"
                inputMode="decimal"
                value={s.weight || ""}
                onChange={(e) => updateSet(si, "weight", parseInt(e.target.value) || 0)}
                placeholder={ghost?.weight ? String(ghost.weight) : "0"}
                className="h-12 bg-white/[0.03] border-none rounded-md text-center font-mono text-base text-foreground w-full outline-none placeholder:text-muted-foreground/20 focus:ring-1 focus:ring-[hsl(var(--synth-cyan))] transition-all"
              />

              {/* Reps input */}
              <input
                type="number"
                inputMode="decimal"
                value={s.reps || ""}
                onChange={(e) => updateSet(si, "reps", parseInt(e.target.value) || 0)}
                placeholder={ghost?.reps ? String(ghost.reps) : "0"}
                className="h-12 bg-white/[0.03] border-none rounded-md text-center font-mono text-base text-foreground w-full outline-none placeholder:text-muted-foreground/20 focus:ring-1 focus:ring-[hsl(var(--synth-cyan))] transition-all"
              />

              {/* Checkmark */}
              <div className="relative flex items-center justify-center">
                <button
                  onClick={() => completeSet(si)}
                  className={cn(
                    "h-10 w-10 flex items-center justify-center rounded-md transition-all duration-200",
                    justPopped === si && "animate-set-pop",
                    isCompleted
                      ? "bg-[hsl(var(--synth-cyan))] text-black shadow-[var(--synth-glow-cyan)]"
                      : "bg-white/[0.03] text-white/20 hover:text-white/40"
                  )}
                >
                  <Check size={16} strokeWidth={isCompleted ? 3 : 2} />
                </button>
                {confettiSet === si && (
                  <span className="absolute inset-0 pointer-events-none" aria-hidden>
                    {Array.from({ length: 20 }).map((_, i) => {
                      const angle = (i / 20) * 360;
                      const dist = 18 + Math.random() * 14;
                      const x = Math.cos((angle * Math.PI) / 180) * dist;
                      const y = Math.sin((angle * Math.PI) / 180) * dist;
                      const colors = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7"];
                      return (
                        <span
                          key={i}
                          className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full animate-confetti-burst"
                          style={{
                            "--confetti-x": `${x}px`,
                            "--confetti-y": `${y}px`,
                            "--confetti-r": `${Math.random() * 360}deg`,
                            backgroundColor: colors[i % colors.length],
                            marginLeft: -3,
                            marginTop: -3,
                          } as React.CSSProperties}
                        />
                      );
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* ─── ADD SET ─── */}
        <button
          onClick={addSet}
          className="mt-2 text-xs font-medium text-[hsl(var(--synth-cyan))] opacity-70 hover:opacity-100 transition-opacity"
        >
          + Add Set
        </button>
      </div>

      <EliteUpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} />
    </>
  );
});

ExerciseCard.displayName = "ExerciseCard";

export default ExerciseCard;
