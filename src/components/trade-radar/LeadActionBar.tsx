import { useEffect, useState } from "react";
import { Phone, X, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ActionStatus = "new" | "called" | "pass" | "snoozed" | "won" | "lost";

interface LeadActionBarProps {
  leadId: string;
  clientId: string;
  /** "trade" → trade_radar_lead_actions, "mortgage" → mortgage_radar_lead_actions */
  product: "trade" | "mortgage";
  initialStatus?: ActionStatus;
  initialSnoozeUntil?: string | null;
  /** Optional dashboard auth — passed to backend when user is anon (token link) */
  email?: string;
  token?: string;
}

const TABLE: Record<"trade" | "mortgage", string> = {
  trade: "trade_radar_lead_actions",
  mortgage: "mortgage_radar_lead_actions",
};

export default function LeadActionBar({
  leadId,
  clientId,
  product,
  initialStatus = "new",
  initialSnoozeUntil = null,
  email,
  token,
}: LeadActionBarProps) {
  const [status, setStatus] = useState<ActionStatus>(initialStatus);
  const [snoozeUntil, setSnoozeUntil] = useState<string | null>(initialSnoozeUntil);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
    setSnoozeUntil(initialSnoozeUntil);
  }, [initialStatus, initialSnoozeUntil]);

  async function applyStatus(next: ActionStatus, snoozeDate: string | null = null) {
    setSaving(true);
    try {
      // Prefer backend function so token-based (anon) dashboard users can save through RLS.
      const { data, error } = await supabase.functions.invoke("claim-trade-radar-lead", {
        body: {
          product,
          client_id: clientId,
          lead_id: leadId,
          status: next,
          snooze_until: snoozeDate,
          email,
          token,
        },
      });
      if (error || (data as any)?.error) {
        // Fallback: try direct upsert (works for logged-in admin/owner)
        const { error: directErr } = await (supabase.from as any)(TABLE[product]).upsert({
          client_id: clientId,
          lead_id: leadId,
          status: next,
          snooze_until: snoozeDate,
        }, { onConflict: "client_id,lead_id" });
        if (directErr) throw (error || directErr);
      }
      setStatus(next);
      setSnoozeUntil(snoozeDate);
      toast.success(
        next === "called" ? "Marked as Called" :
        next === "pass" ? "Lead passed" :
        next === "snoozed" ? `Snoozed until ${snoozeDate}` : "Updated"
      );
    } catch (err: any) {
      console.warn("[LeadActionBar] save failed", err);
      toast.error("Could not save — try again");
    } finally {
      setSaving(false);
    }
  }

  function handleSnooze() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    applyStatus("snoozed", d.toISOString().slice(0, 10));
  }

  const isCalled = status === "called";
  const isPass = status === "pass";
  const isSnoozed = status === "snoozed";

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-white/5">
      <Button
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={() => applyStatus(isCalled ? "new" : "called")}
        className={cn(
          "h-8 text-xs rounded-lg border-white/10",
          isCalled
            ? "bg-green-500/15 border-green-500/30 text-green-400"
            : "text-white/70 hover:bg-white/5"
        )}
      >
        {isCalled ? <Check className="w-3 h-3 mr-1" /> : <Phone className="w-3 h-3 mr-1" />}
        {isCalled ? "Called" : "Mark Called"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={handleSnooze}
        className={cn(
          "h-8 text-xs rounded-lg border-white/10",
          isSnoozed
            ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
            : "text-white/70 hover:bg-white/5"
        )}
      >
        <Clock className="w-3 h-3 mr-1" />
        {isSnoozed && snoozeUntil ? `Snoozed → ${snoozeUntil}` : "Snooze 7d"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={() => applyStatus(isPass ? "new" : "pass")}
        className={cn(
          "h-8 text-xs rounded-lg border-white/10",
          isPass
            ? "bg-red-500/15 border-red-500/30 text-red-400"
            : "text-white/70 hover:bg-white/5"
        )}
      >
        <X className="w-3 h-3 mr-1" />
        {isPass ? "Passed" : "Pass"}
      </Button>
    </div>
  );
}
