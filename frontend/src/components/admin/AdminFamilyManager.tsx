import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, UserPlus, Trash2, Edit3, Save, X, Loader2, Link2, Eye, Search,
} from "lucide-react";
import { Link } from "react-router-dom";

interface ParentChildRow {
  id: string;
  parent_user_id: string;
  child_user_id: string;
  created_at: string;
  parent_name?: string;
  parent_email?: string;
  child_name?: string;
  child_email?: string;
}

const AdminFamilyManager = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingChild, setEditingChild] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Create child form
  const [parentSearch, setParentSearch] = useState("");
  const [selectedParent, setSelectedParent] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childPassword, setChildPassword] = useState("");

  // Fetch all parent-child links with enriched profile data
  const { data: links = [], isLoading } = useQuery({
    queryKey: ["admin-family-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_child_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get unique user IDs
      const allIds = new Set<string>();
      (data || []).forEach((l) => {
        allIds.add(l.parent_user_id);
        allIds.add(l.child_user_id);
      });

      // Batch fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .in("user_id", [...allIds]);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      return (data || []).map((link): ParentChildRow => {
        const parent = profileMap.get(link.parent_user_id);
        const child = profileMap.get(link.child_user_id);
        return {
          ...link,
          parent_name: parent?.full_name || parent?.athlete_name || "",
          parent_email: parent?.email || "",
          child_name: child?.athlete_name || child?.full_name || "",
          child_email: child?.email || "",
        };
      });
    },
  });

  // Fetch all profiles for parent dropdown
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin-all-profiles-family"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("parent_child_links").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-family-links"] });
      toast.success("Link removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Update child name mutation
  const updateChildMutation = useMutation({
    mutationFn: async ({ userId, name }: { userId: string; name: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ athlete_name: name, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-family-links"] });
      setEditingChild(null);
      toast.success("Child profile updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Create child account via edge function
  const [creating, setCreating] = useState(false);
  const handleCreateChild = async () => {
    if (!selectedParent || !childEmail.trim() || !childName.trim() || !childPassword.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (childPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCreating(true);
    try {
      // Use the edge function but pass parentId override for admin
      const { data, error } = await supabase.functions.invoke("create-child-account", {
        body: {
          childEmail: childEmail.trim(),
          childName: childName.trim(),
          childPassword,
          adminParentOverride: selectedParent,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Child account created and linked to parent`);
      setShowCreate(false);
      setChildEmail("");
      setChildName("");
      setChildPassword("");
      setSelectedParent("");
      queryClient.invalidateQueries({ queryKey: ["admin-family-links"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  // Filter
  const filtered = links.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.parent_name || "").toLowerCase().includes(q) ||
      (l.parent_email || "").toLowerCase().includes(q) ||
      (l.child_name || "").toLowerCase().includes(q) ||
      (l.child_email || "").toLowerCase().includes(q)
    );
  });

  const parentOptions = allProfiles.filter((p) => {
    const q = parentSearch.toLowerCase();
    return (
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.athlete_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
            <Users size={16} className="text-primary" />
            Family Account Manager
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            View, create, edit, and manage all parent-child account links.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-m2"
        >
          <UserPlus size={12} /> Create Child Account
        </button>
      </div>

      {/* Create child form */}
      {showCreate && (
        <div className="bg-muted border border-border p-4 space-y-3">
          <h4 className="text-xs font-bold text-foreground">Create & Link a Child Account</h4>
          <p className="text-[10px] text-muted-foreground">
            Select a parent, fill in the child's details, and the accounts will be linked automatically.
          </p>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Parent Account *</label>
            <input
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
              placeholder="Search parent by name or email..."
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none mb-1"
            />
            {parentSearch && !selectedParent && (
              <div className="bg-card border border-border max-h-32 overflow-y-auto">
                {parentOptions.slice(0, 8).map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => {
                      setSelectedParent(p.user_id);
                      setParentSearch(p.full_name || p.email || "");
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent/20 transition-m2"
                  >
                    <span className="font-bold text-foreground">{p.full_name || p.athlete_name || "No name"}</span>
                    <span className="text-muted-foreground ml-2">{p.email}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedParent && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Link2 size={10} />
                <span>Parent selected</span>
                <button onClick={() => { setSelectedParent(""); setParentSearch(""); }} className="text-destructive text-[10px] ml-2">Clear</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Child's Name *</label>
              <input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="Athlete name"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
              <input
                value={childEmail}
                onChange={(e) => setChildEmail(e.target.value)}
                type="email"
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="child@email.com"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Password *</label>
              <input
                value={childPassword}
                onChange={(e) => setChildPassword(e.target.value)}
                type="password"
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="Min 6 characters"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreateChild}
              disabled={creating}
              className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
              Create & Link
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="bg-muted text-muted-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-m2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by parent or child name/email..."
          className="w-full bg-card border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Links</p>
          <p className="text-2xl font-mono font-bold text-foreground">{links.length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parents</p>
          <p className="text-2xl font-mono font-bold text-primary">{new Set(links.map((l) => l.parent_user_id)).size}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Children</p>
          <p className="text-2xl font-mono font-bold text-foreground">{new Set(links.map((l) => l.child_user_id)).size}</p>
        </div>
      </div>

      {/* Links list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card shadow-m2 p-6 text-center">
          <Users size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No family links found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((link) => (
            <div key={link.id} className="bg-card shadow-m2 p-4">
              <div className="flex items-center justify-between gap-4">
                {/* Parent info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Parent</p>
                  <p className="text-sm font-bold text-foreground truncate">{link.parent_name || "Unknown"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{link.parent_email}</p>
                </div>

                <Link2 size={14} className="text-primary shrink-0" />

                {/* Child info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Child</p>
                  {editingChild === link.child_user_id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-background border border-border px-2 py-1 text-xs text-foreground w-28 focus:ring-1 focus:ring-primary outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => updateChildMutation.mutate({ userId: link.child_user_id, name: editName })}
                        className="p-1 text-primary hover:text-primary/80"
                      >
                        <Save size={12} />
                      </button>
                      <button onClick={() => setEditingChild(null)} className="p-1 text-muted-foreground hover:text-foreground">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-bold text-foreground truncate">{link.child_name || "Unnamed"}</p>
                      <button
                        onClick={() => {
                          setEditingChild(link.child_user_id);
                          setEditName(link.child_name || "");
                        }}
                        className="p-1 text-muted-foreground hover:text-primary transition-m2"
                        title="Edit child name"
                      >
                        <Edit3 size={10} />
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground truncate">{link.child_email}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    to={`/progress?child=${link.child_user_id}`}
                    className="p-2 text-muted-foreground hover:text-primary transition-m2"
                    title="View child progress"
                  >
                    <Eye size={14} />
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm("Unlink this parent-child connection?")) {
                        unlinkMutation.mutate(link.id);
                      }
                    }}
                    className="p-2 text-muted-foreground hover:text-destructive transition-m2"
                    title="Remove link"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mt-2">Linked {new Date(link.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFamilyManager;
