import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Timer, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface GeneratedTimer {
  name: string;
  description: string;
  prep: number;
  work: number;
  rest: number;
  rounds: number;
  warning: number;
  coachTip: string;
}

const QUICK_PROMPTS = [
  "Tabata for fat loss",
  "Boxing round training",
  "HIIT for beginners",
  "Sprint intervals for athletes",
  "Endurance builder 20 rounds",
  "Quick 5-minute finisher",
  "Youth athlete conditioning",
  "Strength rest periods",
];

const AdminAiTimerGenerator = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeneratedTimer[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const generate = async (input: string) => {
    if (!input.trim()) return;
    setLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-timer-generator", {
        body: { prompt: input.trim() },
      });

      if (error) throw error;
      if (data?.timers && Array.isArray(data.timers)) {
        setResults(data.timers);
      } else {
        toast({ title: "No timers generated", description: "Try a more specific prompt.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Timer generation error:", e);
      toast({ title: "Generation failed", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (timer: GeneratedTimer, idx: number) => {
    const text = `${timer.name}\nPrep: ${timer.prep}s | Work: ${timer.work}s | Rest: ${timer.rest}s | Rounds: ${timer.rounds} | Warning: ${timer.warning}s\n${timer.coachTip}`;
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const pushToWorkoutInventory = async (timer: GeneratedTimer) => {
    // Save as a community workout template for the admin
    const { error } = await supabase.from("community_workouts").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      title: `⏱ ${timer.name}`,
      description: `${timer.description}\n\nCoach Tip: ${timer.coachTip}`,
      creator_name: "Coach Matt",
      is_public: true,
      exercises: [
        { title: "Interval Protocol", sets: String(timer.rounds), reps: `${timer.work}s work / ${timer.rest}s rest`, notes: `Prep: ${timer.prep}s · Warning at ${timer.warning}s · ${timer.coachTip}` },
      ],
    });

    if (error) {
      toast({ title: "Save failed", variant: "destructive" });
    } else {
      toast({ title: "Saved to Workout Inventory", description: timer.name });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Timer size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">AI Timer Generator</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Describe a training scenario and AI will generate optimized interval timer configs with coaching notes.
      </p>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp}
            onClick={() => { setPrompt(qp); generate(qp); }}
            className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-muted text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all border border-border"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Custom prompt */}
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate(prompt)}
          placeholder="e.g. 'MMA conditioning for 3-minute rounds'"
          className="flex-1 bg-card border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
        <button
          onClick={() => generate(prompt)}
          disabled={loading || !prompt.trim()}
          className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generate
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 size={16} className="animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Generating timer configs...</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{results.length} Timer{results.length > 1 ? "s" : ""} Generated</span>
          {results.map((timer, i) => (
            <div key={i} className="bg-card border border-border overflow-hidden">
              <div className="p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{timer.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{timer.description}</p>
                </div>

                {/* Config grid */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Prep", value: `${timer.prep}s` },
                    { label: "Work", value: `${timer.work}s` },
                    { label: "Rest", value: `${timer.rest}s` },
                    { label: "Rounds", value: String(timer.rounds) },
                    { label: "Warning", value: `${timer.warning}s` },
                  ].map((item) => (
                    <div key={item.label} className="text-center bg-muted p-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block">{item.label}</span>
                      <span className="text-sm font-mono font-bold text-primary">{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Coach tip */}
                <div className="bg-primary/5 border-l-2 border-primary/40 p-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary block mb-0.5">Coach Tip</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{timer.coachTip}</p>
                </div>

                {/* Total time */}
                <div className="text-[10px] text-muted-foreground font-mono">
                  Total: {Math.floor((timer.prep + timer.rounds * (timer.work + timer.rest)) / 60)}m {(timer.prep + timer.rounds * (timer.work + timer.rest)) % 60}s
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-border px-4 py-2.5 flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(timer, i)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedIdx === i ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  {copiedIdx === i ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => pushToWorkoutInventory(timer)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-colors"
                >
                  <Sparkles size={12} /> Save to Workouts
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAiTimerGenerator;
