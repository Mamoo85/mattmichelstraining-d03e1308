import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Search, Target, FileText, Bell, TrendingUp } from "lucide-react";

const FEATURES = [
  { icon: Search, title: "Automated Bid Board Scanning", desc: "We scan SAM.gov, BidNet, and state procurement portals daily for opportunities matching your trade and territory." },
  { icon: Target, title: "AI Fit Scoring (0-100)", desc: "Every opportunity is scored on trade match, location, project size, and timeline. Focus only on bids worth pursuing." },
  { icon: FileText, title: "Auto-Generated Proposals", desc: "For high-fit opportunities (70+), AI drafts a first-pass proposal using your historical pricing. You review and send." },
  { icon: Bell, title: "72-Hour Deadline SMS Alerts", desc: "When a bid is due within 72 hours, you get an immediate text. Never miss a submission window." },
  { icon: TrendingUp, title: "Win Rate Intelligence", desc: "Track which bid types, sizes, and sources convert best for your business over time." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Tell Us Your Trade", desc: "Enter your trade (electrical, plumbing, HVAC, etc.), service territory, and optional rate sheet." },
  { step: "02", title: "We Scan Daily", desc: "Every morning we search federal, state, and private bid boards for opportunities matching your profile." },
  { step: "03", title: "You Bid & Win", desc: "Get scored opportunities with auto-drafted proposals. Review, approve, and submit — all from your inbox." },
];

const TRADE_OPTIONS = [
  "Electrical", "Plumbing", "HVAC", "Roofing", "Concrete", "Steel/Iron",
  "Painting", "Drywall", "Flooring", "Landscaping", "Demolition", "Excavation",
  "Fire Protection", "Insulation", "Masonry", "Glazing", "Other",
];

export default function BidIntelligence() {
  const [form, setForm] = useState({
    customer_email: "",
    customer_name: "",
    company_name: "",
    trade: "Electrical",
    service_territory: "",
    max_bid_radius_miles: "50",
    phone: "",
  });
  const [loading, setLoading] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_email || !form.company_name) {
      toast.error("Company name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-bid-intel-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're all set!</h1>
          <p className="text-muted-foreground leading-relaxed">Your Bid Intelligence monitor is now active. You'll receive your first bid report within 24 hours.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? Text Matt at <a href="tel:+13139921219" className="text-primary">(313) 992-1219</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Bid Intelligence & Proposal Factory — Win More Bids | $599/mo"
        description="AI-powered bid board scanning, opportunity scoring, and auto-generated proposals for commercial subcontractors. $599/mo."
        path="/bid-intelligence"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Target size={11} /> Bid Intelligence
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Win More Bids.<br /><span className="text-primary">Spend Less Time Looking.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              AI scans bid boards daily, scores every opportunity, and auto-drafts proposals for the best matches. You just review and submit.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$599<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">For commercial subcontractors · Cancel anytime</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90"
            >
              Start Finding Bids <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-card border border-border p-5 rounded-sm">
                  <Icon size={20} className="text-primary mb-3" />
                  <p className="font-bold text-sm mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((s) => (
                <div key={s.step} className="text-center">
                  <div className="text-3xl font-black text-primary/20 mb-2">{s.step}</div>
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sign-Up Form */}
        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Activate Bid Intelligence</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">$599/mo — secure checkout via Stripe.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input type="text" placeholder="Company Name *" required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <input type="text" placeholder="Your Name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <input type="email" placeholder="Email *" required value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <select value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none">
                  {TRADE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <input type="text" placeholder="Service Territory (e.g. Southeast Michigan)" value={form.service_territory} onChange={(e) => setForm({ ...form, service_territory: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <input type="number" placeholder="Max Bid Radius (miles)" value={form.max_bid_radius_miles} onChange={(e) => setForm({ ...form, max_bid_radius_miles: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <input type="tel" placeholder="Phone (for SMS alerts)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>Get Started <ArrowRight size={14} /></>}
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">Powered by Stripe. Cancel anytime. Questions? <a href="tel:+13139921219" className="text-primary">(313) 992-1219</a></p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 border-t border-border text-center text-xs text-muted-foreground">
          M² Performance Training &middot; Grosse Pointe, MI &middot; <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a>
        </footer>
      </div>
    </>
  );
}
