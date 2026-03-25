import { useState, useEffect, useCallback } from "react";
import { Search, FileText, User, Calendar, Dumbbell, Play, Trash2, Download, Loader2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyUserIds } from "@/hooks/useFamilyUserIds";
import { printCommunityWorkout } from "./printCommunityWorkout";
import { toast } from "@/hooks/use-toast";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";
import FixItDisclaimer from "@/components/shared/FixItDisclaimer";

interface CommunityExercise {
  title: string;
  sets: string;
  reps: string;
  notes?: string;
}

interface CommunityWorkout {
  id: string;
  title: string;
  description: string;
  creator_name: string;
  exercises: CommunityExercise[];
  created_at: string;
  user_id: string;
  is_public: boolean;
  source_type: string;
}

export type WorkoutBankMode = "my" | "generated" | "fixit" | "community";

interface CommunityWorkoutBankProps {
  mode?: WorkoutBankMode;
  onCreateNew?: () => void;
}

const MODE_CONFIG: Record<WorkoutBankMode, { title: string; subtitle: string; emptyText: string }> = {
  my: {
    title: "My Workouts",
    subtitle: "Your manual workouts + Coach Matt starter workouts",
    emptyText: "No workouts yet. Create one or grab one from the Community tab!",
  },
  generated: {
    title: "AI Generated Workouts",
    subtitle: "Workouts built by Coach Matt's AI for you",
    emptyText: "No generated workouts yet. Use Smart Build to create one!",
  },
  fixit: {
    title: "Fix It Protocols",
    subtitle: "Your corrective rehab protocols from Coach Matt's AI",
    emptyText: "No Fix It protocols yet. Use the Fix It button to generate one!",
  },
  community: {
    title: "Community Workout Bank",
    subtitle: "Workouts shared by other Mattletes",
    emptyText: "No community workouts yet. Be the first to share!",
  },
};

