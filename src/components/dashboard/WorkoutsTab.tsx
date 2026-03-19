import { useState, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import WorkoutBuilder from "@/components/workout/WorkoutBuilder";
import CommunityWorkoutBank from "@/components/workout/CommunityWorkoutBank";

const PRO_AND_ABOVE: (string | null)[] = ["foundation", "custom", "team_elite"];

const WorkoutsTab = memo(() => {
  const [showBuilder, setShowBuilder] = useState(false);
  const { subscriptionTier, isLegend } = useAuth();
  const { isAdmin } = useIsAdmin();
  const canCreate = isAdmin || isLegend || PRO_AND_ABOVE.includes(subscriptionTier);

  return showBuilder ? (
    <WorkoutBuilder
      onSaved={() => setShowBuilder(false)}
      onClose={() => setShowBuilder(false)}
    />
  ) : (
    <CommunityWorkoutBank onCreateNew={canCreate ? () => setShowBuilder(true) : undefined} />
  );
});

WorkoutsTab.displayName = "WorkoutsTab";

export default WorkoutsTab;
