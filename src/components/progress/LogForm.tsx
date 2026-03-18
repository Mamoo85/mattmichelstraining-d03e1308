import { useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LogFormProps {
  activeLift: string;
  repMax: number;
  effectiveUserId: string;
  onLogged: () => Promise<void>;
}

// Parse spoken text like "225 for 8" or "set one 225 pounds for eight reps"
function parseSpokenSet(text: string): { weight?: string; reps?: string } {
  const lower = text.toLowerCase().replace(/,/g, "");

  // Word-to-number map for common spoken numbers
  const wordNums: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
    eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
    sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  };

  // Replace word numbers with digits
  let normalized = lower;
  for (const [word, num] of Object.entries(wordNums)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }

  // Extract all numbers
  const nums = normalized.match(/\d+\.?\d*/g);
  if (!nums || nums.length === 0) return {};

  // Pattern: "[weight] (lbs/pounds) (for/x/times) [reps] (reps)"
  // First number is weight, second is reps
  let weight = nums[0];
  let reps = nums.length > 1 ? nums[nums.length > 2 ? nums.length - 1 : 1] : undefined;

  // If "reps" or "rep" appears right after first number, swap
  if (normalized.match(new RegExp(`${nums[0]}\\s*(reps?|rep)\\b`)) && nums.length > 1) {
    reps = nums[0];
    weight = nums[1];
  }

  return { weight, reps };
}

const LogForm = ({ activeLift, repMax, effectiveUserId, onLogged }: LogFormProps) => {
  const [logWeight, setLogWeight] = useState("");
  const [logReps, setLogReps] = useState("");
  const [logDate, setLogDate] = useState<Date>(new Date());
  const [logging, setLogging] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Speech not supported", description: "Use Chrome or Safari for voice logging.", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const parsed = parseSpokenSet(transcript);

      if (parsed.weight) setLogWeight(parsed.weight);
      if (parsed.reps) setLogReps(parsed.reps);

      const parts = [];
      if (parsed.weight) parts.push(`${parsed.weight} lbs`);
      if (parsed.reps) parts.push(`${parsed.reps} reps`);

      toast({
        title: parts.length > 0 ? `Got it: ${parts.join(" × ")}` : "Couldn't parse that",
        description: `Heard: "${transcript}"`,
      });
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        toast({ title: "Mic error", description: event.error, variant: "destructive" });
      }
    };

    recognition.onend = () => setListening(false);
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleLog = async () => {
    const weight = parseFloat(logWeight);
    const reps = parseInt(logReps) || repMax;
    if (!weight || weight <= 0) {
      toast({ title: "Enter a valid weight", variant: "destructive" });
      return;
    }
    setLogging(true);
    const estimated1rm = Math.round(weight * (1 + reps / 30));

    const { error } = await supabase.from("progress_logs").insert({
      user_id: effectiveUserId,
      exercise_name: activeLift,
      weight,
      reps,
      estimated_1rm: estimated1rm,
      logged_at: logDate.toISOString(),
    });

    if (error) {
      toast({ title: "Failed to log", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Logged +25 pts", description: `${activeLift}: ${weight} lbs × ${reps}` });
      try {
        await supabase.rpc("award_points", {
          _user_id: effectiveUserId,
          _action: "workout_log",
          _points: 25,
          _description: `Logged ${activeLift}`,
          _reference_id: null,
        });
      } catch { /* silent */ }
      setLogWeight("");
      setLogReps("");
      await onLogged();
    }
    setLogging(false);
  };

  return (
    <div className="mt-4 mb-4 p-4 bg-card border border-border">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
        Log {activeLift}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 w-[130px] justify-start text-left font-mono text-sm px-2",
                !logDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
              {format(logDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={logDate}
              onSelect={(d) => d && setLogDate(d)}
              disabled={(d) => d > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <input
          type="number"
          placeholder="Weight (lbs)"
          value={logWeight}
          onChange={(e) => setLogWeight(e.target.value)}
          className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-9 w-28"
        />
        <input
          type="number"
          placeholder={`Reps (${repMax})`}
          value={logReps}
          onChange={(e) => setLogReps(e.target.value)}
          className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-9 w-20"
        />
        <button
          onPointerDown={startListening}
          onPointerUp={stopListening}
          onPointerLeave={stopListening}
          className={cn(
            "h-9 w-9 flex items-center justify-center border transition-all",
            listening
              ? "bg-primary text-primary-foreground border-primary animate-pulse"
              : "bg-muted text-muted-foreground border-border hover:text-primary hover:border-primary"
          )}
          title="Hold to speak — e.g. '225 for 8'"
        >
          <Mic size={14} />
        </button>
        <button
          onClick={handleLog}
          disabled={logging}
          className="bg-primary text-primary-foreground px-5 h-9 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
        >
          {logging ? "…" : "Log"}
        </button>
      </div>
      {listening && (
        <p className="text-[10px] text-primary mt-2 animate-pulse">
          🎙️ Listening… say something like "225 for 8 reps"
        </p>
      )}
    </div>
  );
};

export default LogForm;
