import { useState, memo } from "react";
import { Sparkles, Loader2, Dumbbell, Play, Save, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { printCommunityWorkout } from "./printCommunityWorkout";

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

const AUDIENCE_OPTIONS = [
  { label: "Middle School", value: "middle school athletes (ages 11-14)" },
  { label: "High School", value: "high school athletes (ages 14-18)" },
  { label: "Adult Fitness", value: "adults looking to get fit" },
  { label: "Sport-Specific", value: "sport-specific conditioning" },
];

const STYLE_OPTIONS = [
  { label: "Strength", value: "strength focused with compound lifts" },
  { label: "Conditioning", value: "high-energy conditioning circuit" },
  { label: "Full Body", value: "balanced full body workout" },
  { label: "Fun & Games", value: "fun challenge-style with variety" },
];

const AiWorkoutSuggest = memo(({ onDone }: { onDone: () => void }) => {
  const { user } = useAuth();
  const [audience, setAudience] = useState(AUDIENCE_OPTIONS[0].value);
  const [style, setStyle] = useState(STYLE_OPTIONS[0].value);
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [saving, setSaving] = useState(false);
  const [shareToBank, setShareToBank] = useState(true);

  const handleGenerate = async () => {
    setGenerating(true);
    setWorkout(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-workout-suggest", {
        body: { goal: goal || "get stronger", audience, style },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWorkout(data);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!user || !workout) return;
    setSaving(true);
    const exerciseData = workout.exercises.map((e, i) => ({
      exerciseId: e.exerciseId || "",
      title: e.title,
      sets: e.sets,
      reps: e.reps,
      notes: e.notes || "",
      order: i,
    }));

    const { error } = await supabase.from("community_workouts").insert({
      user_id: user.id,
      title: workout.title,
      description: workout.description,
      creator_name: "Coach Matt AI",
      exercises: exerciseData as any,
      is_public: shareToBank,
    });

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: shareToBank ? "Shared to bank! 🎉 +30 M² Points" : "Saved! 💪" });
      onDone();
    }
    setSaving(false);
  };

  const handleStart = () => {
    if (!workout) return;
    window.dispatchEvent(
      new CustomEvent("open-workout-zone", {
        detail: {
          title: workout.title,
          source: "ai-suggest",
          exercises: workout.exercises.map((ex) => ({
            exerciseTitle: ex.title,
            prescribedSets: parseInt(ex.sets) || 3,
            prescribedReps: parseInt(ex.reps) || 10,
            notes: ex.notes,
          })),
        },
      })
    );
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Smart Workout Builder</h3>
        </div>
        <button onClick={onDone} className="text-xs text-muted-foreground hover:text-foreground">Back</button>
      </div>

      {!workout ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tell us who it's for and what vibe you want — Coach Matt's system builds it from the M² exercise library.
          </p>

          {/* Audience */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Who's it for?</label>
            <div className="grid grid-cols-2 gap-1.5">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAudience(opt.value)}
                  className={`p-2.5 text-xs font-bold uppercase tracking-widest transition-all border ${
                    audience === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Style</label>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStyle(opt.value)}
                  className={`p-2.5 text-xs font-bold uppercase tracking-widest transition-all border ${
                    style === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Goal (optional)</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. improve speed, build upper body, game day prep…"
              className="w-full bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full h-12 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
          >
            {generating ? (
              <><Loader2 size={14} className="animate-spin" /> Building Workout…</>
            ) : (
              <><Sparkles size={14} /> Generate Workout</>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Generated workout preview */}
          <div className="bg-card border border-border p-4 space-y-3">
            <div>
              <h4 className="text-base font-bold text-foreground">{workout.title}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{workout.description}</p>
            </div>

            <div className="space-y-1.5">
              {workout.exercises.map((ex, i) => (
                <div key={i} className="flex items-start gap-3 text-xs bg-muted/30 p-2">
                  <span className="text-primary font-mono font-bold w-5 text-right shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-foreground block">{ex.title}</span>
                    {ex.notes && <span className="text-muted-foreground text-[10px]">{ex.notes}</span>}
                  </div>
                  <span className="font-mono text-primary shrink-0">{ex.sets}×{ex.reps}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regenerate */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full h-10 border border-border text-muted-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:border-primary/40 hover:text-foreground transition-all disabled:opacity-50"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Regenerate
          </button>

          {/* Share toggle */}
          <div className="flex items-center gap-3 bg-muted p-3">
            <Share2 size={14} className={shareToBank ? "text-primary" : "text-muted-foreground"} />
            <div className="flex-1">
              <span className="text-xs font-bold text-foreground block">Share to Workout Bank</span>
              <span className="text-[10px] text-muted-foreground">+30 M² Points when shared</span>
            </div>
            <button
              onClick={() => setShareToBank(!shareToBank)}
              className={`w-10 h-5 rounded-full transition-all relative ${shareToBank ? "bg-primary" : "bg-border"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${shareToBank ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-12 bg-muted text-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-muted/80 transition-all disabled:opacity-50"
            >
              <Save size={14} /> {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleStart}
              className="h-12 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <Play size={14} /> Start Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

AiWorkoutSuggest.displayName = "AiWorkoutSuggest";

export default AiWorkoutSuggest;
