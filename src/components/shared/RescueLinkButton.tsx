import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";

interface RescueLinkButtonProps {
  /** start-radar-trial product key, e.g. "mortgage_radar", "contractor_leads", "missed_call", "fielddesk", "industry_pulse", "site_radar", "techalert", or any "<vertical>_radar". */
  product: string;
  /** Recipient email if known. If missing, falls back to a Text Matt prompt. */
  email?: string | null;
  /** Optional human label for the product, used in button copy. */
  productLabel?: string;
  className?: string;
}

/**
 * Universal "email me a fresh login link" rescue CTA used on every access-denied
 * dashboard screen. Calls start-radar-trial in rescue mode — idempotent, will
 * reuse the existing native client row if one exists.
 */
export default function RescueLinkButton({
  product,
  email,
  productLabel,
  className,
}: RescueLinkButtonProps) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!email) {
      const { toast } = await import("sonner");
      toast.error("Open the link from your last email, or text Matt at (313) 992-1219.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("start-radar-trial", {
        body: { email, product, source: "rescue_link" },
      });
      if (error) throw error;
      setSent(true);
      const { toast } = await import("sonner");
      toast.success("Fresh login link sent — check your email.");
    } catch (e: any) {
      const { toast } = await import("sonner");
      toast.error(e?.message || "Couldn't send link — text Matt at (313) 992-1219.");
    } finally {
      setBusy(false);
    }
  }

  const label = productLabel ? `Email me a fresh ${productLabel} link` : "Email me a fresh login link";

  return (
    <Button
      onClick={send}
      disabled={busy || sent || !email}
      className={
        className ||
        "bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold"
      }
    >
      <Mail className="w-4 h-4 mr-1.5" />
      {sent ? "Link sent — check email" : busy ? "Sending…" : label}
    </Button>
  );
}
