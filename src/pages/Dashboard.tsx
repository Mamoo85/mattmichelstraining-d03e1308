import AppNavbar from "@/components/AppNavbar";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import TrialPaywallModal from "@/components/TrialPaywallModal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Crown, User, Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import StudioCheckIn from "@/components/StudioCheckIn";

// Extracted sub-components
import DashboardHome from "@/components/dashboard/DashboardHome";
import WorkoutsTab from "@/components/dashboard/WorkoutsTab";

// Lazy-load heavier tabs
import { lazy, Suspense } from "react";
const ProgressCharts = lazy(() => import("@/components/ProgressCharts"));
const MyPrograms = lazy(() => import("@/components/MyPrograms"));
const PointsLeaderboard = lazy(() => import("@/components/PointsLeaderboard"));
const ReferralDashboard = lazy(() => import("@/components/ReferralDashboard"));
const TeamManager = lazy(() => import("@/components/TeamManager"));

const BASE_TABS = [
  { key: "home", label: "Home" },
  { key: "progress", label: "Progress" },
  { key: "programs", label: "My Programs" },
  { key: "workouts", label: "Workouts" },
  { key: "points", label: "Points" },
  { key: "referrals", label: "Refer" },
] as const;

const TabLoader = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={20} className="text-primary animate-spin" />
  </div>
);

const Dashboard = () => {
  const { user, subscribed, subscriptionTier, isLegend } = useAuth();
  const { trialExpired, isOnTrial, trialDaysLeft } = useTrialStatus();
  const { isAdmin } = useIsAdmin();
  const [profile, setProfile] = useState<{ full_name: string | null; athlete_name: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [portalLoading, setPortalLoading] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [hasPrograms, setHasPrograms] = useState<boolean | null>(null);
  const [hasLogs, setHasLogs] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    // Fetch profile + activity counts in parallel
    Promise.all([
      supabase.from("profiles").select("full_name, athlete_name").eq("user_id", user.id).single(),
      supabase.from("user_active_programs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("progress_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([profileRes, progRes, logRes]) => {
      if (profileRes.data) setProfile(profileRes.data);
      setHasPrograms((progRes.count ?? 0) > 0);
      setHasLogs((logRes.count ?? 0) > 0);
    });
  }, [user]);

  const handleManageSubscription = useCallback(async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch { /* silent */ }
    finally { setPortalLoading(false); }
  }, []);

  const athleteDisplay = profile?.athlete_name || profile?.full_name || "Athlete";
  const isNewUser = hasPrograms === false && hasLogs === false;

  const tabs = useMemo(() =>
    subscriptionTier === "team_elite" || isAdmin
      ? [...BASE_TABS, { key: "team", label: "Team" } as const]
      : BASE_TABS,
    [subscriptionTier, isAdmin]
  );

  const handleViewPoints = useCallback(() => setActiveTab("points"), []);
  const handleViewReferrals = useCallback(() => setActiveTab("referrals"), []);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <PwaInstallBanner />
      <div className="container pt-20 pb-12 px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-foreground truncate">Welcome back, {athleteDisplay}</h2>
              {isLegend ? (
                <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground shrink-0">
                  <Crown size={10} /> M² Legend
                </Badge>
              ) : subscriptionTier ? (
                <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest shrink-0">
                  <Crown size={10} /> {TIERS[subscriptionTier].name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest shrink-0">Free</Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Your training portal · Real training, real results</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/profile"
              className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all"
            >
              <User size={12} /> Profile
            </Link>
            {subscribed && (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {portalLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                Manage
              </button>
            )}
          </div>
        </div>

        <StudioCheckIn />

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap shrink-0 ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <Suspense fallback={<TabLoader />}>
          {activeTab === "home" && (
            <DashboardHome
              isNewUser={isNewUser}
              onViewPoints={handleViewPoints}
              onViewReferrals={handleViewReferrals}
            />
          )}
          {activeTab === "progress" && <ProgressCharts />}
          {activeTab === "programs" && <MyPrograms />}
          {activeTab === "workouts" && <WorkoutsTab />}
          {activeTab === "points" && <PointsLeaderboard />}
          {activeTab === "referrals" && <ReferralDashboard />}
          {activeTab === "team" && <TeamManager />}
        </Suspense>
      </div>

      {/* Floating timer */}
      {!showTimer && (
        <button
          onClick={() => setShowTimer(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-all rounded-full mb-[env(safe-area-inset-bottom)]"
          aria-label="Open interval timer"
        >
          <Timer size={24} />
        </button>
      )}
      {showTimer && <IntervalTimer onClose={() => setShowTimer(false)} />}

      {/* Trial banner */}
      {isOnTrial && !subscribed && !isAdmin && !isLegend && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-primary text-primary-foreground text-center py-2 text-xs font-bold uppercase tracking-widest">
          🔥 Trial: {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining
        </div>
      )}

      {/* Hard paywall */}
      {trialExpired && !subscribed && !isAdmin && !isLegend && (
        <TrialPaywallModal open={true} hardLock />
      )}
    </div>
  );
};

export default Dashboard;
