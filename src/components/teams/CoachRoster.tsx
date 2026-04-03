import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, TrendingUp, Flame, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  rosterId: string | null;
}

const CoachRoster = ({ rosterId }: Props) => {
  const [members, setMembers] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completionData, setCompletionData] = useState<Record<string, number>>({});
  const [streakData, setStreakData] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!rosterId) return;
    const load = async () => {
      const { data } = await supabase
        .from("team_members")
        .select("*")
        .eq("roster_id", rosterId)
        .order("joined_at", { ascending: false });
      setMembers(data || []);

      if (data?.length) {
        const userIds = data.map((m) => m.athlete_user_id).filter(Boolean);

        // Get workout completions per user
        const { data: completions } = await supabase
          .from("team_workout_completions")
          .select("user_id")
          .in("user_id", userIds);
        const counts: Record<string, number> = {};
        (completions || []).forEach((c) => {
          counts[c.user_id] = (counts[c.user_id] || 0) + 1;
        });
        setCompletionData(counts);

        // Get streak data from user_streaks or points
        const { data: points } = await supabase
          .from("user_points")
          .select("user_id, total_points")
          .in("user_id", userIds);
        const streaks: Record<string, number> = {};
        (points || []).forEach((p) => {
          streaks[p.user_id] = p.total_points;
        });
        setStreakData(streaks);
      }
    };
    load();
  }, [rosterId]);

  if (!rosterId) {
    return <p className="text-center text-sm text-muted-foreground py-8 mt-4">Select a team first</p>;
  }

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Roster ({members.length} athletes)
        </h3>
      </div>

      {members.map((m) => {
        const wkDone = completionData[m.athlete_user_id] || 0;
        const pts = streakData[m.athlete_user_id] || 0;
        const isExpanded = expandedId === m.id;

        return (
          <Card key={m.id} className="overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : m.id)}
              className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={16} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{m.athlete_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{m.athlete_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-[10px]">
                  {m.status}
                </Badge>
                {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3 bg-muted/20">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-lg font-black text-primary">{wkDone}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Workouts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-primary">{pts}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-primary flex items-center justify-center gap-1">
                      <Flame size={14} /> {wkDone > 0 ? "Active" : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">Status</div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Joined {new Date(m.joined_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </Card>
        );
      })}

      {members.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No athletes yet — share your invite link!
        </p>
      )}
    </div>
  );
};

export default CoachRoster;
