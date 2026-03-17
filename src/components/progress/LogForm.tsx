import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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

const LogForm = ({ activeLift, repMax, effectiveUserId, onLogged }: LogFormProps) => {
  const [logWeight, setLogWeight] = useState("");
  const [logReps, setLogReps] = useState("");
  const [logDate, setLogDate] = useState<Date>(new Date());
  const [logging, setLogging] = useState(false);

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
      // Award points for logging a workout
      try {
        await supabase.rpc("award_points", {
          _user_id: effectiveUserId,
          _action: "workout_log",
          _points: 25,
          _description: `Logged ${activeLift}`,
          _reference_id: null,
        });
      } catch (e) { console.error("Points award failed:", e); }
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
          onClick={handleLog}
          disabled={logging}
          className="bg-primary text-primary-foreground px-5 h-9 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
        >
          {logging ? "…" : "Log"}
        </button>
      </div>
    </div>
  );
};

export default LogForm;
