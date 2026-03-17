import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Dumbbell, X, Save, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TrainingProgram {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  sport: string | null;
  price: number;
  is_active: boolean;
}

interface ProgramWorkout {
  id: string;
  program_id: string;
  exercise_id: string;
  week_number: number;
  day_number: number;
  prescribed_sets_reps: string;
  coach_instructions: string;
  sort_order: number;
  exercise_library?: { id: string; title: string } | null;
}

interface ExerciseOption {
  id: string;
  title: string;
}

const CATEGORIES = ["Athlete", "Lifestyle Fitness"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const SPORTS = ["Baseball", "Football", "Basketball", "Hockey", "Soccer", "Lacrosse", "Track & Field", "Swimming", "Tennis", "Volleyball"];

const emptyProgram: Omit<TrainingProgram, "id"> = {
  title: "", description: "", category: "Athlete", level: "Beginner", sport: null, price: 49, is_active: true,
};

const AdminPrograms = () => {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProgram, setEditingProgram] = useState<(Omit<TrainingProgram, "id"> & { id?: string }) | null>(null);
  const [workouts, setWorkouts] = useState<ProgramWorkout[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);

  const fetchPrograms = async () => {
    const { data } = await supabase
      .from("training_programs")
      .select("*")
      .order("category")
      .order("title");
    setPrograms((data as TrainingProgram[]) || []);
    setLoading(false);
  };

  const fetchExercises = async () => {
    const { data } = await supabase
      .from("exercise_library")
      .select("id, title")
      .order("title");
    setExercises((data as ExerciseOption[]) || []);
  };

  useEffect(() => {
    fetchPrograms();
    fetchExercises();
  }, []);

  const fetchWorkouts = async (programId: string) => {
    setWorkoutsLoading(true);
    const { data } = await supabase
      .from("program_workouts")
      .select("*, exercise_library(id, title)")
      .eq("program_id", programId)
      .order("week_number")
      .order("day_number")
      .order("sort_order");
    setWorkouts((data as ProgramWorkout[]) || []);
    setWorkoutsLoading(false);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setWorkouts([]);
    } else {
      setExpandedId(id);
      fetchWorkouts(id);
    }
  };

  // Save program (create or update)
  const saveProgram = async () => {
    if (!editingProgram) return;
    const { id, ...data } = editingProgram as TrainingProgram;

    if (!data.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }

    if (id) {
      const { error } = await supabase.from("training_programs").update(data).eq("id", id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Program updated" });
    } else {
      const { error } = await supabase.from("training_programs").insert(data);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Program created" });
    }

    setEditingProgram(null);
    fetchPrograms();
  };

  const deleteProgram = async (id: string) => {
    if (!confirm("Delete this program and all its workouts?")) return;
    const { error } = await supabase.from("training_programs").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Program deleted" });
    if (expandedId === id) { setExpandedId(null); setWorkouts([]); }
    fetchPrograms();
  };

  const toggleActive = async (p: TrainingProgram) => {
    await supabase.from("training_programs").update({ is_active: !p.is_active }).eq("id", p.id);
    fetchPrograms();
  };

  // Workout CRUD
  const addWorkout = async (programId: string) => {
    const maxSort = workouts.length > 0 ? Math.max(...workouts.map(w => w.sort_order)) + 1 : 1;
    const { error } = await supabase.from("program_workouts").insert({
      program_id: programId,
      exercise_id: exercises[0]?.id || "",
      week_number: 1,
      day_number: 1,
      prescribed_sets_reps: "3 sets of 10 reps",
      coach_instructions: "",
      sort_order: maxSort,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    fetchWorkouts(programId);
  };

  const updateWorkout = async (workout: ProgramWorkout, field: string, value: any) => {
    await supabase.from("program_workouts").update({ [field]: value }).eq("id", workout.id);
    setWorkouts(prev => prev.map(w => w.id === workout.id ? { ...w, [field]: value } : w));
  };

  const deleteWorkout = async (id: string, programId: string) => {
    await supabase.from("program_workouts").delete().eq("id", id);
    fetchWorkouts(programId);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="text-primary animate-spin" /></div>;
  }

  const ageRanges = editingProgram?.category === "Athlete" ? ATHLETE_AGE_RANGES : LIFESTYLE_AGE_RANGES;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Interactive Programs ({programs.length})</h2>
        <button
          onClick={() => setEditingProgram({ ...emptyProgram })}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          <Plus size={12} /> New Program
        </button>
      </div>

      {/* Program form modal */}
      {editingProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setEditingProgram(null)}>
          <div className="bg-card border border-border p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">
                {(editingProgram as any).id ? "Edit Program" : "New Program"}
              </h3>
              <button onClick={() => setEditingProgram(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Title *</label>
                <input
                  value={editingProgram.title}
                  onChange={e => setEditingProgram({ ...editingProgram, title: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
                <textarea
                  value={editingProgram.description}
                  onChange={e => setEditingProgram({ ...editingProgram, description: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-24 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Category</label>
                  <select
                    value={editingProgram.category}
                    onChange={e => setEditingProgram({ ...editingProgram, category: e.target.value, sport: e.target.value === "Lifestyle Fitness" ? null : editingProgram.sport })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Age Range</label>
                  <select
                    value={editingProgram.age_range}
                    onChange={e => setEditingProgram({ ...editingProgram, age_range: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  >
                    {ageRanges.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sex</label>
                  <select
                    value={editingProgram.sex}
                    onChange={e => setEditingProgram({ ...editingProgram, sex: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  >
                    {SEX_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Price ($)</label>
                  <input
                    type="number"
                    value={editingProgram.price}
                    onChange={e => setEditingProgram({ ...editingProgram, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {editingProgram.category === "Athlete" && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sport</label>
                  <select
                    value={editingProgram.sport || ""}
                    onChange={e => setEditingProgram({ ...editingProgram, sport: e.target.value || null })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="">No specific sport</option>
                    {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProgram.is_active}
                  onChange={e => setEditingProgram({ ...editingProgram, is_active: e.target.checked })}
                  className="accent-primary"
                />
                <label className="text-xs text-foreground">Active (visible in store)</label>
              </div>

              <button
                onClick={saveProgram}
                className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 w-full flex items-center justify-center gap-2"
              >
                <Save size={14} />
                {(editingProgram as any).id ? "Update Program" : "Create Program"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Program list */}
      {programs.map((p) => (
        <div key={p.id} className="bg-card shadow-m2 overflow-hidden">
          <div className="p-3 flex items-center gap-3">
            <button onClick={() => toggleExpand(p.id)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              {expandedId === p.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(p.id)}>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground truncate">{p.title}</h3>
                {!p.is_active && (
                  <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 font-bold uppercase tracking-widest">Hidden</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                <span>{p.category}</span>
                <span>·</span>
                <span>{p.age_range}</span>
                <span>·</span>
                <span>{p.sex}</span>
                {p.sport && <><span>·</span><span>{p.sport}</span></>}
                <span>·</span>
                <span className="font-mono text-primary">${p.price}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => toggleActive(p)}
                className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest transition-m2 ${
                  p.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {p.is_active ? "Active" : "Hidden"}
              </button>
              <button
                onClick={() => setEditingProgram(p)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-m2"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => deleteProgram(p.id)}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-m2"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Expanded: workouts */}
          {expandedId === p.id && (
            <div className="border-t border-border">
              <div className="p-3 bg-muted flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Workouts ({workouts.length})
                </span>
                <button
                  onClick={() => addWorkout(p.id)}
                  className="flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
                >
                  <Plus size={10} /> Add Exercise
                </button>
              </div>

              {workoutsLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={16} className="text-primary animate-spin" /></div>
              ) : workouts.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No exercises added yet. Click "Add Exercise" to build the workout plan.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {workouts.map((w) => (
                    <WorkoutRow
                      key={w.id}
                      workout={w}
                      exercises={exercises}
                      onUpdate={updateWorkout}
                      onDelete={() => deleteWorkout(w.id, p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {programs.length === 0 && (
        <div className="bg-card shadow-m2 p-8 text-center">
          <Dumbbell size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-xs text-muted-foreground">No programs yet. Click "New Program" to create one.</p>
        </div>
      )}
    </div>
  );
};

/** Inline-editable workout row */
const WorkoutRow = ({
  workout,
  exercises,
  onUpdate,
  onDelete,
}: {
  workout: ProgramWorkout;
  exercises: ExerciseOption[];
  onUpdate: (w: ProgramWorkout, field: string, value: any) => void;
  onDelete: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredExercises = searchTerm
    ? exercises.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : exercises;

  const exerciseTitle = (workout.exercise_library as any)?.title || exercises.find(e => e.id === workout.exercise_id)?.title || "Select exercise";

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-bold">W{workout.week_number}D{workout.day_number}</span>
          <span>·</span>
          <span>#{workout.sort_order}</span>
        </div>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">Week</label>
          <input
            type="number" min={1}
            value={workout.week_number}
            onChange={e => onUpdate(workout, "week_number", parseInt(e.target.value) || 1)}
            className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">Day</label>
          <input
            type="number" min={1}
            value={workout.day_number}
            onChange={e => onUpdate(workout, "day_number", parseInt(e.target.value) || 1)}
            className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">Order</label>
          <input
            type="number" min={1}
            value={workout.sort_order}
            onChange={e => onUpdate(workout, "sort_order", parseInt(e.target.value) || 1)}
            className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
      </div>

      {/* Exercise picker with search */}
      <div className="relative">
        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">Exercise</label>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="w-full bg-background border border-border px-2 py-1.5 text-xs text-left text-foreground hover:border-primary transition-m2 flex items-center justify-between"
        >
          <span className="truncate">{exerciseTitle}</span>
          <Search size={10} className="text-muted-foreground flex-shrink-0" />
        </button>
        {showSearch && (
          <div className="absolute z-10 mt-1 w-full bg-card border border-border shadow-m2 max-h-48 overflow-y-auto">
            <div className="sticky top-0 bg-card p-1.5 border-b border-border">
              <input
                autoFocus
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search exercises..."
                className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            {filteredExercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => {
                  onUpdate(workout, "exercise_id", ex.id);
                  setShowSearch(false);
                  setSearchTerm("");
                }}
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/50 transition-m2 ${
                  ex.id === workout.exercise_id ? "text-primary font-bold" : "text-foreground"
                }`}
              >
                {ex.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">Sets & Reps</label>
        <input
          value={workout.prescribed_sets_reps}
          onChange={e => onUpdate(workout, "prescribed_sets_reps", e.target.value)}
          placeholder="e.g. 3 sets of 10 reps"
          className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <div>
        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">Coach Instructions</label>
        <textarea
          value={workout.coach_instructions}
          onChange={e => onUpdate(workout, "coach_instructions", e.target.value)}
          placeholder="Coaching cues for this exercise..."
          className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none h-16 resize-none"
        />
      </div>
    </div>
  );
};

export default AdminPrograms;
