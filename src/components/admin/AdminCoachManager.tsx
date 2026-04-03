import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Shield } from "lucide-react";
import { toast } from "sonner";

const AdminCoachManager = () => {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [sport, setSport] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("coach_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (data?.length) {
      const userIds = data.map((c) => c.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p) => { profileMap[p.user_id] = p; });

      setCoaches(data.map((c) => ({ ...c, profile: profileMap[c.user_id] })));
    } else {
      setCoaches([]);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!email.trim() || !user) return;
    setCreating(true);
    try {
      // Find user by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (!profile) {
        toast.error("No user found with that email. They need to sign up first.");
        setCreating(false);
        return;
      }

      // Create coach profile
      const { error: cpError } = await supabase.from("coach_profiles").insert({
        user_id: profile.user_id,
        created_by: user.id,
        school_name: school.trim(),
        sport: sport.trim(),
      } as any);

      if (cpError) throw cpError;

      // Assign coach role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: profile.user_id,
        role: "coach" as any,
      });

      if (roleError && roleError.code !== "23505") throw roleError;

      toast.success("Coach added! They can now access /coach-hub");
      setEmail("");
      setSchool("");
      setSport("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to add coach");
    }
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-primary" />
        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Coach Manager</h2>
      </div>

      {/* Add coach */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase">Add Coach</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Input placeholder="Coach email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="School" value={school} onChange={(e) => setSchool(e.target.value)} />
          <Input placeholder="Sport" value={sport} onChange={(e) => setSport(e.target.value)} />
          <Button onClick={handleAdd} disabled={creating}>
            <Plus size={14} className="mr-1" /> Add Coach
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Coach must have an existing account. They'll get access to /coach-hub.</p>
      </Card>

      {/* Coach list */}
      {coaches.map((c) => (
        <Card key={c.id} className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {c.profile?.athlete_name || c.profile?.full_name || "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground">
                {c.profile?.email} · {c.school_name} · {c.sport}
              </p>
            </div>
          </div>
          <Badge variant={c.is_active ? "default" : "secondary"}>
            {c.is_active ? "Active" : "Inactive"}
          </Badge>
        </Card>
      ))}

      {coaches.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">No coaches yet</p>
      )}
    </div>
  );
};

export default AdminCoachManager;
