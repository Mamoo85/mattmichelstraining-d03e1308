import { useState, useCallback, useRef } from "react";
import { Send, Loader2, Mic, MicOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ALL_LIFTS } from "@/components/progress/liftConfig";
import { usePoints } from "@/hooks/usePoints";
import PRCelebration from "@/components/gamification/PRCelebration";
import QuickLogPRConfirm from "./QuickLogPRConfirm";
import type { LoggedExerciseData } from "./WorkoutLogger";

interface ParsedSet {
  exercise_name: string;
  weight_lbs: number;
  reps: number;
  rpe: number;
}

interface QuickLogBarProps {
  exercises: LoggedExerciseData[];
  onApplyParsed: (sets: ParsedSet[]) => void;
}

// Fuzzy match parsed exercise name to a progress lift
function matchProgressLift(parsedName: string): string | null {
  const lower = parsedName.toLowerCase().trim();
  if (!lower) return null;
  for (const lift of ALL_LIFTS) {
    const liftLower = lift.name.toLowerCase();
    if (lower === liftLower || lower.includes(liftLower) || liftLower.includes(lower)) {
      return lift.name;
    }
  }
  return null;
}

const QuickLogBar = ({ exercises, onApplyParsed }: QuickLogBarProps) => {
  const { user } = useAuth();
  const { awardPoints } = usePoints();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [prCandidates, setPrCandidates] = useState<Array<{
    exercise_name: string;
    weight_lbs: number;
    reps: number;
    previous_best: number;
  }> | null>(null);
  const [pendingSets, setPendingSets] = useState<ParsedSet[] | null>(null);
  const [prCelebration, setPrCelebration] = useState<{
    exerciseName: string;
    newWeight: number;
    previousBest: number;
    reps?: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const speechSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleMic = useCallback(() => {
    if (!speechSupported) return;
    if (listening) { setListening(false); return; }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setText((prev) => (prev ? prev + " " + transcript : transcript));
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, speechSupported]);

  // Check parsed sets against progress_logs for PR detection
  const checkForPRs = useCallback(async (sets: ParsedSet[]): Promise<boolean> => {
    if (!user) return false;
    const candidates: Array<{
      exercise_name: string;
      weight_lbs: number;
      reps: number;
      previous_best: number;
    }> = [];

    for (const s of sets) {
      const liftName = matchProgressLift(s.exercise_name);
      if (!liftName || s.weight_lbs <= 0) continue;

      try {
        const { data } = await supabase
          .from("progress_logs")
          .select("weight")
          .eq("user_id", user.id)
          .eq("exercise_name", liftName)
          .order("weight", { ascending: false })
          .limit(1);

        const prevBest = data?.[0]?.weight || 0;
        if (s.weight_lbs > prevBest) {
          candidates.push({
            exercise_name: liftName,
            weight_lbs: s.weight_lbs,
            reps: s.reps,
            previous_best: prevBest,
          });
        }
      } catch (err) {
        console.error("PR check error:", err);
      }
    }

    if (candidates.length > 0) {
      setPrCandidates(candidates);
      setPendingSets(sets);
      return true;
    }
    return false;
  }, [user]);

  const handlePRConfirm = useCallback(async (confirmed: Array<{
    exercise_name: string;
    weight_lbs: number;
    reps: number;
    previous_best: number;
  }>) => {
    if (!user || !pendingSets) return;

    // Apply the parsed sets to exercises
    onApplyParsed(pendingSets);

    // Insert confirmed PRs into progress_logs
    for (const pr of confirmed) {
      try {
        await supabase.from("progress_logs").insert({
          user_id: user.id,
          exercise_name: pr.exercise_name,
          weight: pr.weight_lbs,
          reps: pr.reps,
        } as any);
      } catch (err) {
        console.error("PR insert error:", err);
      }
    }

    toast.success(`${confirmed.length} PR${confirmed.length > 1 ? "s" : ""} logged! 🏆`);
    setPrCandidates(null);
    setPendingSets(null);
    setText("");
  }, [user, pendingSets, onApplyParsed]);

  const handlePRDismiss = useCallback(() => {
    // User said "not correct" — don't apply sets, let them re-enter
    setPrCandidates(null);
    setPendingSets(null);
    toast.info("No worries — fix the input and try again.");
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-workout-text", {
        body: { text: trimmed },
      });
      if (error) throw error;

      const sets: ParsedSet[] = data?.sets;
      if (!sets || sets.length === 0) {
        toast.error("Couldn't parse any sets from that. Try something like '225 for 8 reps'.");
        return;
      }

      // Check for PRs before applying
      const hasPRs = await checkForPRs(sets);
      if (!hasPRs) {
        // No PRs detected — apply immediately
        onApplyParsed(sets);
        setText("");
        toast.success(`Parsed ${sets.length} set${sets.length > 1 ? "s" : ""} — check your exercises`);
      }
      // If PRs detected, the confirmation modal will handle apply
    } catch (e: any) {
      console.error("Quick Log parse error:", e);
      toast.error(e?.message || "Failed to parse. Try again.");
    } finally {
      setLoading(false);
    }
  }, [text, loading, onApplyParsed, checkForPRs]);

  return (
    <>
      <div className="flex items-center gap-2 bg-card/80 backdrop-blur-xl border border-white/[0.08] rounded-full px-3 py-2 w-full shadow-lg">
        {/* Mic button */}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleMic}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-full transition-all shrink-0",
              listening
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            title={listening ? "Stop recording" : "Voice input"}
          >
            {listening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder='e.g. "squat 315 for 3"'
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
          disabled={loading}
        />

        {/* Clear */}
        {text && !loading && (
          <button
            type="button"
            onClick={() => setText("")}
            className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
          >
            <X size={12} />
          </button>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          className={cn(
            "h-9 w-9 flex items-center justify-center rounded-full transition-all shrink-0",
            text.trim() && !loading
              ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
              : "text-muted-foreground/40"
          )}
          title="Parse & auto-fill"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {/* PR Confirmation Modal */}
      {prCandidates && prCandidates.length > 0 && (
        <QuickLogPRConfirm
          candidates={prCandidates}
          onConfirm={handlePRConfirm}
          onDismiss={handlePRDismiss}
        />
      )}
    </>
  );
};

export default QuickLogBar;
