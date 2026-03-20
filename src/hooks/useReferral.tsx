import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { safeSessionStorage } from "@/lib/browserStorage";

const REFERRAL_STORAGE_KEY = "m2_referral_code";

/**
 * Hook to capture ?ref=CODE from URL and persist in sessionStorage.
 * Call this on the landing page / app root.
 */
export const useReferralCapture = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      safeSessionStorage.setItem(REFERRAL_STORAGE_KEY, ref.toUpperCase().trim());
    }
  }, [searchParams]);
};

/**
 * Get stored referral code (if any).
 */
export const getStoredReferralCode = (): string | null => {
  return safeSessionStorage.getItem(REFERRAL_STORAGE_KEY);
};

/**
 * Clear stored referral code after successful checkout.
 */
export const clearStoredReferralCode = () => {
  safeSessionStorage.removeItem(REFERRAL_STORAGE_KEY);
};
