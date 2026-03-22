import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";

// Tier mapping: product_id → tier key
export const TIERS = {
  basic: {
    product_id: "prod_UBI78IQsBpyfNw",
    price_id: "price_1TCvWxD52tPWee46Mhmf2mEs",
    name: "M² Basic",
    price: "$12.99",
    priceNum: 12.99,
  },
  foundation: {
    product_id: "prod_UBI7Wdb3liTxiF",
    price_id: "price_1TCvXOD52tPWee46dgedK3Ky",
    name: "M² Foundation",
    price: "$19.99",
    priceNum: 19.99,
  },
  custom: {
    product_id: "prod_UBI8SV9Fa6CibX",
    price_id: "price_1TCvXrD52tPWee46jNJ6sSZ9",
    name: "M² Custom",
    price: "$49.99",
    priceNum: 49.99,
  },
  team_elite: {
    product_id: "prod_UBI8mP9jA5rV3U",
    price_id: "price_1TCvYED52tPWee46oJ5hfI5X",
    name: "M² Team/Elite",
    price: "$99.99",
    priceNum: 99.99,
  },
} as const;

// Annual pricing (2 months free = 10 months price)
export const ANNUAL_TIERS: Record<TierKey, { price_id: string; product_id: string; price: string; priceNum: number; monthlyEquiv: string }> = {
  basic: {
    product_id: "prod_UC3NyJRutYTL87",
    price_id: "price_1TDfH3D52tPWee4668pIobVk",
    price: "$129.90",
    priceNum: 129.90,
    monthlyEquiv: "$10.83",
  },
  foundation: {
    product_id: "prod_UC3OvNMcgtPafc",
    price_id: "price_1TDfHPD52tPWee46Gk18jY4m",
    price: "$199.90",
    priceNum: 199.90,
    monthlyEquiv: "$16.66",
  },
  custom: {
    product_id: "prod_UC3ONcP6ZoWtdM",
    price_id: "price_1TDfHjD52tPWee46PQkctivf",
    price: "$499.90",
    priceNum: 499.90,
    monthlyEquiv: "$41.66",
  },
  team_elite: {
    product_id: "prod_UC3OtnhWc3wNQc",
    price_id: "price_1TDfI3D52tPWee46F6XteV0s",
    price: "$999.90",
    priceNum: 999.90,
    monthlyEquiv: "$83.33",
  },
};

export const FIRST_MONTH_COUPON_ID = "JJwqu21q";

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
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<TierKey | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setSubscribed(false);
      setSubscriptionTier(null);
      setSubscriptionEnd(null);
      return;
    }
    try {
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
    let subscription: { unsubscribe: () => void } | null = null;
    let initialDone = false;

    try {
      // Set up listener FIRST (per Supabase best practice)
      const result = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        if (!initialDone) {
          initialDone = true;
          setLoading(false);
        }
        if (newSession) {
          setTimeout(() => checkSubscription(), 0);
        } else {
          setSubscribed(false);
          setSubscriptionTier(null);
          setSubscriptionEnd(null);
        }
      });
      subscription = result.data.subscription;
    } catch (e) {
      console.warn("[Auth] onAuthStateChange blocked or failed:", e);
    }

    // Fallback: if onAuthStateChange hasn't fired within 2s, resolve loading
    const fallbackTimer = setTimeout(() => {
      if (!initialDone) {
        initialDone = true;
        setLoading(false);
      }
    }, 2000);

    // getSession to pick up existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!initialDone) {
        initialDone = true;
        setSession(s);
        setLoading(false);
        if (s) checkSubscription();
      }
    }).catch(() => {
      if (!initialDone) {
        initialDone = true;
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      subscription?.unsubscribe();
    };
  }, [checkSubscription]);

  // Auto-refresh subscription every 5 min while logged in (was 60s)
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(checkSubscription, 5 * 60_000);
    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const signOut = async () => {
    // Clear React Query cache + persisted cache to prevent data bleed between users
    const { queryClient } = await import("@/App");
    queryClient.clear();
    safeLocalStorage.removeItem("m2-query-cache");
    safeLocalStorage.removeItem("m2_offline_queue");
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
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
