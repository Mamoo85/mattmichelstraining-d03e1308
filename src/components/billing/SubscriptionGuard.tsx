import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SubscriptionGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, subscribed } = useAuth();
  const { trialExpired, loading: trialLoading } = useTrialStatus();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const toasted = useRef(false);

  // Check if user is an in-person client (bypasses paywall like a basic subscriber)
  const { data: isInPerson = false, isLoading: inPersonLoading } = useQuery({
    queryKey: ["is-in-person", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_in_person")
        .eq("user_id", user!.id)
        .single();
      return data?.is_in_person ?? false;
    },
    staleTime: 60_000,
  });

  const loading = authLoading || trialLoading || adminLoading || inPersonLoading;

  // Admins and in-person clients always pass through
  const bypassed = isAdmin || isInPerson;
  const lockedOut = !bypassed && !subscribed && trialExpired;

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
