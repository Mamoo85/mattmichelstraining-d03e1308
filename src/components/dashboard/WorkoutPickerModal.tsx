import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Plus, Dumbbell, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface PurchasedProgram {
  id: string;
  program_title: string;
  sport: string | null;
  exercises: any;
}

interface ActiveProgram {
  id: string;
  program_id: string;
  program_title: string;
  sport: string | null;
  exercises: any;
}

interface CommunityWorkout {
  id: string;
  title: string;
  exercises: any;
}

interface WorkoutPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WorkoutPickerModal = ({ open, onOpenChange }: WorkoutPickerModalProps) => {
  const { user, subscribed } = useAuth();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<PurchasedProgram[]>([]);
  const [activePrograms, setActivePrograms] = useState<ActiveProgram[]>([]);
  const [workouts, setWorkouts] = useState<CommunityWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("purchased_programs")
        .select("id, program_title, sport, exercises")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("purchased_at", { ascending: false }),
      supabase
        .from("user_active_programs" as any)
        .select("id, program_id, training_programs(id, title, category, sport)")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("community_workouts")
        .select("id, title, exercises")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([progRes, activeRes, cwRes]) => {
      setPrograms((progRes.data as PurchasedProgram[] | null) ?? []);
      const mapped = ((activeRes.data as any[]) ?? []).map((a: any) => ({
        id: a.id,
        program_id: a.program_id,
        program_title: a.training_programs?.title ?? "Program",
        sport: a.training_programs?.sport ?? null,
        exercises: [],
      }));
      setActivePrograms(mapped);
      setWorkouts((cwRes.data as CommunityWorkout[] | null) ?? []);
      setLoading(false);
    });
  }, [open, user]);

  const launchWorkout = (title: string, source: string, exercises: any[]) => {
    onOpenChange(false);
    window.dispatchEvent(
      new CustomEvent("open-workout-zone", {
        detail: { title, source, exercises },
      })
    );
  };

  const startProgram = (p: PurchasedProgram) => {
    const exArr = Array.isArray(p.exercises) ? p.exercises : [];
    const mapped = exArr.map((ex: any) => ({
      exerciseTitle: ex.title || ex.exerciseTitle || ex.name || "Exercise",
      prescribedSets: parseInt(ex.sets) || ex.prescribedSets || 3,
      prescribedReps: parseInt(ex.reps) || ex.prescribedReps || 10,
      notes: ex.notes || ex.coach_instructions || "",
    }));
    launchWorkout(p.program_title, "program", mapped);
  };

  const startCommunity = (w: CommunityWorkout) => {
    const exArr = Array.isArray(w.exercises) ? w.exercises : [];
    const mapped = exArr.map((ex: any) => ({
      exerciseTitle: ex.title || ex.name || "Exercise",
      prescribedSets: parseInt(ex.sets) || 3,
      prescribedReps: parseInt(ex.reps) || 10,
      notes: ex.notes || "",
    }));
    launchWorkout(w.title, "community", mapped);
  };

  const hasContent = programs.length > 0 || activePrograms.length > 0 || workouts.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-sm font-bold uppercase tracking-widest">
            Start a Workout
          </SheetTitle>
          <SheetDescription className="text-xs">
            Pick a program, saved workout, or start fresh.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
        ) : (
          <div className="space-y-4 pb-4">
            {/* Purchased Programs */}
            {programs.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <BookOpen size={12} /> My Programs
                </span>
                {programs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => startProgram(p)}
                    className="w-full text-left bg-card border border-border p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
                  >
                    <Play size={14} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{p.program_title}</p>
                      {p.sport && (
                        <p className="text-[10px] text-muted-foreground">{p.sport}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Active / Interactive Programs */}
            {activePrograms.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <BookOpen size={12} /> Active Programs
                </span>
                {activePrograms.map((ap) => (
                  <button
                    key={ap.id}
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/dashboard?tab=programs");
                    }}
                    className="w-full text-left bg-card border border-border p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
                  >
                    <Play size={14} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{ap.program_title}</p>
                      {ap.sport && (
                        <p className="text-[10px] text-muted-foreground">{ap.sport}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Saved workouts */}
            {workouts.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Dumbbell size={12} /> My Saved Workouts
                </span>
                {workouts.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => startCommunity(w)}
                    className="w-full text-left bg-card border border-border p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
                  >
                    <Play size={14} className="text-primary flex-shrink-0" />
                    <p className="text-sm font-bold text-foreground truncate">{w.title}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Create new - available to anyone with content or subscribed */}
            {(subscribed || hasContent) && (
              <button
                onClick={() => launchWorkout("Quick Workout", "quick", [])}
                className="w-full h-11 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
              >
                <Plus size={14} /> Create New Workout
              </button>
            )}

            {/* Upsell if free with nothing */}
            {!subscribed && !hasContent && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate("/pricing");
                }}
                className="w-full h-11 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
              >
                Unlock Training →
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default WorkoutPickerModal;
