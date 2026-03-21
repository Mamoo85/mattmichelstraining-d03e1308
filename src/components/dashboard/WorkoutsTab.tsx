import { useState, memo } from "react";
import { Sparkles, Dumbbell } from "lucide-react";
import WorkoutBuilder from "@/components/workout/WorkoutBuilder";
import CommunityWorkoutBank from "@/components/workout/CommunityWorkoutBank";
import AiWorkoutSuggest from "@/components/workout/AiWorkoutSuggest";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type View = "bank" | "builder" | "ai";

const WorkoutsTab = memo(() => {
  const [view, setView] = useState<View>("bank");
  const { subscribed } = useAuth();
  const { isAdmin } = useIsAdmin();
  const canUseAi = subscribed || isAdmin;

  if (view === "builder") {
    return (
      <WorkoutBuilder
        onSaved={() => setView("bank")}
        onClose={() => setView("bank")}
      />
    );
  }

  if (view === "ai") {
    return <AiWorkoutSuggest onDone={() => setView("bank")} />;
  }

  return (
    <div className="space-y-4">
      {/* AI + Manual create buttons */}
      {canUseAi && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setView("ai")}
            className="h-12 border-2 border-primary text-primary flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
          >
            <Sparkles size={14} /> Smart Build
          </button>
          <button
            onClick={() => setView("builder")}
            className="h-12 border-2 border-border text-muted-foreground flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:border-primary/40 hover:text-foreground transition-all"
          >
            <Dumbbell size={14} /> Manual Build
          </button>
        </div>
      )}
      <CommunityWorkoutBank onCreateNew={!canUseAi ? () => setView("builder") : undefined} />
    </div>
  );
});

WorkoutsTab.displayName = "WorkoutsTab";

export default WorkoutsTab;
