import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LoggedExerciseData } from "@/components/workout/WorkoutLogger";
import type { RecoveryData } from "@/components/workout/RecoveryInput";
import { safeLocalStorage } from "@/lib/browserStorage";

interface SaveParams {
  userId: string;
  date: Date;
  sessionNotes: string;
  exercises: LoggedExerciseData[];
  recovery: RecoveryData;
}

export function useWorkoutSave() {
  const [saving, setSaving] = useState(false);

  const save = useCallback(async ({ userId, date, sessionNotes, exercises, recovery }: SaveParams): Promise<string | null> => {
    setSaving(true);
    try {
      const recoveryPayload: Record<string, any> = {};
      if (recovery.sleepHours) recoveryPayload.sleep_hours = parseFloat(recovery.sleepHours);
      if (recovery.sleepQuality && recovery.sleepQuality > 0) recoveryPayload.sleep_quality = recovery.sleepQuality;
      if (recovery.soreness && recovery.soreness > 0) recoveryPayload.soreness = recovery.soreness;
      if (recovery.energy && recovery.energy > 0) recoveryPayload.energy = recovery.energy;
      if (recovery.recoveryNotes) recoveryPayload.recovery_notes = recovery.recoveryNotes;

      const { data: log, error: logErr } = await supabase
        .from("workout_logs")
        .insert({
          user_id: userId,
          date: date.toISOString(),
          session_notes: sessionNotes || null,
          ...recoveryPayload,
        } as any)
        .select("id")
        .single();

      if (logErr || !log) {
        toast.error(logErr?.message || "Failed to save workout");
        return null;
      }

      const validExercises = exercises.filter(e => e.exerciseId && e.exerciseId.length > 0);
      if (validExercises.length > 0) {
        const rows = validExercises.map((e) => ({
          log_id: log.id,
          exercise_id: e.exerciseId,
          sets_reps_weight: e.sets as any,
          client_notes: e.clientNotes || null,
          video_url: e.videoUrl || null,
          flag_for_coach: e.flagForCoach,
        }));

        const { error: exErr } = await supabase.from("logged_exercises").insert(rows);
        if (exErr) {
          toast.error(exErr.message || "Exercises failed to save");
        }
      }

      safeLocalStorage.removeItem("m2-paused-workout");
      return log.id;
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong saving your workout");
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving };
}
