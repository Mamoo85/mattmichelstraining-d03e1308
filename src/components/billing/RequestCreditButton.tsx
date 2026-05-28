import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  leadId: string;
  email: string;
  product: "trade_radar" | "mortgage_radar" | "contractor_leads" | "techalert";
  leadValueCents?: number;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  label?: string;
}

const REASONS = [
  { value: "invalid_address", label: "Address doesn't exist / can't be validated" },
  { value: "duplicate_30day", label: "Duplicate of a lead I already received (last 30 days)" },
  { value: "out_of_area_zip", label: "Outside my coverage ZIPs / counties" },
  { value: "wrong_signal_type", label: "Wrong signal type for my service" },
  { value: "bad_phone_email", label: "Owner contact info is bad / disconnected" },
  { value: "other", label: "Other (explain below)" },
];

export function RequestCreditButton({ leadId, email, product, leadValueCents, className, variant = "outline", label = "Request Credit" }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("invalid_address");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-lead-credit", {
        body: { email, lead_id: leadId, product, reason, lead_value_cents: leadValueCents, details: details.trim() || null },
      });
      if (error) throw error;
      if (data?.already_credited) {
        toast.info("This lead was already credited.");
        setResult({ status: "already_credited", message: "Already credited to your next invoice." });
      } else if (data?.ok) {
        toast.success(data.message || "Credit issued");
        setResult({ status: data.status, message: data.message });
      } else {
        throw new Error(data?.error || "Credit request failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Credit request failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResult(null); setDetails(""); setReason("invalid_address"); } }}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" className={className}>
          <AlertCircle className="w-4 h-4 mr-2" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request lead credit</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{result.message}</p>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Why are you requesting a credit?</Label>
                <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
                  {REASONS.map((r) => (
                    <div key={r.value} className="flex items-start gap-2">
                      <RadioGroupItem value={r.value} id={`r-${r.value}`} className="mt-0.5" />
                      <Label htmlFor={`r-${r.value}`} className="text-sm font-normal cursor-pointer leading-snug">
                        {r.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="details" className="text-sm font-semibold mb-1 block">
                  Details <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                  placeholder="Anything we should know?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RequestCreditButton;
