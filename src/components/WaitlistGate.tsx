import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WaitlistGateProps {
  productName: string;
  description?: string;
  price?: string;
}

const WaitlistGate = ({ productName, description }: WaitlistGateProps) => {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState("submitting");
    try {
      await supabase.from("newsletter_subscribers").upsert(
        { email, source: `waitlist_${productName.toLowerCase().replace(/\s+/g, "_")}` },
        { onConflict: "email" }
      );
      setState("done");
      toast({ title: "You're on the list!", description: "We'll notify you when this launches." });
    } catch {
      setState("idle");
      toast({ title: "Something went wrong", variant: "destructive" });
    }
  };

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle className="text-green-500" size={32} />
        <p className="text-lg font-bold text-foreground">You're on the list!</p>
        <p className="text-sm text-muted-foreground">We'll email you the moment {productName} launches.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-card border border-border rounded-lg p-6 text-center space-y-4">
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
        <Bell size={12} /> Coming Soon
      </div>
      <h3 className="text-lg font-bold text-foreground">{productName}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={state === "submitting"} size="sm">
          {state === "submitting" ? <Loader2 size={14} className="animate-spin" /> : "Notify Me"}
        </Button>
      </form>
      <p className="text-[10px] text-muted-foreground">No spam. Just a one-time launch notification.</p>
    </div>
  );
};

export default WaitlistGate;
