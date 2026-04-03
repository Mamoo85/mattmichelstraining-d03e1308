import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Users, Trophy, Dumbbell, Flame, ChevronDown, Zap, Target, TrendingUp, Share2 } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_WORKOUT = {
  title: "Week 1 — Foundation",
  exercises: [
    { name: "Trap Bar Deadlift", sets: "4×6", note: "Build from 60%" },
    { name: "DB Split Squat", sets: "3×8 each", note: "Controlled descent" },
    { name: "Band Pull-Aparts", sets: "3×15", note: "Squeeze at top" },
    { name: "Plank Hold", sets: "3×30s", note: "Brace hard" },
    { name: "Box Jumps", sets: "4×3", note: "Stick the landing" },
  ],
};

const FEATURES = [
  { icon: Dumbbell, label: "Pro Programming", desc: "Real strength & speed work — not random WODs" },
  { icon: Flame, label: "Team Feed", desc: "Celebrate PRs, build streaks, compete on the leaderboard" },
  { icon: Target, label: "Track Everything", desc: "Log workouts, see progress, earn badges" },
  { icon: Share2, label: "No App Required", desc: "Works on any phone — or just download the PDF" },
];

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
  const [showWorkout, setShowWorkout] = useState(false);

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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* HERO */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-6 py-12 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-md space-y-8">
          {/* Brand chip */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5">
            <Zap size={14} className="text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-[0.2em]">M² Teams</span>
          </div>

          {/* Team name */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight leading-none">
              {team.team_name}
            </h1>
            {team.sport && (
              <div className="inline-block bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                {team.sport}
              </div>
            )}
            {team.school_name && (
              <p className="text-muted-foreground text-sm">{team.school_name}</p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-black text-primary">{memberCount}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Athletes</div>
            </div>
            {coachName && (
              <div className="text-center">
                <div className="text-2xl font-black text-primary">
                  <Trophy size={24} className="inline" />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{coachName}</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-black text-primary">100%</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Free</div>
            </div>
          </div>

          {/* CTA */}
          {alreadyMember ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-bold text-sm px-4 py-2 rounded-full">
                <Flame size={16} /> You're on this team
              </div>
              <Button onClick={() => navigate("/my-team")} size="lg" className="w-full text-lg font-black uppercase tracking-wider">
                <Dumbbell size={18} className="mr-2" />
                Go to My Team
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleJoin}
              disabled={joining}
              size="lg"
              className="w-full h-14 text-lg font-black uppercase tracking-wider rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
            >
              {joining ? (
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : user ? (
                <>
                  <Flame size={20} className="mr-2" />
                  Join the Team
                </>
              ) : (
                "Sign Up & Join — Free"
              )}
            </Button>
          )}

          {/* Scroll hint */}
          <button
            onClick={() => setShowWorkout(true)}
            className="flex flex-col items-center gap-1 mx-auto text-muted-foreground hover:text-primary transition-colors pt-4"
          >
            <span className="text-[10px] uppercase tracking-widest">See the workout</span>
            <ChevronDown size={20} className="animate-bounce" />
          </button>
        </div>
      </section>

      {/* WORKOUT PREVIEW */}
      <section className="px-6 pb-12">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black uppercase tracking-wider">This Week's Program</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Sample — {SAMPLE_WORKOUT.title}</p>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {SAMPLE_WORKOUT.exercises.map((ex, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-5 py-4 ${
                  i < SAMPLE_WORKOUT.exercises.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{ex.name}</div>
                    <div className="text-[11px] text-muted-foreground">{ex.note}</div>
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                  {ex.sets}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Your coach assigns real workouts weekly. Log them, track PRs, compete.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 pb-12">
        <div className="max-w-md mx-auto">
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon size={18} className="text-primary" />
                </div>
                <div className="font-bold text-sm">{f.label}</div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF MOCK */}
      <section className="px-6 pb-12">
        <div className="max-w-md mx-auto space-y-4">
          <h3 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">Team Feed Preview</h3>
          <div className="space-y-3">
            {[
              { name: "Jake M.", text: "Just hit 225 on bench! 🔥", reactions: 12, type: "PR" },
              { name: "Coach", text: "Week 2 programming is live. Let's go.", reactions: 8, type: "Announcement" },
              { name: "Ava R.", text: "7-day streak — who else is keeping up?", reactions: 6, type: "Streak" },
            ].map((post, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                      {post.name[0]}
                    </div>
                    <span className="font-bold text-sm">{post.name}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {post.type}
                  </span>
                </div>
                <p className="text-sm">{post.text}</p>
                <div className="flex items-center gap-1 text-primary">
                  <Flame size={14} />
                  <span className="text-xs font-bold">{post.reactions}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="px-6 pb-16">
        <div className="max-w-md mx-auto space-y-4 text-center">
          {!alreadyMember && (
            <Button
              onClick={handleJoin}
              disabled={joining}
              size="lg"
              className="w-full h-14 text-lg font-black uppercase tracking-wider rounded-xl shadow-lg shadow-primary/25"
            >
              {joining ? "Joining..." : user ? "Join the Team 🔥" : "Sign Up & Join — Free"}
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Powered by M² Performance Training
          </p>
        </div>
      </section>
    </div>
  );
};

export default JoinTeam;
