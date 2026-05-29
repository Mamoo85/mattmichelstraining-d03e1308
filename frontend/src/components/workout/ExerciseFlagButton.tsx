import { useState } from "react";
import { Flag, Loader2, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface ExerciseFlagButtonProps {
  protocolExerciseId: string;
  exerciseName: string;
}

const ExerciseFlagButton = ({ protocolExerciseId, exerciseName }: ExerciseFlagButtonProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !question.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("protocol_exercise_flags").insert({
        protocol_exercise_id: protocolExerciseId,
        user_id: user.id,
        question: question.trim(),
      });
      if (error) throw error;
      toast({ title: "Question sent to Coach Matt" });
      setQuestion("");
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        title="Ask Coach Matt about this exercise"
      >
        <Flag size={12} /> Ask Coach
      </button>
    );
  }

  return (
    <div className="bg-muted/50 border border-border p-3 space-y-2 mt-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
          Ask about: {exerciseName}
        </span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X size={12} />
        </button>
      </div>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. Is there a modification for this if I have a bad shoulder?"
        className="w-full bg-background border border-border px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none h-16 resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!question.trim() || submitting}
        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        Send to Coach Matt
      </button>
    </div>
  );
};

export default ExerciseFlagButton;
