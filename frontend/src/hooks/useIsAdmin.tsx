import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useIsAdmin = () => {
  const { user } = useAuth();

  const { data: isAdmin = false, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) return false;
      return data ?? false;
    },
    enabled: !!user,
  });

  return { isAdmin, isLoading };
};

/**
 * Returns true if the user is an admin OR a coach (read-only access to admin dashboards).
 */
export const useIsAdminOrCoach = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["is-admin-or-coach", user?.id],
    queryFn: async () => {
      if (!user) return { isAdmin: false, isCoach: false };
      const [admin, coach] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "coach" as any }),
      ]);
      return {
        isAdmin: !!admin.data,
        isCoach: !!coach.data,
      };
    },
    enabled: !!user,
  });

  const isAdmin = data?.isAdmin ?? false;
  const isCoach = data?.isCoach ?? false;
  return { isAdmin, isCoach, isAdminOrCoach: isAdmin || isCoach, isLoading };
};
