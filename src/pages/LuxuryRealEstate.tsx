import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, TrendingUp, Map, Users, DollarSign, Zap, BarChart } from "lucide-react";

const FEATURES = [
  { icon: TrendingUp, title: "Weekly Luxury Market Briefing", desc: "Sales velocity, days on market, price-per-square-foot trends, and absorption rates for the luxury tier in your target markets — every Monday." },
  { icon: Map, title: "Migration & Demand Signals", desc: "Where high-net-worth buyers are moving from, what's driving relocation decisions, and which markets are accumulating demand before it shows up in MLS data." },
  { icon: Users, title: "Buyer Profile Intelligence", desc: "Demographic and psychographic shifts in the luxury buyer pool — what they're prioritizing, what's losing appeal, and how their criteria are changing year over year." },
  { icon: DollarSign, title: "Off-Market Activity Monitoring", desc: "Luxury trades often happen off-market. AI surfaces recorded transactions, estate transfers, and developer activity that doesn't hit the MLS." },
  { icon: BarChart, title: "Inventory & List-to-Sale Analysis", desc: "How overpriced or fairly priced the current luxury inventory is, which properties are sitting and why, and where motivated sellers are likely to emerge." },
  { icon: Zap, title: "Custom Market Configuration", desc: "We configure monitoring for your exact zip codes, price tier, and property type. Not a national report — your market, your tier." },
];

export default function LuxuryRealEstate() {
  const [form, setForm] = useState({ email: "", name: "", company_name: "", markets: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.company_name) { toast.error("Email and company name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-luxury-re-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">Intelligence activated.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">Matt will configure your market monitoring within 24 hours. First weekly briefing arrives Monday.</p>
        <p className="mt-6 text-sm text-muted-foreground">Questions? <a href="tel:+13139921219" className="text-primary font-bold">(313) 992-1219</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Luxury Real Estate Intelligence — $299/mo | M2 Training" description="Weekly luxury market briefing covering sales velocity, migration signals, off-market activity, and buyer profile shifts in your target markets." path="/luxury-re-intel" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <TrendingUp size={11} /> Luxury Market Intelligence
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">See the Luxury Market<br /><span className="text-primary">Before It Moves.</span></h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">In luxury real estate, the difference between a good year and a great year is information timing. AI monitors migration patterns, off-market activity, and buyer demand signals in your market — so you're calling motivated sellers before they list, not after.</p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">$299<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">Weekly briefing · Custom markets · Cancel anytime</p>
            </div>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">
              Get Briefed Weekly <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0"><f.icon size={16} className="text-primary" /></div>
                  <div><p className="font-bold text-sm mb-1">{f.title}</p><p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Market Intelligence</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Configured to your markets within 24 hours. First briefing Monday.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "company_name", label: "Brokerage / Company *", placeholder: "Michels Luxury Realty" },
                { key: "markets", label: "Target Markets *", placeholder: "Grosse Pointe, Birmingham, Rochester Hills..." },
                { key: "name", label: "Your Name *", placeholder: "Jane Smith" },
                { key: "email", label: "Email Address *", placeholder: "jane@brokerage.com", type: "email" },
                { key: "phone", label: "Phone Number", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Get Started — $299/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
