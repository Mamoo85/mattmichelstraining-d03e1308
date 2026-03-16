import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Tier mapping: product_id → tier key
export const TIERS = {
  basic: {
    product_id: "prod_U9nodUkO0weUdZ",
    price_id: "price_1TBUDGD52tPWee46tt86qRtV",
    name: "M² Basic",
    price: "$14.99",
    priceNum: 14.99,
  },
  pro: {
    product_id: "prod_U9npxGkPWWKNvm",
    price_id: "price_1TBUDcD52tPWee46l6oytTfq",
    name: "M² Pro",
    price: "$29.99",
    priceNum: 29.99,
  },
  elite: {
    product_id: "prod_U9o5tWBaClrsKK",
    price_id: "price_1TBUTdD52tPWee46mOvReEKv",
    name: "M² Elite",
    price: "$49.99",
    priceNum: 49.99,
  },
  team: {
    product_id: "prod_U9o6YhWzK6UMaj",
    price_id: "price_1TBUTwD52tPWee465OrhyHnw",
    name: "M² Team",
    price: "$99.99",
    priceNum: 99.99,
  },
} as const;

export type TierKey = keyof typeof TIERS;

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
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("check-subscription error:", error);
        return;
      }
      setSubscribed(data?.subscribed ?? false);
      setSubscriptionTier(getTierByProductId(data?.product_id ?? null));
      setSubscriptionEnd(data?.subscription_end ?? null);
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
