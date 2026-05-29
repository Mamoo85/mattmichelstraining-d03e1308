import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AgencyRole = "agency_admin" | "client" | null;

export const useAgencyRole = () => {
  const { user } = useAuth();

  const { data: agencyRole = null, isLoading } = useQuery({
    queryKey: ["agency-role", user?.id],
    queryFn: async (): Promise<AgencyRole> => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("get_agency_role", {
        _user_id: user.id,
      });
      if (error) return null;
      return (data as AgencyRole) ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return { agencyRole, isLoading, isAgencyAdmin: agencyRole === "agency_admin", isClient: agencyRole === "client" };
};
