import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppNavbar from "@/components/layout/AppNavbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CoachMyTeams from "@/components/teams/CoachMyTeams";
import CoachRoster from "@/components/teams/CoachRoster";
import CoachAssignWorkout from "@/components/teams/CoachAssignWorkout";
import CoachTeamFeed from "@/components/teams/CoachTeamFeed";
import CoachTeamProgress from "@/components/teams/CoachTeamProgress";
import { Loader2, ShieldAlert } from "lucide-react";

const CoachHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCoach, setIsCoach] = useState<boolean | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data: coachProfile } = await supabase
        .from("coach_profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      setIsCoach(!!coachProfile || !!isAdmin);
    };
    check();
  }, [user]);

  if (isCoach === null) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  if (!isCoach) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="flex flex-col items-center justify-center pt-32 gap-4 px-6 text-center">
          <ShieldAlert size={48} className="text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">Coach Access Required</h1>
          <p className="text-muted-foreground text-sm max-w-md">
            This area is for registered coaches. Contact Matt to get set up as a coach.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-24 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-wider">Coach Hub</h1>
          <p className="text-sm text-muted-foreground">Manage your teams, assign workouts, track progress</p>
        </div>

        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="teams" className="text-xs">Teams</TabsTrigger>
            <TabsTrigger value="roster" className="text-xs">Roster</TabsTrigger>
            <TabsTrigger value="assign" className="text-xs">Assign</TabsTrigger>
            <TabsTrigger value="progress" className="text-xs">Progress</TabsTrigger>
            <TabsTrigger value="feed" className="text-xs">Feed</TabsTrigger>
          </TabsList>

          <TabsContent value="teams">
            <CoachMyTeams
              onSelectTeam={(id) => setSelectedRosterId(id)}
              selectedRosterId={selectedRosterId}
            />
          </TabsContent>

          <TabsContent value="roster">
            <CoachRoster rosterId={selectedRosterId} />
          </TabsContent>

          <TabsContent value="assign">
            <CoachAssignWorkout rosterId={selectedRosterId} />
          </TabsContent>

          <TabsContent value="progress">
            <CoachTeamProgress rosterId={selectedRosterId} />
          </TabsContent>

          <TabsContent value="feed">
            <CoachTeamFeed rosterId={selectedRosterId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CoachHub;
