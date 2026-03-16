import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SectionHeader from "./SectionHeader";

const NewsletterSignup = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({ title: "You're in.", description: "Matt's newsletter is on its way." });
    setEmail("");
  };

  return (
    <div>
      <SectionHeader title="The Real Deal" timestamp="Matt's free newsletter" />
      <div className="bg-card shadow-m2 p-5">
        <p className="text-sm text-foreground text-balance leading-relaxed mb-1">
          The training advice, injury prevention tips, and hard truths that Matt shares with his athletes —
          delivered to your inbox. Free.
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          No videos. No fluff. Just 20+ years of knowledge written in plain English.
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
            className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2"
          >
            <Mail size={14} />
            Subscribe
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
