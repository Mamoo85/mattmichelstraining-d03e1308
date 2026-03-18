import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TierKey } from "./useAuth";
import { useIsAdmin } from "./useIsAdmin";

const TIER_COLUMN_MAP: Record<string, string> = {
  basic: "tier_basic",
  foundation: "tier_foundation",
  custom: "tier_custom",
  team_elite: "tier_team_elite",
};

export const useTierAccess = (featureKey: string) => {
  const { subscriptionTier, isLegend } = useAuth();
  const { isAdmin } = useIsAdmin();

  const { data: features = [] } = useQuery({
    queryKey: ["tier-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tier_features")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  // Admins and Legends always have access
  if (isAdmin || isLegend) return { hasAccess: true, loading: false };

  const feature = features.find((f: any) => f.feature_key === featureKey);
  if (!feature) return { hasAccess: false, loading: false };

  if (!subscriptionTier) return { hasAccess: false, loading: false };

  const col = TIER_COLUMN_MAP[subscriptionTier];
  if (!col) return { hasAccess: false, loading: false };

  return { hasAccess: !!(feature as any)[col], loading: false };
};
