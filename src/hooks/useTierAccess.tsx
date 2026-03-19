import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TierKey } from "./useAuth";
import { useIsAdmin } from "./useIsAdmin";

// Tier hierarchy: higher tiers inherit all lower-tier access
const TIER_HIERARCHY: TierKey[] = ["basic", "foundation", "custom", "team_elite"];

const TIER_COLUMN_MAP: Record<string, string> = {
  basic: "tier_basic",
  foundation: "tier_foundation",
  custom: "tier_custom",
  team_elite: "tier_team_elite",
};

export const getTierLevel = (tier: TierKey | null): number => {
  if (!tier) return -1;
  return TIER_HIERARCHY.indexOf(tier);
};

export const hasTierAccess = (userTier: TierKey | null, requiredTier: TierKey): boolean => {
  return getTierLevel(userTier) >= getTierLevel(requiredTier);
};

export const useTierAccess = (featureKey: string) => {
  const { subscriptionTier } = useAuth();
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

  // Admins always have access
  if (isAdmin) return { hasAccess: true, loading: false };

  const feature = features.find((f: any) => f.feature_key === featureKey);
  if (!feature) return { hasAccess: false, loading: false };

  if (!subscriptionTier) return { hasAccess: false, loading: false };

  // Check current tier AND all lower tiers (inheritance)
  const userLevel = getTierLevel(subscriptionTier);
  for (let i = userLevel; i >= 0; i--) {
    const tierKey = TIER_HIERARCHY[i];
    const col = TIER_COLUMN_MAP[tierKey];
    if (col && (feature as any)[col]) return { hasAccess: true, loading: false };
  }

  // Also check the user's exact tier column
  const col = TIER_COLUMN_MAP[subscriptionTier];
  if (!col) return { hasAccess: false, loading: false };

  return { hasAccess: !!(feature as any)[col], loading: false };
};

// Simple hook: does user have at least this tier?
export const useMinTier = (requiredTier: TierKey) => {
  const { subscriptionTier } = useAuth();
  const { isAdmin } = useIsAdmin();

  if (isAdmin) return true;
  return hasTierAccess(subscriptionTier, requiredTier);
};
