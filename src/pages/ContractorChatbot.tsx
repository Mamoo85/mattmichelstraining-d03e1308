import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, MessageSquare, Clock, PhoneCall, Code2, Star } from "lucide-react";

const FEATURES = [
  { icon: Clock, label: "24/7 lead qualification", sub: "Answers at 2am when you're asleep. Never misses a visitor." },
  { icon: PhoneCall, label: "Captures name + phone", sub: "Walks visitors through service, zip code, budget, then asks for contact info." },
  { icon: MessageSquare, label: "Trained on your business", sub: "Knows your trade, your city, and what questions matter for your jobs." },
  { icon: Code2, label: "One line of code to install", sub: "Paste a snippet in your website footer. Done. No plugins or dashboards." },
];

export default function ContractorChatbot() {
  const [form, setForm] = useState({
    business_name: "",
    business_type: "",
    city: "",
    name: "",
    email: "",
    phone: "",
  });
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
          <p className="text-muted-foreground leading-relaxed">
            Matt will reach out within 24 hours to set up your chatbot, configure it for your business, and send you the embed code to drop on your site.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) {
      toast.error("Business name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-chatbot-checkout", {
        body: form,
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Contractor AI Chatbot — Close Leads 24/7 | M² Training"
        description="AI-powered chat widget for contractor websites. Qualifies visitors, captures name and phone, and emails you leads — even at 2am. $149/month."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="bg-[#1e293b] text-white px-6 py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest">
              Contractor AI Chatbot
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-5">
              Your website closes leads at 2am.<br />Even when you're asleep.
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed mb-8">
              A smart chat widget that qualifies every visitor, asks the right questions, and sends you a lead with their name, phone number, and project details — automatically.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-3xl font-black text-[#e8621a]">$149</span>
              <span className="text-slate-400 text-lg">/month</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 text-sm">Cancel anytime</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-16 max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <div key={f.label} className="border border-border rounded-xl p-5 flex gap-4 items-start">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon size={20} className="text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm mb-1">{f.label}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Embed Code Preview */}
        <section className="px-6 pb-12 max-w-3xl mx-auto">
          <div className="bg-[#1e293b] rounded-xl p-6">
            <p className="text-xs font-bold text-[#e8621a] uppercase tracking-widest mb-3">Install in 60 seconds</p>
            <p className="text-slate-300 text-sm mb-4">Paste this one line before your closing <code className="text-[#e8621a]">&lt;/body&gt;</code> tag. That's it.</p>
            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto select-all">
              {`<script src="https://www.mattmichelstraining.com/chatbot.js" data-client-id="YOUR_CLIENT_ID" defer></script>`}
            </div>
            <p className="text-slate-500 text-xs mt-3">Your unique client ID is emailed to you after signup. Works on any website — WordPress, Wix, Squarespace, or custom.</p>
          </div>
        </section>

        {/* Social Proof */}
        <section className="px-6 pb-12 max-w-3xl mx-auto">
          <div className="bg-muted/50 rounded-xl p-6 border border-border">
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(i => <Star key={i} size={14} fill="#e8621a" className="text-[#e8621a]" />)}
            </div>
            <p className="text-foreground text-sm leading-relaxed italic mb-4">
              "I was getting traffic but nobody was calling. Three days after installing this, I got two booked jobs from people who chatted at 11pm. Worth every penny."
            </p>
            <p className="text-muted-foreground text-xs font-semibold">— Roofing contractor, Metro Detroit</p>
          </div>
        </section>

        {/* Signup Form */}
        <section className="px-6 pb-20 max-w-lg mx-auto">
          <div className="border border-border rounded-2xl p-8">
            <h2 className="text-xl font-black text-foreground mb-2">Get your chatbot set up</h2>
            <p className="text-muted-foreground text-sm mb-6">Matt will configure it for your specific trade and city, then send you the code to paste on your site.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                name="business_name"
                value={form.business_name}
                onChange={handleChange}
                placeholder="Business name *"
                required
                className="border border-input rounded-lg px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                name="business_type"
                value={form.business_type}
                onChange={handleChange}
                placeholder="Trade (roofing, HVAC, plumbing…)"
                className="border border-input rounded-lg px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="City you serve"
                className="border border-input rounded-lg px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                className="border border-input rounded-lg px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email address *"
                required
                className="border border-input rounded-lg px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone (optional)"
                className="border border-input rounded-lg px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-white font-bold rounded-lg py-3.5 text-sm flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>Start for $149/mo <ArrowRight size={16} /></>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Secure checkout via Stripe. Cancel anytime.
              </p>
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Questions? Text or call Matt at{" "}
            <a href="tel:+13138064952" className="text-primary font-semibold">(313) 806-4952</a>
          </p>
        </section>

      </div>
    </>
  );
}
