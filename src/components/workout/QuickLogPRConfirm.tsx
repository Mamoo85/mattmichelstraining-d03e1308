import { useState } from "react";
import { AlertTriangle, Check, X, Trophy } from "lucide-react";

interface PRCandidate {
  exercise_name: string;
  weight_lbs: number;
  reps: number;
  previous_best: number;
}

interface QuickLogPRConfirmProps {
  candidates: PRCandidate[];
  onConfirm: (confirmed: PRCandidate[]) => void;
  onDismiss: () => void;
}

export default function QuickLogPRConfirm({ candidates, onConfirm, onDismiss }: QuickLogPRConfirmProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set(candidates.map((_, i) => i)));

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-card border border-primary/30 rounded-2xl p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={20} className="text-primary" />
          <h3 className="font-oswald text-lg font-bold uppercase tracking-wider text-foreground">
            New PR Detected!
          </h3>
        </div>
        <p className="text-muted-foreground text-xs mb-4">
          These weights are higher than your current personal records. Confirm the ones that are correct:
        </p>

        <div className="space-y-2 mb-4">
          {candidates.map((c, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                selected.has(i)
                  ? "border-primary/50 bg-primary/10"
                  : "border-muted/30 bg-muted/5 opacity-60"
              }`}
            >
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                selected.has(i) ? "bg-primary text-primary-foreground" : "bg-muted/30"
              }`}>
                {selected.has(i) && <Check size={12} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-foreground">{c.exercise_name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.previous_best > 0
                    ? `${c.previous_best} lbs → ${c.weight_lbs} lbs (+${c.weight_lbs - c.previous_best} lbs)`
                    : `First logged: ${c.weight_lbs} lbs`}
                </div>
              </div>
              <AlertTriangle size={14} className="text-primary shrink-0" />
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl border border-muted/30 text-muted-foreground text-xs font-bold uppercase hover:bg-muted/10 transition-colors"
          >
            Not correct — fix it
          </button>
          <button
            onClick={() => onConfirm(candidates.filter((_, i) => selected.has(i)))}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase hover:bg-primary/90 transition-colors"
          >
            Confirm PR{selected.size > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
