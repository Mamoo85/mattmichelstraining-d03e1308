import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, Upload, Trash2, Dumbbell, ChevronDown, ChevronUp, Plus, Timer, Flame, Target, Zap,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import SectionHeader from "@/components/SectionHeader";

interface WorkoutExercise {
  name: string;
  phase: "rolling" | "warmup" | "main" | "finisher" | "cooldown";
  sets?: number;
  reps: string;
  rest?: string;
  tempo?: string;
  notes?: string;
  the_why?: string;
  coaching_reference?: string;
}

interface GeneratedWorkout {
  title: string;
  description: string;
  target_audience: string;
  estimated_duration?: string;
  intensity_level?: string;
  exercises: WorkoutExercise[];
}

const STYLES = [
  "Traditional Strength", "EMOM", "AMRAP", "HIIT", "Core Circuit",
  "CrossFit/Metcon", "Active Recovery", "Complexes", "Contrast Training", "Density Block",
];
const EQUIPMENT = [
  "Full Gym", "Dumbbells/Kettlebells Only", "Bodyweight Only",
  "Barbell + Rack", "Resistance Bands", "Minimal (DB + Band)",
];
const AUDIENCES = [
  "Youth Athlete (11-13)", "Youth Athlete (14-15)", "Youth Athlete (16-17)",
  "Adult/Parent Foundation", "Competitive Athlete", "General Fitness",
];
const DURATIONS = ["20-30 min", "30-45 min", "45-60 min", "60-75 min", "75-90 min"];
const INTENSITIES = ["Low", "Moderate", "High", "Max"];
const FOCUS_OPTIONS = [
  "Upper Body Push", "Upper Body Pull", "Lower Body Squat", "Lower Body Hinge",
  "Full Body", "Core & Stability", "Power & Explosiveness", "Speed & Agility",
  "Posterior Chain", "Grip & Forearms", "Unilateral", "Olympic Lifts",
];
const CREATIVITY_LEVELS = [
  { value: "standard", label: "Standard", desc: "Proven, classic structures" },
  { value: "high", label: "Creative", desc: "Unique pairings, complexes, outside the box" },
  { value: "experimental", label: "Experimental", desc: "Push boundaries, invent formats" },
];
const COACHING_DETAIL = [
  { value: "brief", label: "Brief", desc: "1-line cues" },
  { value: "standard", label: "Standard", desc: "1-2 sentence technique + mistake" },
  { value: "detailed", label: "Detailed", desc: "Full coaching breakdown" },
];

