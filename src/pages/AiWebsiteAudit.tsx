import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Search, Clock, FileText, TrendingUp, Phone, Star, ArrowRight } from "lucide-react";

const WHAT_WE_CHECK = [
  { icon: TrendingUp, label: "Local SEO Signals", desc: "City/region mentions, Google Business Profile alignment, local keywords" },
  { icon: Search, label: "First Impression & Design", desc: "Visual quality, mobile responsiveness, brand consistency" },
  { icon: FileText, label: "Content & Copy", desc: "Value proposition clarity, calls to action, page structure" },
  { icon: Star, label: "Trust & Credibility", desc: "Reviews, credentials, SSL, photos of real people" },
  { icon: Clock, label: "Speed & Mobile UX", desc: "Load time, tap targets, mobile navigation flow" },
  { icon: CheckCircle, label: "Conversion Optimization", desc: "Phone number prominence, contact forms, next steps for visitors" },
];

const TESTIMONIALS = [
  { text: "Got my audit within 2 minutes. Told me exactly why my site wasn't ranking. Hired Matt the same week.", attr: "HVAC contractor, Sterling Heights" },
  { text: "The report called out things I'd been ignoring for 3 years. Worth every dollar and then some.", attr: "Restaurant owner, Grosse Pointe" },
  { text: "Detailed, honest, no fluff. Actually useful unlike other 'free audits' that just try to upsell you on a subscription.", attr: "Law firm, Detroit" },
];

export default function AiWebsiteAudit() {
  const [form, setForm] = useState({ email: "", business_name: "", business_url: "" });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">Your audit is being generated.</h1>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Check your inbox — your full website audit report will arrive within 60 seconds. Check your spam folder if you don't see it.
          </p>
          <p className="text-sm text-muted-foreground">
            Questions? <a href="tel:3138064952" className="text-primary font-semibold">(313) 806-4952</a> — Matt responds personally.
          </p>
          <a href="/ai-website-audit" className="mt-6 inline-block text-sm text-muted-foreground underline">Run another audit</a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_url) {
      toast.error("Email and website URL are required");
      return;
    }
    // Basic URL validation
    let url = form.business_url.trim();
    if (!url.startsWith("http")) url = "https://" + url;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-report-checkout", {
        body: {
          product_type: "website_audit",
          email: form.email,
          business_name: form.business_name,
          business_url: url,
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
        title="AI Website Audit — $9 | Instant Report | M² Web Design"
        description="Get a full AI-powered website audit delivered to your inbox in 60 seconds. SEO, mobile, trust signals, local ranking, and actionable fixes. $9 flat, no subscription."
        path="/ai-website-audit"
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="pt-16 pb-12 px-6 bg-card border-b border-border">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-5 px-4 py-1.5 rounded-full bg-primary/10 text-primary">
              <Clock size={13} /> Delivered in 60 seconds
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-tight mb-4">
              Find out why your website<br />
              <span className="text-primary">isn't bringing in customers.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6 max-w-xl mx-auto leading-relaxed">
              Enter your URL. Pay $9. Get a full professional audit report in your inbox within 60 seconds — SEO score, design grade, trust signals, mobile check, and the 3 fixes that will actually move the needle.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> No subscription</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> No upsell calls</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> Real report, real fixes</span>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-14 grid lg:grid-cols-2 gap-12">
          {/* Form */}
          <div>
            <h2 className="text-xl font-black text-foreground mb-6">Get Your Audit — $9</h2>
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
                <p className="text-xs text-muted-foreground mt-1.5">Your audit report will be sent here within 60 seconds of payment.</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Business Name</label>
                <input
                  type="text"
                  placeholder="Acme Plumbing"
                  value={form.business_name}
                  onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Website URL <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  placeholder="acmeplumbing.com"
                  value={form.business_url}
                  onChange={e => setForm(f => ({ ...f, business_url: e.target.value }))}
                  required
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg font-black text-sm uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><FileText size={16} /> Get My Audit Report — $9</>}
              </button>
              <p className="text-xs text-center text-muted-foreground">Secure checkout via Stripe. One-time charge, no subscription.</p>
            </form>

            <div className="mt-8 p-4 bg-muted/40 rounded-lg border border-border">
              <p className="text-sm font-semibold text-foreground mb-1">Not ready to pay yet?</p>
              <p className="text-xs text-muted-foreground">Call Matt directly and he'll answer your questions for free: <a href="tel:3138064952" className="text-primary font-semibold">(313) 806-4952</a></p>
            </div>
          </div>

          {/* What's included */}
          <div>
            <h2 className="text-xl font-black text-foreground mb-6">What's in the report</h2>
            <div className="space-y-4">
              {WHAT_WE_CHECK.map(item => (
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

            <div className="mt-6 p-5 bg-primary/5 rounded-lg border border-primary/15">
              <p className="text-sm font-bold text-foreground mb-1">Also included: Top 3 Priority Fixes</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every report ends with the 3 most impactful changes you can make — specific, actionable, prioritized by ROI. Not a generic checklist. Actual recommendations for your site.
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
            <h2 className="text-2xl font-black text-foreground mb-3">Ready to know the truth about your site?</h2>
            <p className="text-muted-foreground mb-6">$9. 60 seconds. No fluff, no upsell call.</p>
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-black text-sm uppercase tracking-wider" style={{ background: "var(--primary)", color: "white" }}>
              Get My Audit <ArrowRight size={16} />
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
