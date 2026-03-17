import { useState } from "react";
import { Gift, Loader2, Tag, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TIER_DISCOUNTS } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const GIFT_CARDS = [
  { amount: 25, label: "$25" },
  { amount: 50, label: "$50" },
  { amount: 100, label: "$100", popular: true },
  { amount: 150, label: "$150" },
];

const GiftCardSection = () => {
  const { user, subscriptionTier } = useAuth();
  const { toast } = useToast();
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [buying, setBuying] = useState(false);
  const [purchasedCode, setPurchasedCode] = useState<string | null>(null);

  const discountPct = subscriptionTier ? (TIER_DISCOUNTS[subscriptionTier] || 0) : 0;
  const discountedPrice = selectedAmount * (1 - discountPct / 100);

  const handlePurchase = async () => {
    if (!user) {
      window.location.href = "/auth?redirect=/shop";
      return;
    }

    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-gift-card", {
        body: { amount: selectedAmount, recipientEmail: recipientEmail.trim() || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.code) setPurchasedCode(data.code);
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Purchase error", description: err.message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-primary/10 border border-primary/20 p-5">
        <div className="flex items-center gap-3 mb-2">
          <Gift size={24} className="text-primary" />
          <h2 className="text-base font-bold text-foreground">M² Gift Cards</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Give the gift of training. M² gift cards can be used toward any program, custom workout,
          or product in the store. The recipient gets full value — and if you're a subscriber,
          you save on the purchase.
        </p>
      </div>

      {/* Amount selector */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Select Amount
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GIFT_CARDS.map((gc) => (
            <button
              key={gc.amount}
              onClick={() => setSelectedAmount(gc.amount)}
              className={`relative p-4 border-2 transition-m2 text-center ${
                selectedAmount === gc.amount
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {gc.popular && (
                <span className="absolute -top-2 right-2 bg-primary text-primary-foreground text-[8px] font-bold uppercase tracking-widest px-2 py-0.5">
                  Popular
                </span>
              )}
              <div className="text-2xl font-mono font-bold text-primary">{gc.label}</div>
              <div className="text-[10px] text-muted-foreground mt-1">Gift Card</div>
            </button>
          ))}
        </div>
      </div>

      {/* Member discount display */}
      {discountPct > 0 && (
        <div className="bg-primary/5 border border-primary/20 p-4 flex items-center gap-3">
          <Tag size={16} className="text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">
              Your {discountPct}% member discount applies!
            </p>
            <p className="text-xs text-muted-foreground">
              You pay <span className="text-primary font-mono font-bold">${discountedPrice.toFixed(2)}</span> —
              recipient gets full <span className="font-bold">${selectedAmount}</span> value.
            </p>
          </div>
        </div>
      )}

      {/* Recipient email */}
      <div className="bg-card shadow-m2 p-5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
          Recipient Email <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          type="email"
          className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          placeholder="Send to someone special (or leave blank for yourself)"
        />
        <p className="text-[10px] text-muted-foreground mt-1.5">
          We'll include the gift card code in their receipt. You'll also get a copy.
        </p>
      </div>

      {/* Purchase */}
      <div className="bg-card shadow-m2 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {discountPct > 0 ? "Your price" : "Total"}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Secure checkout via Stripe
            </p>
          </div>
          <div className="text-right">
            {discountPct > 0 ? (
              <>
                <div className="text-sm text-muted-foreground line-through">${selectedAmount}</div>
                <div className="text-2xl font-mono font-bold text-primary">${discountedPrice.toFixed(2)}</div>
              </>
            ) : (
              <div className="text-2xl font-mono font-bold text-primary">${selectedAmount}</div>
            )}
            <div className="text-[9px] text-muted-foreground">${selectedAmount} gift card</div>
          </div>
        </div>

        <button
          onClick={handlePurchase}
          disabled={buying}
          className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 w-full justify-center disabled:opacity-50"
        >
          {buying ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
          Buy ${selectedAmount} Gift Card{discountPct > 0 ? ` · Pay $${discountedPrice.toFixed(2)}` : ""}
        </button>
      </div>

      {/* Success state */}
      {purchasedCode && (
        <div className="bg-primary/10 border-2 border-primary p-6 text-center">
          <Check size={32} className="text-primary mx-auto mb-2" />
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-1">
            Gift Card Ready!
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Complete checkout to activate. Your code:
          </p>
          <div className="bg-background border-2 border-primary/30 px-6 py-3 inline-block">
            <span className="font-mono text-xl font-bold text-primary tracking-widest">
              {purchasedCode}
            </span>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-muted p-4">
        <h4 className="text-xs font-bold text-foreground mb-2">How Gift Cards Work</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">1.</span>
            Purchase a gift card — you'll get a unique code
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">2.</span>
            Share the code with the recipient (or use it yourself)
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">3.</span>
            Enter the code at checkout for any store product
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftCardSection;
