import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SectionHeader from "./SectionHeader";

const NewsletterSignup = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .upsert({ email: email.trim().toLowerCase(), source: "website" }, { onConflict: "email" });
      if (error) throw error;
      toast({ title: "You're in.", description: "Matt's newsletter is on its way." });
      setEmail("");
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SectionHeader title="The Real Deal" timestamp="Matt's monthly newsletter" />
      <div className="bg-card shadow-m2 p-5">
        <p className="text-sm text-foreground text-balance leading-relaxed mb-1">
          Once a month, Matt sends training insights, injury prevention tips, and the hard truths
          he shares with his athletes — straight to your inbox.
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          No videos. No fluff. Just 20+ years of knowledge written in plain English, once a month.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
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
            <Mail size={14} />
            {loading ? "..." : "Subscribe"}
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2">
          No spam. Unsubscribe anytime. Matt writes every word himself.
        </p>
      </div>
    </div>
  );
};

export default NewsletterSignup;
