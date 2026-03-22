import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyUserIds } from "@/hooks/useFamilyUserIds";
import { Loader2, Dumbbell, MessageSquare, ShoppingBag, ChevronLeft, ChevronRight, Printer, Play } from "lucide-react";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ActiveProgramView from "@/components/programs/ActiveProgramView";
import { printWorkoutLog } from "@/components/programs/printWorkoutLog";

interface ProgramExercise {
  name: string;
  sets: string;
  reps: string;
  notes?: string;
}

interface PurchasedProgram {
  id: string;
  program_title: string;
  program_type: string;
  sport: string | null;
  exercises: ProgramExercise[];
  purchased_at: string;
  is_active: boolean;
  notes_from_matt: string | null;
}

interface ActiveProgram {
  id: string;
  program_id: string;
  start_date: string;
  status: string;
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
}

const MyPrograms = () => {
  const { user } = useAuth();
  const { familyIds } = useFamilyUserIds();
  const [purchasedPrograms, setPurchasedPrograms] = useState<PurchasedProgram[]>([]);
  const [activePrograms, setActivePrograms] = useState<ActiveProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [loggingProgram, setLoggingProgram] = useState<string | null>(null);
  const [viewingProgram, setViewingProgram] = useState<ActiveProgram | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user || familyIds.length === 0) return;
    const fetchAll = async () => {
      // Fetch purchased programs for user AND linked family members
      const { data: purchased } = await supabase
        .from("purchased_programs" as any)
        .select("*")
        .in("user_id", familyIds)
        .order("purchased_at", { ascending: false });

      if (purchased) {
        setPurchasedPrograms(
          (purchased as any[]).map((p) => ({
            ...p,
            exercises: Array.isArray(p.exercises) ? p.exercises : JSON.parse(p.exercises || "[]"),
          }))
        );
      }

      // Fetch interactive programs for user AND linked family members
      const { data: active } = await supabase
        .from("user_active_programs")
        .select("id, program_id, start_date, status, current_week, current_day, block_number, completed_days, training_programs(id, title, description, category, sport)")
        .in("user_id", familyIds)
        .order("created_at", { ascending: false });

      if (active) {
        setActivePrograms(
          (active as any[]).map((a) => ({
            ...a,
            program: a.training_programs,
          }))
        );
      }

      setLoading(false);
    };
    fetchAll();
  }, [user, familyIds]);

  const logProgramSession = async (program: PurchasedProgram) => {
    if (!user) return;
    setLoggingProgram(program.id);

    const entries = Object.entries(weights).filter(
      ([key, v]) => key.startsWith(program.id) && v && parseFloat(v) > 0
    );

    if (entries.length === 0) {
      toast({ title: "Log at least one weight", variant: "destructive" });
      setLoggingProgram(null);
      return;
    }

    for (const [key, w] of entries) {
      const exIndex = parseInt(key.split("_")[1]);
      const ex = program.exercises[exIndex];
      if (!ex) continue;
      const weight = parseFloat(w);
      const reps = parseInt(ex.reps) || 1;
      const estimated1rm = Math.round(weight * (1 + reps / 30));

      await supabase.from("progress_logs").insert({
        user_id: user.id,
        exercise_name: ex.name,
        weight,
        reps,
        estimated_1rm: estimated1rm,
      });
    }

    toast({ title: "Session logged", description: "Nice work. Matt sees this." });
    setWeights({});
    setLoggingProgram(null);
  };

  const handlePrintCustom = (program: PurchasedProgram) => {
    printWorkoutLog({
      title: program.program_title,
      sport: program.sport,
      category: program.program_type === "custom" ? "Custom Program" : "Program",
      weeks: [
        {
          week: 1,
          days: [
            {
              day: 1,
              exercises: program.exercises.map((ex) => ({
                name: ex.name,
                setsReps: `${ex.sets} × ${ex.reps}`,
                instructions: ex.notes,
              })),
            },
          ],
        },
      ],
    });
  };

  const handlePrintInteractive = async (ap: ActiveProgram) => {
    // Fetch workouts for this program
    const { data } = await supabase
      .from("program_workouts")
      .select("week_number, day_number, prescribed_sets_reps, coach_instructions, sort_order, exercise_library(title)")
      .eq("program_id", ap.program_id)
      .order("week_number")
      .order("day_number")
      .order("sort_order");

    if (!data || data.length === 0) {
      toast({ title: "No workouts to print", description: "This program doesn't have exercises yet.", variant: "destructive" });
      return;
    }

    // Group into weeks and days
    const weekMap = new Map<number, Map<number, Array<{ name: string; setsReps: string; instructions?: string }>>>();
    for (const row of data as any[]) {
      const w = row.week_number;
      const d = row.day_number;
      if (!weekMap.has(w)) weekMap.set(w, new Map());
      const dayMap = weekMap.get(w)!;
      if (!dayMap.has(d)) dayMap.set(d, []);
      dayMap.get(d)!.push({
        name: row.exercise_library?.title || "Unknown",
        setsReps: row.prescribed_sets_reps,
        instructions: row.coach_instructions || undefined,
      });
    }

    const weeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0]).map(([weekNum, dayMap]) => ({
      week: weekNum,
      days: [...dayMap.entries()].sort((a, b) => a[0] - b[0]).map(([dayNum, exercises]) => ({
        day: dayNum,
        exercises,
      })),
    }));

    printWorkoutLog({
      title: ap.program.title,
      sport: ap.program.sport,
      category: ap.program.category,
      weeks,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  if (viewingProgram) {
    return (
      <div>
        <button
          onClick={() => setViewingProgram(null)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-m2"
        >
          <ChevronLeft size={14} /> Back to My Programs
        </button>
        <ActiveProgramView activeProgram={viewingProgram} />
      </div>
    );
  }

  const hasAny = purchasedPrograms.length > 0 || activePrograms.length > 0;

  // Split into current and past
  const currentInteractive = activePrograms.filter((a) => a.status === "active");
  const pastInteractive = activePrograms.filter((a) => a.status !== "active");
  const currentCustom = purchasedPrograms.filter((p) => p.is_active);
  const pastCustom = purchasedPrograms.filter((p) => !p.is_active);
  const hasPast = pastInteractive.length > 0 || pastCustom.length > 0;

  if (!hasAny) {
    return (
      <EmptyStateCard
        icon={<ShoppingBag size={28} className="text-primary" />}
        title="No Programs Yet"
        description="When you purchase a custom program or interactive training system from Matt, it appears here — ready to log, track, and get coaching feedback on every lift."
        ctaLabel="Browse Programs →"
        ctaTo="/shop"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Interactive Programs */}
      {currentInteractive.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Active Programs</h3>
          <div className="grid gap-3">
            {currentInteractive.map((ap) => (
              <div key={ap.id} className="bg-card shadow-m2">
                <div
                  onClick={() => setViewingProgram(ap)}
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-m2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-0.5">
                        {ap.block_number && ap.block_number > 1 ? `Block ${ap.block_number} · ` : ""}{ap.program.category}{ap.program.sport ? ` · ${ap.program.sport}` : ""}
                      </span>
                      <h3 className="text-sm font-bold text-foreground">{ap.program.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{ap.program.description}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                  </div>
                </div>
                <div className="border-t border-border px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Wk {ap.current_week ?? 1}/8 · Day {ap.current_day ?? 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(
                          new CustomEvent("open-workout-zone", {
                            detail: { title: ap.program.title, source: "program", programId: ap.program_id },
                          })
                        );
                      }}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-m2"
                    >
                      <Play size={12} /> Start Workout
                    </button>
                    <button
                      onClick={() => handlePrintInteractive(ap)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-m2"
                    >
                      <Printer size={12} /> Print Log
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Custom Programs */}
      {currentCustom.length > 0 && (
        <div>
          {currentInteractive.length > 0 && (
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Custom Programs</h3>
          )}
          {currentCustom.map((program) => (
            <div key={program.id} className="bg-card shadow-m2 overflow-hidden mb-4">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-0.5">
                      {program.program_type === "custom" ? "Custom Program" : "Program"}{program.sport ? ` · ${program.sport}` : ""}
                    </span>
                    <h3 className="text-sm font-bold text-foreground">{program.program_title}</h3>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => handlePrintCustom(program)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-m2"
                    >
                      <Printer size={12} /> Print
                    </button>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {format(new Date(program.purchased_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                {program.notes_from_matt && (
                  <div className="mt-2 bg-primary/5 border-l-2 border-primary/40 p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <MessageSquare size={10} className="text-primary" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Note from Matt</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{program.notes_from_matt}</p>
                  </div>
                )}
              </div>

              <div>
                <div className="grid grid-cols-[1fr_70px_70px_80px] gap-2 px-3 py-2 bg-muted">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exercise</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sets</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reps</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Weight</span>
                </div>

                {program.exercises.map((ex, i) => {
                  const key = `${program.id}_${i}`;
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_70px_70px_80px] gap-2 px-3 py-3 border-b border-border items-center hover:bg-secondary/30 transition-m2"
                    >
                      <div>
                        <span className="text-sm font-semibold text-foreground">{ex.name}</span>
                        {ex.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{ex.notes}</p>}
                      </div>
                      <span className="text-sm font-mono text-primary">{ex.sets}</span>
                      <span className="text-sm font-mono text-primary">{ex.reps}</span>
                      <input
                        type="number"
                        placeholder="lbs"
                        value={weights[key] || ""}
                        onChange={(e) => setWeights({ ...weights, [key]: e.target.value })}
                        className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-8 w-full"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="p-3 flex justify-end gap-2">
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-workout-zone", {
                        detail: {
                          title: program.program_title,
                          source: "custom",
                          exercises: program.exercises.map((ex) => ({
                            exerciseTitle: ex.name,
                            prescribedSets: parseInt(ex.sets) || 3,
                            prescribedReps: parseInt(ex.reps) || 10,
                            notes: ex.notes,
                          })),
                        },
                      })
                    );
                  }}
                  className="bg-muted text-foreground px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-muted/80 transition-m2 flex items-center gap-2"
                >
                  <Play size={12} /> Start Workout
                </button>
                <button
                  onClick={() => logProgramSession(program)}
                  disabled={loggingProgram === program.id}
                  className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 disabled:opacity-50 flex items-center gap-2"
                >
                  {loggingProgram === program.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <>Log Session</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past Programs toggle */}
      {hasPast && (
        <div>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2 flex items-center gap-1.5"
          >
            {showAll ? "▾" : "▸"} Previous Programs ({pastInteractive.length + pastCustom.length})
          </button>

          {showAll && (
            <div className="mt-3 space-y-3 opacity-80">
              {pastInteractive.map((ap) => (
                <div key={ap.id} className="bg-card shadow-m2">
                  <div
                    onClick={() => setViewingProgram(ap)}
                    className="p-4 cursor-pointer hover:bg-accent/50 transition-m2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">
                          {ap.program.category}{ap.program.sport ? ` · ${ap.program.sport}` : ""} · Completed
                        </span>
                        <h3 className="text-sm font-bold text-foreground">{ap.program.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePrintInteractive(ap); }}
                          className="text-muted-foreground hover:text-primary transition-m2"
                        >
                          <Printer size={14} />
                        </button>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {pastCustom.map((program) => (
                <div key={program.id} className="bg-card shadow-m2 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">
                        {program.program_type === "custom" ? "Custom" : "Program"}{program.sport ? ` · ${program.sport}` : ""} · Completed
                      </span>
                      <h3 className="text-sm font-bold text-foreground">{program.program_title}</h3>
                    </div>
                    <button
                      onClick={() => handlePrintCustom(program)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-m2"
                    >
                      <Printer size={12} /> Print
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyPrograms;
