import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Search, MapPin, TrendingUp, Users, Star, ArrowRight, Eye, Target, BarChart2 } from "lucide-react";

const WHAT_YOU_GET = [
  { icon: MapPin, label: "Real Local Data", desc: "Competitors pulled from Google Maps — not a generic list. Their actual ratings, review counts, and locations." },
  { icon: TrendingUp, label: "Review Gap Analysis", desc: "See who's dominating reviews in your market and exactly how many you need to overtake them." },
  { icon: Eye, label: "Positioning Opportunities", desc: "Gaps in the market your competitors aren't covering — niches, areas, and services wide open for you." },
  { icon: Target, label: "Threat Assessment", desc: "Each competitor rated Low / Medium / High threat with specific reasoning — know who to watch." },
  { icon: BarChart2, label: "Market Health Score", desc: "How saturated is your market? How much room is there? Data-driven answer, not a guess." },
  { icon: Star, label: "Top 5 Action Items", desc: "Specific, prioritized moves to gain market share — not generic advice, real actions for your market." },
];

const INDUSTRIES = [
  "HVAC", "Plumbing", "Electrical", "Roofing", "Landscaping", "General Contractor",
  "Auto Repair", "Restaurant", "Dental Practice", "Medical Clinic", "Law Firm",
  "Salon / Spa", "Cleaning Service", "Real Estate", "Gym / Fitness", "Retail Store",
  "Accounting / Tax", "Insurance", "Veterinary", "Other",
];

const TESTIMONIALS = [
  { text: "I had no idea how far behind I was on reviews. This report showed me two competitors with 3x my reviews and told me exactly how to close the gap.", attr: "HVAC contractor, Sterling Heights" },
  { text: "Found out a new competitor opened 2 miles from me that I didn't even know about. The positioning section helped me differentiate immediately.", attr: "Plumber, Warren" },
  { text: "Worth every penny. I used the action items to rewrite my Google profile and got 4 new calls that week.", attr: "Restaurant owner, Royal Oak" },
];

export default function AiCompetitorReport() {
  const [form, setForm] = useState({
    email: "",
    business_name: "",
    industry: "",
    city: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">Your competitor report is being generated.</h1>
          <p className="text-muted-foreground leading-relaxed mb-4">
            We're pulling real data from Google Maps and analyzing your local competition right now. Check your inbox — your report will arrive within 2 minutes. Check spam if you don't see it.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Want us to track competitors automatically? Ask Matt about our <a href="/competitor-watch" className="text-primary font-semibold">weekly competitor tracking service</a>.
          </p>
          <p className="text-xs text-muted-foreground">
            Questions? <a href="tel:3138064952" className="text-primary font-semibold">(313) 806-4952</a> — Matt picks up.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.industry || !form.city) {
      toast.error("Email, industry, and city are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-report-checkout", {
        body: {
          product_type: "competitor_report",
          email: form.email,
          business_name: form.business_name,
          city: form.city,
          industry: form.industry,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Try again or call (313) 806-4952.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="AI Local Competitor Analysis — $9 | Real Google Maps Data | M² Web Design"
        description="Get a data-driven competitor analysis for your local market. Real Google Maps data, review gaps, positioning opportunities, and 5 action items. $9, delivered in 2 minutes."
        path="/ai-competitor-report"
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="pt-16 pb-12 px-6 bg-card border-b border-border">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-5 px-4 py-1.5 rounded-full bg-primary/10 text-primary">
              <MapPin size={13} /> Real data from Google Maps
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-tight mb-4">
              Know exactly who you're<br />
              <span className="text-primary">competing against.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6 max-w-xl mx-auto leading-relaxed">
              We pull your actual competitors from Google Maps — their ratings, review counts, and positioning — then AI analyzes the gaps you can exploit. Real data, not guesswork. $9, delivered in 2 minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> Real Google Maps data</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> 8-10 competitors analyzed</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> Delivered in 2 minutes</span>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-14 grid lg:grid-cols-2 gap-12">
          {/* Form */}
          <div>
            <h2 className="text-xl font-black text-foreground mb-6">Get Your Competitor Report — $9</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Email <span className="text-destructive">*</span></label>
                <input
                  type="email"
                  placeholder="you@yourbusiness.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Business Name</label>
                <input
                  type="text"
                  placeholder="Acme Plumbing"
                  value={form.business_name}
                  onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Industry <span className="text-destructive">*</span></label>
                  <select
                    value={form.industry}
                    onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                    required
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select...</option>
                    {INDUSTRIES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">City / Area <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    placeholder="Sterling Heights, MI"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    required
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg font-black text-sm uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><Search size={16} /> Get My Competitor Report — $9</>}
              </button>
              <p className="text-xs text-center text-muted-foreground">Secure checkout via Stripe. One-time charge, no subscription.</p>
            </form>

            <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/15">
              <p className="text-sm font-semibold text-foreground mb-1">Want weekly competitor tracking?</p>
              <p className="text-xs text-muted-foreground">Our <a href="/competitor-watch" className="text-primary font-semibold underline">Competitor Watch service</a> monitors your market every week and sends you alerts when competitors change pricing, get new reviews, or new businesses enter your territory.</p>
            </div>
          </div>

          {/* What you get */}
          <div>
            <h2 className="text-xl font-black text-foreground mb-6">What's in the report</h2>
            <div className="space-y-4 mb-8">
              {WHAT_YOU_GET.map(item => (
                <div key={item.label} className="flex items-start gap-4 p-4 bg-card rounded-lg border border-border">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 bg-muted/40 rounded-lg border border-border">
              <h3 className="text-sm font-bold text-foreground mb-2">How is this different from Googling it myself?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You could spend 3 hours manually looking up every competitor, counting their reviews, and trying to figure out patterns. Or pay $9 and get a structured analysis with specific action items in 2 minutes. We pull real Google Maps data, not guesses.
              </p>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <section className="py-14 px-6 bg-card border-t border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black text-foreground text-center mb-8">What people say</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {TESTIMONIALS.map(t => (
                <div key={t.attr} className="p-6 bg-background rounded-lg border border-border">
                  <div className="flex gap-0.5 mb-3">{[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" className="text-yellow-500" />)}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic mb-3">"{t.text}"</p>
                  <p className="text-xs font-semibold text-foreground/60">— {t.attr}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA footer */}
        <section className="py-12 px-6 text-center border-t border-border">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-foreground mb-3">Know your competition. Own your market.</h2>
            <p className="text-muted-foreground mb-6">$9. Real data. 2 minutes. No fluff.</p>
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-black text-sm uppercase tracking-wider" style={{ background: "var(--primary)", color: "white" }}>
              Get My Report <ArrowRight size={16} />
            </a>
            <p className="mt-4 text-xs text-muted-foreground">
              Or call Matt: <a href="tel:3138064952" className="font-semibold text-primary">(313) 806-4952</a>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
