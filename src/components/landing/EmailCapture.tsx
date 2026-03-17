import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const EmailCapture = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .upsert({ email: email.trim().toLowerCase(), source: "footer-capture" }, { onConflict: "email" });
      if (error) throw error;
      toast({ title: "You're in.", description: "Matt's monthly tips are on the way." });
      setEmail("");
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-10 bg-card shadow-m2 p-5 md:p-8 border-t-4 border-primary">
      <div className="flex items-center gap-2 mb-1">
        <Mail size={16} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
          Free Monthly Tips
        </span>
      </div>
      <h3 className="text-base md:text-lg font-bold text-foreground mb-1">
        Get Matt's training tips — once a month
      </h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-lg leading-relaxed">
        Injury prevention, strength fundamentals, and the hard truths he shares
        with his athletes. No fluff. Written by Matt, not AI.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="flex-1 bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? "..." : "Subscribe"}
          <ArrowRight size={14} />
        </button>
      </form>
      <p className="text-[10px] text-muted-foreground mt-2">
        No spam. Unsubscribe anytime. Matt writes every word himself.
      </p>
    </div>
  );
};

export default EmailCapture;
