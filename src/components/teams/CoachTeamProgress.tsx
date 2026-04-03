import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BarChart3, CheckCircle, XCircle, Users } from "lucide-react";

interface Props {
  rosterId: string | null;
}

const CoachTeamProgress = ({ rosterId }: Props) => {
  const [members, setMembers] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);

  useEffect(() => {
    if (!rosterId) return;
    const load = async () => {
      const [membersRes, workoutsRes, completionsRes] = await Promise.all([
        supabase.from("team_members").select("athlete_user_id, athlete_name").eq("roster_id", rosterId).eq("status", "active"),
        supabase.from("team_workouts").select("id, title, due_date").eq("roster_id", rosterId).order("created_at", { ascending: false }).limit(10),
        supabase.from("team_workout_completions").select("team_workout_id, user_id, completed_at")
      ]);
      setMembers(membersRes.data || []);
      setWorkouts(workoutsRes.data || []);
      setCompletions(completionsRes.data || []);
    };
    load();
  }, [rosterId]);

  if (!rosterId) {
    return <p className="text-center text-sm text-muted-foreground py-8 mt-4">Select a team first</p>;
  }

  // Build a completion matrix: workout × athlete
  const completionSet = new Set(completions.map((c) => `${c.team_workout_id}:${c.user_id}`));

  const totalAssignments = workouts.length * members.length;
  const totalCompletions = workouts.reduce((acc, w) => {
    return acc + members.filter((m) => completionSet.has(`${w.id}:${m.athlete_user_id}`)).length;
  }, 0);
  const completionRate = totalAssignments > 0 ? Math.round((totalCompletions / totalAssignments) * 100) : 0;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Team Progress</h3>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-black text-primary">{members.length}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Athletes</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-black text-primary">{workouts.length}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Workouts</div>
        </Card>
        <Card className="p-3 text-center">
          <div className={`text-2xl font-black ${completionRate >= 70 ? "text-green-500" : completionRate >= 40 ? "text-yellow-500" : "text-destructive"}`}>
            {completionRate}%
          </div>
          <div className="text-[10px] text-muted-foreground uppercase">Completion</div>
        </Card>
      </div>

      {/* Grid: workouts vs athletes */}
      {workouts.length > 0 && members.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-bold uppercase tracking-wider">Athlete</th>
                {workouts.map((w) => (
                  <th key={w.id} className="text-center py-2 px-1 text-muted-foreground font-bold uppercase tracking-wider max-w-[80px] truncate" title={w.title}>
                    {w.title.length > 8 ? w.title.slice(0, 8) + "…" : w.title}
                  </th>
                ))}
                <th className="text-center py-2 px-2 text-muted-foreground font-bold uppercase tracking-wider">Rate</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const memberCompletions = workouts.filter((w) => completionSet.has(`${w.id}:${m.athlete_user_id}`)).length;
                const memberRate = workouts.length > 0 ? Math.round((memberCompletions / workouts.length) * 100) : 0;
                return (
                  <tr key={m.athlete_user_id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 font-semibold text-foreground">{m.athlete_name || "—"}</td>
                    {workouts.map((w) => (
                      <td key={w.id} className="text-center py-2 px-1">
                        {completionSet.has(`${w.id}:${m.athlete_user_id}`) ? (
                          <CheckCircle size={14} className="text-green-500 mx-auto" />
                        ) : (
                          <XCircle size={14} className="text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    ))}
                    <td className={`text-center py-2 px-2 font-black ${memberRate >= 70 ? "text-green-500" : memberRate >= 40 ? "text-yellow-500" : "text-destructive"}`}>
                      {memberRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">
          {workouts.length === 0 ? "No workouts assigned yet" : "No athletes on the team yet"}
        </p>
      )}
    </div>
  );
};

export default CoachTeamProgress;
