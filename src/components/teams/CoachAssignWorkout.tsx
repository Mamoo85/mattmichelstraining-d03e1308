import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  rosterId: string | null;
}

interface Exercise {
  title: string;
  sets: string;
  reps: string;
  notes: string;
}

const CoachAssignWorkout = ({ rosterId }: Props) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([
    { title: "", sets: "3", reps: "10", notes: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    if (!rosterId) return;
    const { data } = await supabase
      .from("team_workouts")
      .select("*")
      .eq("roster_id", rosterId)
      .order("created_at", { ascending: false })
      .limit(10);
    setHistory(data || []);
  };

  useEffect(() => { loadHistory(); }, [rosterId]);

  const addExercise = () => setExercises([...exercises, { title: "", sets: "3", reps: "10", notes: "" }]);
  const removeExercise = (i: number) => setExercises(exercises.filter((_, idx) => idx !== i));
  const updateExercise = (i: number, field: keyof Exercise, val: string) => {
    const updated = [...exercises];
    updated[i][field] = val;
    setExercises(updated);
  };

  const handleSubmit = async () => {
    if (!rosterId || !user || !title.trim()) {
      toast.error("Select a team and add a title");
      return;
    }
    setSubmitting(true);
    const filteredExercises = exercises.filter((e) => e.title.trim());
    const { error } = await supabase.from("team_workouts").insert({
      roster_id: rosterId,
      assigned_by: user.id,
      title: title.trim(),
      description: description.trim(),
      exercises: filteredExercises as any,
      due_date: dueDate || null,
    } as any);

    if (error) {
      toast.error(error.message);
    } else {
      // Auto-post announcement to feed
      await supabase.from("team_feed").insert({
        roster_id: rosterId,
        user_id: user.id,
        type: "coach_announcement",
        content: `📋 New workout assigned: "${title.trim()}" — ${filteredExercises.length} exercises${dueDate ? `. Due ${new Date(dueDate).toLocaleDateString()}` : ""}. Let's go!`,
        is_pinned: false,
      });

      toast.success("Workout assigned & team notified! 💪");
      setTitle("");
      setDescription("");
      setDueDate("");
      setExercises([{ title: "", sets: "3", reps: "10", notes: "" }]);
      loadHistory();
    }
    setSubmitting(false);
  };

  const deleteWorkout = async (id: string) => {
    await supabase.from("team_workout_completions").delete().eq("team_workout_id", id);
    await supabase.from("team_workouts").delete().eq("id", id);
    toast.success("Workout deleted");
    loadHistory();
  };

  if (!rosterId) {
    return <p className="text-center text-sm text-muted-foreground py-8 mt-4">Select a team first</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Assign Workout</h3>
        <Input placeholder="Workout title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase">Exercises</h4>
          {exercises.map((ex, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Input placeholder="Exercise name" value={ex.title} onChange={(e) => updateExercise(i, "title", e.target.value)} />
                <div className="flex gap-2">
                  <Input placeholder="Sets" value={ex.sets} onChange={(e) => updateExercise(i, "sets", e.target.value)} className="w-16" />
                  <Input placeholder="Reps" value={ex.reps} onChange={(e) => updateExercise(i, "reps", e.target.value)} className="w-20" />
                  <Input placeholder="Notes" value={ex.notes} onChange={(e) => updateExercise(i, "notes", e.target.value)} className="flex-1" />
                </div>
              </div>
              {exercises.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeExercise(i)}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addExercise} className="w-full">
            <Plus size={14} className="mr-1" /> Add Exercise
          </Button>
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full font-bold uppercase tracking-wider">
          {submitting ? "Assigning..." : "Push to Team 🔥"}
        </Button>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          >
            <Clock size={12} />
            Previously Assigned ({history.length})
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showHistory && history.map((w) => (
            <Card key={w.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{w.title}</h4>
                  <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>{new Date(w.created_at).toLocaleDateString()}</span>
                    {w.due_date && <span>· Due {new Date(w.due_date).toLocaleDateString()}</span>}
                    {Array.isArray(w.exercises) && <span>· {(w.exercises as any[]).length} exercises</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteWorkout(w.id)} className="h-7 w-7">
                  <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoachAssignWorkout;
