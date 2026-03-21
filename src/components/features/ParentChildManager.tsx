import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Loader2, Eye, Trash2, UserPlus,
  Send, Copy, Check
} from "lucide-react";
import { Link } from "react-router-dom";

interface ChildLink {
  id: string;
  child_user_id: string;
  created_at: string;
  child_email?: string;
  child_name?: string;
}

interface InviteToken {
  id: string;
  token: string;
  child_name: string | null;
  is_used: boolean;
  created_at: string;
}

const ParentChildManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<ChildLink[]>([]);
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Tab: "invite" or "manual"
  const [tab, setTab] = useState<"invite" | "manual">("invite");

  // Invite form
  const [showForm, setShowForm] = useState(false);
  const [inviteChildName, setInviteChildName] = useState("");

  // Manual create form
  const [childEmail, setChildEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childPassword, setChildPassword] = useState("");

  const fetchLinks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [linksRes, invitesRes] = await Promise.all([
        supabase.from("parent_child_links").select("*").eq("parent_user_id", user.id),
        supabase.from("parent_invite_tokens" as any).select("*").eq("parent_user_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (linksRes.error) throw linksRes.error;

      const enriched = await Promise.all(
        (linksRes.data || []).map(async (link: any) => {
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
      setInvites((invitesRes.data as any) || []);
    } catch (err: any) {
      toast({ title: "Error loading linked accounts", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLinks(); }, [user]);

  const generateInviteLink = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const { error } = await supabase.from("parent_invite_tokens" as any).insert({
        parent_user_id: user.id,
        token,
        child_name: inviteChildName.trim() || null,
      } as any);
      if (error) throw error;
      toast({ title: "Invite link created!", description: "Copy the link and send it to your athlete." });
      setInviteChildName("");
      setShowForm(false);
      fetchLinks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/auth?invite=${token}`;
    navigator.clipboard.writeText(link);
    setCopied(token);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(null), 2000);
  };

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
      const { data, error } = await supabase.functions.invoke("create-child-account", {
        body: { childEmail: childEmail.trim(), childName: childName.trim(), childPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Child account created!", description: `${childName} is now linked to your account.` });
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

  const pendingInvites = invites.filter((i: any) => !i.is_used);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Family Pack</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          <UserPlus size={12} />
          Add Athlete
        </button>
      </div>

      {showForm && (
        <div className="bg-card shadow-m2 border border-primary/20">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("invite")}
              className={`flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                tab === "invite" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Send size={12} className="inline mr-1.5" />
              Send Invite Link
            </button>
            <button
              onClick={() => setTab("manual")}
              className={`flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                tab === "manual" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus size={12} className="inline mr-1.5" />
              Create Account Manually
            </button>
          </div>

          <div className="p-5 space-y-3">
            {tab === "invite" ? (
              <>
                <p className="text-[10px] text-muted-foreground">
                  Generate a link and text/email it to your athlete. When they sign up through the link, their account is automatically linked to yours.
                </p>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Child's Name (optional)</label>
                  <input
                    value={inviteChildName}
                    onChange={(e) => setInviteChildName(e.target.value)}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none max-w-xs"
                    placeholder="Athlete's first name"
                  />
                </div>
                <button
                  onClick={generateInviteLink}
                  disabled={creating}
                  className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
                >
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Generate Invite Link
                </button>

                {/* Show pending invites */}
                {pendingInvites.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending Invites</p>
                    {pendingInvites.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between bg-background border border-border p-3">
                        <div>
                          <p className="text-xs font-bold text-foreground">{inv.child_name || "Unnamed"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                            {window.location.origin}/auth?invite={inv.token}
                          </p>
                        </div>
                        <button
                          onClick={() => copyInviteLink(inv.token)}
                          className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary/20 transition-m2"
                        >
                          {copied === inv.token ? <Check size={12} /> : <Copy size={12} />}
                          {copied === inv.token ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground">
                  Create your child's account directly. They'll use these credentials to log in on their own device.
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
              </>
            )}
          </div>
        </div>
      )}

      {links.length === 0 && !showForm ? (
        <div className="bg-card shadow-m2 p-6 text-center">
          <Users size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-2">No athletes in your Family Pack yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add your athlete to your Family Pack — send an invite link or create their account directly.
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
