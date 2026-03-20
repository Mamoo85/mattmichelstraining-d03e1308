import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Tier mapping: product_id → tier key
export const TIERS = {
  basic: {
    product_id: "prod_UBI78IQsBpyfNw",
    price_id: "price_1TCvWxD52tPWee46Mhmf2mEs",
    name: "M² Basic",
    price: "$14.99",
    priceNum: 14.99,
  },
  foundation: {
    product_id: "prod_UBI7Wdb3liTxiF",
    price_id: "price_1TCvXOD52tPWee46dgedK3Ky",
    name: "M² Foundation",
    price: "$39.99",
    priceNum: 39.99,
  },
  custom: {
    product_id: "prod_UBI8SV9Fa6CibX",
    price_id: "price_1TCvXrD52tPWee46jNJ6sSZ9",
    name: "M² Custom",
    price: "$99.99",
    priceNum: 99.99,
  },
  team_elite: {
    product_id: "prod_UBI8mP9jA5rV3U",
    price_id: "price_1TCvYED52tPWee46oJ5hfI5X",
    name: "M² Team/Elite",
    price: "$149.99",
    priceNum: 149.99,
  },
} as const;

export type TierKey = keyof typeof TIERS;

// Tier-based store discounts (more aggressive)
export const TIER_DISCOUNTS: Record<TierKey, number> = {
  basic: 10,
  foundation: 15,
  custom: 20,
  team_elite: 25,
};

export const getTierByProductId = (productId: string | null): TierKey | null => {
  if (!productId) return null;
  for (const [key, tier] of Object.entries(TIERS)) {
    if (tier.product_id === productId) return key as TierKey;
  }
  return null;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  subscribed: boolean;
  subscriptionTier: TierKey | null;
  subscriptionEnd: string | null;
  checkSubscription: () => Promise<void>;
  isVip: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  subscribed: false,
  subscriptionTier: null,
  subscriptionEnd: null,
  checkSubscription: async () => {},
  isVip: false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<TierKey | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);

  const checkSubscription = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setSubscribed(false);
      setSubscriptionTier(null);
      setSubscriptionEnd(null);
      setIsVip(false);
      return;
    }
    try {
      // Fetch VIP status from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_vip")
        .eq("user_id", currentSession.user.id)
        .single();
      setIsVip(profile?.is_vip ?? false);

      const subResult = await supabase.functions.invoke("check-subscription");
      if (!subResult.error) {
        setSubscribed(subResult.data?.subscribed ?? false);
        setSubscriptionTier(getTierByProductId(subResult.data?.product_id ?? null));
        setSubscriptionEnd(subResult.data?.subscription_end ?? null);
      }
    } catch (e) {
      // subscription check failed silently
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session) {
        // defer to avoid Supabase deadlock
        setTimeout(() => checkSubscription(), 0);
      } else {
        setSubscribed(false);
        setSubscriptionTier(null);
        setSubscriptionEnd(null);
        setIsVip(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) checkSubscription();
    });

    return () => subscription.unsubscribe();
  }, [checkSubscription]);

  // Auto-refresh every 60s while logged in
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const signOut = async () => {
    // Clear React Query cache + persisted cache to prevent data bleed between users
    const { queryClient } = await import("@/App");
    queryClient.clear();
    localStorage.removeItem("m2-query-cache");
    localStorage.removeItem("m2_offline_queue");
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      signOut,
      subscribed,
      subscriptionTier,
      subscriptionEnd,
      checkSubscription,
      isVip,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
