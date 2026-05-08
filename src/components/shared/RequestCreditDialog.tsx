import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const REASONS = [
  { value: "invalid_address",  label: "Invalid / undeliverable address" },
  { value: "duplicate",        label: "Duplicate of an earlier lead (≤30 days)" },
  { value: "wrong_signal",     label: "Signal type doesn't match what was promised" },
  { value: "out_of_area",      label: "Outside my coverage area / ZIPs" },
  { value: "no_contact",       label: "No way to reach owner after multiple tries" },
  { value: "other",            label: "Other (describe below)" },
];

export interface RequestCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: string;       // e.g. "contractor_leads"
  leadId: string;
  leadTable?: string;    // e.g. "contractor_leads"
  leadSummary?: string;  // shown to user as confirmation
  requesterEmail: string;
  onSubmitted?: () => void;
}

export default function RequestCreditDialog({
  open,
  onOpenChange,
  product,
  leadId,
  leadTable,
  leadSummary,
  requesterEmail,
  onSubmitted,
}: RequestCreditDialogProps) {
  const [reasonCode, setReasonCode] = useState<string>("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reasonCode) {
      toast.error("Pick a reason so we can review faster.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp?.user?.id ?? null;

      const { error } = await supabase.from("lead_credit_requests").insert({
        product,
        lead_id: leadId,
        lead_table: leadTable ?? null,
        requester_email: requesterEmail,
        requester_user_id: userId,
        reason_code: reasonCode,
        reason_detail: reasonDetail.trim() || null,
      });

      if (error) throw error;

      toast.success("Credit request submitted — we'll respond within 1 business day.");
      onSubmitted?.();
      onOpenChange(false);
      setReasonCode("");
      setReasonDetail("");
    } catch (err) {
      // Fall back to mailto so the user is never stranded
      console.error("[RequestCreditDialog] insert failed", err);
      const subject = `Credit Request — ${product} ${leadId.slice(0, 8)}`;
      const body = [
        `Lead ID: ${leadId}`,
        `Product: ${product}`,
        `Reason: ${reasonCode || "(not selected)"}`,
        `Detail: ${reasonDetail || "(none)"}`,
        leadSummary ? `\nLead summary:\n${leadSummary}` : "",
      ].join("\n");
      window.location.href = `mailto:matt@detroitwebagent.com?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
      toast.message("Submitting via email instead — your inbox should open.");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Request a lead credit
          </DialogTitle>
          <DialogDescription>
            Disputed leads get a 1-business-day review. Approved credits drop a
            replacement lead into your queue automatically.
          </DialogDescription>
        </DialogHeader>

        {leadSummary && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono text-muted-foreground whitespace-pre-line">
            {leadSummary}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="credit-reason">Reason</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger id="credit-reason">
                <SelectValue placeholder="Pick the closest reason…" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credit-detail">Details (optional)</Label>
            <Textarea
              id="credit-detail"
              rows={3}
              placeholder="Anything we should know — call attempts, why the address didn't work, etc."
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reasonCode}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Submit credit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
