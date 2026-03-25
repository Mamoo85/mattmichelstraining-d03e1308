import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import AppNavbar from "@/components/layout/AppNavbar";
import { ArrowLeft, Loader2, User, Dumbbell, TrendingUp, BookOpen } from "lucide-react";

const ProgressCharts = lazy(() => import("@/components/features/ProgressCharts"));
const MyPrograms = lazy(() => import("@/components/features/MyPrograms"));

const TabLoader = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={20} className="text-primary animate-spin" />
  </div>
);

const AdminViewUser = () => {
  const { userId } = useParams<{ userId: string }>();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"progress" | "programs">("progress");

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
            <ProgressCharts overrideUserId={userId} />
          )}
          {activeTab === "programs" && userId && (
            <MyPrograms overrideUserId={userId} />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default AdminViewUser;
