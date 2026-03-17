import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Loader2, Eye, MessageSquare, Trash2, UserPlus,
  Shield, AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";

interface ChildLink {
  id: string;
  child_user_id: string;
  created_at: string;
  child_email?: string;
  child_name?: string;
}

const ParentChildManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<ChildLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Child creation form
  const [showForm, setShowForm] = useState(false);
  const [childEmail, setChildEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childPassword, setChildPassword] = useState("");

  const fetchLinks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("parent_child_links")
        .select("*")
        .eq("parent_user_id", user.id);
      if (error) throw error;

      // Fetch child profiles
      const enriched = await Promise.all(
        (data || []).map(async (link) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name, athlete_name")
            .eq("user_id", link.child_user_id)
            .maybeSingle();
          return {
            ...link,
            child_email: profile?.email || "",
            child_name: profile?.athlete_name || profile?.full_name || "",
          };
        })
      );
      setLinks(enriched);
    } catch (err: any) {
      toast({ title: "Error loading linked accounts", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLinks(); }, [user]);

  const handleCreateChild = async () => {
    if (!user || !childEmail.trim() || !childName.trim() || !childPassword.trim()) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    if (childPassword.length < 6) {
      toast({ title: "Password too short", description: "At least 6 characters", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      // Create child account via edge function
      const { data, error } = await supabase.functions.invoke("create-child-account", {
        body: {
          childEmail: childEmail.trim(),
          childName: childName.trim(),
          childPassword,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Child account created!", description: `${childName} is now linked to your account.` });
      setShowForm(false);
      setChildEmail("");
      setChildName("");
      setChildPassword("");
      fetchLinks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      const { error } = await supabase.from("parent_child_links").delete().eq("id", linkId);
      if (error) throw error;
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      toast({ title: "Account unlinked" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Linked Child Accounts</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          <UserPlus size={12} />
          Add Child
        </button>
      </div>

      {showForm && (
        <div className="bg-card shadow-m2 p-5 border border-primary/20 space-y-3">
          <h4 className="text-xs font-bold text-foreground">Create a Child Account</h4>
          <p className="text-[10px] text-muted-foreground">
            Your child will have their own login to access programs, log workouts, and track progress.
            You'll be able to monitor everything from your account.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Child's Name *</label>
              <input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="Athlete's first name"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email for Login *</label>
              <input
                value={childEmail}
                onChange={(e) => setChildEmail(e.target.value)}
                type="email"
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="child@email.com"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Password *</label>
            <input
              value={childPassword}
              onChange={(e) => setChildPassword(e.target.value)}
              type="password"
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none max-w-xs"
              placeholder="At least 6 characters"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateChild}
              disabled={creating}
              className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Create & Link Account
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-muted text-muted-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-m2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {links.length === 0 && !showForm ? (
        <div className="bg-card shadow-m2 p-6 text-center">
          <Users size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-2">No linked child accounts yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create a child account so your athlete can access their programs on their own device
            while you monitor their progress.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="bg-card shadow-m2 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {(link.child_name || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{link.child_name || "Athlete"}</p>
                  <p className="text-[10px] text-muted-foreground">{link.child_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={`/progress?child=${link.child_user_id}`}
                  className="p-2 text-muted-foreground hover:text-primary transition-m2"
                  title="View progress"
                >
                  <Eye size={14} />
                </Link>
                <button
                  onClick={() => handleUnlink(link.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-m2"
                  title="Unlink account"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParentChildManager;
