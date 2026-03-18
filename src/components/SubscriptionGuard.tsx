import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SubscriptionGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, subscribed, isLegend } = useAuth();
  const { trialExpired, loading: trialLoading } = useTrialStatus();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const toasted = useRef(false);

  const loading = authLoading || trialLoading || adminLoading;

  // Admins and Legend members always pass through
  if (isAdmin || isLegend) return <>{children}</>;

  const lockedOut = !subscribed && trialExpired;

  useEffect(() => {
    if (loading || !user) return;
    if (lockedOut && !toasted.current) {
      toasted.current = true;
      toast.error("Your 14-day trial has expired. Choose a plan to keep your logs and continue training.");
      navigate("/pricing", { replace: true });
    }
  }, [loading, user, lockedOut, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (lockedOut) return null;

  return <>{children}</>;
};

export default SubscriptionGuard;
