import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

interface Props {
  rosterId: string | null;
}

const CoachRoster = ({ rosterId }: Props) => {
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (!rosterId) return;
    const load = async () => {
      const { data } = await supabase
        .from("team_members")
        .select("*")
        .eq("roster_id", rosterId)
        .order("joined_at", { ascending: false });
      setMembers(data || []);
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
          Roster ({members.length})
        </h3>
      </div>

      {members.map((m) => (
        <Card key={m.id} className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{m.athlete_name || "Unknown"}</p>
              <p className="text-xs text-muted-foreground">{m.athlete_email}</p>
            </div>
          </div>
          <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-xs">
            {m.status}
          </Badge>
        </Card>
      ))}

      {members.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No athletes yet — share your invite link!
        </p>
      )}
    </div>
  );
};

export default CoachRoster;
