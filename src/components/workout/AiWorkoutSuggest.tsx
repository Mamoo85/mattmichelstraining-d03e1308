import { useState, memo } from "react";
import { Sparkles, Loader2, Dumbbell, Play, Save, Share2, ArrowLeft, Wrench, Printer, Timer, Minus, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import GymPhotoUpload from "@/components/generator/GymPhotoUpload";
import { motion, AnimatePresence } from "framer-motion";
import { printCommunityWorkout } from "./printCommunityWorkout";

interface GeneratedExercise {
  title: string;
  sets: string;
  reps: string;
  notes?: string;
  phase?: string;
  exerciseId?: string;
}

interface TimerConfigData {
  work: number;
  rest: number;
  rounds: number;
  prep: number;
}

interface GeneratedWorkout {
  title: string;
  description: string;
  exercises: GeneratedExercise[];
  isTimedCircuit?: boolean;
  timerConfig?: TimerConfigData;
}

type Path = null | "workout" | "fixit";

const AiWorkoutSuggest = memo(({ onDone, initialPath }: { onDone: () => void; initialPath?: "workout" | "fixit" }) => {
  const { user } = useAuth();
  const [path, setPath] = useState<Path>(initialPath ?? null);
  const [userText, setUserText] = useState("");
  const [gymImageBase64, setGymImageBase64] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [saving, setSaving] = useState(false);
  const [shareToBank, setShareToBank] = useState(false);
  const [editTimerConfig, setEditTimerConfig] = useState<TimerConfigData | null>(null);

  const handleGenerate = async () => {
    if (!userText.trim()) return;
    setGenerating(true);
    setWorkout(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-workout-suggest", {
        body: {
          mode: "dual-path",
          path,
          userText: userText.trim(),
          gymImageBase64: gymImageBase64 || undefined,
        },
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

  const handleBack = () => {
    setPath(null);
    setUserText("");
    setGymImageBase64(null);
  };

  const phaseColors: Record<string, string> = {
    "Rolling/Soft Tissue": "bg-blue-500/20 text-blue-300",
    "Tissue Release": "bg-blue-500/20 text-blue-300",
    "Dynamic Warmup": "bg-amber-500/20 text-amber-300",
    Mobility: "bg-amber-500/20 text-amber-300",
    "Main Work": "bg-primary/20 text-primary",
    "Isometric Loading": "bg-primary/20 text-primary",
    "Isometric/Corrective Loading": "bg-primary/20 text-primary",
    "Finisher/Conditioning": "bg-red-500/20 text-red-300",
    Cooldown: "bg-green-500/20 text-green-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
            {path === "fixit" ? "Fix It Engine" : "AI Workout Builder"}
          </h3>
        </div>
        <button onClick={onDone} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Close
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!workout ? (
          <motion.div
            key={path ?? "fork"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-3"
          >
            {/* === FORK === */}
            {path === null && (
              <div className="space-y-2">
                <button
                  onClick={() => setPath("workout")}
                  className="w-full bg-card border-2 border-border hover:border-primary p-5 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🏋️‍♂️</span>
                    <div>
                      <p className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Build a Workout
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Custom program from your goals, equipment, and experience.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPath("fixit")}
                  className="w-full bg-card border-2 border-border hover:border-[hsl(var(--accent))] p-5 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🩹</span>
                    <div>
                      <p className="text-sm font-black text-foreground group-hover:text-[hsl(270_60%_60%)] transition-colors">
                        Fix a Pain Point
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Describe your pain — get a corrective rehab protocol.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* === INPUT FORM === */}
            {path !== null && (
              <div className="space-y-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                >
                  <ArrowLeft size={12} /> Choose different path
                </button>

                {path === "workout" && (
                  <>
                    <GymPhotoUpload onImageChange={setGymImageBase64} />
                    <Textarea
                      value={userText}
                      onChange={(e) => setUserText(e.target.value)}
                      placeholder="Tell me about yourself. (e.g., I'm 35, been lifting for a year, want to get stronger, and I only have 3 days a week with dumbbells and a bench.)"
                      className="min-h-[100px] bg-background border-border text-sm"
                    />
                  </>
                )}

                {path === "fixit" && (
                  <Textarea
                    value={userText}
                    onChange={(e) => setUserText(e.target.value)}
                    placeholder="Where does it hurt and when does it happen? (e.g., My lower back tightens up during heavy squats, or my right shoulder hurts when I press overhead.)"
                    className="min-h-[100px] bg-background border-border text-sm"
                  />
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generating || !userText.trim()}
                  className="w-full h-12 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {generating ? (
                    <><Loader2 size={14} className="animate-spin" /> {path === "fixit" ? "Building Protocol…" : "Building Program…"}</>
                  ) : (
                    <>
                      {path === "fixit" ? <Wrench size={14} /> : <Sparkles size={14} />}
                      {path === "fixit" ? "Generate Rehab Protocol" : "Generate Program"}
                    </>
                  )}
                </button>

                <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
                  Powered by Coach Matt's 20 years of sports-science data. No generic internet fluff.
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Generated workout preview */}
            <div className="bg-card border border-border p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Dumbbell size={16} className="text-primary" />
                  <h4 className="text-base font-bold text-foreground">{workout.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground">{workout.description}</p>
              </div>

              <div className="space-y-1.5">
                {workout.exercises.map((ex, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs bg-muted/30 p-2">
                    <span className="text-primary font-mono font-bold w-5 text-right shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground">{ex.title}</span>
                        {ex.phase && (
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${phaseColors[ex.phase] || "bg-muted text-muted-foreground"}`}>
                            {ex.phase}
                          </span>
                        )}
                      </div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

AiWorkoutSuggest.displayName = "AiWorkoutSuggest";

export default AiWorkoutSuggest;