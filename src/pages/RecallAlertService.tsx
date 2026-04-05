import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, ShieldAlert, FileText, Bell, Tag } from "lucide-react";

const FEATURES = [
  { icon: ShieldAlert, title: "Daily FDA Food & Drug Recall Checks", desc: "We monitor FDA recall feeds every morning — food, beverages, drugs, medical devices." },
  { icon: Bell, title: "CPSC Consumer Product Recall Monitoring", desc: "Consumer Product Safety Commission alerts matched to your product categories." },
  { icon: FileText, title: "AI-Summarized Plain-English Alerts", desc: "No jargon. Our AI translates recall notices into clear action items your team can act on." },
  { icon: Tag, title: "Matched to Your Industry & Categories", desc: "Only get alerts relevant to what you actually sell, serve, or use. No noise." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Tell Us Your Business", desc: "Select your industry and enter the product categories you carry, serve, or use." },
  { step: "02", title: "We Monitor Daily", desc: "Every morning we scan FDA and CPSC feeds for new recalls matching your profile." },
  { step: "03", title: "You Get an Alert", desc: "When a match is found, you get a plain-English email summary with the affected products and what to do." },
];

export default function RecallAlertService() {
  const [form, setForm] = useState({
    email: "",
    business_name: "",
    industry: "",
    product_categories: "",
  });
  const [loading, setLoading] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) {
      toast.error("Business name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-recall-alert-checkout", { body: form });
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
          <h1 className="text-2xl font-black text-foreground mb-3">You're protected!</h1>
          <p className="text-muted-foreground leading-relaxed">Recall monitoring is active! You'll get your first daily digest tomorrow morning at 7am.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? Text Matt at <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="FDA & CPSC Recall Alerts for Your Business | $19/mo"
        description="Daily monitoring of product recalls matched to your industry. AI-summarized email alerts so you never serve, sell, or use a recalled product. $19/mo."
        path="/recall-alert-service"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <ShieldAlert size={11} /> Recall Alert Service
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              FDA & CPSC Recall Alerts<br /><span className="text-primary">for Your Business</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Daily monitoring of product recalls matched to your industry. AI-summarized email alerts so you never serve, sell, or use a recalled product.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$19<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">Monitors daily · AI summaries · Cancel anytime</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90"
            >
              Start Monitoring <ArrowRight size={14} />
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
            <h2 className="text-2xl font-black text-center mb-2">Start for $19/mo</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Secure checkout via Stripe. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={form.business_name}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                  placeholder="Main Street Diner"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@business.com"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Industry</label>
                <select
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">Select your industry…</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Daycare">Daycare</option>
                  <option value="Retail">Retail</option>
                  <option value="Grocery">Grocery</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Product Categories (comma-separated)</label>
                <input
                  type="text"
                  value={form.product_categories}
                  onChange={(e) => setForm((f) => ({ ...f, product_categories: e.target.value }))}
                  placeholder="food, beverages, toys"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Start Recall Monitoring — $19/mo"}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">Secure checkout via Stripe. Cancel anytime.</p>
            </form>
          </div>
        </section>

        <p className="text-[12px] text-muted-foreground text-center pb-10">
          Questions? Email <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
        </p>
      </div>
    </>
  );
}
