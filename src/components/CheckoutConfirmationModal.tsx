import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, FileText, Rocket, Video, Users, Loader2 } from "lucide-react";

export type CheckoutProductType = "pdf" | "basic" | "foundation" | "custom" | "custom_program" | "team_elite" | "program" | "session";

interface CheckoutConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  productName: string;
  productPrice: string;
  productType: CheckoutProductType;
}

const NEXT_STEPS: Record<CheckoutProductType, { icon: typeof FileText; text: string }> = {
  pdf: {
    icon: FileText,
    text: "Your blueprint will be instantly unlocked in your Profile to download.",
  },
  program: {
    icon: FileText,
    text: "Your program will be instantly unlocked in your Profile to download.",
  },
  custom_program: {
    icon: FileText,
    text: "Matt reads your intake and builds a custom program from scratch. You'll receive it in your Profile once it's ready.",
  },
  basic: {
    icon: Rocket,
    text: "You will get instant access to the exercise library and 10 pre-loaded daily workouts. Start training today.",
  },
  foundation: {
    icon: Rocket,
    text: "You will get instant access to the portal with your 8-week periodized training block. Your first task is to log your baseline numbers.",
  },
  custom: {
    icon: Video,
    text: "After checkout, you will complete your intake form and optionally schedule an in-person or online session with Coach Matt to build your custom protocol.",
  },
  team_elite: {
    icon: Users,
    text: "After checkout, you'll get access to roster management and full-season training plans for your entire team.",
  },
  session: {
    icon: Rocket,
    text: "Your session will be confirmed and added to the schedule. You'll receive a confirmation email with details.",
  },
};

const CheckoutConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  loading = false,
  productName,
  productPrice,
  productType,
}: CheckoutConfirmationModalProps) => {
  const step = NEXT_STEPS[productType] || NEXT_STEPS.program;
  const StepIcon = step.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border p-0 gap-0 max-h-[85dvh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="p-5 pb-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <DialogTitle className="text-sm font-black uppercase tracking-widest text-foreground">
              Order Summary
            </DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Review your order before proceeding to checkout.
          </DialogDescription>
        </DialogHeader>

        {/* Order details */}
        <div className="px-5 pt-4 pb-3">
          <div className="bg-muted/50 border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground leading-tight">{productName}</span>
              <span className="text-lg font-mono font-black text-primary ml-3 shrink-0">{productPrice}</span>
            </div>
          </div>
        </div>

        {/* What Happens Next */}
        <div className="px-5 pb-5">
          <div className="bg-primary/5 border border-primary/15 p-4">
            <div className="flex items-start gap-3">
              <StepIcon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">What Happens Next</p>
                <p className="text-xs text-foreground leading-relaxed">{step.text}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Confirm & Checkout"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutConfirmationModal;
