import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";

const TRADES = [
  { slug: "hvac-metro-detroit", trade: "hvac", label: "HVAC", city: "Metro Detroit", state: "MI", monthly: "$399" },
  { slug: "plumbing-metro-detroit", trade: "plumbing", label: "Plumbing", city: "Metro Detroit", state: "MI", monthly: "$399" },
  { slug: "roofing-metro-detroit", trade: "roofing", label: "Roofing", city: "Metro Detroit", state: "MI", monthly: "$399" },
  { slug: "electrical-metro-detroit", trade: "electrical", label: "Electrical", city: "Metro Detroit", state: "MI", monthly: "$399" },
  { slug: "boiler-metro-detroit", trade: "boiler", label: "Boiler / Mechanical", city: "Metro Detroit", state: "MI", monthly: "$399" },
  { slug: "gutters-metro-detroit", trade: "gutters", label: "Gutters / Siding", city: "Metro Detroit", state: "MI", monthly: "$299" },
];

const WINS = [
  "Every lead is exclusive — you're the only contractor who gets it",
  "Leads are real homeowners who searched for your service, filled out a form, and asked to be contacted",
  "You get name, phone, email, and project details in your inbox within minutes",
  "Flat monthly fee — no per-lead charges, no surprises",
  "Cancel anytime — no contracts, no minimums",
];

const PAIN = [
  { label: "Angi / HomeAdvisor", sub: "Same lead sold to 4–8 contractors. You're bidding against yourself." },
  { label: "Thumbtack", sub: "$10–$100/lead, shared. You still compete on price." },
  { label: "Facebook Ads", sub: "You pay for clicks. Most don't convert. Requires constant management." },
  { label: "Word of mouth alone", sub: "Good but unpredictable. Feast or famine." },
];

export default function ContractorLeads() {
  const [selected, setSelected] = useState<typeof TRADES[0] | null>(null);
  const [form, setForm] = useState({ name: "", business_name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { toast.error("Please select a territory first"); return; }
    if (!form.email || !form.name) { toast.error("Name and email are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-contractor-checkout", {
        body: {
          email: form.email,
          name: form.name,
          business_name: form.business_name || form.name,
          phone: form.phone,
          trade: selected.trade,
          city: selected.city,
          state: selected.state,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Try calling (313) 992-1219.");
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
          <h1 className="text-2xl font-black text-foreground mb-3">You're locked in!</h1>
          <p className="text-muted-foreground leading-relaxed">Your territory is reserved. Expect a call from Matt within 24 hours to confirm your lead capture page and go-live date.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? Call or text <a href="tel:+13139921219" className="text-primary font-bold">(313) 992-1219</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Exclusive Contractor Leads — Metro Detroit | Detroit Web Agency"
        description="Exclusive roofing, HVAC, plumbing, and electrical leads in Metro Detroit. No shared leads. One contractor per trade. Flat monthly fee."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Detroit Web Agency</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">Exclusive contractor leads.<br />Metro Detroit. One company per trade.</h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            Every roofing, HVAC, plumbing, and electrical lead generated in Metro Detroit goes <strong className="text-white">only to you</strong>. No Angi. No shared bids. Flat monthly fee — cancel anytime.
          </p>
          <div className="mt-6">
            <a href="tel:+13139921219" className="border border-white/30 text-white px-6 py-3 font-bold text-sm hover:bg-white/10 transition-all inline-flex items-center gap-2">
              <Phone size={14} /> (313) 992-1219
            </a>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">

          {/* Why Not Angi */}
          <h2 className="text-lg font-black text-foreground mb-6 uppercase tracking-wide">Why contractors hate Angi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {PAIN.map((p) => (
              <div key={p.label} className="bg-red-950/20 border border-red-900/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle size={14} className="text-red-500 flex-shrink-0" />
                  <span className="font-bold text-sm text-foreground">{p.label}</span>
                </div>
                <p className="text-[12px] text-muted-foreground">{p.sub}</p>
              </div>
            ))}
          </div>

          {/* Founder Intro */}
          <div className="bg-[#1e293b] text-white p-5 mb-10 flex items-center gap-5">
            <img
              src="/images/matt-family-cornfield.jpg"
              alt="Matt Michels"
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
            <p className="text-sm text-slate-200 leading-relaxed">
              <span className="font-bold text-white">I'm Matt Michels — local guy, dad, Grosse Pointe.</span>{" "}
              I built this because I watched good contractors get killed by Angi's shared lead model. Every lead I send is yours alone.
            </p>
          </div>

          {/* How it works */}
          <h2 className="text-lg font-black text-foreground mb-4 uppercase tracking-wide">How this works</h2>
          <div className="space-y-3 mb-10">
            {WINS.map((w) => (
              <div key={w} className="flex items-start gap-3">
                <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{w}</p>
              </div>
            ))}
          </div>

          {/* Territory Picker + Checkout Form */}
          <h2 className="text-lg font-black text-foreground mb-2 uppercase tracking-wide">Open territories</h2>
          <p className="text-sm text-muted-foreground mb-4">Click your market to claim it. One contractor per trade per city.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {TRADES.map((t) => (
              <button
                key={t.slug}
                onClick={() => setSelected(selected?.slug === t.slug ? null : t)}
                className={`p-4 border text-left transition-all ${
                  selected?.slug === t.slug
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <p className="font-bold text-sm text-foreground">{t.label} — {t.city}, {t.state}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t.monthly}/mo · exclusive territory</p>
                {selected?.slug === t.slug && (
                  <p className="text-[11px] text-primary font-bold mt-1">✓ Selected — fill in your info below</p>
                )}
              </button>
            ))}
          </div>

          {/* Signup Form */}
          <div className="bg-card border border-border p-6">
            <h3 className="font-black text-foreground mb-1">
              {selected ? `Claim ${selected.label} leads in ${selected.city}` : "Select a territory above to get started"}
            </h3>
            {selected && (
              <p className="text-sm text-muted-foreground mb-4">{selected.monthly}/mo — cancel anytime, no contracts</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="First Last"
                    required
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name</label>
                  <input
                    type="text"
                    value={form.business_name}
                    onChange={(e) => setForm(f => ({ ...f, business_name: e.target.value }))}
                    placeholder="Your company name"
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@yourcompany.com"
                    required
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(555) 555-5555"
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !selected}
                className="w-full bg-primary text-white font-bold py-3 text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Opening checkout…</>
                ) : (
                  <>Claim My Territory <ArrowRight size={14} /></>
                )}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                Secure checkout via Stripe. Cancel anytime. First month begins on activation.
              </p>
            </form>
          </div>

          {/* Fallback CTA */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">Prefer to talk first?</p>
            <a href="tel:+13139921219" className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:underline">
              <Phone size={14} /> Call or text Matt — (313) 992-1219
            </a>
          </div>

        </div>
      </div>
    </>
  );
}
