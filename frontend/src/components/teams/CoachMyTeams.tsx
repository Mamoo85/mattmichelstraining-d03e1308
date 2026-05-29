import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Copy, Users, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSelectTeam: (id: string) => void;
  selectedRosterId: string | null;
}

const CoachMyTeams = ({ onSelectTeam, selectedRosterId }: Props) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_rosters")
      .select("*, team_members(count)")
      .or(`coach_user_id.eq.${user.id},owner_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    setTeams(data || []);
    if (data?.length && !selectedRosterId) onSelectTeam(data[0].id);
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const { error } = await supabase.from("team_rosters").insert({
      owner_id: user.id,
      coach_user_id: user.id,
      team_name: newName.trim(),
      sport: newSport.trim(),
    });
    if (error) toast.error(error.message);
    else { toast.success("Team created!"); setNewName(""); setNewSport(""); load(); }
    setCreating(false);
  };

  const copyInvite = (code: string, id: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Create team */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Create Team</h3>
        <div className="flex gap-2">
          <Input placeholder="Team name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
          <Input placeholder="Sport" value={newSport} onChange={(e) => setNewSport(e.target.value)} className="w-28" />
          <Button onClick={handleCreate} disabled={creating} size="icon"><Plus size={16} /></Button>
        </div>
      </Card>

      {/* Team list */}
      {teams.map((t) => (
        <Card
          key={t.id}
          className={`p-4 cursor-pointer transition-colors ${selectedRosterId === t.id ? "border-primary bg-primary/5" : ""}`}
          onClick={() => onSelectTeam(t.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">{t.team_name}</h3>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                {t.sport && <span className="text-primary font-semibold uppercase">{t.sport}</span>}
                <span className="flex items-center gap-1">
                  <Users size={12} /> {t.team_members?.[0]?.count || 0}
                </span>
              </div>
            </div>
            {t.invite_code && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); copyInvite(t.invite_code, t.id); }}
              >
                {copiedId === t.id ? <Check size={14} /> : <Copy size={14} />}
                <span className="ml-1 text-xs">{t.invite_code}</span>
              </Button>
            )}
          </div>
        </Card>
      ))}

      {teams.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No teams yet — create one above</p>
      )}
    </div>
  );
};

export default CoachMyTeams;
