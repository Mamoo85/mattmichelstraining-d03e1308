import AppNavbar from "@/components/layout/AppNavbar";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import TrialPaywallModal from "@/components/billing/TrialPaywallModal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Crown, User, Dumbbell, Trophy, Sparkles, Wrench, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import PwaInstallBanner from "@/components/layout/PwaInstallBanner";
import StudioCheckIn from "@/components/sessions/StudioCheckIn";
import { safeLocalStorage } from "@/lib/browserStorage";

import DashboardHome from "@/components/dashboard/DashboardHome";
import WorkoutsTab from "@/components/dashboard/WorkoutsTab";

import { lazy, Suspense } from "react";
const MyPrograms = lazy(() => import("@/components/features/MyPrograms"));
const ChallengeHub = lazy(() => import("@/components/dashboard/ChallengeHub"));
const TeamManager = lazy(() => import("@/components/features/TeamManager"));
const ProgressCharts = lazy(() => import("@/components/features/ProgressCharts"));
const AiWorkoutSuggest = lazy(() => import("@/components/workout/AiWorkoutSuggest"));
const FixItLibrary = lazy(() => import("@/components/features/FixItLibrary"));

import PortalOnboarding from "@/components/dashboard/PortalOnboarding";

const BASE_TABS = [
  { key: "home", label: "Home" },
  { key: "progress", label: "Progress" },
  { key: "programs", label: "Programs" },
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
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string | null; athlete_name: string | null; is_in_person: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [hasPrograms, setHasPrograms] = useState<boolean | null>(null);
  const [hasLogs, setHasLogs] = useState<boolean | null>(null);
  const [generatorView, setGeneratorView] = useState<null | "workout" | "fixit">(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("full_name, athlete_name, is_in_person").eq("user_id", user.id).single(),
      supabase.from("user_active_programs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("progress_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([profileRes, progRes, logRes]) => {
      if (profileRes.data) setProfile(profileRes.data as any);
      setHasPrograms((progRes.count ?? 0) > 0);
      setHasLogs((logRes.count ?? 0) > 0);
    });
  }, [user]);

  const athleteDisplay = profile?.athlete_name || profile?.full_name || "Athlete";
  const isNewUser = hasPrograms === false && hasLogs === false;

  const tabs = useMemo(() =>
    subscriptionTier === "elite" || isAdmin
      ? [...BASE_TABS, { key: "team", label: "Team" } as const]
      : BASE_TABS,
    [subscriptionTier, isAdmin]
  );

  const handleViewPoints = useCallback(() => setActiveTab("challenge"), []);
  const handleViewReferrals = useCallback(() => setActiveTab("challenge"), []);

  const canUseGenerator = subscribed || isAdmin;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <PwaInstallBanner />
      <div className="container pt-20 pb-40 md:pb-24 px-4 sm:px-6">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground truncate">{athleteDisplay}</h2>
              {isAdmin ? (
                <Badge className="text-[9px] uppercase tracking-widest shrink-0 bg-primary text-primary-foreground">
                  <Crown size={9} className="mr-0.5" /> Coach
                </Badge>
              ) : subscriptionTier ? (
                <Badge className="text-[9px] uppercase tracking-widest shrink-0">
                  <Crown size={9} className="mr-0.5" /> {TIERS[subscriptionTier].name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] uppercase tracking-widest shrink-0">Free</Badge>
              )}
            </div>
          </div>
          <Link
            to="/profile"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <User size={14} />
          </Link>
        </div>

        <StudioCheckIn onOpenWorkouts={() => setActiveTab("workouts")} />

        {/* Resume workout banner */}
        {safeLocalStorage.getItem("m2-paused-workout") && (
          <button
            onClick={() => window.dispatchEvent(new Event("resume-workout-zone"))}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 mb-4 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all animate-pulse"
          >
            Resume Paused Workout
          </button>
        )}

        {/* Action Buttons — Enter Portal + Generators */}
        <div className="space-y-2 mb-5">
          {/* Primary: Enter Portal */}
          <button
            onClick={() => {
              if (!subscribed && hasPrograms === false && hasLogs === false && !isAdmin) {
                navigate("/pricing");
                return;
              }
              window.dispatchEvent(new CustomEvent("open-workout-zone", { detail: null }));
            }}
            className="w-full h-12 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Dumbbell size={14} /> Open Workout Portal
          </button>

          {/* Secondary row: Generator + Fix It */}
          {canUseGenerator && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate("/the-edge")}
                className="h-11 bg-card border border-primary/40 text-primary flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Sparkles size={13} /> Workout Generator
              </button>
              <button
                onClick={() => {
                  navigate("/the-edge");
                  // Set path to fix-it via URL param or state
                  setTimeout(() => window.dispatchEvent(new CustomEvent("set-generator-path", { detail: "fixit" })), 100);
                }}
                className="h-11 bg-card border border-[hsl(270_60%_50%)] text-[hsl(270_60%_60%)] flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[hsl(270_60%_50%)] hover:text-white transition-all"
              >
                <Wrench size={13} /> Fix It Engine
              </button>
            </div>
          )}

          {/* Prove It */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-prove-it-zone"))}
            className="w-full h-11 bg-card border border-border text-muted-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:border-primary/40 hover:text-foreground transition-all"
          >
            <Trophy size={13} /> Submit PR Attempt
          </button>
        </div>

        {/* Pill tab switcher */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide bg-muted/50 rounded-full p-1 sm:w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap shrink-0 rounded-full ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
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
              isInPerson={profile?.is_in_person ?? false}
              onViewPoints={handleViewPoints}
              onViewReferrals={handleViewReferrals}
            />
          )}
          {activeTab === "progress" && <ProgressCharts />}
          {activeTab === "programs" && <MyPrograms />}
          {activeTab === "workouts" && <WorkoutsTab />}
          {activeTab === "challenge" && <ChallengeHub />}
          {activeTab === "team" && <TeamManager />}
        </Suspense>
      </div>

      {/* Trial banner */}
      {isOnTrial && !subscribed && !isAdmin && !profile?.is_in_person && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-primary text-primary-foreground text-center py-2 text-xs font-bold uppercase tracking-widest">
          🔥 Trial: {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining
        </div>
      )}

      {/* Hard paywall */}
      {trialExpired && !subscribed && !isAdmin && !profile?.is_in_person && (
        <TrialPaywallModal open={true} hardLock />
      )}

      <PortalOnboarding />
    </div>
  );
};

export default Dashboard;
