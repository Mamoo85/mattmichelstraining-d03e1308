import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, ChevronDown, ChevronRight, Sparkles, Trash2, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

interface WorkoutExercise {
  title?: string;
  name?: string;
  sets: string;
  reps: string;
  notes?: string;
  phase?: string;
}

interface GeneratedWorkout {
  id: string;
  title: string;
  description: string | null;
  creator_name: string;
  exercises: WorkoutExercise[];
  user_id: string;
  created_at: string;
  is_public: boolean;
}

const AdminUserGeneratedWorkouts = () => {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeneratedWorkout | null>(null);
  const queryClient = useQueryClient();

  const { data: workouts = [], isLoading } = useQuery({
    queryKey: ["admin-user-generated-workouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_workouts")
        .select("*")
        .eq("creator_name", "Coach Matt AI")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as GeneratedWorkout[];
    },
  });

  // Get profiles for user names
  const userIds = [...new Set(workouts.map(w => w.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-user-profiles-generated", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-generated-workouts"] });
      toast.success("Workout deleted");
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = workouts.filter(w => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const profile = profileMap.get(w.user_id) as any;
    const userName = profile?.athlete_name || profile?.full_name || profile?.email || "";
    return w.title.toLowerCase().includes(q) || userName.toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">User Generated Workouts</h3>
          <p className="text-[10px] text-muted-foreground">{workouts.length} AI-generated workouts across all users</p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by workout title or user name..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border focus:border-primary outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          <Sparkles size={20} className="mx-auto mb-2 opacity-40" />
          No AI-generated workouts found
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((w) => {
            const profile = profileMap.get(w.user_id) as any;
            const userName = profile?.athlete_name || profile?.full_name || profile?.email || "Unknown";
            const isExpanded = expandedId === w.id;
            const exercises = Array.isArray(w.exercises) ? w.exercises : [];

            return (
              <div key={w.id} className="border border-border bg-card">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : w.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={12} className="text-muted-foreground shrink-0" /> : <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{w.title}</span>
                      <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 font-bold uppercase tracking-widest shrink-0">
                        AI Generated
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <User size={9} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{userName}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{exercises.length} exercises</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(w); }}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                    {w.description && (
                      <p className="text-[10px] text-muted-foreground italic">{w.description}</p>
                    )}
                    <div className="space-y-1">
                      {exercises.map((ex, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10px] bg-muted/30 p-2">
                          <span className="text-primary font-mono font-bold w-5 text-right shrink-0">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-foreground">{ex.title || ex.name}</span>
                              {ex.phase && (
                                <span className="text-[8px] font-bold uppercase px-1 py-0.5 bg-muted text-muted-foreground rounded">
                                  {ex.phase}
                                </span>
                              )}
                            </div>
                            {ex.notes && <p className="text-muted-foreground text-[9px] mt-0.5">{ex.notes}</p>}
                          </div>
                          <span className="font-mono text-primary shrink-0">{ex.sets}×{ex.reps}</span>
                        </div>
                      ))}
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
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Generated Workout"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

export default AdminUserGeneratedWorkouts;
