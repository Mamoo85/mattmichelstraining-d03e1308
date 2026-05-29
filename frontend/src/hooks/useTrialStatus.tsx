import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface TrialStatus {
  isOnTrial: boolean;
  trialExpired: boolean;
  trialDaysLeft: number;
  trialStartedAt: string | null;
  loading: boolean;
}

export const useTrialStatus = (): TrialStatus => {
  const { user, subscribed } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["trial-status", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("trial_started_at")
        .eq("user_id", user!.id)
        .single();
      return profile;
    },
    staleTime: 30_000,
  });

  if (!user || isLoading) {
    return { isOnTrial: false, trialExpired: false, trialDaysLeft: 0, trialStartedAt: null, loading: isLoading };
  }

  // If user is subscribed, trial doesn't matter
  if (subscribed) {
    return { isOnTrial: false, trialExpired: false, trialDaysLeft: 0, trialStartedAt: data?.trial_started_at ?? null, loading: false };
  }

  const trialStart = data?.trial_started_at;
  if (!trialStart) {
    return { isOnTrial: false, trialExpired: false, trialDaysLeft: 0, trialStartedAt: null, loading: false };
  }

  const startDate = new Date(trialStart);
  const now = new Date();
  const TRIAL_DAYS = 14;
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, TRIAL_DAYS - daysSinceStart);
  const expired = daysSinceStart >= TRIAL_DAYS;

  return {
    isOnTrial: !expired,
    trialExpired: expired,
    trialDaysLeft: daysLeft,
    trialStartedAt: trialStart,
    loading: false,
  };
};
