import { useState, memo, useEffect } from "react";
import { Sparkles, Dumbbell, Wrench, Users, ChevronDown } from "lucide-react";
import WorkoutBuilder from "@/components/workout/WorkoutBuilder";
import CommunityWorkoutBank from "@/components/workout/CommunityWorkoutBank";
import AiWorkoutSuggest from "@/components/workout/AiWorkoutSuggest";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { safeLocalStorage } from "@/lib/browserStorage";

type View = "tabs" | "builder" | "ai-workout" | "ai-fixit";
type Tab = "my" | "generated" | "fixit" | "community";

const TAB_CONFIG: { key: Tab; label: string; icon: typeof Dumbbell }[] = [
  { key: "my", label: "Mine", icon: Dumbbell },
  { key: "generated", label: "AI", icon: Sparkles },
  { key: "fixit", label: "Fix It", icon: Wrench },
  { key: "community", label: "Community", icon: Users },
];

const LAST_TAB_KEY = "m2-workouts-last-tab";

const WorkoutsTab = memo(() => {
  const [view, setView] = useState<View>("tabs");
  const [tab, setTab] = useState<Tab>(() => {
    const saved = safeLocalStorage.getItem(LAST_TAB_KEY);
    return (saved as Tab) || "my";
  });
  const { subscribed } = useAuth();
  const { isAdmin } = useIsAdmin();
  const canUseAi = subscribed || isAdmin;
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    safeLocalStorage.setItem(LAST_TAB_KEY, tab);
  }, [tab]);

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
    <div className="space-y-3">
      {/* Create dropdown — compact */}
      {canUseAi && (
        <div>
          <button
            onClick={() => setCreateOpen(!createOpen)}
            className="w-full h-10 border border-border bg-card flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            + Create Workout
            <ChevronDown size={10} className={`transition-transform ${createOpen ? "rotate-180" : ""}`} />
          </button>
          {createOpen && (
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              <button
                onClick={() => { setCreateOpen(false); setView("ai-workout"); }}
                className="h-10 border border-primary/30 text-primary flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Sparkles size={11} /> Smart
              </button>
              <button
                onClick={() => { setCreateOpen(false); setView("ai-fixit"); }}
                className="h-10 border border-accent/30 text-accent-foreground flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
              >
                <Wrench size={11} /> Fix It
              </button>
              <button
                onClick={() => { setCreateOpen(false); setView("builder"); }}
                className="h-10 border border-border text-muted-foreground flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-widest hover:border-primary/40 hover:text-foreground transition-all"
              >
                <Dumbbell size={11} /> Manual
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab bar — compact */}
      <div className="flex border-b border-border">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 px-2.5 py-2 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={10} /> {label}
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
