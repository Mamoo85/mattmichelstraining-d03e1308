import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileSearch, Hammer, Clock, MapPin } from "lucide-react";

const FEATURES = [
  { icon: FileSearch, title: "Daily Permit Portal Scanning", desc: "We scan city and county permit portals every morning for new filings in your area." },
  { icon: Hammer, title: "Matched to Your Trade", desc: "Only get permits relevant to your work — plumbing, electrical, roofing, HVAC, and more." },
  { icon: Clock, title: "Early Lead Intelligence", desc: "Homeowners pull permits before work starts. You know about the job before they've hired anyone." },
  { icon: MapPin, title: "Covers Your City & Surrounding Areas", desc: "We monitor your city plus neighboring municipalities so no job slips through." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Tell Us Your Trade & City", desc: "Enter your trade, city, and state. We'll know exactly which permits to watch for." },
  { step: "02", title: "We Scan Daily", desc: "Every morning our system checks local permit portals for new filings that match your trade." },
  { step: "03", title: "You Get the Report", desc: "New permits land in your inbox each morning. Call the homeowner before your competition does." },
];

const TRADE_OPTIONS = [
  "Plumbing", "Electrical", "Roofing", "HVAC",
  "General Construction", "Concrete", "Framing", "Drywall",
];

export default function PermitWatch() {
  const [form, setForm] = useState({
    email: "",
    business_name: "",
    phone: "",
    city: "Grosse Pointe",
    state: "MI",
    trades: [] as string[],
  });
  const [loading, setLoading] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const toggleTrade = (trade: string) => {
    setForm((f) => ({
      ...f,
      trades: f.trades.includes(trade)
        ? f.trades.filter((t) => t !== trade)
        : [...f.trades, trade],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) {
      toast.error("Business name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-permit-watch-checkout", {
        body: { ...form, trades: form.trades.join(", ") },
      });
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
          <p className="text-muted-foreground leading-relaxed">Permit Watch is active! You'll get your first permit report tomorrow morning.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? Text Matt at <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Permit Watch — Daily Building Permit Alerts for Contractors | $29/mo"
        description="Daily building permit scanning for your area. Be the first contractor to know about new construction, remodels, and renovation jobs. $29/mo."
        path="/permit-watch"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <FileSearch size={11} /> Permit Watch
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Get Notified When<br /><span className="text-primary">New Permits Drop</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Daily building permit scanning for your area. Be the first contractor to know about new construction, remodels, and renovation jobs.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$29<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">Daily reports · Beat your competition · Cancel anytime</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90"
            >
              Activate Permit Watch <ArrowRight size={14} />
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
            <h2 className="text-2xl font-black text-center mb-2">Activate Permit Watch</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">$29/mo — secure checkout via Stripe.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={form.business_name}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                  placeholder="Smith Plumbing Co."
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
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(313) 555-0100"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Grosse Pointe"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    placeholder="MI"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Trades to Watch</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRADE_OPTIONS.map((trade) => (
                    <label key={trade} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.trades.includes(trade)}
                        onChange={() => toggleTrade(trade)}
                        className="accent-orange-500 w-4 h-4"
                      />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{trade}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Activate Permit Watch — $29/mo"}
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
