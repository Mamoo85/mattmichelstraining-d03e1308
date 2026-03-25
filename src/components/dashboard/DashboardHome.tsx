import { memo, lazy, Suspense, useState } from "react";
import { MessageCircle } from "lucide-react";
import MonthlyFocusWidget from "@/components/features/MonthlyFocusWidget";
import UpcomingSessions from "@/components/sessions/UpcomingSessions";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import TodaysTrainingCard from "@/components/programs/TodaysTrainingCard";
import { useAuth } from "@/hooks/useAuth";

const SharedWorkoutFeed = lazy(() => import("@/components/workout/SharedWorkoutFeed"));
const CustomProgramRequest = lazy(() => import("./CustomProgramRequest"));
const CoachChatPanel = lazy(() => import("./CoachChatPanel"));

interface DashboardHomeProps {
  isNewUser: boolean;
  isInPerson: boolean;
  onViewPoints: () => void;
  onViewReferrals: () => void;
}

const DashboardHome = memo(({ isNewUser, isInPerson, onViewPoints, onViewReferrals }: DashboardHomeProps) => {
  const { subscribed } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);

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

      {/* Chat with Matt — portal only */}
      <button
        onClick={() => setChatOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 border border-border bg-card hover:bg-muted/50 transition-colors text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
      >
        <MessageCircle size={14} /> Chat with Matt
      </button>
      {chatOpen && (
        <Suspense fallback={null}>
          <CoachChatPanel onClose={() => setChatOpen(false)} />
        </Suspense>
      )}
    </div>
  );
});

DashboardHome.displayName = "DashboardHome";

export default DashboardHome;
