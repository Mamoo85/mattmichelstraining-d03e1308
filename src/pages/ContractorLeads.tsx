import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, CheckCircle, Zap, DollarSign, XCircle, ArrowRight, Loader2 } from "lucide-react";

const TRADES = [
  { slug: "roofing-chicago", trade: "Roofing", city: "Chicago", state: "IL", monthly: "$399", spots: 1 },
  { slug: "hvac-columbus", trade: "HVAC", city: "Columbus", state: "OH", monthly: "$399", spots: 1 },
  { slug: "plumbing-phoenix", trade: "Plumbing", city: "Phoenix", state: "AZ", monthly: "$399", spots: 1 },
  { slug: "electrical-dallas", trade: "Electrical", city: "Dallas", state: "TX", monthly: "$399", spots: 1 },
  { slug: "roofing-charlotte", trade: "Roofing", city: "Charlotte", state: "NC", monthly: "$299", spots: 1 },
  { slug: "hvac-denver", trade: "HVAC", city: "Denver", state: "CO", monthly: "$299", spots: 1 },
  { slug: "plumbing-nashville", trade: "Plumbing", city: "Nashville", state: "TN", monthly: "$299", spots: 1 },
  { slug: "gutters-atlanta", trade: "Gutters / Siding", city: "Atlanta", state: "GA", monthly: "$299", spots: 1 },
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
  const [form, setForm] = useState({ name: "", business_name: "", email: "", phone: "", trade: "", city: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.trade || !form.city) { toast.error("Fill in all fields"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-contractor-checkout", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Exclusive Contractor Leads — Any City in the US | M² Lead Network"
        description="Exclusive roofing, HVAC, plumbing, and electrical leads in your market. No shared leads. One contractor per trade per city. Flat monthly fee."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero Banner */}
        <div className="w-full">
          <img
            src="/images/hero-contractor-leads.png"
            alt="Contractor Lead System — Exclusive leads in your city"
            className="w-full object-cover"
          />
        </div>
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² Lead Network</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">Exclusive contractor leads.<br />One company per city.</h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            Every roofing, HVAC, plumbing, and electrical lead generated in your market goes <strong className="text-white">only to you</strong>. No Angi. No shared bids. Flat monthly fee — cancel anytime.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <a href="#signup" className="bg-primary text-white px-6 py-3 font-bold text-sm hover:opacity-90 transition-all">
              Claim Your Territory →
            </a>
            <a href="tel:+13138064952" className="border border-white/30 text-white px-6 py-3 font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-2">
              <Phone size={14} /> (313) 806-4952
            </a>
          </div>
        </div>

        {/* Why Not Angi */}
        <div className="max-w-3xl mx-auto px-6 py-12">
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

          <h2 className="text-lg font-black text-foreground mb-4 uppercase tracking-wide">How this works</h2>
          <div className="space-y-3 mb-10">
            {WINS.map((w) => (
              <div key={w} className="flex items-start gap-3">
                <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{w}</p>
              </div>
            ))}
          </div>

          {/* Open Territories */}
          <h2 className="text-lg font-black text-foreground mb-4 uppercase tracking-wide">Open territories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
            {TRADES.map((t) => (
              <div key={t.slug} className="bg-card border border-border p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-foreground">{t.trade} — {t.city}, {t.state}</p>
                  <p className="text-[11px] text-green-500 font-bold mt-0.5">● {t.spots} spot available</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-primary">{t.monthly}</p>
                  <p className="text-[10px] text-muted-foreground">/month</p>
                </div>
              </div>
            ))}
          </div>

          {/* Signup Form — PAUSED */}
          <div id="signup" className="bg-card border border-border p-6">
            <h2 className="text-base font-black text-foreground mb-1 uppercase tracking-wide">Claim your territory</h2>
            <div className="bg-muted/40 border border-border rounded p-5 text-center space-y-2">
              <p className="text-sm font-bold text-foreground">Currently accepting waitlist only</p>
              <p className="text-[12px] text-muted-foreground">We're onboarding a limited number of contractors in select markets. Drop your info and Matt will reach out personally when your area opens up.</p>
              <a href="mailto:matt@mattmichelstraining.com?subject=Contractor Leads Waitlist" className="inline-block mt-2 bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                Join the Waitlist →
              </a>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name</label>
                  <input
                    value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    placeholder="John Smith" required
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name</label>
                  <input
                    value={form.business_name} onChange={e => setForm(f => ({...f, business_name: e.target.value}))}
                    placeholder="Smith Roofing Co."
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    placeholder="you@yourbusiness.com" required
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    placeholder="(313) 555-0100"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Trade</label>
                  <select
                    value={form.trade} onChange={e => setForm(f => ({...f, trade: e.target.value}))} required
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="">Select your trade</option>
                    <option value="roofing">Roofing</option>
                    <option value="hvac">HVAC</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="gutters">Gutters / Siding</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Target City</label>
                  <input
                    value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
                    placeholder="e.g. Chicago, Dallas, Atlanta…" required
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <button
                type="submit" disabled={submitting}
                className="w-full bg-primary text-primary-foreground py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? "Processing..." : "Claim This Territory →"}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">Questions first? Email <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
