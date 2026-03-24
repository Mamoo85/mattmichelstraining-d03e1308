import { useState, memo } from "react";
import { Sparkles, Dumbbell, Wrench, Users } from "lucide-react";
import WorkoutBuilder from "@/components/workout/WorkoutBuilder";
import CommunityWorkoutBank from "@/components/workout/CommunityWorkoutBank";
import AiWorkoutSuggest from "@/components/workout/AiWorkoutSuggest";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type View = "tabs" | "builder" | "ai-workout" | "ai-fixit";
type Tab = "my" | "generated" | "fixit" | "community";

const TAB_CONFIG: { key: Tab; label: string; icon: typeof Dumbbell }[] = [
  { key: "my", label: "My Workouts", icon: Dumbbell },
  { key: "generated", label: "Generated", icon: Sparkles },
  { key: "fixit", label: "Fix It", icon: Wrench },
  { key: "community", label: "Community", icon: Users },
];

const WorkoutsTab = memo(() => {
  const [view, setView] = useState<View>("tabs");
  const [tab, setTab] = useState<Tab>("my");
  const { subscribed } = useAuth();
  const { isAdmin } = useIsAdmin();
  const canUseAi = subscribed || isAdmin;

  if (view === "builder") {
    return (
      <WorkoutBuilder
        onSaved={() => setView("tabs")}
        onClose={() => setView("tabs")}
      />
    );
  }

  if (view === "ai-workout") {
    return <AiWorkoutSuggest onDone={() => { setTab("generated"); setView("tabs"); }} initialPath="workout" />;
  }

  if (view === "ai-fixit") {
    return <AiWorkoutSuggest onDone={() => { setTab("fixit"); setView("tabs"); }} initialPath="fixit" />;
  }

  return (
    <div className="space-y-4">
      {/* Create buttons */}
      {canUseAi && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setView("ai-workout")}
            className="h-12 border-2 border-primary text-primary flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
          >
            <Sparkles size={13} /> Smart Build
          </button>
          <button
            onClick={() => setView("ai-fixit")}
            className="h-12 border-2 border-accent text-accent-foreground flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-accent hover:text-accent-foreground transition-all"
          >
            <Wrench size={13} /> Fix It
          </button>
          <button
            onClick={() => setView("builder")}
            className="h-12 border-2 border-border text-muted-foreground flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest hover:border-primary/40 hover:text-foreground transition-all"
          >
            <Dumbbell size={13} /> Manual
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <CommunityWorkoutBank
        mode={tab}
        onCreateNew={!canUseAi ? () => setView("builder") : undefined}
      />
    </div>
  );
});

WorkoutsTab.displayName = "WorkoutsTab";

export default WorkoutsTab;
