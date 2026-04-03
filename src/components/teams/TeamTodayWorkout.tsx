import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Dumbbell, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  rosterId: string;
}

const TeamTodayWorkout = ({ rosterId }: Props) => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("team_workouts")
        .select("*")
        .eq("roster_id", rosterId)
        .order("created_at", { ascending: false })
        .limit(5);
      setWorkouts(data || []);

      // Auto-expand the most recent
      if (data?.length) setExpandedId(data[0].id);

      if (user && data?.length) {
        const ids = data.map((w) => w.id);
        const { data: completions } = await supabase
          .from("team_workout_completions")
          .select("team_workout_id")
          .eq("user_id", user.id)
          .in("team_workout_id", ids);
        setCompletedIds(new Set((completions || []).map((c) => c.team_workout_id)));
      }
    };
    load();
  }, [rosterId, user]);

  const handleComplete = async (workoutId: string) => {
    if (!user) return;
    const { error } = await supabase.from("team_workout_completions").insert({
      team_workout_id: workoutId,
      user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") toast.info("Already logged!");
      else toast.error(error.message);
    } else {
      toast.success("Workout logged! 🔥");
      setCompletedIds(new Set([...completedIds, workoutId]));

      await supabase.from("team_feed").insert({
        roster_id: rosterId,
        user_id: user.id,
        type: "workout_log",
        content: `Just completed: ${workouts.find((w) => w.id === workoutId)?.title || "a workout"} 💪`,
      });
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-2">
        <Dumbbell size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Assigned Workouts</h3>
      </div>

      {workouts.map((w) => {
        const done = completedIds.has(w.id);
        const exercises = (w.exercises as any[]) || [];
        const overdue = !done && isOverdue(w.due_date);
        const isExpanded = expandedId === w.id;

        return (
          <Card key={w.id} className={`overflow-hidden transition-opacity ${done ? "opacity-60" : ""} ${overdue ? "border-destructive/50" : ""}`}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : w.id)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                {done ? (
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Check size={16} className="text-green-500" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Dumbbell size={16} className="text-primary" />
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-foreground text-sm">{w.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{exercises.length} exercises</span>
                    {w.due_date && (
                      <span className={`flex items-center gap-0.5 ${overdue ? "text-destructive font-bold" : ""}`}>
                        <Clock size={10} /> {overdue ? "Overdue" : `Due ${new Date(w.due_date).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 pb-4 space-y-3">
                {w.description && <p className="text-xs text-muted-foreground pt-2">{w.description}</p>}

                {exercises.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {exercises.map((ex: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-primary font-mono font-bold w-5">{i + 1}</span>
                          <div>
                            <span className="text-sm font-medium text-foreground">{ex.title || ex.name}</span>
                            {(ex.notes) && (
                              <p className="text-[10px] text-muted-foreground">{ex.notes}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {ex.sets}{ex.reps ? `×${ex.reps}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {!done && (
                  <Button size="sm" className="w-full font-bold uppercase tracking-wider" onClick={() => handleComplete(w.id)}>
                    Mark Complete 🔥
                  </Button>
                )}
                {done && (
                  <p className="text-center text-xs text-green-500 font-bold py-1">✅ Completed</p>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {workouts.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No workouts assigned yet — check back soon!</p>
      )}
    </div>
  );
};

export default TeamTodayWorkout;
