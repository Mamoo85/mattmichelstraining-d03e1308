import { useState, useCallback, useRef } from "react";
import { Send, Loader2, Mic, MicOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

const QuickLogBar = ({ exercises, onApplyParsed }: QuickLogBarProps) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
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

      onApplyParsed(sets);
      setText("");
      toast.success(`Parsed ${sets.length} set${sets.length > 1 ? "s" : ""} — check your exercises`);
    } catch (e: any) {
      console.error("Quick Log parse error:", e);
      toast.error(e?.message || "Failed to parse. Try again.");
    } finally {
      setLoading(false);
    }
  }, [text, loading, onApplyParsed]);

  return (
    <div className="flex items-center gap-2 bg-card/80 backdrop-blur-xl border border-white/[0.08] rounded-full px-3 py-2 max-w-lg mx-auto w-full shadow-lg">
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
        placeholder='e.g. "225 for 8 reps"'
        className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
        disabled={loading}
      />

      {/* Clear */}
      {text && !loading && (
        <button
          type="button"
          onClick={() => setText("")}
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
  );
};

export default QuickLogBar;
