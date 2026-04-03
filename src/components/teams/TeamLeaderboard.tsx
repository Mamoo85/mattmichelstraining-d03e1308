import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface Props {
  rosterId: string;
}

const TeamLeaderboard = ({ rosterId }: Props) => {
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      // Get team members with their points
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("athlete_user_id, athlete_name")
        .eq("roster_id", rosterId)
        .eq("status", "active");

      if (!teamMembers?.length) { setMembers([]); return; }

      const userIds = teamMembers.map((m) => m.athlete_user_id).filter(Boolean);
      const { data: points } = await supabase
        .from("user_points")
        .select("user_id, total_points, level")
        .in("user_id", userIds);

      const { data: completions } = await supabase
        .from("team_workout_completions")
        .select("user_id")
        .in("user_id", userIds);

      const completionCounts: Record<string, number> = {};
      (completions || []).forEach((c) => {
        completionCounts[c.user_id] = (completionCounts[c.user_id] || 0) + 1;
      });

      const pointsMap: Record<string, any> = {};
      (points || []).forEach((p) => { pointsMap[p.user_id] = p; });

      const merged = teamMembers.map((m) => ({
        ...m,
        points: pointsMap[m.athlete_user_id]?.total_points || 0,
        level: pointsMap[m.athlete_user_id]?.level || "rookie",
        completions: completionCounts[m.athlete_user_id] || 0,
      }));

      merged.sort((a, b) => b.points - a.points);
      setMembers(merged);
    };
    load();
  }, [rosterId]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Leaderboard</h3>
      </div>

      {members.map((m, i) => (
        <Card key={m.athlete_user_id} className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg w-8 text-center">{medals[i] || `${i + 1}`}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{m.athlete_name || "Unknown"}</p>
              <p className="text-xs text-muted-foreground capitalize">{m.level} · {m.completions} workouts done</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-primary">{m.points}</p>
            <p className="text-[10px] text-muted-foreground uppercase">pts</p>
          </div>
        </Card>
      ))}

      {members.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No athletes on this team yet</p>
      )}
    </div>
  );
};

export default TeamLeaderboard;
