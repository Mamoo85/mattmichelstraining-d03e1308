import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, TrendingUp, Factory, Globe, Clock } from "lucide-react";

const FEATURES = [
  { icon: Factory, label: "Plant openings & expansions", sub: "Know which manufacturers are scaling before your competitors do." },
  { icon: TrendingUp, label: "Procurement shifts", sub: "Supplier changes and new purchasing decisions in your target industries." },
  { icon: Globe, label: "Competitor moves", sub: "Mergers, product launches, and market entries that affect your territory." },
  { icon: Clock, label: "Monday morning timing", sub: "In your inbox before your workweek starts. Actionable, not academic." },
];

export default function IndustrialNewsletter() {
  const [form, setForm] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're in.</h1>
          <p className="text-muted-foreground leading-relaxed">
            First issue hits your inbox next Monday at 9am. You'll get 5 actionable sales intelligence insights from the manufacturing and industrial markets.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) {
      toast.error("Email is required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-industrial-newsletter-checkout", {
        body: form,
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Industrial Sales Intel — Weekly Newsletter | M² Training"
        description="Sales intelligence for industrial and manufacturing B2B reps. Manufacturing plant openings, procurement shifts, competitor moves — delivered every Monday. $19/month."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="bg-[#1e293b] text-white px-6 py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest">
              Industrial Sales Intel
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-5">
              Sales intelligence for industrial reps.<br />Every Monday. $19/mo.
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed mb-8">
              Manufacturing plant openings, procurement shifts, competitor moves — delivered before your workweek starts. 5 actionable insights you can use to prospect and close deals that week.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-3xl font-black text-[#e8621a]">$19</span>
              <span className="text-slate-400 text-lg">/month</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 text-sm">Cancel anytime</span>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="px-6 py-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-black text-foreground text-center mb-10">What's in every issue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <div key={f.label} className="border border-border rounded-xl p-5 flex gap-4 items-start">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon size={20} className="text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm mb-1">{f.label}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sample insight */}
        <section className="px-6 pb-12 max-w-3xl mx-auto">
          <div className="bg-muted/50 rounded-xl p-7 border border-border">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Sample insight</p>
            <h3 className="text-base font-bold text-foreground mb-2">Midwest Steel Fabricators Adding Capacity</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Three mid-sized steel fabricators in Ohio and Michigan announced capital equipment purchases this week. That means open doors for reps selling cutting tools, welding equipment, ERP software, and safety gear. Call their plant manager directly — mention you saw the expansion announcement and want to help them get new equipment producing faster.
            </p>
            <p className="text-xs text-muted-foreground font-semibold">Insight #2 of 5 — Week of March 24</p>
          </div>
        </section>

        {/* Who it's for */}
        <section className="px-6 pb-12 max-w-3xl mx-auto">
          <div className="bg-[#1e293b] rounded-xl p-7 text-white">
            <p className="text-xs font-bold text-[#e8621a] uppercase tracking-widest mb-4">Who this is for</p>
            <ul className="space-y-2 text-sm text-slate-300 leading-relaxed">
              <li>Industrial equipment and machinery reps</li>
              <li>MRO and safety supply reps</li>
              <li>B2B SaaS reps selling into manufacturing</li>
              <li>Distribution and logistics reps</li>
              <li>Anyone prospecting into plants, fabricators, or industrial buyers</li>
            </ul>
          </div>
        </section>

        {/* Signup Form */}
        <section className="px-6 pb-20 max-w-md mx-auto">
          <div className="border border-border rounded-2xl p-8">
            <h2 className="text-xl font-black text-foreground mb-2">Get next Monday's issue</h2>
            <p className="text-muted-foreground text-sm mb-6">$19/month. Cancel anytime. First issue next Monday at 9am.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                name="name"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
                className="border border-input rounded-lg px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email address *"
                required
                className="border border-input rounded-lg px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-white font-bold rounded-lg py-3.5 text-sm flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>Subscribe for $19/mo <ArrowRight size={16} /></>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Secure checkout via Stripe. Cancel anytime — no questions asked.
              </p>
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Questions? Text or call Matt at{" "}
            <a href="tel:+13138064952" className="text-primary font-semibold">(313) 806-4952</a>
          </p>
        </section>

      </div>
    </>
  );
}
