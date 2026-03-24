import { memo, lazy, Suspense, useState, useEffect } from "react";
import MonthlyFocusWidget from "@/components/features/MonthlyFocusWidget";
import UpcomingSessions from "@/components/sessions/UpcomingSessions";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import TodaysTrainingCard from "@/components/programs/TodaysTrainingCard";
import { useAuth } from "@/hooks/useAuth";

const SharedWorkoutFeed = lazy(() => import("@/components/workout/SharedWorkoutFeed"));
const CustomProgramRequest = lazy(() => import("./CustomProgramRequest"));

interface DashboardHomeProps {
  isNewUser: boolean;
  isInPerson: boolean;
  onViewPoints: () => void;
  onViewReferrals: () => void;
}

const DashboardHome = memo(({ isNewUser, isInPerson, onViewPoints, onViewReferrals }: DashboardHomeProps) => {
  const { subscribed } = useAuth();

  return (
    <div className="space-y-5">
      {/* Empty state CTA — never for in-person clients */}
      {isNewUser && !isInPerson && (
        <EmptyStateCard
          title="Welcome to M²"
          description="Your training log is empty. Select your starting track and begin Day 1."
          ctaLabel="Select Your Starting Track →"
          ctaTo="/shop"
        />
      )}

      <Suspense fallback={null}>
        <CustomProgramRequest />
      </Suspense>

      <TodaysTrainingCard />

      <UpcomingSessions />
      <MonthlyFocusWidget />

      <Suspense fallback={null}>
        <SharedWorkoutFeed />
      </Suspense>
    </div>
  );
});

DashboardHome.displayName = "DashboardHome";

export default DashboardHome;
