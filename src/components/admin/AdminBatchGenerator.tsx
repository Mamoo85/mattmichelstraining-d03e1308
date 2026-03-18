import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, Upload, Trash2, ChevronDown, ChevronUp, Pencil, Dumbbell,
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
  sets?: number;
  reps: string;
  notes?: string;
}

interface GeneratedWorkout {
  title: string;
  description: string;
  target_audience: string;
  exercises: WorkoutExercise[];
}

const STYLES = [
  "EMOM", "AMRAP", "HIIT", "Core Circuit", "CrossFit/Metcon", "Active Recovery", "Traditional Strength",
];
const EQUIPMENT = ["Full Gym", "Dumbbells/Kettlebells Only", "Bodyweight Only"];
const AUDIENCES = ["Youth Athlete", "Adult/Parent Foundation"];

const AdminBatchGenerator = () => {
  const [quantity, setQuantity] = useState(5);
  const [style, setStyle] = useState("Traditional Strength");
  const [equipment, setEquipment] = useState("Full Gym");
  const [audience, setAudience] = useState("Youth Athlete");

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);

  const handleGenerate = async () => {
    setGenerating(true);
    setWorkouts([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-daily-workouts", {
        body: { quantity, style, equipment, audience },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWorkouts(data.workouts || []);
      toast({ title: `${data.workouts?.length || 0} workouts generated`, description: "Review and edit before publishing." });
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
      // Get current max sort_order
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
          ? {
              ...w,
              exercises: w.exercises.map((ex, j) =>
                j === eIndex ? { ...ex, [field]: value } : ex
              ),
            }
          : w
      )
    );
  };

  const removeWorkout = (index: number) => {
    setWorkouts((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExercise = (wIndex: number, eIndex: number) => {
    setWorkouts((prev) =>
      prev.map((w, i) =>
        i === wIndex
          ? { ...w, exercises: w.exercises.filter((_, j) => j !== eIndex) }
          : w
      )
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="AI Batch Workout Generator" />

      {/* Config Controls */}
      <div className="bg-card border border-border p-5 space-y-5">
        {/* Quantity */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
            Quantity: {quantity} workout{quantity > 1 ? "s" : ""}
          </label>
          <Slider
            min={1}
            max={30}
            step={1}
            value={[quantity]}
            onValueChange={([v]) => setQuantity(v)}
            className="max-w-md"
          />
        </div>

        {/* Dropdowns row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Workout Style
            </label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Equipment
            </label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Target Audience
            </label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? `Generating ${quantity} workouts…` : "Generate Workouts"}
        </button>
      </div>

      {/* Review Section */}
      {workouts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader title={`Review ${workouts.length} Workouts`} />
            <Badge variant="outline" className="text-primary border-primary/30">
              {workouts.reduce((sum, w) => sum + w.exercises.length, 0)} total exercises
            </Badge>
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
                  {/* Edit title */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Title</label>
                    <Input
                      value={workout.title}
                      onChange={(e) => updateWorkout(wIdx, "title", e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  {/* Edit description */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Description</label>
                    <Textarea
                      value={workout.description}
                      onChange={(e) => updateWorkout(wIdx, "description", e.target.value)}
                      rows={2}
                      className="bg-background"
                    />
                  </div>
                  {/* Exercises */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Exercises</label>
                    <div className="space-y-2">
                      {workout.exercises.map((ex, eIdx) => (
                        <div key={eIdx} className="bg-secondary/30 border border-border p-3 flex flex-col sm:flex-row gap-2">
                          <Input
                            value={ex.name}
                            onChange={(e) => updateExercise(wIdx, eIdx, "name", e.target.value)}
                            placeholder="Exercise name"
                            className="bg-background flex-1 text-sm"
                          />
                          <Input
                            value={ex.reps}
                            onChange={(e) => updateExercise(wIdx, eIdx, "reps", e.target.value)}
                            placeholder="Reps/time"
                            className="bg-background w-full sm:w-24 text-sm"
                          />
                          <Input
                            value={ex.sets?.toString() || ""}
                            onChange={(e) => updateExercise(wIdx, eIdx, "sets", parseInt(e.target.value) || undefined)}
                            placeholder="Sets"
                            className="bg-background w-full sm:w-20 text-sm"
                          />
                          <Input
                            value={ex.notes || ""}
                            onChange={(e) => updateExercise(wIdx, eIdx, "notes", e.target.value)}
                            placeholder="Coach notes"
                            className="bg-background flex-1 text-sm"
                          />
                          <button
                            onClick={() => removeExercise(wIdx, eIdx)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1 self-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Publish Button */}
          <div className="bg-secondary/50 border border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {workouts.length} workout{workouts.length !== 1 ? "s" : ""} ready to publish to the daily workouts library.
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
