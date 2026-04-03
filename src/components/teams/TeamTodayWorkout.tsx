import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Dumbbell } from "lucide-react";
import { toast } from "sonner";

interface Props {
  rosterId: string;
}

const TeamTodayWorkout = ({ rosterId }: Props) => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("team_workouts")
        .select("*")
        .eq("roster_id", rosterId)
        .order("created_at", { ascending: false })
        .limit(5);
      setWorkouts(data || []);

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

      // Auto-post to feed
      await supabase.from("team_feed").insert({
        roster_id: rosterId,
        user_id: user.id,
        type: "workout_log",
        content: `Just completed: ${workouts.find((w) => w.id === workoutId)?.title || "a workout"} 💪`,
      });
    }
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
        return (
          <Card key={w.id} className={`p-4 space-y-3 ${done ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-foreground">{w.title}</h4>
                {w.due_date && (
                  <p className="text-xs text-muted-foreground">
                    Due: {new Date(w.due_date).toLocaleDateString()}
                  </p>
                )}
                {w.description && <p className="text-xs text-muted-foreground mt-1">{w.description}</p>}
              </div>
              {done && <Check size={20} className="text-green-500" />}
            </div>

            {exercises.length > 0 && (
              <div className="space-y-1">
                {exercises.map((ex: any, i: number) => (
                  <div key={i} className="text-xs flex gap-2 text-muted-foreground">
                    <span className="text-primary font-mono">{i + 1}.</span>
                    <span className="text-foreground font-medium">{ex.title}</span>
                    <span>{ex.sets}×{ex.reps}</span>
                    {ex.notes && <span className="italic">— {ex.notes}</span>}
                  </div>
                ))}
              </div>
            )}

            {!done && (
              <Button size="sm" className="w-full font-bold uppercase tracking-wider" onClick={() => handleComplete(w.id)}>
                Mark Complete 🔥
              </Button>
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
