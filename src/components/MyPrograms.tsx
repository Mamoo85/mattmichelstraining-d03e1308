import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Dumbbell, MessageSquare, ShoppingBag, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import LiftChat from "./progress/LiftChat";
import ActiveProgramView from "./programs/ActiveProgramView";

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
  const [purchasedPrograms, setPurchasedPrograms] = useState<PurchasedProgram[]>([]);
  const [activePrograms, setActivePrograms] = useState<ActiveProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [loggingProgram, setLoggingProgram] = useState<string | null>(null);
  const [viewingProgram, setViewingProgram] = useState<ActiveProgram | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      // Fetch purchased (custom) programs
      const { data: purchased } = await supabase
        .from("purchased_programs" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("purchased_at", { ascending: false });

      if (purchased) {
        setPurchasedPrograms(
          (purchased as any[]).map((p) => ({
            ...p,
            exercises: Array.isArray(p.exercises) ? p.exercises : JSON.parse(p.exercises || "[]"),
          }))
        );
      }

      // Fetch interactive (active) programs
      const { data: active } = await supabase
        .from("user_active_programs")
        .select("id, program_id, start_date, status, training_programs(id, title, description, category, sport)")
        .eq("user_id", user.id)
        .eq("status", "active");

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
  }, [user]);

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  // If viewing a specific interactive program
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

  if (!hasAny) {
    return (
      <div className="bg-card shadow-m2 p-6 text-center">
        <ShoppingBag size={32} className="text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-bold text-foreground mb-1">No programs yet</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
          When you purchase a custom program or interactive training system from Matt, it automatically appears here — 
          ready to log, track, and get coaching feedback on every lift.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          Browse Programs
          <Dumbbell size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Interactive Programs */}
      {activePrograms.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Interactive Programs</h3>
          <div className="grid gap-3">
            {activePrograms.map((ap) => (
              <div
                key={ap.id}
                onClick={() => setViewingProgram(ap)}
                className="bg-card shadow-m2 p-4 cursor-pointer hover:bg-accent/50 transition-m2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-0.5">
                      {ap.program.category}{ap.program.sport ? ` · ${ap.program.sport}` : ""}
                    </span>
                    <h3 className="text-sm font-bold text-foreground">{ap.program.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{ap.program.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Started {format(new Date(ap.start_date), "MMM d")}
                    </span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchased (custom) Programs */}
      {purchasedPrograms.length > 0 && (
        <div>
          {activePrograms.length > 0 && (
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Custom Programs</h3>
          )}
          {purchasedPrograms.map((program) => (
            <div key={program.id} className="bg-card shadow-m2 overflow-hidden mb-4">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-0.5">
                      {program.program_type === "custom" ? "Custom Program" : "Sport Guide"}{program.sport ? ` · ${program.sport}` : ""}
                    </span>
                    <h3 className="text-sm font-bold text-foreground">{program.program_title}</h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {format(new Date(program.purchased_at), "MMM d, yyyy")}
                  </span>
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

              <div className="p-3 flex justify-end">
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
    </div>
  );
};

export default MyPrograms;
