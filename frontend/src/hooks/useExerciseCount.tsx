import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useExerciseCount() {
  const { data: count } = useQuery({
    queryKey: ["exercise-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("exercise_library")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 85;
    },
    staleTime: 300_000,
  });
  return count ?? 85;
}
