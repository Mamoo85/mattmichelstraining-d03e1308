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
        .from("community_workouts")
        .select("id, title, exercises")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([progRes, cwRes]) => {
      setPrograms((progRes.data as PurchasedProgram[] | null) ?? []);
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

  const canCreate = subscribed;

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
            {/* Programs */}
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

            {/* Community workouts */}
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

            {/* Create new */}
            {canCreate && (
              <button
                onClick={() => launchWorkout("Quick Workout", "quick", [])}
                className="w-full h-11 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
              >
                <Plus size={14} /> Create New Workout
              </button>
            )}

            {/* Upsell if free with nothing */}
            {!canCreate && programs.length === 0 && workouts.length === 0 && (
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
