import { useState, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import WorkoutBuilder from "@/components/workout/WorkoutBuilder";
import CommunityWorkoutBank from "@/components/workout/CommunityWorkoutBank";

const WorkoutsTab = memo(() => {
  const [showBuilder, setShowBuilder] = useState(false);

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
