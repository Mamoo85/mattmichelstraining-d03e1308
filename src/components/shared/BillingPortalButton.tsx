import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Opens the Stripe customer billing portal for the logged-in user.
 * Drop into any My*.tsx portal page.
 */
export default function BillingPortalButton({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-customer-portal-session");
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("No portal URL returned");
      window.location.href = url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not open billing portal";
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={open}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1e3a5f] bg-[#0a1628] text-white text-sm font-medium hover:bg-[#0f1f3a] transition disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      Manage Billing
    </button>
  );
}
