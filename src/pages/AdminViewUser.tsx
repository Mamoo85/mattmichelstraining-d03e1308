import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import AppNavbar from "@/components/layout/AppNavbar";
import { ArrowLeft, Loader2, User, Dumbbell, TrendingUp, BookOpen, Eye, EyeOff, Shield, Activity } from "lucide-react";
import UserActivityFeed from "@/components/admin/UserActivityFeed";

const ProgressCharts = lazy(() => import("@/components/features/ProgressCharts"));

const TabLoader = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={20} className="text-primary animate-spin" />
  </div>
);

interface PrivacySettings {
  show_name: boolean;
  show_points: boolean;
  show_level: boolean;
  show_lifts: boolean;
  show_challenges: boolean;
  show_nutrition: boolean;
  show_streaks: boolean;
  show_programs: boolean;
}

const AdminViewUser = () => {
  const { userId } = useParams<{ userId: string }>();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"progress" | "programs" | "activity">("progress");
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [activePrograms, setActivePrograms] = useState<any[]>([]);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [programsLoading, setProgramsLoading] = useState(false);

  useEffect(() => {
    if (!userId || !isAdmin) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      setProfile(data);
      setLoading(false);
    };
    load();
  }, [userId, isAdmin]);

  useEffect(() => {
    if (!userId || !isAdmin || activeTab !== "programs") return;
    const loadPrograms = async () => {
      setProgramsLoading(true);
      const [wRes, pRes, privRes] = await Promise.all([
        supabase.from("community_workouts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("user_active_programs").select("*, training_programs(title, category, sport)").eq("user_id", userId),
        supabase.from("user_privacy_settings").select("*").eq("user_id", userId).single(),
      ]);
      setWorkouts(wRes.data || []);
      setActivePrograms(pRes.data || []);
      setPrivacy(privRes.data as PrivacySettings | null);
      setProgramsLoading(false);
    };
    loadPrograms();
  }, [userId, isAdmin, activeTab]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="text-primary animate-spin" />
        </div>
      </div>
    );
  }

  const displayName = profile?.full_name || profile?.email || "Unknown User";

  const tabs = [
    { key: "progress" as const, label: "Progress", icon: TrendingUp },
    { key: "programs" as const, label: "Programs", icon: BookOpen },
    { key: "activity" as const, label: "Activity", icon: Activity },
  ];

  const privacyFields: { key: keyof PrivacySettings; label: string }[] = [
    { key: "show_name", label: "Name" },
    { key: "show_points", label: "Points" },
    { key: "show_level", label: "Level" },
    { key: "show_streaks", label: "Streaks" },
    { key: "show_lifts", label: "Lifts" },
    { key: "show_challenges", label: "Challenges" },
    { key: "show_nutrition", label: "Nutrition" },
    { key: "show_programs", label: "Programs" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/admin")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <User size={14} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Viewing as User</span>
            </div>
            <h1 className="text-lg font-bold text-foreground">{displayName}</h1>
            <p className="text-xs text-muted-foreground">{profile?.email} · {profile?.subscription_tier || "free"}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === tab.key
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <Suspense fallback={<TabLoader />}>
          {activeTab === "progress" && userId && (
            <ProgressCharts targetUserId={userId} targetUserName={displayName} />
          )}
          {activeTab === "programs" && (
            programsLoading ? <TabLoader /> : (
              <div className="space-y-6">
                {/* Privacy Settings Overview */}
                {privacy && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield size={14} className="text-primary" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Visibility Settings</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {privacyFields.map((f) => (
                        <div key={f.key} className="flex items-center gap-2 text-xs">
                          {privacy[f.key] ? (
                            <Eye size={12} className="text-green-500" />
                          ) : (
                            <EyeOff size={12} className="text-red-400" />
                          )}
                          <span className={privacy[f.key] ? "text-foreground" : "text-muted-foreground"}>
                            {f.label}: {privacy[f.key] ? "Public" : "Private"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Programs */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground mb-3">
                    Active Programs ({activePrograms.length})
                  </h3>
                  {activePrograms.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No active programs</p>
                  ) : (
                    <div className="space-y-2">
                      {activePrograms.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                          <div>
                            <span className="text-sm font-bold text-foreground block">
                              {(p as any).training_programs?.title || "Unknown Program"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Week {p.current_week || 1} · Day {p.current_day || 1} · Block {p.block_number || 1} · {p.status}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                            {(p as any).training_programs?.category || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* All Workouts */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground mb-3">
                    All Workouts ({workouts.length})
                  </h3>
                  {workouts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No workouts saved</p>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {workouts.map((w: any) => {
                        const exerciseCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
                        return (
                          <div key={w.id} className="bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-foreground">{w.title}</span>
                              <div className="flex items-center gap-2">
                                {w.is_public ? (
                                  <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase">Public</span>
                                ) : (
                                  <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">Private</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>{exerciseCount} exercises</span>
                              <span>by {w.creator_name}</span>
                              <span>{w.source_type}</span>
                              <span>{new Date(w.created_at).toLocaleDateString()}</span>
                            </div>
                            {w.description && (
                              <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-2">{w.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default AdminViewUser;
