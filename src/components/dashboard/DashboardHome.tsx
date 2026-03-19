import { memo, lazy, Suspense, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import MonthlyFocusWidget from "@/components/MonthlyFocusWidget";
import UpcomingSessions from "@/components/UpcomingSessions";
import PointsWidget from "@/components/PointsWidget";
import WorkoutScanner from "@/components/workout/WorkoutScanner";
import EmptyStateCard from "@/components/EmptyStateCard";
import ReferEarnCard from "./ReferEarnCard";
import WorkoutPickerModal from "./WorkoutPickerModal";
import { useAuth } from "@/hooks/useAuth";

const SharedWorkoutFeed = lazy(() => import("@/components/workout/SharedWorkoutFeed"));

interface DashboardHomeProps {
  isNewUser: boolean;
  onViewPoints: () => void;
  onViewReferrals: () => void;
}

const DashboardHome = memo(({ isNewUser, onViewPoints, onViewReferrals }: DashboardHomeProps) => {
  const { subscribed, isLegend } = useAuth();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleStartWorkout = useCallback(() => {
    // Free users with no content go straight to pricing
    if (!subscribed && !isLegend && isNewUser) {
      navigate("/pricing");
      return;
    }
    setPickerOpen(true);
  }, [subscribed, isLegend, isNewUser, navigate]);

  return (
  <div className="space-y-6">
    {isNewUser && (
      <EmptyStateCard
        title="Welcome to M²"
        description="Your training log is empty. Select your starting track and begin Day 1 — Matt will review every session and coach you personally."
        ctaLabel="Select Your Starting Track →"
        ctaTo="/shop"
      />
    )}

    <div className="bg-card border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Quick Log</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Snap a photo of your school workout card or gym whiteboard — AI reads it and logs your session instantly.
      </p>
      <WorkoutScanner />
      <button
        onClick={handleStartWorkout}
        className="w-full h-10 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all mt-2"
      >
        <Play size={14} /> Start Workout
      </button>
    </div>

    <WorkoutPickerModal open={pickerOpen} onOpenChange={setPickerOpen} />

    <Link
      to="/nutrition"
      className="block bg-card border border-border p-5 space-y-1 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">AI Nutrition</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Snap a photo of your food and get instant calorie & macro estimates.
      </p>
    </Link>

    <UpcomingSessions />
    <PointsWidget onViewLeaderboard={onViewPoints} />
    <ReferEarnCard onViewAll={onViewReferrals} />
    <MonthlyFocusWidget />

    <Suspense fallback={null}>
      <SharedWorkoutFeed />
    </Suspense>
  </div>
));

DashboardHome.displayName = "DashboardHome";

export default DashboardHome;
