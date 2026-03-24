import { useState, memo } from "react";
import { Sparkles, Loader2, Play, RefreshCw, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import m2Logo from "@/assets/m2-logo.jpg";

interface GeneratedExercise {
  title: string;
  sets: string;
  reps: string;
  notes?: string;
  exerciseId?: string;
}

interface GeneratedWorkout {
  title: string;
  description: string;
  exercises: GeneratedExercise[];
}

interface OpenWorkoutAIProps {
  onStart: (workout: GeneratedWorkout) => void;
  onSkip: () => void;
  onBack: () => void;
}

const OpenWorkoutAI = memo(({ onStart, onSkip, onBack }: OpenWorkoutAIProps) => {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Tell Coach Matt how you're feeling today.");
      return;
    }
    setGenerating(true);
    setWorkout(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-workout-suggest", {
        body: { prompt: prompt.trim(), mode: "open-workout" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWorkout(data);
    } catch (e: any) {
      if (e.message?.includes("429") || e.message?.includes("Rate")) {
        toast.error("High demand — try again in a moment.");
      } else {
        toast.error(e.message || "Generation failed");
      }
    }
    setGenerating(false);
  };

  const handleStart = () => {
    if (workout) onStart(workout);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <header className="shrink-0 px-4 py-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-3">
          <img src={m2Logo} alt="M²" className="h-8 w-8 rounded-full object-cover" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest text-primary">
              Open Workout
            </h1>
            <p className="text-[10px] text-muted-foreground">Powered by Coach Matt's AI</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-24">
        {!workout ? (
          <>
            <div className="bg-card/60 border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                  Check-In
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Just like in a real session — tell me how you're feeling. Anything sore or tight?
                What do you want to work on today? I'll build a workout around it.
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. My lower back is a little tight from sitting all day. I want to get a solid squat session in and hit some upper body too. I've got about 45 minutes."
                className="w-full bg-background border border-white/[0.08] rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/40 outline-none min-h-[120px] resize-none"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="w-full h-14 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
            >
              {generating ? (
                <><Loader2 size={16} className="animate-spin" /> Building Your Workout…</>
              ) : (
                <><Sparkles size={16} /> Build Today's Workout</>
              )}
            </button>

            <button
              onClick={onSkip}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Skip — I'll build my own
            </button>
          </>
        ) : (
          <>
            {/* Generated workout preview */}
            <div className="bg-card border border-primary/20 rounded-2xl overflow-hidden">
              <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
                  Today's Workout
                </span>
                <h3 className="text-base font-bold text-foreground">{workout.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{workout.description}</p>
              </div>

              <div className="p-4 space-y-1.5">
                {workout.exercises.map((ex, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs bg-muted/20 rounded-lg p-2.5">
                    <span className="text-primary font-mono font-bold w-5 text-right shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-foreground block">{ex.title}</span>
                      {ex.notes && (
                        <span className="text-muted-foreground text-[10px]">{ex.notes}</span>
                      )}
                    </div>
                    <span className="font-mono text-primary shrink-0 font-bold">
                      {ex.sets}×{ex.reps}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="h-14 border-2 border-border text-muted-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest rounded-xl hover:border-primary/40 hover:text-foreground transition-all disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Refresh
              </button>
              <button
                onClick={handleStart}
                className="h-14 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              >
                <Play size={14} /> Start
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
});

OpenWorkoutAI.displayName = "OpenWorkoutAI";

export default OpenWorkoutAI;
