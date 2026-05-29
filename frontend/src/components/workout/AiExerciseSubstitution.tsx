import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, StopCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAiStream } from "@/hooks/useAiStream";
import ReactMarkdown from "react-markdown";

interface AiExerciseSubstitutionProps {
  exerciseName: string;
  onClose?: () => void;
}

const REASONS = [
  "Don't have the equipment",
  "Injury/pain prevents this movement",
  "Need an easier variation",
  "Need a harder variation",
  "Prefer a different movement pattern",
];

const EQUIPMENT_OPTIONS = [
  "Full gym",
  "Dumbbells only",
  "Bodyweight only",
  "Resistance bands",
  "Barbell + rack",
  "Kettlebells",
];

const AiExerciseSubstitution = ({ exerciseName, onClose }: AiExerciseSubstitutionProps) => {
  const [reason, setReason] = useState("");
  const [availableEquipment, setAvailableEquipment] = useState("");
  const [injuryNotes, setInjuryNotes] = useState("");

  const { stream, streaming, content, error, abort, reset } = useAiStream({
    functionName: "ai-athlete-stream",
  });

  const handleSubstitute = async () => {
    if (!reason) {
      toast({ title: "Select a reason", variant: "destructive" });
      return;
    }
    reset();
    await stream({
      type: "exercise_substitution",
      context: { exerciseName, reason, availableEquipment, injuryNotes },
    });
  };

  return (
    <div className="border border-primary/20 bg-primary/5 p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Find a Substitute for "{exerciseName}"
          </span>
        </div>
        <div className="flex items-center gap-2">
          {streaming && (
            <button onClick={abort} className="text-destructive hover:text-destructive/80 text-xs">
              <StopCircle size={14} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          )}
        </div>
      </div>

      {!content && !streaming ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Reason *</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full bg-background border border-border px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select...</option>
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Equipment</label>
              <select value={availableEquipment} onChange={(e) => setAvailableEquipment(e.target.value)}
                className="w-full bg-background border border-border px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="">What you have...</option>
                {EQUIPMENT_OPTIONS.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {(reason === "Injury/pain prevents this movement") && (
            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Injury Details</label>
              <input type="text" value={injuryNotes} onChange={(e) => setInjuryNotes(e.target.value)}
                placeholder="e.g., Left knee pain when squatting deep"
                className="w-full bg-background border border-border px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
          )}

          <button onClick={handleSubstitute} disabled={streaming}
            className="w-full bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center justify-center gap-2 disabled:opacity-50">
            <Sparkles size={12} />
            Find Substitutes
          </button>
        </>
      ) : (
        <div>
          <div className="prose prose-sm max-w-none text-foreground text-xs leading-relaxed">
            <ReactMarkdown>{content}</ReactMarkdown>
            {streaming && (
              <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 p-3 mt-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          {!streaming && (
            <button onClick={() => { reset(); setReason(""); }}
              className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-m2 mt-2">
              ← Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AiExerciseSubstitution;
