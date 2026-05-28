import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  email?: string | null;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  label?: string;
}

/**
 * Opens Stripe Customer Portal for self-serve cancel / upgrade / payment-method update.
 * Pass the client's billing email (from URL params on My* portals).
 */
export function ManageSubscriptionButton({ email, className, variant = "outline", label = "Manage Subscription" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!email) {
      toast.error("No billing email on file. Contact support: matt@detroitwebagent.com");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-customer-portal-session", {
        body: { email },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "No portal URL returned");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to open billing portal";
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading} variant={variant} className={className} size="sm">
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
}

export default ManageSubscriptionButton;
