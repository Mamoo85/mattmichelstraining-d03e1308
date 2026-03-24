import { useState } from "react";
import { Plus, Trash2, GripVertical, Save, FileText, Share2, ArrowUp, ArrowDown, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import ExercisePicker from "./ExercisePicker";
import { printCommunityWorkout } from "./printCommunityWorkout";

interface WorkoutExercise {
  exerciseId: string;
  exerciseTitle: string;
  sets: string;
  reps: string;
  notes: string;
}

interface WorkoutBuilderProps {
  onSaved?: () => void;
  onClose?: () => void;
}

const WorkoutBuilder = ({ onSaved, onClose }: WorkoutBuilderProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareToBank, setShareToBank] = useState(true);
  const [savedWorkout, setSavedWorkout] = useState<{ title: string; exercises: WorkoutExercise[] } | null>(null);

  const addExercise = (id: string, titleStr: string) => {
    setExercises((prev) => [
      ...prev,
      { exerciseId: id, exerciseTitle: titleStr, sets: "3", reps: "10", notes: "" },
    ]);
    setShowPicker(false);
  };

  const updateExercise = (index: number, field: keyof WorkoutExercise, value: string) => {
    setExercises((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= exercises.length) return;
    const updated = [...exercises];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setExercises(updated);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast({ title: "Give your workout a name", variant: "destructive" });
      return;
    }
    if (exercises.length === 0) {
      toast({ title: "Add at least one exercise", variant: "destructive" });
      return;
    }
    if (shareToBank && !creatorName.trim()) {
      toast({ title: "Enter your name to share with the community", variant: "destructive" });
      return;
    }

    setSaving(true);
    const exerciseData = exercises.map((e, i) => ({
      exerciseId: e.exerciseId,
      title: e.exerciseTitle,
      sets: e.sets,
      reps: e.reps,
      notes: e.notes,
      order: i,
    }));

    const { error } = await supabase.from("community_workouts").insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      creator_name: creatorName.trim() || "Anonymous",
      exercises: exerciseData as any,
      is_public: shareToBank,
      source_type: "manual",
    });

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: shareToBank ? "Workout shared! 🎉 +30 M² Points" : "Workout saved! 💪" });
      setSavedWorkout({ title: title.trim(), exercises: [...exercises] });
    }
    setSaving(false);
  };

  const handlePrintPreview = () => {
    if (exercises.length === 0) {
      toast({ title: "Add exercises first", variant: "destructive" });
      return;
    }
    printCommunityWorkout({
      title: title || "My Workout",
      creatorName: creatorName || "Mattlete",
      description,
      exercises: exercises.map((e) => ({
        name: e.exerciseTitle,
        sets: e.sets,
        reps: e.reps,
        notes: e.notes,
      })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Build Your Workout</h3>
        {onClose && (
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        )}
      </div>

      {/* Title + Creator */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Workout name (e.g. Game Day Prep)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-card border border-border p-3 text-sm text-foreground font-bold placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
        />
        <input
          type="text"
          placeholder="Your name (shown in community bank)"
          value={creatorName}
          onChange={(e) => setCreatorName(e.target.value)}
          className="w-full bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
        />
        <textarea
          placeholder="Description (optional)…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[50px] resize-none"
        />
      </div>

      {/* Exercise List */}
      {exercises.map((ex, i) => (
        <div key={i} className="bg-card border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-muted-foreground" />
            <span className="text-sm font-bold text-foreground flex-1">{ex.exerciseTitle}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => moveExercise(i, -1)} disabled={i === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ArrowUp size={12} />
              </button>
              <button onClick={() => moveExercise(i, 1)} disabled={i === exercises.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ArrowDown size={12} />
              </button>
              <button onClick={() => removeExercise(i)} className="p-1 text-destructive hover:text-destructive/80">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sets</label>
              <input
                type="text"
                value={ex.sets}
                onChange={(e) => updateExercise(i, "sets", e.target.value)}
                className="w-full bg-background border border-border p-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary outline-none text-center"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Reps</label>
              <input
                type="text"
                value={ex.reps}
                onChange={(e) => updateExercise(i, "reps", e.target.value)}
                className="w-full bg-background border border-border p-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary outline-none text-center"
              />
            </div>
          </div>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={ex.notes}
            onChange={(e) => updateExercise(i, "notes", e.target.value)}
            className="w-full bg-background border border-border p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
      ))}

      {/* Add exercise */}
      {showPicker ? (
        <ExercisePicker onSelect={addExercise} onCancel={() => setShowPicker(false)} />
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full h-12 border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all"
        >
          <Plus size={16} /> Add Exercise
        </button>
      )}

      {/* Share toggle */}
      {exercises.length > 0 && (
        <div className="flex items-center gap-3 bg-muted p-3">
          <Share2 size={14} className={shareToBank ? "text-primary" : "text-muted-foreground"} />
          <div className="flex-1">
            <span className="text-xs font-bold text-foreground block">Share to Mattletes Bank</span>
            <span className="text-[10px] text-muted-foreground">Other members can view and use your workout</span>
          </div>
          <button
            onClick={() => setShareToBank(!shareToBank)}
            className={`w-10 h-5 rounded-full transition-all relative ${shareToBank ? "bg-primary" : "bg-border"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${shareToBank ? "left-5" : "left-0.5"}`} />
          </button>
        </div>
      )}

      {/* Actions */}
      {exercises.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={handlePrintPreview}
            className="flex-1 h-12 bg-muted text-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:bg-muted/80 transition-all"
          >
            <FileText size={14} /> Print PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-12 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Saving…" : "Save Workout"}
          </button>
        </div>
      )}
      {/* Start Workout after save */}
      {savedWorkout && (
        <div className="space-y-2">
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("open-workout-zone", {
                  detail: {
                    title: savedWorkout.title,
                    source: "builder",
                    exercises: savedWorkout.exercises.map((e) => ({
                      name: e.exerciseTitle,
                      exerciseId: e.exerciseId,
                      sets: e.sets,
                      reps: e.reps,
                      notes: e.notes,
                    })),
                  },
                })
              );
              onSaved?.();
            }}
            className="w-full h-14 bg-primary text-primary-foreground flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Play size={18} /> Start This Workout
          </button>
          <button
            onClick={() => onSaved?.()}
            className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-2"
          >
            Back to Workouts
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkoutBuilder;
