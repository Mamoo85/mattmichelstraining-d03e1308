import { useState, useEffect } from "react";
import { Search, FileText, User, Calendar, Dumbbell, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { printCommunityWorkout } from "./printCommunityWorkout";

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
}

interface CommunityWorkoutBankProps {
  onCreateNew?: () => void;
}

const CommunityWorkoutBank = ({ onCreateNew }: CommunityWorkoutBankProps) => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<CommunityWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadWorkouts();
  }, [user]);

  const loadWorkouts = async () => {
    setLoading(true);
    // Fetch public workouts + user's own private workouts
    const [publicRes, privateRes] = await Promise.all([
      supabase
        .from("community_workouts")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(50),
      user
        ? supabase
            .from("community_workouts")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_public", false)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);
    const publicWorkouts = (publicRes.data as any[]) ?? [];
    const privateWorkouts = (privateRes.data as any[]) ?? [];
    // Merge, deduplicate by id
    const allMap = new Map<string, any>();
    for (const w of [...privateWorkouts, ...publicWorkouts]) {
      if (!allMap.has(w.id)) allMap.set(w.id, w);
    }
    setWorkouts(Array.from(allMap.values()));
    setLoading(false);
  };

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Mattletes Workout Bank</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Community-created workouts · Use any, share yours</p>
        </div>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <Dumbbell size={12} /> Create
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center bg-card border border-border px-3 h-10">
        <Search size={14} className="text-muted-foreground mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search workouts or creators…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {/* Workout list */}
      {loading ? (
        <p className="text-xs text-muted-foreground p-4 text-center">Loading workouts…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Dumbbell size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No workouts yet. Be the first to share!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((w) => (
            <div key={w.id} className="bg-card border border-border overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                className="w-full text-left p-4 hover:bg-muted/50 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground truncate">{w.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User size={10} /> {w.creator_name}
                      </span>
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
                  {/* Exercise list */}
                  <div className="space-y-1.5">
                    {w.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
                        <span className="font-bold text-foreground flex-1">{ex.title}</span>
                        <span className="font-mono text-primary">{ex.sets}×{ex.reps}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("open-workout-zone", {
                            detail: {
                              title: w.title,
                              source: "community",
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
                      <Play size={12} /> Start Workout
                    </button>
                    <button
                      onClick={() => handlePrint(w)}
                      className="flex-1 h-10 bg-muted text-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-muted/80 transition-all"
                    >
                      <FileText size={12} /> Print PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityWorkoutBank;