const CommunityWorkoutBank = ({ mode = "my", onCreateNew }: CommunityWorkoutBankProps) => {
  const { user } = useAuth();
  const { familyIds } = useFamilyUserIds();
  const [workouts, setWorkouts] = useState<CommunityWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityWorkout | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    const userIds = familyIds.length > 0 ? familyIds : user ? [user.id] : [];

    let data: any[] = [];

    if (mode === "my") {
      if (userIds.length > 0) {
        const { data: res } = await supabase
          .from("community_workouts")
          .select("*")
          .in("user_id", userIds)
          .in("source_type", ["manual", "coach_seeded"])
          .order("created_at", { ascending: false })
          .limit(100);
        data = res ?? [];
      }
    } else if (mode === "generated") {
      if (userIds.length > 0) {
        const { data: res } = await supabase
          .from("community_workouts")
          .select("*")
          .in("user_id", userIds)
          .eq("source_type", "ai_workout")
          .order("created_at", { ascending: false })
          .limit(100);
        data = res ?? [];
      }
    } else if (mode === "fixit") {
      if (userIds.length > 0) {
        const { data: res } = await supabase
          .from("community_workouts")
          .select("*")
          .in("user_id", userIds)
          .eq("source_type", "ai_fixit")
          .order("created_at", { ascending: false })
          .limit(100);
        data = res ?? [];
      }
    } else if (mode === "community") {
      const { data: res } = await supabase
        .from("community_workouts")
        .select("*")
        .eq("is_public", true)
        .eq("source_type", "manual")
        .order("created_at", { ascending: false })
        .limit(50);
      data = res ?? [];
    }

    setWorkouts(data as CommunityWorkout[]);
    setLoading(false);
  }, [user, familyIds, mode]);

  useEffect(() => { loadWorkouts(); }, [loadWorkouts]);

  const filtered = workouts.filter(
    (w) =>
      w.title.toLowerCase().includes(query.toLowerCase()) ||
      w.creator_name.toLowerCase().includes(query.toLowerCase())
  );

  const handlePrint = (workout: CommunityWorkout) => {
    printCommunityWorkout({
      title: workout.title,
      creatorName: workout.creator_name,
      description: workout.description,
      exercises: workout.exercises.map((e) => ({
        name: e.title,
        sets: e.sets || "3",
        reps: e.reps || "10",
        notes: e.notes || "",
      })),
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    const { error } = await supabase
      .from("community_workouts")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Workout deleted" });
      setWorkouts((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      setExpanded(null);
    }
    setDeleteTarget(null);
  };

  const handleSaveCopy = async (workout: CommunityWorkout) => {
    if (!user) return;
    setSavingId(workout.id);
    const { error } = await supabase.from("community_workouts").insert({
      user_id: user.id,
      title: workout.title,
      description: workout.description,
      creator_name: workout.creator_name,
      exercises: workout.exercises as any,
      is_public: false,
      source_type: "manual",
    });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved to your workouts!", description: "Find it in the My Workouts tab." });
      loadWorkouts();
    }
    setSavingId(null);
  };

  const isOwn = (w: CommunityWorkout) => {
    if (!user) return false;
    return w.user_id === user.id || familyIds.includes(w.user_id);
  };

  const config = MODE_CONFIG[mode];
  const isFixIt = mode === "fixit";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">{config.title}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">{config.subtitle}</p>
        </div>
        {onCreateNew && mode === "my" && (
          <button
            onClick={onCreateNew}
            className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <Dumbbell size={12} /> Create
          </button>
        )}
      </div>

      {isFixIt && <FixItDisclaimer compact />}

      {/* Search */}
      <div className="flex items-center bg-card border border-border px-3 h-10">
        <Search size={14} className="text-muted-foreground mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder={mode === "community" ? "Search workouts or creators…" : "Search your workouts…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {/* Workout list */}
      {loading ? (
        <p className="text-xs text-muted-foreground p-4 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          {isFixIt ? <Wrench size={24} className="mx-auto text-muted-foreground/30 mb-2" /> : <Dumbbell size={24} className="mx-auto text-muted-foreground/30 mb-2" />}
          <p className="text-sm text-muted-foreground">{config.emptyText}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((w) => {
            const own = isOwn(w);
            return (
              <div key={w.id} className="bg-card border border-border overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                  className="w-full text-left p-4 hover:bg-muted/50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground truncate">{w.title}</h4>
                        {mode === "community" && own && (
                          <span className="text-[8px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 shrink-0">
                            Yours
                          </span>
                        )}
                        {isFixIt && (
                          <span className="text-[8px] font-bold uppercase tracking-widest text-accent-foreground bg-accent/20 px-1.5 py-0.5 shrink-0">
                            Rehab
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {mode === "community" && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <User size={10} /> {w.creator_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Dumbbell size={10} /> {w.exercises.length} exercises
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar size={10} /> {new Date(w.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {w.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{w.description}</p>
                      )}
                    </div>
                  </div>
                </button>

                {expanded === w.id && (
                  <div className="border-t border-border p-4 space-y-3">
                    <div className="space-y-1.5">
                      {w.exercises.map((ex, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
                          <span className="font-bold text-foreground flex-1">{ex.title}</span>
                          <span className="font-mono text-primary">{ex.sets}×{ex.reps}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent("open-workout-zone", {
                              detail: {
                                title: w.title,
                                source: mode === "fixit" ? "fixit" : "community",
                                exercises: w.exercises.map((ex) => ({
                                  exerciseTitle: ex.title,
                                  prescribedSets: parseInt(ex.sets) || 3,
                                  prescribedReps: parseInt(ex.reps) || 10,
                                  notes: ex.notes,
                                })),
                              },
                            })
                          );
                        }}
                        className="flex-1 h-10 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                      >
                        <Play size={12} /> {isFixIt ? "Start Protocol" : "Start Workout"}
                      </button>
                      {/* Save copy — only in community mode for other users' workouts */}
                      {mode === "community" && !own && (
                        <button
                          onClick={() => handleSaveCopy(w)}
                          disabled={savingId === w.id}
                          className="h-10 bg-muted text-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-muted/80 transition-all px-4 disabled:opacity-50"
                        >
                          {savingId === w.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Save
                        </button>
                      )}
                      <button
                        onClick={() => handlePrint(w)}
                        className="h-10 bg-muted text-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-muted/80 transition-all px-4"
                      >
                        <FileText size={12} /> PDF
                      </button>
                      {/* Delete — only own workouts, not in community mode */}
                      {own && mode !== "community" && (
                        <button
                          onClick={() => setDeleteTarget(w)}
                          className="h-10 bg-destructive/10 text-destructive flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-destructive/20 transition-all px-4"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmActionModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Workout"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default CommunityWorkoutBank;
