import { memo, lazy, Suspense, useState } from "react";
import { MessageCircle, Camera, Brain } from "lucide-react";
import MonthlyFocusWidget from "@/components/features/MonthlyFocusWidget";
import UpcomingSessions from "@/components/sessions/UpcomingSessions";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import TodaysTrainingCard from "@/components/programs/TodaysTrainingCard";
import DashboardReferralCard from "@/components/dashboard/DashboardReferralCard";
import DashboardChallengePreview from "@/components/dashboard/DashboardChallengePreview";
import CommunityActivityFeed from "@/components/dashboard/CommunityActivityFeed";
import DynamicPromoBox from "@/components/dashboard/DynamicPromoBox";
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
  onOpenGenerator?: () => void;
}

const DashboardHome = memo(({ isNewUser, isInPerson, onViewPoints, onViewReferrals, onOpenGenerator }: DashboardHomeProps) => {
  const { subscribed } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [postureOpen, setPostureOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  useBrowserNotifications();

  return (
    <div className="space-y-5">
      {isNewUser && !isInPerson && (
        <EmptyStateCard
          title="Welcome to M²"
          description="Your training log is empty. Select your starting track and begin Day 1."
          ctaLabel="Select Your Starting Track →"
          ctaTo="/shop"
        />
      )}

      <DashboardReferralCard />
      <CommunityActivityFeed />

      <Suspense fallback={null}>
        <CustomProgramRequest />
      </Suspense>

      <TodaysTrainingCard />
      <UpcomingSessions />
      <MonthlyFocusWidget />

      <DashboardChallengePreview onViewChallenge={onViewPoints} />

      {/* Posture Analysis + Technology — glowing buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setPostureOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-[0.97]"
          style={{
            background: "rgba(236,72,153,0.08)",
            border: "1px solid rgba(236,72,153,0.3)",
            color: "#ec4899",
            boxShadow: "0 0 12px rgba(236,72,153,0.2)",
          }}
        >
          <Camera size={14} /> Posture Analysis
        </button>
        <button
          onClick={() => setTechOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-[0.97]"
          style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "#6366f1",
            boxShadow: "0 0 12px rgba(99,102,241,0.2)",
          }}
        >
          <Brain size={14} /> Technology Hub
        </button>
      </div>

      <Suspense fallback={null}>
        <SharedWorkoutFeed />
      </Suspense>

      {/* Dynamic promo box */}
      <DynamicPromoBox onOpenGenerator={onOpenGenerator} />

      {/* Chat with Matt */}
      <button
        onClick={() => setChatOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-[0.97]"
        style={{
          background: "rgba(249,115,22,0.08)",
          border: "1px solid rgba(249,115,22,0.25)",
          color: "#f97316",
        }}
      >
        <MessageCircle size={14} /> Chat with Matt
      </button>
      {chatOpen && (
        <Suspense fallback={null}>
          <CoachChatPanel onClose={() => setChatOpen(false)} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <SelfPostureAnalysis open={postureOpen} onClose={() => setPostureOpen(false)} />
        <TechHubModal open={techOpen} onClose={() => setTechOpen(false)} />
      </Suspense>
    </div>
  );
});

DashboardHome.displayName = "DashboardHome";

export default DashboardHome;
