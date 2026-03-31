import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Zap, Apple, Trophy, MessageSquare, ArrowRight } from "lucide-react";

const WHAT_YOU_GET = [
  { icon: Zap, title: "The Weekly Training Truth", desc: "One actionable coaching insight each week — the kind of thing most coaches keep to themselves." },
  { icon: Trophy, title: "The Weekly Drill", desc: "A single drill with exact sets/reps, why it works, and the mistake most athletes make." },
  { icon: Apple, title: "Nutrition for Athletes", desc: "Practical fueling tips for youth athletes — no supplement ads, no fads." },
  { icon: MessageSquare, title: "Matt's Take", desc: "Honest commentary on youth sports culture, overtraining, college pressure, and athlete development." },
];

const NewsletterSubscribe = () => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .upsert({ email: email.toLowerCase().trim(), is_active: true }, { onConflict: "email" });

      if (error) throw error;
      setDone(true);
    } catch (err) {
      toast.error("Something went wrong. Try again or email matt@mattmichelstraining.com");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SEOHead
        title="The M² Brief — Free Weekly Newsletter for Athletes & Parents"
        description="Weekly training tips, drills, and performance insights for youth athletes and sports parents. Free. No spam. From Coach Matt Michels in Grosse Pointe, MI."
        path="/newsletter"
      />

      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="relative pt-20 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/6 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-2xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Zap size={11} /> Weekly · Free · No Spam
            </div>
            <div className="text-5xl sm:text-7xl font-black tracking-tight mb-2">M²</div>
            <h1 className="text-2xl sm:text-4xl font-black leading-tight mb-4 tracking-tight">
              The <span className="text-primary">Brief</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
              A weekly performance newsletter for athletes, sports parents, and coaches who want real answers — not generic advice.
            </p>

            {done ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                  <CheckCircle size={28} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold">You're in.</h2>
                <p className="text-muted-foreground text-sm">First issue lands in your inbox on Friday. Welcome to The M² Brief.</p>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="mt-2">
                    Explore M² Training <ArrowRight size={13} className="ml-1.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <div className="flex-1">
                  <Label htmlFor="nl-email" className="sr-only">Email</Label>
                  <Input
                    id="nl-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="py-5 text-base"
                  />
                </div>
                <Button type="submit" disabled={sending} className="py-5 px-7 text-base font-bold shrink-0">
                  {sending ? "Subscribing..." : "Get the Brief →"}
                </Button>
              </form>
            )}

            {!done && (
              <p className="text-xs text-muted-foreground mt-3">
                Free. Unsubscribe anytime. No pitch, no ads, just coaching.
              </p>
            )}
          </div>
        </section>

        {/* What's In It */}
        <section className="px-4 pb-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">What You Get Every Friday</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {WHAT_YOU_GET.map(item => (
                <div key={item.title} className="flex gap-4 p-5 bg-card/50 border border-border/40 rounded-xl">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About Matt */}
        <section className="px-4 pb-20 bg-muted/20">
          <div className="max-w-2xl mx-auto py-12">
            <Card className="border-primary/20 bg-card/60">
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row gap-5 items-start">
                <div className="shrink-0 w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-primary text-2xl font-black">M</div>
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-bold">Matt Michels</h3>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">20+ Years Coaching</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    I've trained youth athletes in Grosse Pointe for over 20 years. Zero injuries in my career. The Brief is how I share what I've learned — the coaching knowledge that actually changes how athletes develop, written in plain English.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {["Strength Coach", "Grosse Pointe, MI", "M² Training Founder"].map(t => (
                      <span key={t} className="text-[10px] px-2 py-1 bg-muted rounded-md text-muted-foreground font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Sample Issue */}
        <section className="px-4 pb-20">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-center mb-6">What a Sample Issue Looks Like</h2>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-0 overflow-hidden">
                <div className="bg-primary h-1 w-full" />
                <div className="p-5 sm:p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-lg font-black tracking-wider text-primary">M² BRIEF</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-widest">The Weekly Sports Performance Newsletter</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Issue #12</div>
                      <div className="text-xs text-muted-foreground">Every Friday</div>
                    </div>
                  </div>
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-primary mb-1">This Week's Training Truth</div>
                      <p>Most youth athletes aren't weak — they're undertrained. The problem isn't intensity, it's consistency. Two focused sessions per week for 12 weeks beats six sloppy sessions for six weeks every single time.</p>
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-primary mb-1">The Weekly Drill</div>
                      <p><strong className="text-foreground">Single-Leg RDL — 3×8 each side.</strong> Builds hamstring strength, hip stability, and ACL resilience. Most common mistake: rotating the hip on the working side. Keep both hips squared to the floor.</p>
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-primary mb-1">Matt's Take</div>
                      <p>Stop asking if your 14-year-old is "ready" for weights. The question is whether they're ready to keep playing without getting hurt. They are. And lifting correctly is how you ensure it.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Bottom Subscribe CTA */}
        {!done && (
          <section className="px-4 pb-20 bg-muted/20">
            <div className="max-w-md mx-auto py-12 text-center">
              <h2 className="text-2xl font-bold mb-3">Join the Brief</h2>
              <p className="text-muted-foreground text-sm mb-6">Free. Every Friday. Unsubscribe anytime.</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="py-5 text-base text-center"
                />
                <Button type="submit" disabled={sending} className="w-full py-5 text-base font-bold">
                  {sending ? "Subscribing..." : "Subscribe — It's Free →"}
                </Button>
              </form>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-border/30 py-6 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} M² Training · Grosse Pointe, MI</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Home</Link>
              <Link to="/pricing" className="hover:text-foreground">Membership</Link>
              <Link to="/detroit-web-design" className="hover:text-foreground">Web Design</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default NewsletterSubscribe;
