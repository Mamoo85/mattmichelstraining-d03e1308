import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BuyerEmailDialog } from "@/components/marketplace/BuyerEmailDialog";
import { Flame, Zap, Clock, X } from "lucide-react";
import { toast } from "sonner";

const VIEWS_KEY = "mp_views_session";
const DISMISS_KEY = "mp_first_look_dismiss_until";
const SUBSCRIBER_KEY = "mp_first_look_subscriber";
const BUYER_EMAIL_KEY = "mp_buyer_email";

interface Props {
  product: string; // "mortgage" | "talent" | etc.
  leads: Array<{ id: string; score?: number; signal_strength_tier?: string; city?: string | null; signal_type?: string | null; human_summary?: string | null }>;
}

export function FirstLookUpsellGate({ product, leads }: Props) {
  const [open, setOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Suppression checks
    const subEmail = localStorage.getItem(SUBSCRIBER_KEY);
    const buyerEmail = localStorage.getItem(BUYER_EMAIL_KEY);
    if (subEmail && buyerEmail && subEmail === buyerEmail) return; // already subscribed
    if (buyerEmail) return; // existing customer — don't pester

    const dismissUntil = Number(localStorage.getItem(DISMISS_KEY) || "0");
    if (dismissUntil > Date.now()) return;

    // Increment view count for this session
    const views = Number(sessionStorage.getItem(VIEWS_KEY) || "0") + 1;
    sessionStorage.setItem(VIEWS_KEY, String(views));

    if (views === 3) {
      // Trigger on 3rd lead view
      setTimeout(() => setOpen(true), 800);
    }
  }, [product]);

  const sample = leads
    .filter((l) => l.signal_strength_tier === "hot")
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0]
    || leads.sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setOpen(false);
  };

  const handleSubscribe = () => {
    setEmailDialogOpen(true);
  };

  const handleEmailConfirm = async (email: string) => {
    localStorage.setItem(BUYER_EMAIL_KEY, email);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-marketplace-first-look-checkout", {
        body: { email, product },
      });
      if (error) throw error;
      const token = (data as any)?.buyer_token;
      if (token) localStorage.setItem("mp_buyer_token", token);
      const url = (data as any)?.url;
      if (!url) throw new Error("No checkout URL");
      window.location.href = url;
    } catch (e) {
      console.error(e);
      toast.error("Could not start checkout — try again.");
      setSubmitting(false);
    }
  };

  if (!sample) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-lg bg-card border-intel-teal/30">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-intel-teal mb-2">
            <Zap className="w-3.5 h-3.5" /> First Look Access
          </div>
          <DialogTitle className="text-2xl">Get hot leads <span className="text-intel-teal">1 hour earlier.</span></DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Subscribers see brand-new hot leads <strong>15 minutes</strong> after they're scored.
            Everyone else waits an hour. Here's a real lead from this product:
          </DialogDescription>
        </DialogHeader>

        {/* Sample lead preview */}
        <div className="rounded border border-intel-teal/30 bg-background/60 p-4 my-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-400">{sample.signal_strength_tier?.toUpperCase() || "HOT"}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{sample.city || "Metro Detroit"}</span>
            </div>
            <div className="text-xs font-mono text-intel-teal">Score {sample.score}/10</div>
          </div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
            {sample.signal_type || "Signal"}
          </div>
          <p className="text-sm text-foreground/90 line-clamp-3">
            {sample.human_summary || "High-intent signal detected — full dossier available to subscribers immediately."}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          You've viewed 3 leads this session — most hot leads sell within 2 hours.
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={handleDismiss} className="flex-1">
            <X className="w-4 h-4 mr-1" /> Continue browsing
          </Button>
          <Button
            onClick={handleSubscribe}
            disabled={submitting}
            className="flex-1 bg-intel-teal text-background hover:bg-intel-teal/90"
          >
            {submitting ? "Loading…" : "Get First Look — $49/mo"}
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground font-mono">
          Cancel anytime · 1-hour head start on every hot lead in {product}
        </p>
      </DialogContent>
    </Dialog>

    <BuyerEmailDialog
      open={emailDialogOpen}
      onOpenChange={setEmailDialogOpen}
      onConfirm={handleEmailConfirm}
      defaultEmail={localStorage.getItem(BUYER_EMAIL_KEY) || ""}
      title="Enter your email"
      description="Where should we send your First Look access confirmation?"
    />
    </>
  );
}
