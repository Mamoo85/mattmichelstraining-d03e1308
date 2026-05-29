import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Dumbbell, ArrowRight, Play, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DailyWorkout {
  title: string;
  description: string;
  target_audience: string;
  exercises: any[];
}

const FreeWorkoutTeaser = () => {
  const [workout, setWorkout] = useState<DailyWorkout | null>(null);

  useEffect(() => {
    supabase
      .from("daily_workouts")
      .select("title, description, target_audience, exercises")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setWorkout(data as DailyWorkout);
      });
  }, []);

  if (!workout) return null;

  const exerciseList = Array.isArray(workout.exercises) ? workout.exercises : [];
  const previewCount = Math.min(exerciseList.length, 3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mb-10"
    >
      <div className="bg-card border-2 border-primary/30 overflow-hidden">
        {/* Header */}
        <div className="bg-primary/5 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              Free Workout of the Day
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock size={10} />
            <span className="text-[9px] font-bold uppercase tracking-widest">
              {workout.target_audience}
            </span>
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-1">
            {workout.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {workout.description}
          </p>

          {/* Preview exercises */}
          {previewCount > 0 && (
            <div className="space-y-1.5 mb-4">
              {exerciseList.slice(0, 3).map((ex: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-muted/30 px-3 py-2"
                >
                  <Play size={8} className="text-primary flex-shrink-0" />
                  <span className="text-xs font-bold text-foreground">
                    {ex.name || ex.title || `Exercise ${i + 1}`}
                  </span>
                  {ex.sets && ex.reps && (
                    <span className="text-[9px] text-muted-foreground ml-auto font-mono">
                      {ex.sets}×{ex.reps}
                    </span>
                  )}
                </div>
              ))}
              {exerciseList.length > 3 && (
                <p className="text-[9px] text-muted-foreground pl-3">
                  +{exerciseList.length - 3} more exercises
                </p>
              )}
            </div>
          )}

          <Link
            to="/auth?redirect=/trial-welcome?path=basic"
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
          >
            Try It Now — Free <ArrowRight size={12} />
          </Link>
          <p className="text-[9px] text-muted-foreground text-center mt-2">
            Sign up free to log this workout and track your progress
          </p>
        </div>
      </div>
    </motion.section>
  );
};

export default FreeWorkoutTeaser;
