import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Loader2, Save, User } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  profile: any;
  onUpdate: (updated: any) => void;
}

const AdminProfileEditor = ({ profile, onUpdate }: Props) => {
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [athleteName, setAthleteName] = useState(profile.athlete_name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [accountRole, setAccountRole] = useState(profile.account_role || "independent_adult");
  const [saving, setSaving] = useState(false);

  const hasChanges =
    fullName !== (profile.full_name || "") ||
    athleteName !== (profile.athlete_name || "") ||
    email !== (profile.email || "") ||
    accountRole !== (profile.account_role || "independent_adult");

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: {
          action: "update_profile",
          targetUserId: profile.user_id,
          updates: {
            full_name: fullName || null,
            athlete_name: athleteName || null,
            email: email || null,
            account_role: accountRole,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Profile updated");
      onUpdate({
        ...profile,
        full_name: fullName || null,
        athlete_name: athleteName || null,
        email: email || null,
        account_role: accountRole,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-secondary/30 border border-border p-3">
      <div className="flex items-center gap-2 mb-3">
        <User size={14} className="text-primary" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Edit Profile</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="First Last"
            className="bg-background text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Athlete / Display Name</label>
          <Input
            value={athleteName}
            onChange={(e) => setAthleteName(e.target.value)}
            placeholder="Nickname"
            className="bg-background text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Email</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@email.com"
            className="bg-background text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Account Role</label>
          <Select value={accountRole} onValueChange={setAccountRole}>
            <SelectTrigger className="bg-background border-border text-xs mt-0.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="independent_adult">Adult Athlete</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="child">Child / Youth</SelectItem>
              <SelectItem value="coach">Coach</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !hasChanges}
        className="mt-3 w-full bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        {saving ? "Saving…" : "Save Profile Changes"}
      </button>
    </div>
  );
};

export default AdminProfileEditor;
