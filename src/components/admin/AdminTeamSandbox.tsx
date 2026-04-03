import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical, Plus, Users, Copy, ExternalLink, Flame,
  Send, Trash2, Dumbbell, Eye, MessageSquare, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminTeamSandbox = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState("Test Team");
  const [newTeamSport, setNewTeamSport] = useState("Football");
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState("coach_announcement");
  const [wkTitle, setWkTitle] = useState("Test Workout");
  const [creating, setCreating] = useState(false);

  const loadTeams = async () => {
    const { data } = await supabase
      .from("team_rosters")
      .select("*, team_members(count)")
      .order("created_at", { ascending: false });
    setTeams(data || []);
  };

  const loadTeamDetails = async (teamId: string) => {
    const [membersRes, feedRes, workoutsRes] = await Promise.all([
      supabase.from("team_members").select("*").eq("roster_id", teamId).order("joined_at", { ascending: false }),
      supabase.from("team_feed").select("*").eq("roster_id", teamId).order("created_at", { ascending: false }).limit(20),
      supabase.from("team_workouts").select("*").eq("roster_id", teamId).order("created_at", { ascending: false }).limit(10),
    ]);
    setMembers(membersRes.data || []);
    setFeedItems(feedRes.data || []);
    setWorkouts(workoutsRes.data || []);
  };

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (selectedTeam) loadTeamDetails(selectedTeam.id); }, [selectedTeam]);

  const selectTeam = (t: any) => setSelectedTeam(t);

  // Create test team + auto-join admin as coach & athlete
  const createTestTeam = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const { data: roster, error } = await supabase
        .from("team_rosters")
        .insert({
          owner_id: user.id,
          coach_user_id: user.id,
          team_name: newTeamName.trim() || "Test Team",
          sport: newTeamSport.trim() || "Football",
          school_name: "Admin Sandbox",
        })
        .select()
        .single();

      if (error) throw error;

      // Also join admin as an athlete member for testing athlete view
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, athlete_name, email")
        .eq("user_id", user.id)
        .single();

      await supabase.from("team_members").insert({
        roster_id: roster.id,
        athlete_user_id: user.id,
        athlete_name: profile?.athlete_name || profile?.full_name || "Admin",
        athlete_email: profile?.email || "",
        role: "athlete",
        status: "active",
      });

      toast.success("Test team created! You're coach + athlete.");
      loadTeams();
      setSelectedTeam(roster);
    } catch (e: any) {
      toast.error(e.message);
    }
    setCreating(false);
  };

  // Seed fake athletes
  const seedFakeAthletes = async () => {
    if (!selectedTeam || !user) return;
    const fakeNames = [
      "Jake Martinez", "Ava Robinson", "Tyler Chen", "Mia Thompson",
      "Ethan Brooks", "Sophia Davis", "Liam Wilson", "Emma Garcia",
    ];
    const inserts = fakeNames.map((name) => ({
      roster_id: selectedTeam.id,
      athlete_user_id: user.id, // all point to admin for testing
      athlete_name: name,
      athlete_email: `${name.toLowerCase().replace(" ", ".")}@test.m2.com`,
      role: "athlete" as const,
      status: "active" as const,
    }));

    const { error } = await supabase.from("team_members").insert(inserts);
    if (error) toast.error(error.message);
    else { toast.success(`Added ${fakeNames.length} test athletes`); loadTeamDetails(selectedTeam.id); loadTeams(); }
  };

  // Post to feed
  const postToFeed = async () => {
    if (!selectedTeam || !user || !postContent.trim()) return;
    await supabase.from("team_feed").insert({
      roster_id: selectedTeam.id,
      user_id: user.id,
      type: postType,
      content: postContent.trim(),
      is_pinned: postType === "coach_announcement",
    });
    setPostContent("");
    toast.success("Posted to team feed");
    loadTeamDetails(selectedTeam.id);
  };

  // Seed sample feed posts
  const seedFeedPosts = async () => {
    if (!selectedTeam || !user) return;
    const posts = [
      { type: "coach_announcement", content: "Week 2 programming is live. No excuses — let's get after it.", is_pinned: true },
      { type: "pr", content: "Jake just hit 225 on bench! New PR! 🔥🔥🔥" },
      { type: "workout_log", content: "Ava completed Leg Day — all 5 exercises logged ✅" },
      { type: "shoutout", content: "Tyler gave a shoutout to Mia for hitting a 7-day streak! 💪" },
      { type: "pr", content: "Ethan deadlifted 315 for the first time! The weight room went crazy 🏆" },
      { type: "workout_log", content: "Sophia finished Upper Body A — 45 min session" },
      { type: "shoutout", content: "Coach Matt: Liam is the Athlete of the Week. 100% completion rate. 🙌" },
    ];
    await supabase.from("team_feed").insert(
      posts.map((p) => ({ ...p, roster_id: selectedTeam.id, user_id: user.id }))
    );
    toast.success("Seeded 7 sample posts");
    loadTeamDetails(selectedTeam.id);
  };

  // Assign test workout
  const assignTestWorkout = async () => {
    if (!selectedTeam || !user) return;
    await supabase.from("team_workouts").insert({
      roster_id: selectedTeam.id,
      assigned_by: user.id,
      title: wkTitle || "Test Workout",
      description: "Auto-generated test workout from admin sandbox",
      exercises: [
        { name: "Trap Bar Deadlift", sets: "4x6", notes: "Build from 60%" },
        { name: "DB Split Squat", sets: "3x8 each", notes: "Controlled descent" },
        { name: "Band Pull-Aparts", sets: "3x15", notes: "Squeeze at top" },
        { name: "Plank Hold", sets: "3x30s", notes: "Brace hard" },
      ],
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    });
    toast.success("Test workout assigned");
    loadTeamDetails(selectedTeam.id);
  };

  // Delete team
  const deleteTeam = async (teamId: string) => {
    await Promise.all([
      supabase.from("team_feed_reactions").delete().in(
        "feed_item_id",
        (feedItems || []).map((f) => f.id)
      ),
      supabase.from("team_feed").delete().eq("roster_id", teamId),
      supabase.from("team_workout_completions").delete().in(
        "team_workout_id",
        (workouts || []).map((w) => w.id)
      ),
      supabase.from("team_workouts").delete().eq("roster_id", teamId),
      supabase.from("team_members").delete().eq("roster_id", teamId),
    ]);
    await supabase.from("team_rosters").delete().eq("id", teamId);
    toast.success("Team deleted");
    setSelectedTeam(null);
    loadTeams();
  };

  const copyInvite = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
    toast.success("Invite link copied");
  };

  const typeEmoji: Record<string, string> = {
    pr: "🏆", workout_log: "💪", shoutout: "🙌", coach_announcement: "📢",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical size={16} className="text-primary" />
        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Team System Sandbox</h2>
      </div>

      {/* Quick actions bar */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase">Create Test Team</h3>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Team name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} className="w-36" />
          <Input placeholder="Sport" value={newTeamSport} onChange={(e) => setNewTeamSport(e.target.value)} className="w-28" />
          <Button onClick={createTestTeam} disabled={creating} size="sm">
            <Plus size={14} className="mr-1" /> Create
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/coach-hub", "_blank")}>
            <Eye size={14} className="mr-1" /> Open Coach View
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("/my-team", "_blank")}>
            <Users size={14} className="mr-1" /> Open Athlete View
          </Button>
          {selectedTeam?.invite_code && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/join/${selectedTeam.invite_code}`, "_blank")}>
              <ExternalLink size={14} className="mr-1" /> Open Join Page
            </Button>
          )}
        </div>
      </Card>

      {/* Team selector */}
      {teams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <Button
              key={t.id}
              variant={selectedTeam?.id === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => selectTeam(t)}
            >
              {t.team_name}
              <Badge variant="secondary" className="ml-1 text-[10px]">{t.team_members?.[0]?.count || 0}</Badge>
            </Button>
          ))}
        </div>
      )}

      {/* Selected team details */}
      {selectedTeam && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="feed" className="text-xs">Feed</TabsTrigger>
            <TabsTrigger value="workouts" className="text-xs">Workouts</TabsTrigger>
            <TabsTrigger value="danger" className="text-xs">⚠️</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-3 mt-3">
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground">{selectedTeam.team_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedTeam.sport} · {selectedTeam.school_name}
                  </p>
                </div>
                {selectedTeam.invite_code && (
                  <Button variant="ghost" size="sm" onClick={() => copyInvite(selectedTeam.invite_code)}>
                    <Copy size={12} className="mr-1" />{selectedTeam.invite_code}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-xl font-black text-primary">{members.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Members</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-xl font-black text-primary">{feedItems.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Posts</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-xl font-black text-primary">{workouts.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Workouts</div>
                </div>
              </div>
            </Card>

            {/* Seed actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={seedFakeAthletes}>
                <Users size={14} className="mr-1" /> Seed 8 Athletes
              </Button>
              <Button variant="outline" size="sm" onClick={seedFeedPosts}>
                <MessageSquare size={14} className="mr-1" /> Seed Feed Posts
              </Button>
              <Button variant="outline" size="sm" onClick={assignTestWorkout}>
                <Dumbbell size={14} className="mr-1" /> Assign Test Workout
              </Button>
            </div>

            {/* Members list */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-muted-foreground uppercase">Members</h4>
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-card rounded text-sm">
                  <div>
                    <span className="font-semibold text-foreground">{m.athlete_name || "—"}</span>
                    <span className="text-xs text-muted-foreground ml-2">{m.athlete_email}</span>
                  </div>
                  <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-[9px]">
                    {m.role} · {m.status}
                  </Badge>
                </div>
              ))}
              {members.length === 0 && <p className="text-xs text-muted-foreground">No members</p>}
            </div>
          </TabsContent>

          {/* FEED */}
          <TabsContent value="feed" className="space-y-3 mt-3">
            <Card className="p-3 space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase">Post to Feed</h4>
              <div className="flex gap-2">
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value)}
                  className="bg-muted text-foreground text-xs rounded px-2 py-1 border border-border"
                >
                  <option value="coach_announcement">📢 Announcement</option>
                  <option value="pr">🏆 PR</option>
                  <option value="workout_log">💪 Workout Log</option>
                  <option value="shoutout">🙌 Shoutout</option>
                </select>
                <Input
                  placeholder="Post content..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && postToFeed()}
                />
                <Button size="icon" onClick={postToFeed}><Send size={14} /></Button>
              </div>
            </Card>

            {feedItems.map((item) => (
              <Card key={item.id} className={`p-3 ${item.is_pinned ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-start gap-2">
                  <span className="text-sm">{typeEmoji[item.type] || "💬"}</span>
                  <div className="flex-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                      {item.type.replace("_", " ")} · {new Date(item.created_at).toLocaleString()}
                    </div>
                    <p className="text-sm text-foreground mt-0.5">{item.content}</p>
                  </div>
                  {item.is_pinned && <Badge variant="default" className="text-[9px]">Pinned</Badge>}
                </div>
              </Card>
            ))}
            {feedItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No posts yet</p>}
          </TabsContent>

          {/* WORKOUTS */}
          <TabsContent value="workouts" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <Input placeholder="Workout title" value={wkTitle} onChange={(e) => setWkTitle(e.target.value)} className="flex-1" />
              <Button size="sm" onClick={assignTestWorkout}>
                <Plus size={14} className="mr-1" /> Assign
              </Button>
            </div>

            {workouts.map((w) => (
              <Card key={w.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground">{w.title}</h4>
                  <span className="text-[10px] text-muted-foreground">Due: {w.due_date}</span>
                </div>
                {Array.isArray(w.exercises) && (
                  <div className="space-y-1">
                    {(w.exercises as any[]).map((ex: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs px-2 py-1 bg-muted rounded">
                        <span className="text-foreground font-medium">{ex.name}</span>
                        <span className="text-primary font-mono">{ex.sets}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
            {workouts.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No workouts assigned</p>}
          </TabsContent>

          {/* DANGER ZONE */}
          <TabsContent value="danger" className="mt-3">
            <Card className="p-4 border-destructive/30 space-y-3">
              <h4 className="text-xs font-bold text-destructive uppercase">Danger Zone</h4>
              <p className="text-xs text-muted-foreground">
                Delete this test team and all its data (members, feed, workouts).
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Delete "${selectedTeam.team_name}" and all its data?`)) {
                    deleteTeam(selectedTeam.id);
                  }
                }}
              >
                <Trash2 size={14} className="mr-1" /> Delete Team
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {teams.length === 0 && !selectedTeam && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No teams yet — create a test team above to start testing
        </p>
      )}
    </div>
  );
};

export default AdminTeamSandbox;
