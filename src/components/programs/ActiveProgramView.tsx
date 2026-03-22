import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ChevronDown, ChevronRight, Dumbbell, Info, Printer, CheckCircle2 } from "lucide-react";
import ExerciseVideoEmbed from "../exercise/ExerciseVideoEmbed";
import AskCoachMatt from "./AskCoachMatt";
import CoachCheckIn from "./CoachCheckIn";
import BlockCompleteSummary from "./BlockCompleteSummary";
import { Progress } from "@/components/ui/progress";
import { printWorkoutLog } from "./printWorkoutLog";
import { toast } from "@/hooks/use-toast";

interface WorkoutExercise {
  id: string;
  exercise_id: string;
  week_number: number;
  day_number: number;
  prescribed_sets_reps: string;
  coach_instructions: string;
  sort_order: number;
  exercise: {
    id: string;
    title: string;
    the_why: string;
    equipment_needed: string;
    focus_area: string[];
    video_url: string | null;
  };
}

interface ActiveProgramProps {
  activeProgram: {
    id: string;
    program_id: string;
    current_week?: number;
    current_day?: number;
    block_number?: number;
    completed_days?: Array<{ week: number; day: number }>;
    program: {
      id: string;
      title: string;
      description: string;
      category: string;
      sport: string | null;
    };
  };
}

const TOTAL_WEEKS = 8;

