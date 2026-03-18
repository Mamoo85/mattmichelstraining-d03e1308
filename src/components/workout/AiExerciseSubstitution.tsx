import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubstitute = async () => {
    if (!reason) {
      toast({ title: "Select a reason", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-athlete-assist", {
        body: {
          type: "exercise_substitution",
          context: { exerciseName, reason, availableEquipment, injuryNotes },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.queued) {
        setResult("✅ Your substitution request has been submitted for Coach Matt's review. You'll get a notification when it's ready.");
      } else {
        setResult(data.result);
      }
    } catch (e: any) {
      toast({ title: "Substitution failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        )}
      </div>

      {!result ? (
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

          <button onClick={handleSubstitute} disabled={loading}
            className="w-full bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loading ? "Finding alternatives…" : "Find Substitutes"}
          </button>
        </>
      ) : (
        <div>
          <div className="prose prose-sm max-w-none text-foreground text-xs leading-relaxed">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
          <button onClick={() => setResult(null)}
            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-m2 mt-2">
            ← Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default AiExerciseSubstitution;
