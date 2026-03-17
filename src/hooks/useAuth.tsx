import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Tier mapping: product_id → tier key
export const TIERS = {
  basic: {
    product_id: "prod_U9ppSReG0j0RIr",
    price_id: "price_1TBWAFD52tPWee460o8cRbW1",
    name: "M² Basic",
    price: "$12.99",
    priceNum: 12.99,
  },
  pro: {
    product_id: "prod_U9pqrtuc44EE4A",
    price_id: "price_1TBWAbD52tPWee46oDcVLwiU",
    name: "M² Pro",
    price: "$25.99",
    priceNum: 25.99,
  },
  elite: {
    product_id: "prod_U9pqNqVuxYD6kl",
    price_id: "price_1TBWAxD52tPWee46alwPjHIV",
    name: "M² Elite",
    price: "$42.99",
    priceNum: 42.99,
  },
  team: {
    product_id: "prod_U9pq1sVSh9nOQi",
    price_id: "price_1TBWBED52tPWee46Ejbp5b8h",
    name: "M² Team",
    price: "$84.99",
    priceNum: 84.99,
  },
} as const;

export type TierKey = keyof typeof TIERS;

// Tier-based store discounts (more aggressive)
export const TIER_DISCOUNTS: Record<TierKey, number> = {
  basic: 10,
  pro: 15,
  elite: 20,
  team: 25,
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
  isLegend: boolean;
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
  isLegend: false,
  checkSubscription: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<TierKey | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [isLegend, setIsLegend] = useState(false);

  const checkSubscription = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setSubscribed(false);
      setSubscriptionTier(null);
      setSubscriptionEnd(null);
      setIsLegend(false);
      return;
    }
    try {
      // Check subscription + legend status in parallel
      const [subResult, profileResult] = await Promise.all([
        supabase.functions.invoke("check-subscription"),
        supabase.from("profiles").select("is_in_person").eq("user_id", currentSession.user.id).single(),
      ]);
      if (!subResult.error) {
        setSubscribed(subResult.data?.subscribed ?? false);
        setSubscriptionTier(getTierByProductId(subResult.data?.product_id ?? null));
        setSubscriptionEnd(subResult.data?.subscription_end ?? null);
      }
      setIsLegend(profileResult.data?.is_in_person ?? false);
    } catch (e) {
      console.error("check-subscription exception:", e);
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
        setIsLegend(false);
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
