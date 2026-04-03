import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Users, Trophy, Dumbbell, Download } from "lucide-react";
import { toast } from "sonner";

const JoinTeam = () => {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<any>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [coachName, setCoachName] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!code) return;
    const load = async () => {
      const { data: roster } = await supabase
        .from("team_rosters")
        .select("*")
        .eq("invite_code", code.toUpperCase())
        .single();

      if (!roster) { setLoading(false); return; }
      setTeam(roster);

      const { count } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("roster_id", roster.id);
      setMemberCount(count || 0);

      if (roster.coach_user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, athlete_name")
          .eq("user_id", roster.coach_user_id)
          .single();
        if (profile) setCoachName(profile.athlete_name || profile.full_name || "Coach");
      }

      if (user) {
        const { data: existing } = await supabase
          .from("team_members")
          .select("id")
          .eq("roster_id", roster.id)
          .eq("athlete_user_id", user.id)
          .maybeSingle();
        if (existing) setAlreadyMember(true);
      }

      setLoading(false);
    };
    load();
  }, [code, user]);

  const handleJoin = async () => {
    if (!user) {
      navigate(`/auth?redirect=/join/${code}`);
      return;
    }
    if (!team) return;
    setJoining(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, athlete_name, email")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase.from("team_members").insert({
        roster_id: team.id,
        athlete_user_id: user.id,
        athlete_name: profile?.athlete_name || profile?.full_name || "",
        athlete_email: profile?.email || user.email || "",
        role: "athlete",
        status: "active",
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("You're already on this team!");
          setAlreadyMember(true);
        } else {
          throw error;
        }
      } else {
        toast.success("You're on the team! 🔥");
        setAlreadyMember(true);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to join team");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-black text-foreground uppercase tracking-wider">Team Not Found</h1>
          <p className="text-muted-foreground">This invite code is invalid or expired.</p>
          <Button onClick={() => navigate("/")} variant="outline">Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Brand */}
        <div className="space-y-1">
          <div className="text-4xl font-black text-primary tracking-widest">M²</div>
          <div className="text-xs text-muted-foreground uppercase tracking-[0.3em]">Teams</div>
        </div>

        {/* Team card */}
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground uppercase tracking-wide">
              {team.team_name}
            </h1>
            {team.sport && (
              <div className="inline-block bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                {team.sport}
              </div>
            )}
            {team.school_name && (
              <p className="text-sm text-muted-foreground">{team.school_name}</p>
            )}
          </div>

          <div className="flex justify-center gap-8 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users size={16} className="text-primary" />
              <span>{memberCount} athletes</span>
            </div>
            {coachName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy size={16} className="text-primary" />
                <span>{coachName}</span>
              </div>
            )}
          </div>

          {alreadyMember ? (
            <div className="space-y-3">
              <p className="text-sm text-primary font-bold">✅ You're on this team</p>
              <Button onClick={() => navigate("/my-team")} className="w-full">
                <Dumbbell size={16} className="mr-2" />
                Go to My Team
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleJoin}
              disabled={joining}
              size="lg"
              className="w-full text-lg font-black uppercase tracking-wider"
            >
              {joining ? "Joining..." : user ? "Join Team" : "Sign Up & Join"}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Powered by M² Performance Training · mattmichelstraining.com
        </p>
      </div>
    </div>
  );
};

export default JoinTeam;
