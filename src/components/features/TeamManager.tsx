import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Loader2, Edit2, Check, X, UserPlus, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import SectionHeader from "@/components/shared/SectionHeader";

interface Roster {
  id: string;
  team_name: string;
  sport: string | null;
  created_at: string;
}

interface Member {
  id: string;
  roster_id: string;
  athlete_email: string;
  athlete_user_id: string | null;
  athlete_name: string | null;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
}

const TeamManager = () => {
  const { user } = useAuth();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSport, setTeamSport] = useState("");
  const [savingName, setSavingName] = useState(false);

  const fetchRoster = async () => {
    if (!user) return;
    setLoading(true);

    // Get or create roster
    const { data: rosters } = await supabase
      .from("team_rosters")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    let currentRoster: Roster;
    if (rosters && rosters.length > 0) {
      currentRoster = rosters[0] as any;
    } else {
      // Auto-create roster for team subscribers
      const { data: newRoster, error } = await supabase
        .from("team_rosters")
        .insert({ owner_id: user.id, team_name: "My Team" } as any)
        .select()
        .single();
      if (error || !newRoster) {
        toast({ title: "Failed to create roster", variant: "destructive" });
        setLoading(false);
        return;
      }
      currentRoster = newRoster as any;
    }

    setRoster(currentRoster);
    setTeamName(currentRoster.team_name);
    setTeamSport(currentRoster.sport || "");

    // Load members
    const { data: memberData } = await supabase
      .from("team_members")
      .select("*")
      .eq("roster_id", currentRoster.id)
      .order("invited_at");

    if (memberData) setMembers(memberData as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchRoster(); }, [user]);

  const handleAddMember = async () => {
    if (!roster || !newEmail.trim()) return;
    if (!newEmail.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setAdding(true);

    // Check if this email already has an account
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name, athlete_name")
      .eq("email", newEmail.trim().toLowerCase())
      .maybeSingle();

    const { error } = await supabase.from("team_members").insert({
      roster_id: roster.id,
      athlete_email: newEmail.trim().toLowerCase(),
      athlete_user_id: profile?.user_id || null,
      athlete_name: newName.trim() || profile?.athlete_name || profile?.full_name || null,
      status: profile?.user_id ? "active" : "invited",
      joined_at: profile?.user_id ? new Date().toISOString() : null,
    } as any);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already on roster", description: "This athlete is already on your team.", variant: "destructive" });
      } else {
        toast({ title: "Failed to add", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Athlete added!", description: profile?.user_id ? "Linked to their M² account." : "They'll be linked when they create an account." });
      setNewEmail("");
      setNewName("");
      fetchRoster();
    }
    setAdding(false);
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Failed to remove", variant: "destructive" });
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast({ title: "Removed from roster" });
    }
  };

  const handleSaveTeamName = async () => {
    if (!roster) return;
    setSavingName(true);
    await supabase
      .from("team_rosters")
      .update({ team_name: teamName.trim() || "My Team", sport: teamSport.trim() || null } as any)
      .eq("id", roster.id);
    setRoster({ ...roster, team_name: teamName.trim() || "My Team", sport: teamSport.trim() || null });
    setEditingName(false);
    setSavingName(false);
    toast({ title: "Team updated" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  const activeCount = members.filter((m) => m.status === "active").length;
  const invitedCount = members.filter((m) => m.status === "invited").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Team Management"
        timestamp="Manage your roster — add and remove athletes"
      />

      {/* Team Info */}
      <div className="bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Your Team</span>
          </div>
          {!editingName && (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
            >
              <Edit2 size={10} /> Edit
            </button>
          )}
        </div>

        {editingName ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Team Name</label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. GP South Baseball" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sport</label>
              <Input value={teamSport} onChange={(e) => setTeamSport(e.target.value)} placeholder="e.g. Baseball" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveTeamName}
                disabled={savingName}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {savingName ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
              <button
                onClick={() => { setEditingName(false); setTeamName(roster?.team_name || ""); setTeamSport(roster?.sport || ""); }}
                className="flex items-center gap-1.5 bg-muted text-muted-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{roster?.team_name}</h3>
            {roster?.sport && (
              <p className="text-xs text-muted-foreground mt-0.5">{roster.sport}</p>
            )}
            <div className="flex gap-4 mt-3">
              <div className="bg-muted px-3 py-2">
                <p className="text-lg font-mono font-bold text-primary">{activeCount}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
              </div>
              <div className="bg-muted px-3 py-2">
                <p className="text-lg font-mono font-bold text-muted-foreground">{invitedCount}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Invited</p>
              </div>
              <div className="bg-muted px-3 py-2">
                <p className="text-lg font-mono font-bold text-foreground">{members.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Athlete */}
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Add Athlete</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Athlete email"
            type="email"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (optional)"
          />
          <button
            onClick={handleAddMember}
            disabled={adding || !newEmail.trim()}
            className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          If the athlete already has an M² account, they'll be linked automatically.
        </p>
      </div>

      {/* Roster */}
      {members.length > 0 ? (
        <div className="bg-card border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted flex items-center gap-2">
            <Users size={12} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Roster</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{members.length} athletes</span>
          </div>
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {(m.athlete_name || m.athlete_email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {m.athlete_name || m.athlete_email.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{m.athlete_email}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 shrink-0 ${
                  m.status === "active"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {m.status === "active" ? "Active" : "Invited"}
                </span>
                <button
                  onClick={() => handleRemove(m.id)}
                  className="text-muted-foreground hover:text-destructive transition-all shrink-0"
                  title="Remove from roster"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border-2 border-primary/20 p-8 text-center">
          <Users size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-bold text-foreground mb-1">No athletes on your roster yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add your athletes by email above. If they already have an M² account, they'll be linked instantly.
            If not, they'll be connected when they sign up.
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamManager;
