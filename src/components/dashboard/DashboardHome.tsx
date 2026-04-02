import { memo, lazy, Suspense, useState } from "react";
import { MessageCircle, Camera, Brain } from "lucide-react";
import MonthlyFocusWidget from "@/components/features/MonthlyFocusWidget";
import UpcomingSessions from "@/components/sessions/UpcomingSessions";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import TodaysTrainingCard from "@/components/programs/TodaysTrainingCard";
import DashboardReferralCard from "@/components/dashboard/DashboardReferralCard";
import DashboardChallengePreview from "@/components/dashboard/DashboardChallengePreview";
import CommunityActivityFeed from "@/components/dashboard/CommunityActivityFeed";
import { useAuth } from "@/hooks/useAuth";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";

const SharedWorkoutFeed = lazy(() => import("@/components/workout/SharedWorkoutFeed"));
const CustomProgramRequest = lazy(() => import("./CustomProgramRequest"));
const CoachChatPanel = lazy(() => import("./CoachChatPanel"));
const SelfPostureAnalysis = lazy(() => import("./SelfPostureAnalysis"));
const TechHubModal = lazy(() => import("./TechHubModal"));

interface DashboardHomeProps {
  isNewUser: boolean;
  isInPerson: boolean;
  onViewPoints: () => void;
  onViewReferrals: () => void;
}

const DashboardHome = memo(({ isNewUser, isInPerson, onViewPoints, onViewReferrals }: DashboardHomeProps) => {
  const { subscribed } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [postureOpen, setPostureOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  useBrowserNotifications();

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

      {/* Invite card — near top, above main content */}
      <DashboardReferralCard />

      {/* Community activity feed */}
      <CommunityActivityFeed />

      <Suspense fallback={null}>
        <CustomProgramRequest />
      </Suspense>

      <TodaysTrainingCard />

      <UpcomingSessions />
      <MonthlyFocusWidget />

      {/* Challenge leaderboard preview */}
      <DashboardChallengePreview onViewChallenge={onViewPoints} />

      {/* Posture Analysis + Technology buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setPostureOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-border bg-card hover:bg-muted/50 transition-colors text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary rounded-lg"
        >
          <Camera size={14} /> Posture Analysis
        </button>
        <button
          onClick={() => setTechOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-border bg-card hover:bg-muted/50 transition-colors text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary rounded-lg"
        >
          <Brain size={14} /> Technology
        </button>
      </div>

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

      {/* Modals */}
      <Suspense fallback={null}>
        <SelfPostureAnalysis open={postureOpen} onClose={() => setPostureOpen(false)} />
        <TechHubModal open={techOpen} onClose={() => setTechOpen(false)} />
      </Suspense>
    </div>
  );
});

DashboardHome.displayName = "DashboardHome";

export default DashboardHome;
