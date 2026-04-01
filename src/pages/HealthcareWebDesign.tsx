import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Heart, Calendar, Users, Search, Smartphone, MapPin } from "lucide-react";

const PLANS = [
  {
    key: "standard",
    name: "Standard",
    setup: "$1,499",
    monthly: "$99/mo",
    description: "Professional site for clinics, PT offices, and solo practices.",
    includes: [
      "8-page custom website",
      "Appointment request form",
      "Services & conditions page",
      "Provider bio",
      "Google SEO + local schema",
      "Mobile-first design",
      "Cancel anytime",
    ],
  },
  {
    key: "professional",
    name: "Pro",
    setup: "$2,499",
    monthly: "$149/mo",
    description: "Multi-provider clinics needing full patient experience.",
    includes: [
      "Everything in Standard",
      "Multi-provider bio pages",
      "Insurance accepted page",
      "Patient testimonials",
      "Blog / health articles (SEO)",
      "Google Analytics + call tracking",
      "Priority support",
    ],
    featured: true,
  },
];

const FEATURES = [
  { icon: Calendar, label: "Appointment requests", sub: "Let new patients request visits online — any time of day" },
  { icon: Heart, label: "Services pages", sub: "Dedicated pages for each condition and treatment you offer" },
  { icon: Users, label: "Provider bios", sub: "Build trust with detailed provider profiles and credentials" },
  { icon: Search, label: "Local SEO", sub: "Rank for 'physical therapy near me' and condition searches" },
  { icon: MapPin, label: "Location + directions", sub: "Google Maps integration and clear parking/access info" },
  { icon: Smartphone, label: "Mobile-first", sub: "Most patients search on their phone — your site is ready" },
];

const FAQS = [
  { q: "What types of healthcare practices do you build for?", a: "Physical therapy, chiropractic, urgent care, sports medicine, occupational therapy, acupuncture, mental health, and most other outpatient clinical practices." },
  { q: "Do I need to provide content?", a: "We handle copywriting and SEO. You provide provider photos, your list of services/conditions, and any specialties you want highlighted." },
  { q: "How long does the build take?", a: "Standard sites are live within 10–14 days. Pro sites with multiple providers take 2–3 weeks." },
  { q: "Will patients actually find this on Google?", a: "Yes — we build local SEO schema, condition-specific landing pages, and Google Business Profile optimization so patients searching for your specialty in your city find you first." },
];

export default function HealthcareWebDesign() {
  const [selectedPlan, setSelectedPlan] = useState("standard");
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    business_type: "Healthcare Practice",
    city: "",
    state: "MI",
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
          <p className="text-muted-foreground leading-relaxed">Matt will reach out within 24 hours to kick off your healthcare practice website build.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) { toast.error("Practice name and email are required"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-web-design-checkout", {
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

  const currentPlan = PLANS.find(p => p.key === selectedPlan);

  return (
    <>
      <SEOHead
        title="Healthcare Practice Website Design — $1,499 Setup | M² Web Design"
        description="Professional websites for PT clinics, chiropractic offices, and healthcare practices. Appointment forms, provider bios, and local SEO. From $1,499 + $99/mo."
      />
      <div className="min-h-screen bg-background text-foreground">
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² Web Design — Healthcare Practices</p>
          <h1 className="text-3xl font-black mb-4">New patients search Google before they call.<br />Make sure your practice shows up.</h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            We build patient-converting websites for healthcare practices — with appointment request forms, provider bios, condition-specific pages, and local SEO that puts you at the top of search.
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">What's built in</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 text-center">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-card border border-border p-5">
                <Icon size={20} className="text-primary mx-auto mb-3" />
                <p className="font-bold text-sm text-foreground mb-1">{label}</p>
                <p className="text-[12px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

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
                <p className="font-black text-foreground text-base mb-0.5">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <p className="text-xl font-black text-primary">{plan.setup}</p>
                  <span className="text-xs text-muted-foreground font-normal">setup + {plan.monthly}</span>
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

          <div className="bg-card border border-border p-6 mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">
              Get Started — {currentPlan?.setup} setup + {currentPlan?.monthly}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Practice Name *</label>
                  <input value={form.business_name} onChange={e => setForm(f => ({...f, business_name: e.target.value}))} required placeholder="Metro PT & Rehab"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name</label>
                  <input value={form.contact_name} onChange={e => setForm(f => ({...f, contact_name: e.target.value}))} placeholder="Dr. Jane Smith"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                  <input type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="you@clinic.com"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="(313) 555-0100"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">City</label>
                  <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="Detroit, Troy, Ann Arbor…"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? "Processing…" : `Start ${currentPlan?.name} Plan →`}
              </button>
            </form>
          </div>

          <div className="bg-card border border-border p-5 mb-10 flex items-start gap-4">
            <img src="/images/matt-family-cornfield.jpg" alt="Matt Michels" className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0" />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">I'm Matt Michels — Grosse Pointe, MI.</span> I build websites for local healthcare professionals who want to grow their patient base without paying agency rates. You get a real person, direct cell, no runaround.
            </p>
          </div>

          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Common questions</h2>
          <div className="space-y-4 mb-8">
            {FAQS.map(faq => (
              <div key={faq.q} className="border-b border-border pb-4">
                <p className="font-bold text-sm text-foreground mb-1.5">{faq.q}</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-muted-foreground text-center">Questions? Email <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    </>
  );
}
