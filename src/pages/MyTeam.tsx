import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppNavbar from "@/components/layout/AppNavbar";
import TeamFeed from "@/components/teams/TeamFeed";
import TeamLeaderboard from "@/components/teams/TeamLeaderboard";
import TeamTodayWorkout from "@/components/teams/TeamTodayWorkout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Trophy, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const MyTeam = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membership, setMembership] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: member } = await supabase
        .from("team_members")
        .select("*, team_rosters(*)")
        .eq("athlete_user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (member) {
        setMembership(member);
        setTeam(member.team_rosters);

        // Get member count
        const { count } = await supabase
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("roster_id", (member.team_rosters as any).id)
          .eq("status", "active");
        setMemberCount(count || 0);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="flex flex-col items-center justify-center pt-32 gap-4 px-6 text-center">
          <Users size={48} className="text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">No Team Yet</h1>
          <p className="text-muted-foreground text-sm">
            Ask your coach for an invite link to join a team.
          </p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-24 space-y-4">
        {/* Team header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-foreground uppercase tracking-wider">
              {team.team_name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {team.sport && (
                <Badge variant="default" className="text-[10px] uppercase tracking-wider">
                  {team.sport}
                </Badge>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users size={12} /> {memberCount}
              </span>
              {team.school_name && (
                <span className="text-xs text-muted-foreground">{team.school_name}</span>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="feed" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="feed" className="text-xs">🔥 Feed</TabsTrigger>
            <TabsTrigger value="workout" className="text-xs">💪 Workout</TabsTrigger>
            <TabsTrigger value="board" className="text-xs">🏆 Board</TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
            <TeamFeed rosterId={team.id} />
          </TabsContent>

          <TabsContent value="workout">
            <TeamTodayWorkout rosterId={team.id} />
          </TabsContent>

          <TabsContent value="board">
            <TeamLeaderboard rosterId={team.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyTeam;
