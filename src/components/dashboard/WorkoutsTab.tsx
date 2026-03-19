import { useState, memo } from "react";
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
    <CommunityWorkoutBank onCreateNew={() => setShowBuilder(true)} />
  );
});

WorkoutsTab.displayName = "WorkoutsTab";

export default WorkoutsTab;
