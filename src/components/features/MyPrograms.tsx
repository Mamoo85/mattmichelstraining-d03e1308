import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyUserIds } from "@/hooks/useFamilyUserIds";
import { Loader2, Dumbbell, MessageSquare, ShoppingBag, ChevronLeft, ChevronRight, Printer, Play, UtensilsCrossed, ChevronDown } from "lucide-react";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { Link } from "react-router-dom";
import WorkoutScanner from "@/components/workout/WorkoutScanner";
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
  const [expandedCustom, setExpandedCustom] = useState<string | null>(null);

  useEffect(() => {
    if (!user || familyIds.length === 0) return;
    const fetchAll = async () => {
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
      <div className="flex justify-center py-8">
        <Loader2 size={18} className="text-primary animate-spin" />
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
    <div className="space-y-4">
      {/* Quick Log — compact */}
      <div className="bg-card border border-border p-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">Quick Log</span>
        <div className="grid grid-cols-2 gap-2">
          <WorkoutScanner />
          <Link
            to="/nutrition"
            className="flex items-center justify-center gap-1.5 border border-dashed border-border hover:border-primary/40 p-3 transition-colors"
          >
            <UtensilsCrossed size={16} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Scan Food</span>
          </Link>
        </div>
      </div>

      {/* Active Interactive Programs — compact rows */}
      {currentInteractive.map((ap) => (
        <div key={ap.id} className="bg-card border border-border">
          <div className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0" onClick={() => setViewingProgram(ap)} role="button">
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
                {ap.block_number && ap.block_number > 1 ? `Block ${ap.block_number} · ` : ""}{ap.program.category}{ap.program.sport ? ` · ${ap.program.sport}` : ""}
              </span>
              <h3 className="text-sm font-bold text-foreground truncate">{ap.program.title}</h3>
              <span className="text-[10px] text-muted-foreground font-mono">Wk {ap.current_week ?? 1} · Day {ap.current_day ?? 1}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("open-workout-zone", {
                      detail: { title: ap.program.title, source: "program", programId: ap.program_id },
                    })
                  );
                }}
                className="h-8 px-3 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 hover:opacity-90 transition-all"
              >
                <Play size={10} /> Go
              </button>
              <button
                onClick={() => handlePrintInteractive(ap)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-m2"
              >
                <Printer size={12} />
              </button>
              <ChevronRight size={14} className="text-muted-foreground" onClick={() => setViewingProgram(ap)} />
            </div>
          </div>
        </div>
      ))}

      {/* Active Custom Programs — collapsed by default */}
      {currentCustom.map((program) => (
        <div key={program.id} className="bg-card border border-border">
          <div className="flex items-center gap-3 p-3">
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => setExpandedCustom(expandedCustom === program.id ? null : program.id)}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
                {program.program_type === "custom" ? "Custom" : "Program"}{program.sport ? ` · ${program.sport}` : ""}
              </span>
              <h3 className="text-sm font-bold text-foreground truncate">{program.program_title}</h3>
              <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(program.purchased_at), "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
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
                className="h-8 px-3 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 hover:opacity-90 transition-all"
              >
                <Play size={10} /> Go
              </button>
              <button
                onClick={() => handlePrintCustom(program)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-m2"
              >
                <Printer size={12} />
              </button>
              <ChevronDown
                size={14}
                className={`text-muted-foreground transition-transform ${expandedCustom === program.id ? "rotate-180" : ""}`}
                onClick={() => setExpandedCustom(expandedCustom === program.id ? null : program.id)}
              />
            </div>
          </div>

          {/* Expanded detail */}
          {expandedCustom === program.id && (
            <div className="border-t border-border">
              {program.notes_from_matt && (
                <div className="mx-3 my-2 bg-primary/5 border-l-2 border-primary/40 p-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <MessageSquare size={10} className="text-primary" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Note from Matt</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{program.notes_from_matt}</p>
                </div>
              )}
              <div className="px-3 py-2 space-y-1">
                {program.exercises.map((ex, i) => {
                  const key = `${program.id}_${i}`;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs py-1">
                      <span className="text-muted-foreground font-mono w-4 text-right text-[10px]">{i + 1}.</span>
                      <span className="font-semibold text-foreground flex-1 truncate">{ex.name}</span>
                      <span className="font-mono text-primary text-[11px] shrink-0">{ex.sets}×{ex.reps}</span>
                      <input
                        type="number"
                        placeholder="lbs"
                        value={weights[key] || ""}
                        onChange={(e) => setWeights({ ...weights, [key]: e.target.value })}
                        className="bg-background border border-border text-right pr-1.5 font-mono text-primary text-[11px] focus:ring-1 focus:ring-primary outline-none h-7 w-16"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="px-3 pb-3 flex justify-end">
                <button
                  onClick={() => logProgramSession(program)}
                  disabled={loggingProgram === program.id}
                  className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loggingProgram === program.id ? <Loader2 size={12} className="animate-spin" /> : <>Log Session</>}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Past Programs */}
      {hasPast && (
        <div>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2 flex items-center gap-1.5"
          >
            {showAll ? "▾" : "▸"} Previous Programs ({pastInteractive.length + pastCustom.length})
          </button>

          {showAll && (
            <div className="mt-2 space-y-2 opacity-80">
              {pastInteractive.map((ap) => (
                <div key={ap.id} className="bg-card border border-border p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0" onClick={() => setViewingProgram(ap)} role="button">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      {ap.program.category}{ap.program.sport ? ` · ${ap.program.sport}` : ""} · Done
                    </span>
                    <h3 className="text-sm font-bold text-foreground truncate">{ap.program.title}</h3>
                  </div>
                  <button onClick={() => handlePrintInteractive(ap)} className="text-muted-foreground hover:text-primary transition-m2">
                    <Printer size={12} />
                  </button>
                </div>
              ))}
              {pastCustom.map((program) => (
                <div key={program.id} className="bg-card border border-border p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      {program.program_type === "custom" ? "Custom" : "Program"}{program.sport ? ` · ${program.sport}` : ""} · Done
                    </span>
                    <h3 className="text-sm font-bold text-foreground truncate">{program.program_title}</h3>
                  </div>
                  <button onClick={() => handlePrintCustom(program)} className="text-muted-foreground hover:text-primary transition-m2">
                    <Printer size={12} />
                  </button>
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
