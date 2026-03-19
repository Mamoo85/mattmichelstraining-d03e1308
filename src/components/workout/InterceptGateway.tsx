import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Dumbbell, BookOpen, Lock, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMinTier } from "@/hooks/useTierAccess";
import { toast } from "sonner";
import type { WorkoutZoneContext } from "./ActiveWorkoutZone";

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

interface CommunityWorkout {
  id: string;
  title: string;
  exercises: any;
  creator_name: string;
}

const InterceptGateway = ({ onSelect, onExit }: InterceptGatewayProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasTemplateAccess = useMinTier("foundation");
  const [programs, setPrograms] = useState<PurchasedProgram[]>([]);
  const [personalWorkouts, setPersonalWorkouts] = useState<CommunityWorkout[]>([]);
  const [masterTemplates, setMasterTemplates] = useState<CommunityWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase
        .from("purchased_programs")
        .select("id, program_title, sport, exercises")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("purchased_at", { ascending: false }),
      supabase
        .from("community_workouts")
        .select("id, title, exercises, creator_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("community_workouts")
        .select("id, title, exercises, creator_name")
        .eq("is_public", true)
        .neq("user_id", user.id)
        .order("likes_count", { ascending: false })
        .limit(20),
    ]).then(([progRes, personalRes, templateRes]) => {
      setPrograms((progRes.data as PurchasedProgram[] | null) ?? []);
      setPersonalWorkouts((personalRes.data as CommunityWorkout[] | null) ?? []);
      setMasterTemplates((templateRes.data as CommunityWorkout[] | null) ?? []);
      setLoading(false);
    });
  }, [user]);

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
    onSelect({ title: "Freestyle Session", source: "manual" });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <header className="shrink-0 px-4 py-4 border-b border-border">
        <h1 className="text-sm font-bold uppercase tracking-widest text-primary">
          What Are We Executing Today?
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-6 pb-24">
        {/* Freestyle */}
        <button
          onClick={handleFreestyle}
          className="w-full h-12 border-2 border-primary text-primary flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
        >
          <Zap size={14} /> Freestyle Session
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Active Programs */}
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

            {/* Personal Bank */}
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

            {/* M2 Master Templates */}
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

      {/* Exit */}
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
