import AppNavbar from "@/components/AppNavbar";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import TrialPaywallModal from "@/components/TrialPaywallModal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Loader2, Crown, User, Dumbbell, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import StudioCheckIn from "@/components/StudioCheckIn";

// Extracted sub-components
import DashboardHome from "@/components/dashboard/DashboardHome";
import WorkoutsTab from "@/components/dashboard/WorkoutsTab";

// Lazy-load heavier tabs
import { lazy, Suspense } from "react";
const MyPrograms = lazy(() => import("@/components/MyPrograms"));
const ChallengeHub = lazy(() => import("@/components/dashboard/ChallengeHub"));
const TeamManager = lazy(() => import("@/components/TeamManager"));

const BASE_TABS = [
  { key: "home", label: "Home" },
  { key: "programs", label: "My Programs" },
  { key: "workouts", label: "Workouts" },
  { key: "challenge", label: "Challenge" },
] as const;

const TabLoader = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={20} className="text-primary animate-spin" />
  </div>
);

const Dashboard = () => {
  const { user, subscribed, subscriptionTier } = useAuth();
  const { trialExpired, isOnTrial, trialDaysLeft } = useTrialStatus();
  const { isAdmin } = useIsAdmin();
  const [profile, setProfile] = useState<{ full_name: string | null; athlete_name: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState("home");
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

  const athleteDisplay = profile?.athlete_name || profile?.full_name || "Athlete";
  const isNewUser = hasPrograms === false && hasLogs === false;

  const tabs = useMemo(() =>
    subscriptionTier === "team_elite" || isAdmin
      ? [...BASE_TABS, { key: "team", label: "Team" } as const]
      : BASE_TABS,
    [subscriptionTier, isAdmin]
  );

  const handleViewPoints = useCallback(() => setActiveTab("challenge"), []);
  const handleViewReferrals = useCallback(() => setActiveTab("challenge"), []);

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
              {subscriptionTier ? (
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
          </div>
        </div>

        <StudioCheckIn />

        {/* Resume workout banner */}
        {localStorage.getItem("m2-paused-workout") && (
          <button
            onClick={() => window.dispatchEvent(new Event("resume-workout-zone"))}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 mb-4 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all animate-pulse"
          >
            <Play size={14} /> Resume Paused Workout
          </button>
        )}

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
          {activeTab === "programs" && <MyPrograms />}
          {activeTab === "workouts" && <WorkoutsTab />}
          {activeTab === "points" && <PointsLeaderboard />}
          {activeTab === "referrals" && <ReferralDashboard />}
          {activeTab === "team" && <TeamManager />}
        </Suspense>
      </div>

      {/* Timer moved to ActiveWorkoutZone */}

      {/* Trial banner */}
      {isOnTrial && !subscribed && !isAdmin && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-primary text-primary-foreground text-center py-2 text-xs font-bold uppercase tracking-widest">
          🔥 Trial: {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining
        </div>
      )}

      {/* Hard paywall */}
      {trialExpired && !subscribed && !isAdmin && (
        <TrialPaywallModal open={true} hardLock />
      )}
    </div>
  );
};

export default Dashboard;
