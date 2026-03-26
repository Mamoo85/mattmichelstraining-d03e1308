import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Dumbbell, Clock, ChevronDown, ChevronUp, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface SharedResult {
  id: string;
  user_id: string;
  workout_title: string;
  caption: string;
  image_url: string | null;
  image_status: string;
  stats: {
    exercises?: number;
    totalSets?: number;
    totalReps?: number;
    totalVolume?: number;
    duration?: number;
  };
  exercises: Array<{ title: string; sets: Array<{ set: number; reps: number; weight: number }> }>;
  created_at: string;
  athlete_name?: string;
  full_name?: string;
}

const SharedWorkoutFeed = () => {
  const [results, setResults] = useState<SharedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("shared_workout_results" as any)
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!data || (data as any[]).length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for names
      const userIds = [...new Set((data as any[]).map((d: any) => d.user_id))];
      const { data: profiles } = await (supabase
        .from("profiles_public" as any)
        .select("user_id, athlete_name, full_name") as any)
        .in("user_id", userIds);

      const profileMap = new Map(
        ((profiles || []) as any[]).map((p: any) => [p.user_id, p])
      );

      setResults(
        (data as any[]).map((d: any) => ({
          ...d,
          stats: typeof d.stats === "string" ? JSON.parse(d.stats) : d.stats || {},
          exercises: typeof d.exercises === "string" ? JSON.parse(d.exercises) : d.exercises || [],
          athlete_name: profileMap.get(d.user_id)?.athlete_name || null,
          full_name: profileMap.get(d.user_id)?.full_name || null,
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return null;
  if (results.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Community Results</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">See what fellow Mattletes are grinding</p>
      </div>

      <div className="space-y-2">
        {results.map((r) => {
          const displayName = r.athlete_name || r.full_name || "Mattlete";
          const isExpanded = expanded === r.id;
          const durationMin = r.stats.duration ? Math.floor(r.stats.duration / 60) : null;

          return (
            <div key={r.id} className="bg-card border border-border overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : r.id)}
                className="w-full text-left p-4 hover:bg-muted/50 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={12} className="text-muted-foreground" />
                      <span className="text-xs font-bold text-foreground">{displayName}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground truncate">{r.workout_title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      {r.stats.exercises && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Dumbbell size={10} /> {r.stats.exercises} exercises
                        </span>
                      )}
                      {r.stats.totalVolume && (
                        <span className="flex items-center gap-1 text-[10px] text-primary font-mono">
                          <Trophy size={10} /> {r.stats.totalVolume.toLocaleString()} lbs
                        </span>
                      )}
                      {durationMin && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock size={10} /> {durationMin} min
                        </span>
                      )}
                    </div>
                    {r.caption && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.caption}</p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-muted-foreground flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown size={14} className="text-muted-foreground flex-shrink-0 mt-1" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border p-4 space-y-3">
                  {/* Approved image */}
                  {r.image_url && r.image_status === "approved" && (
                    <img
                      src={r.image_url}
                      alt="Post workout"
                      className="w-full max-h-64 object-cover rounded-sm"
                    />
                  )}

                  {/* Exercise details */}
                  <div className="space-y-1.5">
                    {r.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">{ex.title}</span>
                        <span className="font-mono text-primary">
                          {ex.sets?.length || 0} sets
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Stats summary */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                    <div className="text-center">
                      <div className="text-sm font-bold font-mono text-foreground">{r.stats.totalSets || 0}</div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Sets</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold font-mono text-foreground">{r.stats.totalReps || 0}</div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Reps</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold font-mono text-foreground">
                        {(r.stats.totalVolume || 0).toLocaleString()}
                      </div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Lbs</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SharedWorkoutFeed;