const ActiveProgramView = ({ activeProgram }: ActiveProgramProps) => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(activeProgram.current_week ?? 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(activeProgram.current_day ?? null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [completedDays, setCompletedDays] = useState<Array<{ week: number; day: number }>>(
    activeProgram.completed_days ?? []
  );
  const [blockNumber, setBlockNumber] = useState(activeProgram.block_number ?? 1);
  const [currentWeek, setCurrentWeek] = useState(activeProgram.current_week ?? 1);
  const [currentDay, setCurrentDay] = useState(activeProgram.current_day ?? 1);
  const [blockComplete, setBlockComplete] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  useEffect(() => {
    const fetchWorkouts = async () => {
      const { data } = await supabase
        .from("program_workouts")
        .select("id, exercise_id, week_number, day_number, prescribed_sets_reps, coach_instructions, sort_order, exercise_library(id, title, the_why, equipment_needed, focus_area, video_url)")
        .eq("program_id", activeProgram.program_id)
        .order("week_number")
        .order("day_number")
        .order("sort_order");

      if (data) {
        setWorkouts(
          (data as any[]).map((w) => ({ ...w, exercise: w.exercise_library }))
        );
      }
      setLoading(false);
    };
    fetchWorkouts();
  }, [activeProgram.program_id]);

  // Check if block is complete
  useEffect(() => {
    if (currentWeek > TOTAL_WEEKS) {
      setBlockComplete(true);
    }
  }, [currentWeek]);

  const isDayCompleted = useCallback(
    (week: number, day: number) => completedDays.some((d) => d.week === week && d.day === day),
    [completedDays]
  );

  const markDayComplete = async () => {
    if (!selectedDay || isDayCompleted(selectedWeek, selectedDay)) return;
    setMarkingComplete(true);

    const newCompleted = [...completedDays, { week: selectedWeek, day: selectedDay }];

    // Determine next day/week
    const daysInCurrentWeek = [...new Set(workouts.filter((w) => w.week_number === selectedWeek).map((w) => w.day_number))].sort((a, b) => a - b);
    const currentDayIndex = daysInCurrentWeek.indexOf(selectedDay);
    let nextWeek = selectedWeek;
    let nextDay = currentDay;

    if (currentDayIndex < daysInCurrentWeek.length - 1) {
      nextDay = daysInCurrentWeek[currentDayIndex + 1];
    } else {
      nextWeek = selectedWeek + 1;
      const nextWeekDays = [...new Set(workouts.filter((w) => w.week_number === nextWeek).map((w) => w.day_number))].sort((a, b) => a - b);
      nextDay = nextWeekDays[0] ?? 1;
    }

    const { error } = await supabase
      .from("user_active_programs")
      .update({
        completed_days: newCompleted,
        current_week: nextWeek,
        current_day: nextDay,
      })
      .eq("id", activeProgram.id);

    if (!error) {
      setCompletedDays(newCompleted);
      setCurrentWeek(nextWeek);
      setCurrentDay(nextDay);
      toast({ title: "Day marked complete ✓", description: nextWeek > TOTAL_WEEKS ? "Block complete!" : `Next up: Week ${nextWeek}, Day ${nextDay}` });
      if (nextWeek > TOTAL_WEEKS) setBlockComplete(true);
    }
    setMarkingComplete(false);
  };

  const handleBlockAdvanced = () => {
    setBlockNumber((b) => b + 1);
    setCurrentWeek(1);
    setCurrentDay(1);
    setCompletedDays([]);
    setSelectedWeek(1);
    setSelectedDay(1);
    setBlockComplete(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  // Block complete state
  if (blockComplete) {
    return (
      <BlockCompleteSummary
        activeProgramId={activeProgram.id}
        blockNumber={blockNumber}
        completedDays={completedDays}
        programTitle={activeProgram.program.title}
        onBlockAdvanced={handleBlockAdvanced}
      />
    );
  }

  const weeks = [...new Set(workouts.map((w) => w.week_number))].sort((a, b) => a - b);
  const daysInWeek = [...new Set(workouts.filter((w) => w.week_number === selectedWeek).map((w) => w.day_number))].sort((a, b) => a - b);
  const dayExercises = workouts.filter((w) => w.week_number === selectedWeek && w.day_number === selectedDay);
  const totalDays = new Set(workouts.map((w) => `${w.week_number}-${w.day_number}`)).size;
  const progressPct = totalDays > 0 ? Math.round((completedDays.length / totalDays) * 100) : 0;

  const handlePrint = () => {
    const weekMap = new Map<number, Map<number, WorkoutExercise[]>>();
    workouts.forEach((w) => {
      if (!weekMap.has(w.week_number)) weekMap.set(w.week_number, new Map());
      const dayMap = weekMap.get(w.week_number)!;
      if (!dayMap.has(w.day_number)) dayMap.set(w.day_number, []);
      dayMap.get(w.day_number)!.push(w);
    });
    printWorkoutLog({
      title: activeProgram.program.title,
      sport: activeProgram.program.sport,
      category: activeProgram.program.category,
      weeks: [...weekMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([week, dayMap]) => ({
          week,
          days: [...dayMap.entries()]
            .sort(([a], [b]) => a - b)
            .map(([day, exercises]) => ({
              day,
              exercises: exercises
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((ex) => ({ name: ex.exercise.title, setsReps: ex.prescribed_sets_reps, instructions: ex.coach_instructions || undefined })),
            })),
        })),
    });
  };

  const isCurrentDay = (week: number, day: number) => week === currentWeek && day === currentDay;

  return (
    <div className="space-y-4">
      {/* Program header with progress */}
      <div className="bg-card shadow-m2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-0.5">
              Block {blockNumber} · {activeProgram.program.category}{activeProgram.program.sport ? ` · ${activeProgram.program.sport}` : ""}
            </span>
            <h2 className="text-base font-bold text-foreground">{activeProgram.program.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{activeProgram.program.description}</p>
          </div>
          {workouts.length > 0 && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest transition-m2 flex-shrink-0"
              aria-label="Print or download program as PDF"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print / PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{completedDays.length} / {totalDays} sessions</span>
            <span className="text-[10px] font-bold text-primary">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
        {/* Start Workout CTA */}
        {selectedDay !== null && dayExercises.length > 0 && (
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("open-workout-zone", {
                  detail: {
                    title: `${activeProgram.program.title} – Wk ${selectedWeek} Day ${selectedDay}`,
                    source: "program",
                    programId: activeProgram.program_id,
                  },
                })
              );
            }}
            className="w-full h-11 mt-3 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Play size={14} /> Start Workout – Wk {selectedWeek} Day {selectedDay}
          </button>
        )}
      </div>

      {/* Week selector */}
      {weeks.length > 0 ? (
        <>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Week</span>
            <div className="flex gap-1 flex-wrap">
              {weeks.map((w) => {
                const weekDays = [...new Set(workouts.filter((wx) => wx.week_number === w).map((wx) => wx.day_number))];
                const allDone = weekDays.every((d) => isDayCompleted(w, d));
                return (
                  <button
                    key={w}
                    onClick={() => { setSelectedWeek(w); setSelectedDay(null); }}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 flex items-center gap-1 ${
                      selectedWeek === w
                        ? "bg-primary text-primary-foreground"
                        : allDone
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {allDone && <CheckCircle2 size={10} />}
                    Wk {w}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day selector */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Day</span>
            <div className="flex gap-1 flex-wrap">
              {daysInWeek.map((d) => {
                const completed = isDayCompleted(selectedWeek, d);
                const isCurrent = isCurrentDay(selectedWeek, d);
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 flex items-center gap-1 ${
                      selectedDay === d
                        ? "bg-primary text-primary-foreground"
                        : completed
                        ? "bg-primary/20 text-primary"
                        : isCurrent
                        ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {completed && <CheckCircle2 size={10} />}
                    Day {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exercise list for selected day */}
          {selectedDay !== null && (
            <div className="space-y-2">
              {dayExercises.length === 0 ? (
                <div className="bg-card shadow-m2 p-6 text-center">
                  <p className="text-xs text-muted-foreground">No exercises scheduled for this day.</p>
                </div>
              ) : (
                <>
                  {dayExercises.map((workout) => {
                    const isExpanded = expandedExercise === workout.id;
                    return (
                      <div key={workout.id} className="bg-card shadow-m2 overflow-hidden">
                        <button
                          onClick={() => setExpandedExercise(isExpanded ? null : workout.id)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-accent/30 transition-m2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Dumbbell size={16} className="text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-foreground truncate">{workout.exercise.title}</h4>
                              <span className="text-[11px] text-primary font-mono">{workout.prescribed_sets_reps}</span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />}
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                            {workout.exercise.equipment_needed && (
                              <div className="text-[10px] text-muted-foreground">
                                <span className="font-bold uppercase tracking-widest">Equipment:</span> {workout.exercise.equipment_needed}
                              </div>
                            )}
                            {workout.exercise.focus_area?.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {workout.exercise.focus_area.map((f, i) => (
                                  <span key={i} className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 font-bold uppercase tracking-widest">{f}</span>
                                ))}
                              </div>
                            )}
                            {workout.exercise.the_why && (
                              <div className="bg-primary/5 border-l-2 border-primary/40 p-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <Info size={10} className="text-primary" />
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">The Why</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{workout.exercise.the_why}</p>
                              </div>
                            )}
                            <ExerciseVideoEmbed videoUrl={workout.exercise.video_url} exerciseTitle={workout.exercise.title} />
                            {workout.coach_instructions && (
                              <div className="bg-muted border-l-2 border-primary/40 p-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Coach Matt's Instructions</span>
                                </div>
                                <p className="text-xs text-foreground leading-relaxed">{workout.coach_instructions}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Mark day complete button */}
                  {!isDayCompleted(selectedWeek, selectedDay) && (
                    <button
                      onClick={markDayComplete}
                      disabled={markingComplete}
                      className="w-full h-11 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {markingComplete ? <Loader2 size={14} className="animate-spin" /> : (
                        <>
                          <CheckCircle2 size={14} /> Mark Day Complete
                        </>
                      )}
                    </button>
                  )}

                  {isDayCompleted(selectedWeek, selectedDay) && (
                    <div className="bg-primary/10 p-3 text-center flex items-center justify-center gap-2">
                      <CheckCircle2 size={14} className="text-primary" />
                      <span className="text-xs font-bold text-primary uppercase tracking-widest">Day Completed</span>
                    </div>
                  )}

                  {/* Coach Check-In at strategic weeks */}
                  <CoachCheckIn
                    weekNumber={selectedWeek}
                    programId={activeProgram.program_id}
                    programTitle={activeProgram.program.title}
                  />

                  {/* Ask Coach Matt */}
                  <AskCoachMatt
                    programId={activeProgram.program_id}
                    programTitle={activeProgram.program.title}
                    weekNumber={selectedWeek}
                    dayNumber={selectedDay}
                    exercises={dayExercises.map((w) => w.exercise.title)}
                    isPurchasedProgram={true}
                  />
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="bg-card shadow-m2 p-6 text-center">
          <Dumbbell size={28} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="text-sm font-bold text-foreground mb-1">Program workouts coming soon</h3>
          <p className="text-xs text-muted-foreground">Matt is building your workout plan. Check back shortly.</p>
        </div>
      )}
    </div>
  );
};

export default ActiveProgramView;
