import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ChevronDown, ChevronUp, Dumbbell, ShoppingBag, Calendar,
  Shield, Clock, Loader2, X, Link2, Unlink, Mail, Trash2, Users, AlertTriangle,
  Star, Copy, MessageSquare, Gift, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AiAssistButton from "./AiAssistButton";
import AdminUserLibrary from "./AdminUserLibrary";

const AdminClientList = () => {
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [eraseConfirmStep, setEraseConfirmStep] = useState(0);
  const [linkSearch, setLinkSearch] = useState("");
  const [giftType, setGiftType] = useState<"program" | "workout">("program");
  const [selectedGiftId, setSelectedGiftId] = useState("");
  const [giftNotes, setGiftNotes] = useState("");
  const [gifting, setGifting] = useState(false);
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: workoutLogs = [] } = useQuery({
    queryKey: ["admin-all-workout-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("workout_logs").select("*").order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: activePrograms = [] } = useQuery({
    queryKey: ["admin-all-active-programs"],
    queryFn: async () => {
      const { data } = await supabase.from("user_active_programs").select("*, training_programs(title, category)");
      return data || [];
    },
  });

  const { data: progressLogs = [] } = useQuery({
    queryKey: ["admin-all-progress-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("progress_logs").select("user_id, exercise_name, weight, reps, logged_at").order("logged_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ["admin-all-gifts"],
    queryFn: async () => {
      const { data } = await supabase.from("gifted_products").select("*");
      return data || [];
    },
  });

  const { data: familyLinks = [] } = useQuery({
    queryKey: ["admin-all-family-links"],
    queryFn: async () => {
      const { data } = await supabase.from("parent_child_links").select("*");
      return data || [];
    },
  });

  const { data: allPrograms = [] } = useQuery({
    queryKey: ["admin-all-training-programs"],
    queryFn: async () => {
      const { data } = await supabase.from("training_programs").select("id, title, category, level, sport, total_weeks, price").eq("is_active", true).order("title");
      return data || [];
    },
  });

  const { data: allDailyWorkouts = [] } = useQuery({
    queryKey: ["admin-all-daily-workouts"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_workouts").select("id, title, description, target_audience, exercises").eq("is_active", true).order("title");
      return data || [];
    },
  });

  const giftContent = async (targetUserId: string, targetName: string) => {
    if (!selectedGiftId) { toast.error("Select a program or workout to gift"); return; }
    setGifting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (giftType === "program") {
        // Check if already has this program
        const { data: existing } = await supabase.from("user_active_programs").select("id").eq("user_id", targetUserId).eq("program_id", selectedGiftId).limit(1);
        if (existing && existing.length > 0) {
          toast.error("User already has this program");
          setGifting(false);
          return;
        }

        // Insert into user_active_programs
        const { error: progErr } = await supabase.from("user_active_programs").insert({
          user_id: targetUserId,
          program_id: selectedGiftId,
          status: "active",
          stripe_session_id: null,
        });
        if (progErr) throw progErr;

        // Track in user_content_access
        const { error: accessErr } = await supabase.from("user_content_access").insert({
          user_id: targetUserId,
          program_id: selectedGiftId,
          access_type: "admin_gift",
          granted_by: user.id,
          notes: giftNotes || `Gifted by admin`,
        });
        if (accessErr) console.warn("Content access tracking failed:", accessErr);

        // Track in gifted_products
        const { error: giftErr } = await supabase.from("gifted_products").insert({
          user_id: targetUserId,
          gifted_by: user.id,
          gift_type: "program",
          product_id: selectedGiftId,
          notes: giftNotes || null,
        });
        if (giftErr) console.warn("Gift tracking failed:", giftErr);

        const prog = allPrograms.find((p: any) => p.id === selectedGiftId);
        toast.success(`Gifted "${prog?.title}" to ${targetName}`);
      } else {
        // Workout gift — copy daily_workouts entry into community_workouts for user
        const workout = allDailyWorkouts.find((w: any) => w.id === selectedGiftId);
        if (!workout) throw new Error("Workout not found");

        const { error: insertErr } = await supabase.from("community_workouts").insert({
          user_id: targetUserId,
          title: workout.title,
          description: workout.description || null,
          creator_name: "Coach Matt",
          is_public: false,
          exercises: workout.exercises,
        });
        if (insertErr) throw insertErr;

        // Track in user_content_access
        const { error: accessErr } = await supabase.from("user_content_access").insert({
          user_id: targetUserId,
          workout_id: selectedGiftId,
          access_type: "admin_gift",
          granted_by: user.id,
          notes: giftNotes || `Gifted workout by admin`,
        });
        if (accessErr) console.warn("Content access tracking failed:", accessErr);

        toast.success(`Gifted workout "${workout.title}" to ${targetName}`);
      }

      // Send notification
      await supabase.from("notifications").insert({
        user_id: targetUserId,
        type: "gift",
        title: giftType === "program" ? "🎁 New Program Unlocked!" : "🎁 New Workout Added!",
        body: giftType === "program"
          ? `Coach Matt just added a training program to your library. Check it out!`
          : `Coach Matt just dropped a custom workout into your library. Get after it!`,
        link: "/dashboard",
      });

      // Reset form
      setSelectedGiftId("");
      setGiftNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-all-active-programs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-gifts"] });
    } catch (err: any) {
      toast.error(err.message || "Gift failed");
    } finally {
      setGifting(false);
    }
  };

  // Mutations
  const toggleInPerson = useMutation({
    mutationFn: async ({ profileId, value }: { profileId: string; value: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_in_person: value }).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Client status updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const setTierMutation = useMutation({
    mutationFn: async ({ profileId, tier }: { profileId: string; tier: string }) => {
      const { error } = await supabase.from("profiles").update({ subscription_tier: tier, updated_at: new Date().toISOString() }).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Tier updated");
      if (selectedProfile) {
        const updated = profiles.find((p) => p.id === selectedProfile.id);
        if (updated) setSelectedProfile({ ...updated });
      }
    },
    onError: () => toast.error("Failed to update tier"),
  });

  // VIP system removed — tier override via Stripe sync is the single source of truth

  const extendTrialMutation = useMutation({
    mutationFn: async ({ profileId, days }: { profileId: string; days: number }) => {
      const profile = profiles.find((p) => p.id === profileId);
      let newStart: string;
      if (profile?.trial_started_at) {
        const current = new Date(profile.trial_started_at);
        current.setDate(current.getDate() + days);
        newStart = current.toISOString();
      } else {
        newStart = new Date().toISOString();
      }
      const { error } = await supabase.from("profiles").update({
        trial_started_at: newStart,
        updated_at: new Date().toISOString(),
      }).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Trial extended");
    },
    onError: () => toast.error("Failed to extend trial"),
  });

  const setTrialDateMutation = useMutation({
    mutationFn: async ({ profileId, date }: { profileId: string; date: string }) => {
      const { error } = await supabase.from("profiles").update({
        trial_started_at: date ? new Date(date).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Trial date updated");
    },
    onError: () => toast.error("Failed to update trial date"),
  });

  const sendMagicLinkMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: { action: "send_magic_link", targetEmail: email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => toast.success(data.message),
    onError: (err: Error) => toast.error(err.message),
  });

  const eraseUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: { action: "erase_user_data", targetUserId: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("User data erased");
      setSelectedProfile(null);
      setEraseConfirmStep(0);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkFamilyMutation = useMutation({
    mutationFn: async ({ parentId, childId }: { parentId: string; childId: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: { action: "link_family", linkParentId: parentId, targetUserId: childId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-family-links"] });
      toast.success("Family link created");
      setLinkSearch("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unlinkFamilyMutation = useMutation({
    mutationFn: async (childId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: { action: "unlink_family", unlinkChildId: childId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-family-links"] });
      toast.success("Family link removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = profiles.filter(
    (p) =>
      (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.athlete_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const getClientPrograms = (userId: string) => activePrograms.filter((p: any) => p.user_id === userId);

  // Family helpers
  const getParentOf = (userId: string) => {
    const link = familyLinks.find((l: any) => l.child_user_id === userId);
    if (!link) return null;
    return profiles.find((p) => p.user_id === (link as any).parent_user_id) || null;
  };
  const getChildrenOf = (userId: string) => {
    const childIds = familyLinks.filter((l: any) => l.parent_user_id === userId).map((l: any) => l.child_user_id);
    return profiles.filter((p) => childIds.includes(p.user_id));
  };

  // Link search results
  const linkSearchResults = linkSearch.length >= 2
    ? profiles.filter(
        (p) =>
          p.user_id !== selectedProfile?.user_id &&
          ((p.email ?? "").toLowerCase().includes(linkSearch.toLowerCase()) ||
           (p.full_name ?? "").toLowerCase().includes(linkSearch.toLowerCase()))
      ).slice(0, 5)
    : [];

  // Stats
  const activeUsers7d = new Set(workoutLogs.filter((l) => new Date(l.date) > new Date(Date.now() - 7 * 86400000)).map((l) => l.user_id)).size;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Clients", value: profiles.length },
          { label: "Pro Members", value: profiles.filter((p) => p.is_pro).length, highlight: true },
          { label: "Active (7d)", value: activeUsers7d },
        ].map((s) => (
          <div key={s.label} className="bg-card shadow-m2 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-mono font-bold ${s.highlight ? "text-primary" : "text-foreground"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="w-full bg-card border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
      </div>

      {/* Client list */}
      <div className="bg-card shadow-m2">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="text-primary animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No clients found</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedProfile(profile)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-m2 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground truncate">{profile.full_name || "No name"}</p>
                    {profile.subscription_tier && profile.subscription_tier !== "free" && (
                      <Badge variant="outline" className="text-[9px] uppercase tracking-widest">{profile.subscription_tier}</Badge>
                    )}
                    {profile.account_role === "parent" && <Badge variant="outline" className="text-[9px] uppercase tracking-widest border-primary/20 text-primary"><Users size={8} className="mr-0.5" />Parent</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.email}</p>
                </div>
                <span className="text-[10px] text-muted-foreground ml-2">{new Date(profile.created_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== USER CONTROL MODAL ===== */}
      <Dialog open={!!selectedProfile} onOpenChange={(open) => { if (!open) setSelectedProfile(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedProfile && (() => {
            const p = selectedProfile;
            const parent = getParentOf(p.user_id);
            const children = getChildrenOf(p.user_id);
            const userWorkouts = workoutLogs.filter((l) => l.user_id === p.user_id).length;
            const userPrograms = getClientPrograms(p.user_id);

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Shield size={18} className="text-primary" />
                    User Control — {p.full_name || p.email}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {p.email} · Joined {new Date(p.created_at).toLocaleDateString()} · {userWorkouts} workouts · {userPrograms.length} programs
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Tier", value: p.subscription_tier || "free" },
                      { label: "Role", value: p.account_role || "athlete" },
                    ].map((s) => (
                      <div key={s.label} className="bg-secondary/50 border border-border p-2.5 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                        <p className="text-xs font-bold text-foreground uppercase">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ===== EDIT PROFILE INFO ===== */}
                  <AdminProfileEditor profile={p} onUpdate={(updated: any) => {
                    setSelectedProfile(updated);
                    queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
                  }} />

                  {/* User Library */}
                  <div className="bg-secondary/30 border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Dumbbell size={14} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">User Library</span>
                    </div>
                    <AdminUserLibrary userId={p.user_id} />
                  </div>

                  {/* Tier Override */}
                  <div className="bg-secondary/30 border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-primary" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tier Override</span>
                      </div>
                      <select
                        value={p.subscription_tier || "free"}
                        onChange={(e) => {
                          setTierMutation.mutate({ profileId: p.id, tier: e.target.value });
                          setSelectedProfile({ ...p, subscription_tier: e.target.value });
                        }}
                        className="bg-background border border-border px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic ($12.99)</option>
                        <option value="foundation">Foundation ($19.99)</option>
                        <option value="custom">Custom ($49.99)</option>
                        <option value="team_elite">Team/Elite ($99.99)</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Warning: Stripe sync will overwrite this on next check.
                    </p>
                  </div>

                  {/* Create Invite Link */}
                  <div className="bg-secondary/30 border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare size={14} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Invite Link</span>
                    </div>
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/auth`;
                        navigator.clipboard.writeText(link);
                        toast.success("Invite link copied! Paste it into a text message.");
                      }}
                      className="w-full bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                      <Copy size={12} />
                      Copy Invite Link for SMS
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Send this to clients so they can create an account.
                    </p>
                  </div>

                  {/* ===== GIFT PROGRAM / WORKOUT ===== */}
                  <div className="bg-secondary/30 border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift size={14} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gift Program or Workout</span>
                    </div>

                    {/* Current programs */}
                    {userPrograms.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Current Programs</p>
                        <div className="flex flex-wrap gap-1">
                          {userPrograms.map((up: any) => (
                            <Badge key={up.id} variant="outline" className="text-[9px]">
                              <BookOpen size={8} className="mr-1" />
                              {up.training_programs?.title || "Program"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Gift type toggle */}
                    <div className="flex gap-1 mb-2">
                      {(["program", "workout"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setGiftType(t); setSelectedGiftId(""); }}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            giftType === t
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {t === "program" ? "📚 Program" : "💪 Workout"}
                        </button>
                      ))}
                    </div>

                    {/* Selector */}
                    <Select value={selectedGiftId} onValueChange={setSelectedGiftId}>
                      <SelectTrigger className="bg-background border-border text-xs mb-2">
                        <SelectValue placeholder={giftType === "program" ? "Select a program..." : "Select a workout..."} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {giftType === "program" ? (
                          allPrograms.map((prog: any) => (
                            <SelectItem key={prog.id} value={prog.id}>
                              <span className="font-bold">{prog.title}</span>
                              <span className="text-muted-foreground ml-2 text-[10px]">
                                {prog.category} · {prog.level} · {prog.total_weeks}wk
                                {prog.price > 0 && ` · $${prog.price}`}
                              </span>
                            </SelectItem>
                          ))
                        ) : (
                          allDailyWorkouts.map((w: any) => (
                            <SelectItem key={w.id} value={w.id}>
                              <span className="font-bold">{w.title}</span>
                              <span className="text-muted-foreground ml-2 text-[10px]">
                                {w.target_audience}
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {/* Notes */}
                    <Input
                      value={giftNotes}
                      onChange={(e) => setGiftNotes(e.target.value)}
                      placeholder="Optional note (visible in records)..."
                      className="bg-background text-xs mb-2"
                    />

                    {/* Gift button */}
                    <button
                      onClick={() => giftContent(p.user_id, p.full_name || p.email || "User")}
                      disabled={gifting || !selectedGiftId}
                      className="w-full bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {gifting ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
                      {gifting ? "Gifting…" : `Gift ${giftType === "program" ? "Program" : "Workout"} to ${p.full_name?.split(" ")[0] || "User"}`}
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Bypasses Stripe — content is added directly to their library with a notification.
                    </p>
                  </div>


                  <div className="bg-secondary/30 border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Trial Control</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={p.trial_started_at ? new Date(p.trial_started_at).toISOString().split("T")[0] : ""}
                        onChange={(e) => {
                          setTrialDateMutation.mutate({ profileId: p.id, date: e.target.value });
                          setSelectedProfile({ ...p, trial_started_at: e.target.value ? new Date(e.target.value).toISOString() : null });
                        }}
                        className="bg-background border border-border px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                      />
                      {[3, 7, 14, 30].map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            extendTrialMutation.mutate({ profileId: p.id, days: d });
                          }}
                          className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                        >
                          +{d}d
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setTrialDateMutation.mutate({ profileId: p.id, date: "" });
                          setSelectedProfile({ ...p, trial_started_at: null });
                        }}
                        className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        Expire Now
                      </button>
                    </div>
                    {p.trial_started_at && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Trial started: {new Date(p.trial_started_at).toLocaleDateString()} — 
                        Expires: {new Date(new Date(p.trial_started_at).getTime() + 7 * 86400000).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* ===== FAMILY LINK MANAGER ===== */}
                  <div className="bg-secondary/30 border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={14} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Family Links</span>
                    </div>

                    {/* Current parent */}
                    {parent && (
                      <div className="flex items-center justify-between bg-card border border-border p-2 mb-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parent Account</p>
                          <p className="text-xs font-bold text-foreground">{parent.full_name || parent.email}</p>
                        </div>
                        <button
                          onClick={() => unlinkFamilyMutation.mutate(p.user_id)}
                          className="text-destructive hover:text-destructive/80 transition-colors p-1"
                          title="Unlink from parent"
                        >
                          <Unlink size={14} />
                        </button>
                      </div>
                    )}

                    {/* Children */}
                    {children.length > 0 && (
                      <div className="space-y-1 mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Linked Athletes</p>
                        {children.map((child: any) => (
                          <div key={child.user_id} className="flex items-center justify-between bg-card border border-border p-2">
                            <p className="text-xs font-bold text-foreground">{child.athlete_name || child.full_name || child.email}</p>
                            <button
                              onClick={() => unlinkFamilyMutation.mutate(child.user_id)}
                              className="text-destructive hover:text-destructive/80 transition-colors p-1"
                              title="Unlink athlete"
                            >
                              <Unlink size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {!parent && children.length === 0 && (
                      <p className="text-xs text-muted-foreground mb-2">No family links.</p>
                    )}

                    {/* Link search */}
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                        placeholder="Search user to link as child..."
                        className="pl-8 text-xs h-8"
                      />
                    </div>
                    {linkSearchResults.length > 0 && (
                      <div className="mt-1 border border-border bg-card max-h-32 overflow-y-auto">
                        {linkSearchResults.map((r) => (
                          <button
                            key={r.user_id}
                            onClick={() => linkFamilyMutation.mutate({ parentId: p.user_id, childId: r.user_id })}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/20 transition-colors flex items-center gap-2"
                          >
                            <Link2 size={12} className="text-primary shrink-0" />
                            <span className="font-bold text-foreground">{r.full_name || r.email}</span>
                            <span className="text-muted-foreground ml-auto text-[10px]">{r.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ===== AUTH RESETS ===== */}
                  <div className="bg-secondary/30 border border-border p-3 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Mail size={14} className="text-primary" />
                      Authentication Actions
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => p.email && sendMagicLinkMutation.mutate(p.email)}
                        disabled={sendMagicLinkMutation.isPending || !p.email}
                        className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {sendMagicLinkMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                        Send Magic Login Link
                      </button>

                      <button
                        onClick={() => setEraseConfirmStep(1)}
                        className="bg-destructive/10 text-destructive px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-destructive/20 transition-all flex items-center gap-1.5"
                      >
                        <Trash2 size={12} />
                        Erase User Data
                      </button>
                    </div>
                  </div>

                  {/* AI Summary */}
                  <div className="flex items-center justify-between bg-secondary/30 border border-border p-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AI Engagement Summary</span>
                    <AiAssistButton
                      type="client_summary"
                      context={{
                        name: p.full_name || p.athlete_name || "Unknown",
                        joined: new Date(p.created_at).toLocaleDateString(),
                        tier: p.subscription_tier || "free",
                        totalWorkouts: workoutLogs.filter((l) => l.user_id === p.user_id).length,
                        recentlyActive: workoutLogs.some((l) => l.user_id === p.user_id && new Date(l.date) > new Date(Date.now() - 7 * 86400000)),
                        programCount: userPrograms.length,
                        recentLifts: progressLogs.filter((l) => l.user_id === p.user_id).slice(0, 5).map((l) => `${l.exercise_name} ${l.weight}lbs×${l.reps}`).join(", "),
                      }}
                      onResult={(text) => toast.success(text, { duration: 15000 })}
                      label="AI Summary"
                    />
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ===== ERASE CONFIRMATION (Double) ===== */}
      <ConfirmActionModal
        open={eraseConfirmStep === 1}
        onOpenChange={() => setEraseConfirmStep(0)}
        title="Delete User Data — Step 1 of 2"
        description={<>This will permanently erase ALL data for <strong>{selectedProfile?.full_name || selectedProfile?.email}</strong> including workouts, progress, messages, subscriptions, and their authentication account. This cannot be undone.</>}
        confirmLabel="I understand, continue"
        destructive
        icon={<AlertTriangle size={18} />}
        onConfirm={() => setEraseConfirmStep(2)}
      />
      <ConfirmActionModal
        open={eraseConfirmStep === 2}
        onOpenChange={() => setEraseConfirmStep(0)}
        title="FINAL CONFIRMATION — Step 2 of 2"
        description={<>Type the user's email to confirm: <strong>{selectedProfile?.email}</strong><br /><br />This action is <strong>irreversible</strong>. The user will be completely removed from the platform.</>}
        confirmLabel="Permanently Delete Everything"
        destructive
        loading={eraseUserMutation.isPending}
        icon={<Trash2 size={18} />}
        onConfirm={() => {
          if (selectedProfile?.user_id) {
            eraseUserMutation.mutate(selectedProfile.user_id);
          }
        }}
      />
    </div>
  );
};

export default AdminClientList;