const PHASE_COLORS: Record<string, string> = {
  rolling: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  warmup: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  main: "bg-primary/15 text-primary border-primary/30",
  finisher: "bg-red-500/15 text-red-400 border-red-500/30",
  cooldown: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const PHASE_LABELS: Record<string, string> = {
  rolling: "🧊 Rolling / Soft Tissue",
  warmup: "🔥 Dynamic Warmup",
  main: "💪 Main Work",
  finisher: "⚡ Finisher",
  cooldown: "🧘 Cooldown / Mobility",
};

const AdminBatchGenerator = () => {
  const [quantity, setQuantity] = useState(3);
  const [style, setStyle] = useState("Traditional Strength");
  const [equipment, setEquipment] = useState("Full Gym");
  const [audience, setAudience] = useState("Youth Athlete (14-15)");
  const [duration, setDuration] = useState("45-60 min");
  const [intensity, setIntensity] = useState("Moderate");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [coachingDetail, setCoachingDetail] = useState("standard");
  const [creativityLevel, setCreativityLevel] = useState("high");
  const [theme, setTheme] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);

  const toggleFocus = (f: string) => {
    setFocusAreas((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setWorkouts([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-daily-workouts", {
        body: {
          quantity,
          style,
          equipment,
          audience,
          duration,
          intensity,
          focusAreas,
          coachingDetail,
          creativityLevel,
          theme: theme || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWorkouts(data.workouts || []);
      toast({ title: `${data.workouts?.length || 0} workouts generated`, description: "Review all phases before publishing." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (workouts.length === 0) return;
    setPublishing(true);
    try {
      const { data: existing } = await supabase
        .from("daily_workouts")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

      const rows = workouts.map((w) => ({
        title: w.title,
        description: w.description,
        target_audience: w.target_audience || "all",
        exercises: w.exercises as any,
        is_active: true,
        sort_order: nextOrder++,
      }));

      const { error } = await supabase.from("daily_workouts").insert(rows);
      if (error) throw error;

      toast({ title: `${workouts.length} workouts published!` });
      setWorkouts([]);
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const updateWorkout = (index: number, field: keyof GeneratedWorkout, value: any) => {
    setWorkouts((prev) => prev.map((w, i) => (i === index ? { ...w, [field]: value } : w)));
  };

  const updateExercise = (wIndex: number, eIndex: number, field: keyof WorkoutExercise, value: any) => {
    setWorkouts((prev) =>
      prev.map((w, i) =>
        i === wIndex
          ? { ...w, exercises: w.exercises.map((ex, j) => (j === eIndex ? { ...ex, [field]: value } : ex)) }
          : w
      )
    );
  };

  const removeWorkout = (index: number) => setWorkouts((prev) => prev.filter((_, i) => i !== index));

  const removeExercise = (wIndex: number, eIndex: number) => {
    setWorkouts((prev) =>
      prev.map((w, i) =>
        i === wIndex ? { ...w, exercises: w.exercises.filter((_, j) => j !== eIndex) } : w
      )
    );
  };

  const addExercise = (wIndex: number, phase: WorkoutExercise["phase"]) => {
    setWorkouts((prev) =>
      prev.map((w, i) =>
        i === wIndex
          ? { ...w, exercises: [...w.exercises, { name: "", phase, reps: "", notes: "" }] }
          : w
      )
    );
  };

  // Group exercises by phase for display
  const groupByPhase = (exercises: WorkoutExercise[]) => {
    const phases: WorkoutExercise["phase"][] = ["rolling", "warmup", "main", "finisher", "cooldown"];
    return phases.map((p) => ({
      phase: p,
      exercises: exercises
        .map((ex, idx) => ({ ...ex, _origIdx: idx }))
        .filter((ex) => ex.phase === p),
    })).filter((g) => g.exercises.length > 0);
  };

  const totalExercises = workouts.reduce((sum, w) => sum + w.exercises.length, 0);
  const phaseBreakdown = workouts.length > 0
    ? ["rolling", "warmup", "main", "finisher", "cooldown"].map((p) => ({
        phase: p,
        count: workouts.reduce((s, w) => s + w.exercises.filter((e) => e.phase === p).length, 0),
      })).filter((p) => p.count > 0)
    : [];

  return (
    <div className="space-y-6">
      <SectionHeader title="AI Workout Generator" />

      {/* ─── Config Controls ─── */}
      <div className="bg-card border border-border p-5 space-y-5">
        {/* Row 1: Quantity + Duration + Intensity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
              Quantity: {quantity} workout{quantity > 1 ? "s" : ""}
            </label>
            <Slider min={1} max={15} step={1} value={[quantity]} onValueChange={([v]) => setQuantity(v)} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              <Timer size={10} className="inline mr-1" /> Duration
            </label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              <Flame size={10} className="inline mr-1" /> Intensity
            </label>
            <Select value={intensity} onValueChange={setIntensity}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTENSITIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Style + Equipment + Audience */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Workout Style
            </label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Equipment
            </label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Target Audience
            </label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Focus Areas */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
            <Target size={10} className="inline mr-1" /> Focus Areas (optional)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FOCUS_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => toggleFocus(f)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  focusAreas.includes(f)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-border pt-4">
            {/* Creativity + Coaching Detail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                  <Zap size={10} className="inline mr-1" /> Creativity Level
                </label>
                <div className="space-y-1.5">
                  {CREATIVITY_LEVELS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCreativityLevel(c.value)}
                      className={`w-full text-left px-3 py-2 border text-xs transition-all ${
                        creativityLevel === c.value
                          ? "bg-primary/10 border-primary text-foreground"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <span className="font-bold">{c.label}</span>
                      <span className="text-[10px] ml-2 opacity-75">— {c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                  Coaching Detail
                </label>
                <div className="space-y-1.5">
                  {COACHING_DETAIL.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCoachingDetail(c.value)}
                      className={`w-full text-left px-3 py-2 border text-xs transition-all ${
                        coachingDetail === c.value
                          ? "bg-primary/10 border-primary text-foreground"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <span className="font-bold">{c.label}</span>
                      <span className="text-[10px] ml-2 opacity-75">— {c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Theme */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Theme / Inspiration (optional)
              </label>
              <Input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g., 'Hockey pre-season', 'Beach body', 'Garage gym warrior', 'Competition prep week 4'"
                className="bg-background"
              />
              <p className="text-[9px] text-muted-foreground mt-1">
                Give the AI a creative direction — it'll influence workout names, exercise selection, and structure.
              </p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? `Generating ${quantity} complete workouts…` : "Generate Workouts"}
        </button>
      </div>

      {/* ─── Review Section ─── */}
      {workouts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <SectionHeader title={`Review ${workouts.length} Workouts`} />
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-primary border-primary/30">
                {totalExercises} exercises
              </Badge>
              {phaseBreakdown.map((p) => (
                <Badge key={p.phase} variant="outline" className={PHASE_COLORS[p.phase]}>
                  {p.count} {p.phase}
                </Badge>
              ))}
            </div>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {workouts.map((workout, wIdx) => (
              <AccordionItem
                key={wIdx}
                value={`workout-${wIdx}`}
                className="border border-border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <Dumbbell size={16} className="text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{workout.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {workout.exercises.length} exercises • {workout.target_audience}
                        {workout.estimated_duration && ` • ${workout.estimated_duration}`}
                        {workout.intensity_level && ` • ${workout.intensity_level}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeWorkout(wIdx); }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-4 space-y-3">
                  {/* Edit title + description */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Title</label>
                      <Input value={workout.title} onChange={(e) => updateWorkout(wIdx, "title", e.target.value)} className="bg-background" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Description</label>
                      <Textarea value={workout.description} onChange={(e) => updateWorkout(wIdx, "description", e.target.value)} rows={2} className="bg-background" />
                    </div>
                  </div>

                  {/* Exercises grouped by phase */}
                  {groupByPhase(workout.exercises).map((group) => (
                    <div key={group.phase}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border ${PHASE_COLORS[group.phase]}`}>
                          {PHASE_LABELS[group.phase]}
                        </span>
                        <button
                          onClick={() => addExercise(wIdx, group.phase)}
                          className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          <Plus size={10} /> Add
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {group.exercises.map((ex) => (
                          <div key={ex._origIdx} className="bg-secondary/20 border border-border p-2.5 grid grid-cols-[1fr_auto] gap-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              <Input
                                value={ex.name}
                                onChange={(e) => updateExercise(wIdx, ex._origIdx, "name", e.target.value)}
                                placeholder="Exercise"
                                className="bg-background text-xs col-span-2 sm:col-span-1"
                              />
                              <Input
                                value={ex.reps}
                                onChange={(e) => updateExercise(wIdx, ex._origIdx, "reps", e.target.value)}
                                placeholder="Reps/time"
                                className="bg-background text-xs"
                              />
                              <Input
                                value={ex.sets?.toString() || ""}
                                onChange={(e) => updateExercise(wIdx, ex._origIdx, "sets", parseInt(e.target.value) || undefined)}
                                placeholder="Sets"
                                className="bg-background text-xs"
                              />
                              <Input
                                value={ex.rest || ""}
                                onChange={(e) => updateExercise(wIdx, ex._origIdx, "rest", e.target.value)}
                                placeholder="Rest"
                                className="bg-background text-xs"
                              />
                            </div>
                            <button
                              onClick={() => removeExercise(wIdx, ex._origIdx)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1 self-start"
                            >
                              <Trash2 size={12} />
                            </button>
                            <div className="col-span-2">
                              <Input
                                value={ex.notes || ""}
                                onChange={(e) => updateExercise(wIdx, ex._origIdx, "notes", e.target.value)}
                                placeholder="Coaching cue…"
                                className="bg-background text-xs text-muted-foreground"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Add phase if missing */}
                  {(["rolling", "warmup", "main", "finisher", "cooldown"] as const)
                    .filter((p) => !workout.exercises.some((e) => e.phase === p))
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => addExercise(wIdx, p)}
                        className="w-full border border-dashed border-border text-[10px] text-muted-foreground hover:text-primary hover:border-primary/50 py-2 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Plus size={10} /> Add {PHASE_LABELS[p]}
                      </button>
                    ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Publish */}
          <div className="bg-secondary/50 border border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {workouts.length} complete workout{workouts.length !== 1 ? "s" : ""} with rolling, warmup, main work, finisher, and cooldown ready to publish.
            </p>
            <button
              onClick={handlePublish}
              disabled={publishing || workouts.length === 0}
              className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {publishing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Publish Batch to Database
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBatchGenerator;
