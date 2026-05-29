import { useState } from "react";
import { Link } from "react-router-dom";
import { Dumbbell, Lock, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import SEOHead from "@/components/layout/SEOHead";
import AppNavbar from "@/components/layout/AppNavbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { lazy, Suspense } from "react";

const TechShowcaseMarketing = lazy(() => import("@/components/landing/TechShowcaseMarketing"));

const WEEK_TEASERS = [
  { week: "Week 1", title: "Foundation — Movement Prep & Core Stability" },
  { week: "Week 2", title: "Load Introduction — Learning the Barbell" },
  { week: "Week 3", title: "Progressive Overload — Building Strength" },
  { week: "Week 4", title: "Test Week — Measure Your Progress" },
];

const FreeProgram = () => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      // Upsert into newsletter_subscribers
      await supabase.from("newsletter_subscribers").upsert(
        { email: email.trim().toLowerCase(), source: "free-program" },
        { onConflict: "email" }
      );

      // Call edge function to generate & email the program
      const { error } = await supabase.functions.invoke("send-free-program", {
        body: { email: email.trim(), firstName: firstName.trim() || undefined },
      });

      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Free 4-Week Beginner Strength Program | M2 Training"
        description="Get a free 4-week beginner strength program from Coach Matt Michels. Enter your email and we'll send it right over. No strings attached."
        path="/free-program"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "M2 Free Strength Program",
          description: "Free 4-week beginner strength program from a 20-year veteran coach.",
          url: "https://www.mattmichelstraining.com/free-program",
          applicationCategory: "HealthApplication",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <AppNavbar />

      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-24 pb-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <span className="inline-block px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-semibold tracking-widest uppercase mb-6">
                100% Free — Just Enter Your Email
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[1.1] mb-4">
                Free 4-Week{" "}
                <span className="text-primary">Beginner Strength Program</span>
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
                Written by Coach Matt Michels — 20 years of real coaching experience distilled into a
                beginner-safe program you can start today. We'll email it to you instantly.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Teaser Weeks */}
        <section className="px-4 pb-10">
          <div className="max-w-md mx-auto space-y-3">
            {WEEK_TEASERS.map((w, i) => (
              <motion.div
                key={w.week}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-center gap-3 p-3 border border-border/40 bg-card/60 rounded-lg"
              >
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{w.week}</p>
                  <p className="text-sm text-foreground/70 blur-[2px] select-none">{w.title}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Email Capture */}
        <section className="px-4 pb-16">
          <div className="max-w-md mx-auto">
            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center p-8 border border-green-500/30 bg-green-500/5 rounded-xl"
              >
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Check Your Inbox!</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Your 4-week program is on its way. Give it a few minutes.
                </p>
                <Button asChild variant="outline">
                  <Link to="/auth?redirect=/trial-welcome">
                    Want coaching with it? Start a free trial <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 p-6 border border-border/40 bg-card/60 rounded-xl">
                <div className="text-center mb-2">
                  <Dumbbell className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h2 className="text-lg font-bold">Send Me the Program</h2>
                  <p className="text-xs text-muted-foreground">No spam. No BS. Just the program.</p>
                </div>
                <Input
                  placeholder="First Name (optional)"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Your Email *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full py-5" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    "Send Me the Program →"
                  )}
                </Button>
              </form>
            )}
          </div>
        </section>

        {/* Tech Showcase */}
        <Suspense fallback={null}>
          <TechShowcaseMarketing />
        </Suspense>

        {/* Footer */}
        <footer className="border-t border-border/30 py-8 px-4 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Matt Michels Training · Grosse Pointe, MI</p>
        </footer>
      </div>
    </>
  );
};

export default FreeProgram;
