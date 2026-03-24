import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Dumbbell, BookOpen, Lock, Zap, Loader2, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMinTier } from "@/hooks/useTierAccess";
import { useFamilyUserIds } from "@/hooks/useFamilyUserIds";
import { toast } from "sonner";
import type { WorkoutZoneContext } from "./ActiveWorkoutZone";
import OpenWorkoutAI from "./OpenWorkoutAI";

interface InterceptGatewayProps {
  onSelect: (context: WorkoutZoneContext) => void;
  onExit: () => void;
}

interface PurchasedProgram {
  id: string;
  program_title: string;
  sport: string | null;
  exercises: any;
}

interface ActiveProgramEntry {
  id: string;
  program_id: string;
  program_title: string;
  sport: string | null;
}

interface CommunityWorkout {
  id: string;
  title: string;
  exercises: any;
  creator_name: string;
}

interface WeekDay {
  week_number: number;
  day_number: number;
}

const InterceptGateway = ({ onSelect, onExit }: InterceptGatewayProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasTemplateAccess = useMinTier("foundation");
  const { familyIds } = useFamilyUserIds();
  const [programs, setPrograms] = useState<PurchasedProgram[]>([]);
  const [activePrograms, setActivePrograms] = useState<ActiveProgramEntry[]>([]);
  const [personalWorkouts, setPersonalWorkouts] = useState<CommunityWorkout[]>([]);
  const [masterTemplates, setMasterTemplates] = useState<CommunityWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAiGenerator, setShowAiGenerator] = useState(false);

  // Week/Day picker state
  const [pickingProgram, setPickingProgram] = useState<ActiveProgramEntry | null>(null);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [loadingDays, setLoadingDays] = useState(false);

  useEffect(() => {
    if (!user) return;
    const userIds = familyIds.length > 0 ? familyIds : [user.id];

    Promise.all([
      supabase
        .from("purchased_programs")
        .select("id, program_title, sport, exercises")
        .in("user_id", userIds)
        .eq("is_active", true)
        .order("purchased_at", { ascending: false }),
      supabase
        .from("user_active_programs" as any)
        .select("id, program_id, training_programs(id, title, sport)")
        .in("user_id", userIds)
        .eq("status", "active"),
      supabase
        .from("community_workouts")
        .select("id, title, exercises, creator_name")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("community_workouts")
        .select("id, title, exercises, creator_name")
        .eq("is_public", true)
        .not("user_id", "in", `(${userIds.join(",")})`)
        .order("likes_count", { ascending: false })
        .limit(20),
    ]).then(([progRes, activeRes, personalRes, templateRes]) => {
      setPrograms((progRes.data as PurchasedProgram[] | null) ?? []);
      const mapped = ((activeRes.data as any[]) ?? []).map((a: any) => ({
        id: a.id,
        program_id: a.program_id,
        program_title: a.training_programs?.title ?? "Program",
        sport: a.training_programs?.sport ?? null,
      }));
      setActivePrograms(mapped);
      setPersonalWorkouts((personalRes.data as CommunityWorkout[] | null) ?? []);
      setMasterTemplates((templateRes.data as CommunityWorkout[] | null) ?? []);
      setLoading(false);
    });
  }, [user, familyIds]);

  const mapExercises = (exercises: any) => {
    const arr = Array.isArray(exercises) ? exercises : [];
    return arr.map((ex: any) => ({
      exerciseTitle: ex.title || ex.exerciseTitle || ex.name || "Exercise",
      prescribedSets: parseInt(ex.sets) || ex.prescribedSets || 3,
      prescribedReps: parseInt(ex.reps) || ex.prescribedReps || 10,
      notes: ex.notes || ex.coach_instructions || "",
    }));
  };

  const handleProgram = (p: PurchasedProgram) => {
    onSelect({
      title: p.program_title,
      source: "program",
      exercises: mapExercises(p.exercises),
    });
  };

  // Step 1: user taps an active program → fetch week/day combos
  const handleActiveProgram = async (ap: ActiveProgramEntry) => {
    setPickingProgram(ap);
    setSelectedWeek(null);
    setLoadingDays(true);

    const { data } = await supabase
      .from("program_workouts")
      .select("week_number, day_number")
      .eq("program_id", ap.program_id)
      .order("week_number", { ascending: true })
      .order("day_number", { ascending: true });

    // Deduplicate
    const seen = new Set<string>();
    const unique: WeekDay[] = [];
    for (const row of (data as WeekDay[] | null) ?? []) {
      const key = `${row.week_number}-${row.day_number}`;
      if (!seen.has(key)) { seen.add(key); unique.push(row); }
    }
    setWeekDays(unique);
    setLoadingDays(false);
  };

  // Step 3: load exercises for the chosen week + day
  const loadDay = async (week: number, day: number) => {
    if (!pickingProgram) return;
    setLoadingDays(true);

    const { data: workouts } = await supabase
      .from("program_workouts")
      .select("exercise_id, prescribed_sets_reps, coach_instructions, exercise_library(id, title, video_url, the_why)")
      .eq("program_id", pickingProgram.program_id)
      .eq("week_number", week)
      .eq("day_number", day)
      .order("sort_order", { ascending: true });

    const exercises = ((workouts as any[]) ?? []).map((w: any) => ({
      exerciseId: w.exercise_library?.id || w.exercise_id,
      exerciseTitle: w.exercise_library?.title || "Exercise",
      prescribedSets: parseInt(w.prescribed_sets_reps?.split("x")?.[0]) || 3,
      prescribedReps: parseInt(w.prescribed_sets_reps?.split("x")?.[1]) || 10,
      notes: w.coach_instructions || "",
      videoUrl: w.exercise_library?.video_url || null,
      theWhy: w.exercise_library?.the_why || null,
    }));

    onSelect({
      title: `${pickingProgram.program_title} — W${week}D${day}`,
      source: "program",
      programId: pickingProgram.program_id,
      exercises,
    });
  };

  const handleWorkout = (w: CommunityWorkout, source: "community" | "custom") => {
    onSelect({
      title: w.title,
      source,
      exercises: mapExercises(w.exercises),
    });
  };

  const handleTemplateLocked = () => {
    toast.error("Upgrade to Foundation or higher to unlock M² Templates");
    navigate("/pricing");
    onExit();
  };

  const handleFreestyle = () => {
    onSelect({ title: "Open Workout", source: "manual" });
  };

  // Derived data for picker
  const weeks = [...new Set(weekDays.map((wd) => wd.week_number))].sort((a, b) => a - b);
  const daysForWeek = selectedWeek !== null
    ? weekDays.filter((wd) => wd.week_number === selectedWeek).map((wd) => wd.day_number).sort((a, b) => a - b)
    : [];

  // ── Week/Day Picker Sub-screen ──
  if (pickingProgram) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        <header className="shrink-0 px-4 py-4 border-b border-border">
          <button
            onClick={() => { setPickingProgram(null); setSelectedWeek(null); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <h1 className="text-sm font-bold uppercase tracking-widest text-primary truncate">
            {pickingProgram.program_title}
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">Select a week & day to load</p>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-24">
          {loadingDays ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : weeks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No workouts found in this program.</p>
          ) : selectedWeek === null ? (
            /* Week selector */
            <section className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Choose Week
              </span>
              {weeks.map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className="w-full text-left bg-card border border-border p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
                >
                  <Play size={14} className="text-primary flex-shrink-0" />
                  <p className="text-sm font-bold text-foreground">Week {w}</p>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {weekDays.filter((wd) => wd.week_number === w).length} days
                  </span>
                </button>
              ))}
            </section>
          ) : (
            /* Day selector */
            <section className="space-y-2">
              <button
                onClick={() => setSelectedWeek(null)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-1"
              >
                <ChevronLeft size={12} /> All Weeks
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Week {selectedWeek} — Choose Day
              </span>
              {daysForWeek.map((d) => (
                <button
                  key={d}
                  onClick={() => loadDay(selectedWeek, d)}
                  className="w-full text-left bg-card border border-border p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
                >
                  <Dumbbell size={14} className="text-primary flex-shrink-0" />
                  <p className="text-sm font-bold text-foreground">Day {d}</p>
                </button>
              ))}
            </section>
          )}
        </main>

        <footer className="fixed bottom-0 w-full z-50 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => { setPickingProgram(null); setSelectedWeek(null); }}
              className="w-full h-10 border border-border text-muted-foreground text-xs font-bold uppercase tracking-widest hover:text-foreground transition-colors"
            >
              ← Back to Selection
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <header className="shrink-0 px-4 py-4 border-b border-border">
        <h1 className="text-sm font-bold uppercase tracking-widest text-primary">
          What Are We Executing Today?
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-6 pb-24">
        {/* Open Workout */}
        <button
          onClick={handleFreestyle}
          className="w-full h-12 border-2 border-primary text-primary flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
        >
          <Zap size={14} /> Open Workout
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {programs.length > 0 && (
              <section className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <BookOpen size={12} /> Active Program
                </span>
                {programs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProgram(p)}
                    className="w-full text-left bg-card border border-border p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
                  >
                    <Play size={14} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{p.program_title}</p>
                      {p.sport && <p className="text-[10px] text-muted-foreground">{p.sport}</p>}
                    </div>
                  </button>
                ))}
              </section>
            )}

            {activePrograms.length > 0 && (
              <section className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Dumbbell size={12} /> My Programs
                </span>
                {activePrograms.map((ap) => (
                  <button
                    key={ap.id}
                    onClick={() => handleActiveProgram(ap)}
                    className="w-full text-left bg-card border border-border p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
                  >
                    <Play size={14} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{ap.program_title}</p>
                      {ap.sport && <p className="text-[10px] text-muted-foreground">{ap.sport}</p>}
                    </div>
                  </button>
                ))}
              </section>
            )}

            {personalWorkouts.length > 0 && (
              <section className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Dumbbell size={12} /> Personal Bank
                </span>
                {personalWorkouts.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleWorkout(w, "custom")}
                    className="w-full text-left bg-card border border-border p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
                  >
                    <Play size={14} className="text-primary flex-shrink-0" />
                    <p className="text-sm font-bold text-foreground truncate">{w.title}</p>
                  </button>
                ))}
              </section>
            )}

            {masterTemplates.length > 0 && (
              <section className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <BookOpen size={12} /> M² Master Templates
                </span>
                {masterTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() =>
                      hasTemplateAccess
                        ? handleWorkout(t, "community")
                        : handleTemplateLocked()
                    }
                    className={`w-full text-left bg-card border border-border p-3 transition-colors flex items-center gap-3 ${
                      hasTemplateAccess
                        ? "hover:border-primary/40"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    {hasTemplateAccess ? (
                      <Play size={14} className="text-primary flex-shrink-0" />
                    ) : (
                      <Lock size={14} className="text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{t.title}</p>
                      {t.creator_name && (
                        <p className="text-[10px] text-muted-foreground">by {t.creator_name}</p>
                      )}
                    </div>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="fixed bottom-0 w-full z-50 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={onExit}
            className="w-full h-10 border border-border text-muted-foreground text-xs font-bold uppercase tracking-widest hover:text-foreground transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </footer>
    </div>
  );
};

export default InterceptGateway;
