import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ChevronDown, ChevronRight, Dumbbell, Info } from "lucide-react";
import ExerciseVideoEmbed from "../exercise/ExerciseVideoEmbed";
import AskCoachMatt from "./AskCoachMatt";

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
  };
}

interface ActiveProgramProps {
  activeProgram: {
    id: string;
    program_id: string;
    program: {
      id: string;
      title: string;
      description: string;
      category: string;
      sport: string | null;
    };
  };
}

const ActiveProgramView = ({ activeProgram }: ActiveProgramProps) => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkouts = async () => {
      const { data, error } = await supabase
        .from("program_workouts")
        .select("id, exercise_id, week_number, day_number, prescribed_sets_reps, coach_instructions, sort_order, exercise_library(id, title, the_why, equipment_needed, focus_area)")
        .eq("program_id", activeProgram.program_id)
        .order("week_number")
        .order("day_number")
        .order("sort_order");

      if (data) {
        setWorkouts(
          (data as any[]).map((w) => ({
            ...w,
            exercise: w.exercise_library,
          }))
        );
      }
      setLoading(false);
    };
    fetchWorkouts();
  }, [activeProgram.program_id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  // Compute weeks and days
  const weeks = [...new Set(workouts.map((w) => w.week_number))].sort((a, b) => a - b);
  const daysInWeek = [...new Set(workouts.filter((w) => w.week_number === selectedWeek).map((w) => w.day_number))].sort((a, b) => a - b);
  const dayExercises = workouts.filter((w) => w.week_number === selectedWeek && w.day_number === selectedDay);

  return (
    <div className="space-y-4">
      {/* Program header */}
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-0.5">
          {activeProgram.program.category}{activeProgram.program.sport ? ` · ${activeProgram.program.sport}` : ""}
        </span>
        <h2 className="text-base font-bold text-foreground">{activeProgram.program.title}</h2>
        <p className="text-xs text-muted-foreground mt-1">{activeProgram.program.description}</p>
      </div>

      {/* Week selector */}
      {weeks.length > 0 ? (
        <>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Week</span>
            <div className="flex gap-1 flex-wrap">
              {weeks.map((w) => (
                <button
                  key={w}
                  onClick={() => { setSelectedWeek(w); setSelectedDay(null); }}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                    selectedWeek === w
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Week {w}
                </button>
              ))}
            </div>
          </div>

          {/* Day selector */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Day</span>
            <div className="flex gap-1 flex-wrap">
              {daysInWeek.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                    selectedDay === d
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Day {d}
                </button>
              ))}
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
                            {/* Equipment */}
                            {workout.exercise.equipment_needed && (
                              <div className="text-[10px] text-muted-foreground">
                                <span className="font-bold uppercase tracking-widest">Equipment:</span> {workout.exercise.equipment_needed}
                              </div>
                            )}

                            {/* Focus areas */}
                            {workout.exercise.focus_area?.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {workout.exercise.focus_area.map((f, i) => (
                                  <span key={i} className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 font-bold uppercase tracking-widest">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* The Why */}
                            {workout.exercise.the_why && (
                              <div className="bg-primary/5 border-l-2 border-primary/40 p-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <Info size={10} className="text-primary" />
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">The Why</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{workout.exercise.the_why}</p>
                              </div>
                            )}

                            {/* Coach Instructions */}
                            {workout.coach_instructions && (
                              <div className="bg-accent/50 border-l-2 border-accent-foreground/20 p-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-foreground">Coach Matt's Instructions</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{workout.coach_instructions}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

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
