import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Star, Bell, MessageSquare, Shield, Clock, TrendingUp, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Bell,
    title: "2-Hour Review Alert",
    desc: "The moment a guest posts a review on Airbnb or VRBO, you get an SMS. No more finding out about a bad review a week later when it's already tanked your ranking.",
  },
  {
    icon: MessageSquare,
    title: "AI Response Draft — Ready to Post",
    desc: "Every alert includes a personalized response written by AI — referencing the guest's specific comments. One tap to approve, post, and move on.",
  },
  {
    icon: Star,
    title: "3-Star Alert (Priority)",
    desc: "Any review 3 stars or below triggers an immediate priority alert — separate from standard notifications — so you can act before it compounds.",
  },
  {
    icon: Shield,
    title: "Monthly Reputation Report",
    desc: "Your average rating trend, response rate, review volume by property, and comparison to your market average. One PDF, every month.",
  },
  {
    icon: Clock,
    title: "Daily Monitoring Across All Listings",
    desc: "Monitors every Airbnb and VRBO listing you own — any number of properties — checking daily so nothing slips through.",
  },
  {
    icon: TrendingUp,
    title: "Ranking Impact Tracking",
    desc: "Tracks your search position on Airbnb over time so you can see whether your review management is actually moving the needle.",
  },
];

const COMPARISON = [
  { tool: "Rankbreeze", price: "$30–80/mo", what: "Analytics only — no review alerts, no AI responses", highlight: false },
  { tool: "Smartbnb / Hospitable", price: "$24/mo", what: "Guest messaging — not built for reputation management", highlight: false },
  { tool: "Hostfully", price: "$79/mo", what: "Property management system — reviews are an afterthought", highlight: false },
  { tool: "M2 STR Reputation", price: "$79/mo per property", what: "2-hr alerts + AI responses + monthly report + ranking tracking", highlight: true },
];

export default function STRReputation() {
  const [form, setForm] = useState({ email: "", name: "", phone: "", propertyUrls: "", propertyCount: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) { toast.error("Name and email are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-str-reputation-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">You're protected.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Matt will activate monitoring on your listings within 24 hours. The next time a review hits, you'll know within 2 hours — with a response ready to post.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Questions? <a href="tel:+13138064952" className="text-primary font-medium">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Airbnb & STR Reputation Manager — 2-Hour Review Alerts + AI Responses | $79/mo"
        description="Know about every Airbnb and VRBO review within 2 hours. AI drafts a personalized response ready to post. Monthly reputation report. $79/mo per property. 14-day trial."
        path="/str-reputation"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Star size={11} /> STR Reputation Manager
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Know about every review<br />
              <span className="text-primary">in 2 hours. AI response ready to post.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              A single unanswered 3-star review can cost you 40+ future bookings. This system catches every review across every listing — and has a personalized response drafted before you even finish reading the alert.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-10">
              <div className="text-center">
                <div className="text-5xl font-black text-primary">$79<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
                <p className="text-sm text-muted-foreground mt-1">per property · 14-day free trial · cancel anytime</p>
              </div>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Protect My Listings <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Stat strip */}
        <section className="py-8 px-4 border-b border-border bg-card">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span>Airbnb + VRBO Monitoring</span>
            <span className="text-border">|</span>
            <span>Alert Within 2 Hours</span>
            <span className="text-border">|</span>
            <span>AI Response in Every Alert</span>
            <span className="text-border">|</span>
            <span>3-Star Priority Alerts</span>
          </div>
        </section>

        {/* Scenario callout */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="border border-border rounded-lg p-8">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-4">The Problem</p>
              <p className="text-lg font-black mb-4 leading-snug">
                A guest leaves a 2-star review on a Friday night. You don't see it until Monday. By then it's already influenced 20 potential bookings — and Airbnb's algorithm has quietly buried your listing.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hosts who respond to reviews within 24 hours have measurably higher booking conversion rates. Response time is factored directly into Airbnb's Superhost algorithm. This system makes sure you never miss the window.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">What You Get</p>
              <h2 className="text-2xl sm:text-3xl font-black">Complete reputation protection. On autopilot.</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">The Alternatives</p>
              <h2 className="text-2xl sm:text-3xl font-black">Nothing else does this.</h2>
            </div>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-5 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div>
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.what}</p>
                  </div>
                  <div className={`text-base font-black whitespace-nowrap ml-4 ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sign up */}
        <section id="signup" className="py-20 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black mb-2">Start Your 14-Day Free Trial</h2>
              <p className="text-muted-foreground text-sm">$79/mo per property after trial. Cancel anytime.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Alex Carter" className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email Address *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="alex@yourhostbiz.com" className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Mobile Phone *</label>
                <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(313) 555-0100" className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Number of Properties *</label>
                <input type="number" min="1" value={form.propertyCount} onChange={e => setForm(p => ({ ...p, propertyCount: e.target.value }))}
                  placeholder="3" className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Listing URLs</label>
                <textarea value={form.propertyUrls} onChange={e => setForm(p => ({ ...p, propertyUrls: e.target.value }))}
                  placeholder={"Paste your Airbnb/VRBO listing URLs, one per line\nhttps://airbnb.com/rooms/12345\nhttps://vrbo.com/1234567"}
                  rows={4} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm resize-none" />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Protect My Listings — $79/mo After Trial"}
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">Secure checkout via Stripe. No card charged for 14 days.</p>
          </div>
        </section>

      </div>
    </>
  );
}
