import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Dumbbell, X, Save, Search, Sparkles, Upload, Eye, EyeOff, Gift, Users,
} from "lucide-react";
import GiftWorkoutModal from "./GiftWorkoutModal";
import { toast } from "@/hooks/use-toast";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

interface WorkoutExercise {
  name?: string;
  title?: string;
  sets: string;
  reps: string;
  notes?: string;
}

interface CommunityWorkout {
  id: string;
  title: string;
  description: string | null;
  creator_name: string;
  exercises: WorkoutExercise[];
  is_public: boolean;
  likes_count: number;
  user_id: string;
  created_at: string;
}

interface GroupedWorkout {
  canonical: CommunityWorkout;
  copies: { id: string; user_id: string; created_at: string; creator_name: string }[];
  userCount: number;
}

const emptyWorkout = {
  title: "",
  description: "",
  creator_name: "Coach Matt",
  exercises: [] as WorkoutExercise[],
  is_public: false,
};

const AdminWorkoutInventory = () => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<CommunityWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<(typeof emptyWorkout & { id?: string }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityWorkout | null>(null);
  const [giftTarget, setGiftTarget] = useState<CommunityWorkout | null>(null);

  // Batch generate state
  const [batchCount, setBatchCount] = useState(3);
  const [batchTheme, setBatchTheme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);

  const fetchWorkouts = async () => {
    const { data } = await supabase
      .from("community_workouts")
      .select("*")
      .order("created_at", { ascending: false }) as { data: any[] | null };
    setWorkouts((data as CommunityWorkout[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchWorkouts(); }, []);

  // Group workouts by title to deduplicate seeded copies
  const grouped: GroupedWorkout[] = (() => {
    const map = new Map<string, GroupedWorkout>();
    for (const w of workouts) {
      const key = w.title.trim().toLowerCase();
      if (map.has(key)) {
        const g = map.get(key)!;
        g.copies.push({ id: w.id, user_id: w.user_id, created_at: w.created_at, creator_name: w.creator_name });
        g.userCount = g.copies.length;
      } else {
        map.set(key, {
          canonical: w,
          copies: [{ id: w.id, user_id: w.user_id, created_at: w.created_at, creator_name: w.creator_name }],
          userCount: 1,
        });
      }
    }
    return Array.from(map.values());
  })();

  const filtered = grouped.filter(
    (g) =>
      g.canonical.title.toLowerCase().includes(search.toLowerCase()) ||
      g.canonical.creator_name.toLowerCase().includes(search.toLowerCase())
  );

  const coachGroups = filtered.filter((g) => g.canonical.creator_name === "Coach Matt");
  const userGroups = filtered.filter((g) => g.canonical.creator_name !== "Coach Matt");

  const saveWorkout = async () => {
    if (!editing || !user) return;
    if (!editing.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }

    const payload = {
      title: editing.title,
      description: editing.description || null,
      creator_name: editing.creator_name || "Coach Matt",
      exercises: editing.exercises as any,
      is_public: editing.is_public,
    };

    if (editing.id) {
      const { error } = await supabase.from("community_workouts").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Workout updated" });
    } else {
      const { error } = await supabase.from("community_workouts").insert({ ...payload, user_id: user.id });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Workout created" });
    }

    setEditing(null);
    fetchWorkouts();
  };

  const deleteWorkout = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("community_workouts").delete().eq("id", deleteTarget.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Workout deleted" });
    setDeleteTarget(null);
    if (expandedId === deleteTarget.id) setExpandedId(null);
    fetchWorkouts();
  };

  const togglePublic = async (w: CommunityWorkout) => {
    await supabase.from("community_workouts").update({ is_public: !w.is_public }).eq("id", w.id);
    fetchWorkouts();
  };

  const handleBatchGenerate = async () => {
    setGenerating(true);
    setBatchResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-daily-workouts", {
        body: {
          quantity: batchCount,
          style: "Traditional Strength",
          equipment: "Full Gym",
          audience: "General Fitness",
          duration: "45-60 min",
          intensity: "Moderate",
          focusAreas: [],
          coachingDetail: "standard",
          creativityLevel: "high",
          theme: batchTheme || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const generated = data.workouts || [];
      setBatchResults(generated);
      toast({ title: `${generated.length} workouts generated`, description: "Review then publish to inventory." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const publishBatch = async () => {
    if (!user || batchResults.length === 0) return;
    try {
      const rows = batchResults.map((w: any) => ({
        title: w.title,
        description: w.description || null,
        creator_name: "Coach Matt",
        exercises: (w.exercises || []).map((ex: any) => ({
          title: ex.name || ex.title,
          sets: String(ex.sets || "3"),
          reps: String(ex.reps || "10"),
          notes: ex.notes || "",
        })),
        is_public: false,
        user_id: user.id,
      }));
      const { error } = await supabase.from("community_workouts").insert(rows);
      if (error) throw error;
      toast({ title: `${rows.length} workouts added to inventory` });
      setBatchResults([]);
      setBatchTheme("");
      fetchWorkouts();
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    }
  };

  const addExerciseToEditing = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      exercises: [...editing.exercises, { title: "", sets: "3", reps: "10", notes: "" }],
    });
  };

  const updateEditingExercise = (idx: number, field: string, value: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      exercises: editing.exercises.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)),
    });
  };

  const removeEditingExercise = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, exercises: editing.exercises.filter((_, i) => i !== idx) });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="text-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-2xl font-mono font-bold text-foreground">{workouts.length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coach Matt</p>
          <p className="text-2xl font-mono font-bold text-primary">{workouts.filter((w) => w.creator_name === "Coach Matt").length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Public</p>
          <p className="text-2xl font-mono font-bold text-foreground">{workouts.filter((w) => w.is_public).length}</p>
        </div>
      </div>

      {/* Header + Search */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-card border border-border px-3 h-10">
          <Search size={14} className="text-muted-foreground mr-2" />
          <input
            type="text"
            placeholder="Search workouts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <button
          onClick={() => setEditing({ ...emptyWorkout })}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 shrink-0"
        >
          <Plus size={12} /> New
        </button>
      </div>

      {/* Batch Generate */}
      <div className="bg-card border border-border p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI Batch Generate</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground block mb-1">Theme (optional)</label>
            <input
              value={batchTheme}
              onChange={(e) => setBatchTheme(e.target.value)}
              placeholder="e.g. Hockey pre-season, Core focus…"
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="w-20">
            <label className="text-[10px] text-muted-foreground block mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={15}
              value={batchCount}
              onChange={(e) => setBatchCount(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground text-center focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <button
            onClick={handleBatchGenerate}
            disabled={generating}
            className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate
          </button>
        </div>

        {batchResults.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground">{batchResults.length} workouts ready</p>
              <button
                onClick={publishBatch}
                className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5"
              >
                <Upload size={12} /> Publish to Inventory
              </button>
            </div>
            {batchResults.map((w: any, i: number) => (
              <div key={i} className="bg-muted/50 p-3 text-xs">
                <p className="font-bold text-foreground">{w.title}</p>
                <p className="text-muted-foreground">{w.exercises?.length || 0} exercises · {w.target_audience}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workout List: Coach Matt section */}
      {coachGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coach Matt Workouts</p>
          {coachGroups.map((g) => (
            <WorkoutCard
              key={g.canonical.id}
              workout={g.canonical}
              userCount={g.userCount}
              isExpanded={expandedId === g.canonical.id}
              onToggle={() => setExpandedId(expandedId === g.canonical.id ? null : g.canonical.id)}
              onEdit={() => setEditing({
                id: g.canonical.id,
                title: g.canonical.title,
                description: g.canonical.description || "",
                creator_name: g.canonical.creator_name,
                exercises: g.canonical.exercises,
                is_public: g.canonical.is_public,
              })}
              onDelete={() => setDeleteTarget(g.canonical)}
              onTogglePublic={() => togglePublic(g.canonical)}
              onGift={() => setGiftTarget(g.canonical)}
            />
          ))}
        </div>
      )}

      {/* User-created section */}
      {userGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">User-Created Workouts</p>
          {userGroups.map((g) => (
            <WorkoutCard
              key={g.canonical.id}
              workout={g.canonical}
              userCount={g.userCount}
              isExpanded={expandedId === g.canonical.id}
              onToggle={() => setExpandedId(expandedId === g.canonical.id ? null : g.canonical.id)}
              onEdit={() => setEditing({
                id: g.canonical.id,
                title: g.canonical.title,
                description: g.canonical.description || "",
                creator_name: g.canonical.creator_name,
                exercises: g.canonical.exercises,
                is_public: g.canonical.is_public,
              })}
              onDelete={() => setDeleteTarget(g.canonical)}
              onTogglePublic={() => togglePublic(g.canonical)}
              onGift={() => setGiftTarget(g.canonical)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-card shadow-m2 p-8 text-center">
          <Dumbbell size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-xs text-muted-foreground">No workouts found.</p>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div className="bg-card border border-border p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">{editing.id ? "Edit Workout" : "New Workout"}</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Title *</label>
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-20 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Creator Name</label>
                  <input
                    value={editing.creator_name}
                    onChange={(e) => setEditing({ ...editing, creator_name: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.is_public}
                      onChange={(e) => setEditing({ ...editing, is_public: e.target.checked })}
                      className="accent-primary"
                    />
                    Public (visible to all)
                  </label>
                </div>
              </div>

              {/* Exercises */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exercises ({editing.exercises.length})</label>
                  <button onClick={addExerciseToEditing} className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1">
                    <Plus size={10} /> Add
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {editing.exercises.map((ex, i) => (
                    <div key={i} className="bg-muted/50 p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono w-5">{i + 1}.</span>
                        <input
                          value={ex.title || ex.name || ""}
                          onChange={(e) => updateEditingExercise(i, "title", e.target.value)}
                          placeholder="Exercise name"
                          className="flex-1 bg-background border border-border px-2 py-1 text-xs text-foreground outline-none"
                        />
                        <input
                          value={ex.sets}
                          onChange={(e) => updateEditingExercise(i, "sets", e.target.value)}
                          placeholder="Sets"
                          className="w-14 bg-background border border-border px-2 py-1 text-xs text-foreground text-center outline-none"
                        />
                        <span className="text-muted-foreground text-xs">×</span>
                        <input
                          value={ex.reps}
                          onChange={(e) => updateEditingExercise(i, "reps", e.target.value)}
                          placeholder="Reps"
                          className="w-14 bg-background border border-border px-2 py-1 text-xs text-foreground text-center outline-none"
                        />
                        <button onClick={() => removeEditingExercise(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <input
                        value={ex.notes || ""}
                        onChange={(e) => updateEditingExercise(i, "notes", e.target.value)}
                        placeholder="Notes (optional)"
                        className="w-full bg-background border border-border px-2 py-1 text-[11px] text-muted-foreground outline-none ml-7"
                        style={{ width: "calc(100% - 1.75rem)" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={saveWorkout}
                className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 w-full flex items-center justify-center gap-2"
              >
                <Save size={14} /> {editing.id ? "Update Workout" : "Create Workout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmActionModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={deleteWorkout}
        title="Delete Workout"
        description={`Remove "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
      />

      {/* Gift modal */}
      {giftTarget && (
        <GiftWorkoutModal
          workoutId={giftTarget.id}
          workoutTitle={giftTarget.title}
          workoutExercises={giftTarget.exercises}
          workoutDescription={giftTarget.description}
          onClose={() => setGiftTarget(null)}
          onGifted={() => setGiftTarget(null)}
        />
      )}
    </div>
  );
};

/** Workout card row */
const WorkoutCard = ({
  workout,
  userCount,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onTogglePublic,
  onGift,
}: {
  workout: CommunityWorkout;
  userCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublic: () => void;
  onGift: () => void;
}) => (
  <div className="bg-card shadow-m2 overflow-hidden">
    <div className="p-3 flex items-center gap-3">
      <button onClick={onToggle} className="text-muted-foreground hover:text-foreground flex-shrink-0">
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-foreground truncate">{workout.title}</h3>
          {!workout.is_public && (
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 font-bold uppercase tracking-widest">Private</span>
          )}
          {userCount > 1 && (
            <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 font-bold uppercase tracking-widest flex items-center gap-0.5">
              <Users size={8} /> {userCount} users
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          <span>{workout.creator_name}</span>
          <span>·</span>
          <span>{workout.exercises.length} exercises</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onGift}
          className="p-1.5 text-muted-foreground hover:text-primary transition-m2"
          title="Gift to user"
        >
          <Gift size={14} />
        </button>
        <button
          onClick={onTogglePublic}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-m2"
          title={workout.is_public ? "Make private" : "Make public"}
        >
          {workout.is_public ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button onClick={onEdit} className="p-1.5 text-muted-foreground hover:text-foreground transition-m2">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive transition-m2">
          <Trash2 size={14} />
        </button>
      </div>
    </div>

    {isExpanded && (
      <div className="border-t border-border p-3 space-y-1">
        {workout.description && (
          <p className="text-xs text-muted-foreground mb-2">{workout.description}</p>
        )}
        {workout.exercises.map((ex, i) => (
          <div key={i} className="flex items-center gap-3 text-xs bg-muted/50 p-2">
            <span className="text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
            <span className="font-bold text-foreground flex-1">{ex.title || ex.name}</span>
            <span className="font-mono text-primary">{ex.sets}×{ex.reps}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default AdminWorkoutInventory;
