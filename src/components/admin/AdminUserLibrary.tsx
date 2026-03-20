import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Dumbbell, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface AdminUserLibraryProps {
  userId: string;
}

const AdminUserLibrary = ({ userId }: AdminUserLibraryProps) => {
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  const { data: communityWorkouts = [], isLoading: loadingWorkouts } = useQuery({
    queryKey: ["admin-user-workouts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_workouts")
        .select("id, title, creator_name, exercises, created_at, is_public")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: activePrograms = [], isLoading: loadingActive } = useQuery({
    queryKey: ["admin-user-active-programs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_active_programs")
        .select("id, program_id, start_date, status, training_programs(title, category, sport, total_weeks)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: purchasedPrograms = [], isLoading: loadingPurchased } = useQuery({
    queryKey: ["admin-user-purchased-programs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchased_programs" as any)
        .select("id, program_title, program_type, sport, exercises, purchased_at, is_active")
        .eq("user_id", userId)
        .order("purchased_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const loading = loadingWorkouts || loadingActive || loadingPurchased;

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={16} className="text-primary animate-spin" />
      </div>
    );
  }

  const hasNothing = communityWorkouts.length === 0 && activePrograms.length === 0 && purchasedPrograms.length === 0;

  if (hasNothing) {
    return <p className="text-xs text-muted-foreground">No workouts or programs in library.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Interactive Programs */}
      {activePrograms.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1.5 flex items-center gap-1">
            <BookOpen size={10} /> Interactive Programs ({activePrograms.length})
          </p>
          <div className="space-y-1">
            {activePrograms.map((ap: any) => (
              <div key={ap.id} className="bg-card border border-border p-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{ap.training_programs?.title || "Unknown"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ap.training_programs?.category}{ap.training_programs?.sport ? ` · ${ap.training_programs.sport}` : ""}
                    {ap.training_programs?.total_weeks ? ` · ${ap.training_programs.total_weeks}wk` : ""}
                  </p>
                </div>
                <Badge
                  variant={ap.status === "active" ? "default" : "secondary"}
                  className="text-[8px] uppercase tracking-widest shrink-0"
                >
                  {ap.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchased / Custom Programs */}
      {purchasedPrograms.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1.5 flex items-center gap-1">
            <BookOpen size={10} /> Custom Programs ({purchasedPrograms.length})
          </p>
          <div className="space-y-1">
            {purchasedPrograms.map((pp: any) => {
              const exercises = Array.isArray(pp.exercises) ? pp.exercises : [];
              return (
                <div key={pp.id} className="bg-card border border-border p-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{pp.program_title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {pp.program_type}{pp.sport ? ` · ${pp.sport}` : ""} · {exercises.length} exercises
                      </p>
                    </div>
                    <Badge
                      variant={pp.is_active ? "default" : "secondary"}
                      className="text-[8px] uppercase tracking-widest shrink-0"
                    >
                      {pp.is_active ? "active" : "past"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Community Workouts */}
      {communityWorkouts.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1.5 flex items-center gap-1">
            <Dumbbell size={10} /> Saved Workouts ({communityWorkouts.length})
          </p>
          <div className="space-y-1">
            {communityWorkouts.map((w: any) => {
              const exercises = Array.isArray(w.exercises) ? w.exercises : [];
              const isExpanded = expandedWorkout === w.id;
              return (
                <div key={w.id} className="bg-card border border-border">
                  <button
                    onClick={() => setExpandedWorkout(isExpanded ? null : w.id)}
                    className="w-full text-left p-2 flex items-center justify-between hover:bg-accent/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-foreground truncate">{w.title}</p>
                        {!w.is_public && (
                          <Badge variant="outline" className="text-[7px] px-1 py-0">Private</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        by {w.creator_name} · {exercises.length} exercises · {new Date(w.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                  </button>
                  {isExpanded && exercises.length > 0 && (
                    <div className="border-t border-border px-3 py-2 space-y-1">
                      {exercises.map((ex: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className="text-muted-foreground font-mono w-4 text-right">{i + 1}.</span>
                          <span className="font-bold text-foreground flex-1 truncate">{ex.title || ex.name}</span>
                          <span className="font-mono text-primary shrink-0">{ex.sets || "3"}×{ex.reps || "10"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserLibrary;
