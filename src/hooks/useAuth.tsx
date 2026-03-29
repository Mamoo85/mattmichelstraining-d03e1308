import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";

// Tier mapping: product_id → tier key
export const TIERS = {
  foundation: {
    product_id: "prod_UBI78IQsBpyfNw",
    price_id: "price_1TELWTD52tPWee46lbQwxNZn",
    name: "The Foundation",
    price: "$19.99",
    priceNum: 19.99,
  },
  pro: {
    product_id: "prod_UBI7Wdb3liTxiF",
    price_id: "price_1TELXyD52tPWee46XQH8y0qu",
    name: "Pro (Semi-Custom)",
    price: "$149.99",
    priceNum: 149.99,
  },
  elite: {
    product_id: "prod_UBI8SV9Fa6CibX",
    price_id: "price_1TELYzD52tPWee46oO4mBsmg",
    name: "Elite (1-on-1)",
    price: "$349.99",
    priceNum: 349.99,
  },
} as const;

// Annual pricing (2 months free = 10 months price)
export const ANNUAL_TIERS: Record<TierKey, { price_id: string; product_id: string; price: string; priceNum: number; monthlyEquiv: string }> = {
  foundation: {
    product_id: "prod_UC3NyJRutYTL87",
    price_id: "price_1TELXKD52tPWee46KZqfNb6u",
    price: "$199.99",
    priceNum: 199.99,
    monthlyEquiv: "$16.66",
  },
  pro: {
    product_id: "prod_UC3OvNMcgtPafc",
    price_id: "price_1TELYYD52tPWee46eYgnlcB8",
    price: "$1,499.99",
    priceNum: 1499.99,
    monthlyEquiv: "$125.00",
  },
  elite: {
    product_id: "prod_UC3ONcP6ZoWtdM",
    price_id: "price_1TELZmD52tPWee46E1mDZPg2",
    price: "$3,499.99",
    priceNum: 3499.99,
    monthlyEquiv: "$291.66",
  },
};

export const FIRST_MONTH_COUPON_ID = "JJwqu21q";

export type TierKey = keyof typeof TIERS;

// Tier-based store discounts
export const TIER_DISCOUNTS: Record<TierKey, number> = {
  foundation: 10,
  pro: 15,
  elite: 20,
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
      console.warn("[Auth] Subscription check failed:", e);
    }
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let initialDone = false;
    let signedOutAlready = false;

    const safeClearSession = () => {
      if (signedOutAlready) return;
      signedOutAlready = true;
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setSession(null);
      setSubscribed(false);
      setSubscriptionTier(null);
      setSubscriptionEnd(null);
    };

    try {
      const result = supabase.auth.onAuthStateChange((event, newSession) => {
        // If the refresh token is invalid/expired, clear the dead session
        if (event === "TOKEN_REFRESHED" && !newSession) {
          console.warn("[Auth] Token refresh failed — clearing stale session");
          safeClearSession();
          if (!initialDone) { initialDone = true; setLoading(false); }
          return;
        }
        if (event === "SIGNED_OUT") {
          signedOutAlready = true;
        }
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

    const fallbackTimer = setTimeout(() => {
      if (!initialDone) {
        initialDone = true;
        setLoading(false);
      }
    }, 3000);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!initialDone) {
        initialDone = true;
        setSession(s);
        setLoading(false);
        if (s) {
          checkSubscription();
        }
      }
      // Verify the session is still valid — but only sign out on definitive failures
      // Use a delayed check to allow token refresh to complete first
      if (s) {
        setTimeout(() => {
          if (signedOutAlready) return;
          supabase.auth.getUser().then(({ error: userError }) => {
            if (signedOutAlready) return;
            if (userError) {
              const msg = userError.message || "";
              const status = (userError as any).status;
              // Only clear on definitive auth failures, not transient network errors
              if (
                msg.includes("session_not_found") ||
                msg.includes("invalid claim") ||
                msg.includes("JWT expired") ||
                status === 401 ||
                status === 403
              ) {
                console.warn("[Auth] Stale session detected — signing out:", msg);
                safeClearSession();
              }
              // For other errors (network, 500, etc.), keep the session — it may recover
            }
          }).catch(() => {
            // Network error — don't sign out, session may still be valid
          });
        }, 1500);
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

  // Auto-refresh subscription every 5 min while logged in
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(checkSubscription, 5 * 60_000);
    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const signOut = async () => {
    try {
      const { queryClient } = await import("@/App");
      queryClient.clear();
    } catch (e) {
      console.warn("[Auth] Failed to clear query cache on sign out:", e);
    }
    safeLocalStorage.removeItem("m2-query-cache");
    safeLocalStorage.removeItem("m2_offline_queue");
    // Use scope: "local" first to clear local state immediately,
    // then attempt server-side signout (non-blocking)
    await supabase.auth.signOut({ scope: "local" });
    supabase.auth.signOut({ scope: "global" }).catch(() => {});
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
