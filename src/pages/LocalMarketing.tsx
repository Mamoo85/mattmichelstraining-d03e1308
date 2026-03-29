import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Phone, Star, Calendar, Mail } from "lucide-react";

const PLANS = [
  {
    key: "basic",
    name: "Basic",
    price: "$49",
    per: "/month",
    description: "3 posts per week to your Google Business Profile, on autopilot.",
    includes: [
      "3 AI-written GBP posts per week",
      "Rotates seasonal & relevant content",
      "Keeps your profile active & ranking",
      "Cancel anytime",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$99",
    per: "/month",
    description: "GBP posts + weekly review request emails to your customers.",
    includes: [
      "Everything in Basic",
      "Weekly review request emails to your customers",
      "Increases Google review count over time",
      "Higher ranking + more trust signals",
    ],
    featured: true,
  },
];

const FAQS = [
  { q: "Do I need to do anything?", a: "After a one-time setup (5 minutes to connect your Google Business Profile), you don't touch it. Posts go out automatically every Monday, Wednesday, and Friday." },
  { q: "What does the AI post about?", a: "Relevant, local content: seasonal tips, service reminders, local shout-outs, and 'did you know' facts specific to your trade and city. It reads like a real post, not spam." },
  { q: "How do the review requests work?", a: "Once you share your customer email list, we send a short, friendly review request email each Sunday on your behalf. No spam, just a polite ask with a direct link to leave a Google review." },
  { q: "Does this actually help my Google ranking?", a: "Yes. Google's algorithm rewards consistent activity on your Business Profile. Active profiles rank higher in the local map pack — which is where most local searches click first." },
  { q: "Can I cancel?", a: "Any time, no questions asked. Cancel before your next billing date and you won't be charged again." },
];

export default function LocalMarketing() {
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [form, setForm] = useState({ email: "", business_name: "", contact_name: "", phone: "", business_type: "", city: "", state: "MI" });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're all set.</h1>
          <p className="text-muted-foreground leading-relaxed">Matt will reach out within 24 hours to connect your Google Business Profile and get your first posts scheduled.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) { toast.error("Business name and email are required"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gbp-checkout", {
        body: { ...form, plan: selectedPlan },
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
        title="Automated Google Business Profile Posts — $49/month | M² Local Marketing"
        description="We post to your Google Business Profile 3x a week, automatically. Stay active, rank higher, get more calls. $49/month, cancel anytime."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² Local Marketing</p>
          <h1 className="text-3xl font-black mb-4">We post to your Google profile.<br />You focus on the work.</h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            3 AI-written Google Business Profile posts per week, automatically. Your profile stays active, your local ranking improves, and your phone rings more — without touching it yourself.
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Why GBP matters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 text-center">
            {[
              { icon: Star, label: "Higher Google ranking", sub: "Active profiles appear first in map searches" },
              { icon: Calendar, label: "Consistent presence", sub: "Google rewards businesses that post regularly" },
              { icon: Mail, label: "More reviews (Pro)", sub: "Automated review requests = more 5-star ratings" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-card border border-border p-5">
                <Icon size={20} className="text-primary mx-auto mb-3" />
                <p className="font-bold text-sm text-foreground mb-1">{label}</p>
                <p className="text-[12px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          {/* Plans */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Choose a plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {PLANS.map(plan => (
              <button
                key={plan.key}
                onClick={() => setSelectedPlan(plan.key)}
                className={`text-left p-5 border-2 transition-all ${selectedPlan === plan.key ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}
              >
                {plan.featured && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded mb-2 inline-block">Most Popular</span>
                )}
                <div className="flex items-end justify-between mb-2">
                  <p className="font-black text-foreground text-base">{plan.name}</p>
                  <p className="text-xl font-black text-primary">{plan.price}<span className="text-xs text-muted-foreground font-normal">{plan.per}</span></p>
                </div>
                <p className="text-[12px] text-muted-foreground mb-3">{plan.description}</p>
                <div className="space-y-1.5">
                  {plan.includes.map(i => (
                    <div key={i} className="flex items-center gap-2 text-[12px] text-foreground">
                      <CheckCircle size={11} className="text-primary flex-shrink-0" /> {i}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Signup form */}
          <div className="bg-card border border-border p-6 mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">Get Started — {PLANS.find(p => p.key === selectedPlan)?.price}/month</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name *</label>
                  <input value={form.business_name} onChange={e => setForm(f => ({...f, business_name: e.target.value}))} required placeholder="Smith Plumbing Co."
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name</label>
                  <input value={form.contact_name} onChange={e => setForm(f => ({...f, contact_name: e.target.value}))} placeholder="John Smith"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                  <input type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="you@business.com"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="(313) 555-0100"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Type</label>
                  <input value={form.business_type} onChange={e => setForm(f => ({...f, business_type: e.target.value}))} placeholder="Plumber, HVAC, Roofer…"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">City</label>
                  <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="Detroit, Warren, Troy…"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? "Processing…" : `Start ${PLANS.find(p => p.key === selectedPlan)?.name} Plan →`}
              </button>
            </form>
          </div>

          {/* FAQs */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Common questions</h2>
          <div className="space-y-4 mb-8">
            {FAQS.map(faq => (
              <div key={faq.q} className="border-b border-border pb-4">
                <p className="font-bold text-sm text-foreground mb-1.5">{faq.q}</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-muted-foreground text-center">Questions? Email <a href="mailto:matt@m2training.com" className="text-primary">matt@m2training.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    </>
  );
}
