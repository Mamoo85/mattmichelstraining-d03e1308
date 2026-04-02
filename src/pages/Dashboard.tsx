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
import PortalOnboarding from "@/components/dashboard/PortalOnboarding";
import FeatureLearningModal from "@/components/dashboard/FeatureLearningModal";
import type { FeatureTip } from "@/components/dashboard/FeatureLearningModal";
import {
  WORKOUT_PORTAL_TIP,
  WORKOUT_GENERATOR_TIP,
  FIXIT_ENGINE_TIP,
  PROVE_IT_TIP,
} from "@/components/dashboard/featureTips";

import { lazy, Suspense } from "react";
const WelcomeGiftModal = lazy(() => import("@/components/dashboard/WelcomeGiftModal"));
const NamePromptModal = lazy(() => import("@/components/dashboard/NamePromptModal"));
const MyPrograms = lazy(() => import("@/components/features/MyPrograms"));
const ChallengeHub = lazy(() => import("@/components/dashboard/ChallengeHub"));
const ProgressCharts = lazy(() => import("@/components/features/ProgressCharts"));
const AiWorkoutSuggest = lazy(() => import("@/components/workout/AiWorkoutSuggest"));
const FixItLibrary = lazy(() => import("@/components/features/FixItLibrary"));

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

/** Check if user has already seen a feature tip */
const hasSeen = (key: string) => safeLocalStorage.getItem(key) === "1";
const markSeen = (key: string) => safeLocalStorage.setItem(key, "1");

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
  const [showWelcomeGift, setShowWelcomeGift] = useState(() => safeLocalStorage.getItem("m2-welcome-gift-seen-v2") !== "1");
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  // Feature learning modal state
  const [activeTip, setActiveTip] = useState<FeatureTip | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("full_name, athlete_name, is_in_person").eq("user_id", user.id).single(),
      supabase.from("user_active_programs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("progress_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([profileRes, progRes, logRes]) => {
      if (profileRes.data) {
        setProfile(profileRes.data as any);
        // Show name prompt if full_name is empty/null
        const name = (profileRes.data as any).full_name;
        if (!name || name.trim() === '') {
          setShowNamePrompt(true);
        }
      }
      setHasPrograms((progRes.count ?? 0) > 0);
      setHasLogs((logRes.count ?? 0) > 0);
    });
  }, [user]);

  const athleteDisplay = profile?.athlete_name || profile?.full_name || "Athlete";
  const isNewUser = hasPrograms === false && hasLogs === false;
  const tabs = BASE_TABS;

  const handleViewPoints = useCallback(() => setActiveTab("challenge"), []);
  const handleViewReferrals = useCallback(() => setActiveTab("challenge"), []);
  const canUseGenerator = subscribed || isAdmin;

  /** Show a feature tip if unseen, then run the action. If already seen, run immediately. */
  const withTip = useCallback((tip: FeatureTip, action: () => void) => {
    if (hasSeen(tip.storageKey)) {
      action();
    } else {
      setActiveTip(tip);
      setPendingAction(() => action);
    }
  }, []);

  const handleTipContinue = useCallback(() => {
    if (activeTip) markSeen(activeTip.storageKey);
    setActiveTip(null);
    pendingAction?.();
    setPendingAction(null);
  }, [activeTip, pendingAction]);

  const handleTipDismiss = useCallback(() => {
    if (activeTip) markSeen(activeTip.storageKey);
    setActiveTip(null);
    setPendingAction(null);
  }, [activeTip]);

  // Button actions (extracted so they can be passed to withTip)
  const openPortalAction = useCallback(() => {
    if (!subscribed && hasPrograms === false && hasLogs === false && !isAdmin) {
      navigate("/pricing");
      return;
    }
    window.dispatchEvent(new CustomEvent("open-workout-zone", { detail: null }));
  }, [subscribed, hasPrograms, hasLogs, isAdmin, navigate]);

  const openGeneratorAction = useCallback(() => setGeneratorView("workout"), []);
  const openFixItAction = useCallback(() => setGeneratorView("fixit"), []);
  const openProveItAction = useCallback(() => {
    window.dispatchEvent(new CustomEvent("open-prove-it-zone"));
  }, []);

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

        {/* Action Buttons */}
        <div className="space-y-2 mb-5">
          <button
            onClick={() => withTip(WORKOUT_PORTAL_TIP, openPortalAction)}
            className="w-full h-12 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Dumbbell size={14} /> Open Workout Portal
          </button>

          {canUseGenerator && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => withTip(WORKOUT_GENERATOR_TIP, openGeneratorAction)}
                className="h-11 bg-card border border-primary/40 text-primary flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Sparkles size={13} /> Workout Generator
              </button>
              <button
                onClick={() => withTip(FIXIT_ENGINE_TIP, openFixItAction)}
                className="h-11 bg-card border border-[hsl(270_60%_50%)] text-[hsl(270_60%_60%)] flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[hsl(270_60%_50%)] hover:text-white transition-all"
              >
                <Wrench size={13} /> Fix It Engine
              </button>
            </div>
          )}

          <button
            onClick={() => withTip(PROVE_IT_TIP, openProveItAction)}
            className="w-full h-11 bg-card border border-border text-muted-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:border-primary/40 hover:text-foreground transition-all"
          >
            <Trophy size={13} /> Submit PR Attempt
          </button>
        </div>

        {/* Generator overlay */}
        {generatorView ? (
          <div className="space-y-4">
            <button
              onClick={() => setGeneratorView(null)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              <ArrowLeft size={12} /> Back to Dashboard
            </button>
            <Suspense fallback={<TabLoader />}>
              {generatorView === "workout" && (
                <AiWorkoutSuggest onDone={() => setGeneratorView(null)} initialPath="workout" />
              )}
              {generatorView === "fixit" && (
                <AiWorkoutSuggest onDone={() => setGeneratorView(null)} initialPath="fixit" />
              )}
            </Suspense>
          </div>
        ) : (
          <>
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

            <Suspense fallback={<TabLoader />}>
              {activeTab === "home" && (
                <DashboardHome
                  isNewUser={isNewUser}
                  isInPerson={profile?.is_in_person ?? false}
                  onViewPoints={handleViewPoints}
                  onViewReferrals={handleViewReferrals}
                  onOpenGenerator={openGeneratorAction}
                />
              )}
              {activeTab === "progress" && <ProgressCharts />}
              {activeTab === "programs" && <MyPrograms />}
              {activeTab === "workouts" && <WorkoutsTab />}
              {activeTab === "challenge" && <ChallengeHub />}
            </Suspense>
          </>
        )}
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

      {showWelcomeGift && (
        <Suspense fallback={null}>
          <WelcomeGiftModal open={showWelcomeGift} onClose={() => setShowWelcomeGift(false)} />
        </Suspense>
      )}

      {/* Feature learning modals */}
      {activeTip && (
        <FeatureLearningModal
          tip={activeTip}
          onContinue={handleTipContinue}
          onDismiss={handleTipDismiss}
        />
      )}

      {/* Name prompt modal */}
      {showNamePrompt && (
        <Suspense fallback={null}>
          <NamePromptModal
            open={showNamePrompt}
            onComplete={() => {
              setShowNamePrompt(false);
              // Refresh profile
              if (user) {
                supabase.from("profiles").select("full_name, athlete_name, is_in_person").eq("user_id", user.id).single()
                  .then(({ data }) => { if (data) setProfile(data as any); });
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Dashboard;
