import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Roster {
  id: string;
  owner_id: string;
  team_name: string;
  sport: string | null;
  created_at: string;
  owner_name?: string;
  owner_email?: string;
  member_count?: number;
}

interface Member {
  id: string;
  athlete_email: string;
  athlete_name: string | null;
  status: string;
}

const AdminTeamRosters = () => {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const fetchRosters = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("team_rosters")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      // Enrich with owner profiles and member counts
      const ownerIds = (data as any[]).map((r) => r.owner_id);
      const [profilesRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email").in("user_id", ownerIds),
        supabase.from("team_members").select("roster_id"),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
      const countMap = new Map<string, number>();
      (membersRes.data || []).forEach((m: any) => {
        countMap.set(m.roster_id, (countMap.get(m.roster_id) || 0) + 1);
      });

      setRosters(
        (data as any[]).map((r) => ({
          ...r,
          owner_name: profileMap.get(r.owner_id)?.full_name || "Unknown",
          owner_email: profileMap.get(r.owner_id)?.email || "",
          member_count: countMap.get(r.id) || 0,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchRosters(); }, []);

  const toggleExpand = async (rosterId: string) => {
    if (expanded === rosterId) {
      setExpanded(null);
      return;
    }
    setExpanded(rosterId);
    setMembersLoading(true);
    const { data } = await supabase
      .from("team_members")
      .select("id, athlete_email, athlete_name, status")
      .eq("roster_id", rosterId)
      .order("invited_at");
    if (data) setMembers(data as any[]);
    setMembersLoading(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from("team_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast({ title: "Member removed" });
    fetchRosters();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  if (rosters.length === 0) {
    return (
      <div className="bg-card border border-border p-8 text-center">
        <Users size={32} className="mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No team rosters yet. Team-tier subscribers can create rosters from their dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{rosters.length} team roster{rosters.length !== 1 ? "s" : ""}</p>

      {rosters.map((r) => (
        <div key={r.id} className="bg-card border border-border overflow-hidden">
          <button
            onClick={() => toggleExpand(r.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-all text-left"
          >
            <Users size={14} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">
                {r.team_name}
                {r.sport && <span className="text-muted-foreground font-normal"> · {r.sport}</span>}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                Owner: {r.owner_name} ({r.owner_email}) · {r.member_count} athlete{r.member_count !== 1 ? "s" : ""}
              </p>
            </div>
            {expanded === r.id ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>

          {expanded === r.id && (
            <div className="border-t border-border">
              {membersLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={14} className="text-primary animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No members yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{m.athlete_name || m.athlete_email.split("@")[0]}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{m.athlete_email}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${
                        m.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>{m.status}</span>
                      <button onClick={() => handleRemoveMember(m.id)} className="text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminTeamRosters;
