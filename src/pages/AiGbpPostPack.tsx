import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, MapPin, Clock, FileText, Star, ArrowRight, Calendar, Zap } from "lucide-react";

const SAMPLE_POSTS = [
  { type: "Service Highlight", text: "Did you know most homeowners wait too long to service their HVAC system? Spring is the perfect time to schedule a tune-up before the heat hits. We're booking now — call us or visit our website to get on the schedule." },
  { type: "Customer Tip", text: "Quick tip from our team: change your air filter every 90 days — or 60 if you have pets. A clean filter keeps your system running efficiently and your energy bill lower. Any questions about your system? We're always happy to take a look." },
  { type: "Local Connection", text: "Proud to serve Sterling Heights and the surrounding communities for over 15 years. There's nothing better than helping our neighbors stay comfortable year-round. Thank you to everyone who's trusted us with their home." },
];

export default function AiGbpPostPack() {
  const [form, setForm] = useState({
    email: "",
    business_name: "",
    business_type: "",
    city: "",
    differentiators: "",
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
          <h1 className="text-2xl font-black text-foreground mb-3">Your 30 posts are on the way.</h1>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Check your inbox — 30 ready-to-use Google Business Profile posts will arrive within 2 minutes. Check spam if you don't see it.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Want us to post automatically every week for you? Our <a href="/local-marketing" className="text-primary font-semibold">GBP Autopilot is $49/month</a>.
          </p>
          <p className="text-xs text-muted-foreground">
            Questions? <a href="tel:3138064952" className="text-primary font-semibold">(313) 806-4952</a>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name || !form.business_type) {
      toast.error("Email, business name, and business type are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-report-checkout", {
        body: {
          product_type: "gbp_post_pack",
          email: form.email,
          business_name: form.business_name,
          industry: form.business_type,
          city: form.city,
          business_info: form.differentiators,
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
        title="30 AI-Written Google Business Profile Posts — $19 | M² Web Design"
        description="Get 30 ready-to-publish Google Business Profile posts written specifically for your business. 3 months of content, delivered to your inbox instantly. $19 flat."
        path="/ai-gbp-post-pack"
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="pt-16 pb-12 px-6 bg-card border-b border-border">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-5 px-4 py-1.5 rounded-full bg-primary/10 text-primary">
              <Zap size={13} /> 30 posts for your specific business
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-tight mb-4">
              3 months of Google posts,<br />
              <span className="text-primary">written for you. $19.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6 max-w-xl mx-auto leading-relaxed">
              Google rewards businesses that post consistently. Most don't. We'll generate 30 on-brand, locally-relevant posts for your specific business — ready to copy and paste into your Google Business Profile.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> Written for your business specifically</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> Delivered in under 2 minutes</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-primary" /> No subscription</span>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-14 grid lg:grid-cols-2 gap-12">
          {/* Form */}
          <div>
            <h2 className="text-xl font-black text-foreground mb-6">Get Your 30 Posts — $19</h2>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Business Name <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    placeholder="Acme Plumbing"
                    value={form.business_name}
                    onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                    required
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Business Type <span className="text-destructive">*</span></label>
                  <select
                    value={form.business_type}
                    onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}
                    required
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select…</option>
                    {["HVAC", "Plumbing", "Electrical", "Roofing", "Landscaping", "Restaurant", "Dental Practice", "Medical Clinic", "Law Firm", "Auto Repair", "Salon / Spa", "Cleaning Service", "Real Estate", "Contractor / Builder", "Retail Store", "Fitness / Gym", "Other"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">City / Location</label>
                <input
                  type="text"
                  placeholder="Sterling Heights, MI"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">What makes your business stand out?</label>
                <textarea
                  placeholder="e.g. Family-owned 20+ years, same-day service, licensed and insured, free estimates…"
                  rows={3}
                  value={form.differentiators}
                  onChange={e => setForm(f => ({ ...f, differentiators: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1.5">The more you tell us, the more specific and on-brand your posts will be.</p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg font-black text-sm uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Calendar size={16} /> Get My 30 Posts — $19</>}
              </button>
              <p className="text-xs text-center text-muted-foreground">Secure checkout via Stripe. One-time charge, no subscription.</p>
            </form>

            <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/15">
              <p className="text-sm font-semibold text-foreground mb-1">Want hands-free posting instead?</p>
              <p className="text-xs text-muted-foreground">Our <a href="/local-marketing" className="text-primary font-semibold underline">GBP Autopilot service ($49/mo)</a> posts to your Google Business Profile automatically every Mon, Wed, and Fri. No work required.</p>
            </div>
          </div>

          {/* Sample + what you get */}
          <div>
            <h2 className="text-xl font-black text-foreground mb-2">Sample posts</h2>
            <p className="text-sm text-muted-foreground mb-5">These are real examples — written in a human, local tone that performs on Google.</p>
            <div className="space-y-4 mb-8">
              {SAMPLE_POSTS.map(p => (
                <div key={p.type} className="p-4 bg-card rounded-lg border border-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">{p.type}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.text}</p>
                </div>
              ))}
            </div>

            <div className="p-5 bg-muted/40 rounded-lg border border-border">
              <h3 className="text-sm font-bold text-foreground mb-3">What you get for $19</h3>
              <ul className="space-y-2">
                {[
                  "30 complete, ready-to-publish posts",
                  "Mix of 8 post types (service, tip, local, FAQ, etc.)",
                  "Each post references your city naturally",
                  "Varied CTAs so it doesn't get repetitive",
                  "Delivered to your inbox in under 2 minutes",
                  "Copy/paste straight into Google Business Profile",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle size={14} className="text-primary mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* CTA footer */}
        <section className="py-12 px-6 text-center border-t border-border bg-card">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-foreground mb-3">Start posting consistently. $19.</h2>
            <p className="text-muted-foreground mb-6">30 posts. 3 months of content. Instant delivery.</p>
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-black text-sm uppercase tracking-wider" style={{ background: "var(--primary)", color: "white" }}>
              Get My Posts <ArrowRight size={16} />
            </a>
            <p className="mt-4 text-xs text-muted-foreground">
              Questions? <a href="tel:3138064952" className="font-semibold text-primary">(313) 806-4952</a> — Matt picks up.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
