import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileText, Scale, Clock, Shield, Home, Zap } from "lucide-react";

const LETTER_TYPES = [
  "Late rent notice",
  "Non-payment / pay or quit",
  "Lease violation warning",
  "Move-out notice",
  "Repair refusal response",
  "Lease renewal offer",
  "Eviction warning",
  "Security deposit itemization",
  "Entry notice",
  "Pet violation",
];

const FEATURES = [
  {
    icon: Scale,
    title: "State-Specific Legal Language",
    desc: "Every letter is generated with your state's required notice periods, proper statutory citations, and legally appropriate language. Michigan requires different notice than Texas — the AI knows both.",
  },
  {
    icon: Clock,
    title: "90-Second Turnaround",
    desc: "Describe the situation in plain English. The AI asks any clarifying questions, then generates a complete, professional letter. Ready to print, email, or certify-mail.",
  },
  {
    icon: FileText,
    title: "Full Correspondence Log",
    desc: "Every letter you generate is saved with the property address, tenant name, date, and situation summary. One click to regenerate or download a PDF. Your complete paper trail.",
  },
  {
    icon: Shield,
    title: "Next Steps Included",
    desc: "Every letter includes a plain-English 'what happens next' section — what you can legally do if the tenant doesn't respond, and what timeline applies in your state.",
  },
  {
    icon: Home,
    title: "Unlimited Properties",
    desc: "One flat monthly rate covers all your properties. Whether you have 2 units or 200, every letter is included. No per-letter fees, no document credits to manage.",
  },
  {
    icon: CheckCircle,
    title: "Works for Every Situation",
    desc: "Late rent, non-payment, lease violations, move-out notices, repair refusal, lease renewals, eviction warnings, security deposit disputes — if it needs a letter, it's covered.",
  },
];

const COMPARISON = [
  { tool: "Real estate attorney", price: "$150–400 per letter", what: "Best legal accuracy — 3–5 day turnaround, billable by the hour", highlight: false },
  { tool: "LegalZoom", price: "$300+ per document", what: "Template-based — not state-specific, not situation-specific", highlight: false },
  { tool: "Landlord Studio", price: "$12–36/mo", what: "Property management software — no letter generation at all", highlight: false },
  { tool: "DIY / Google", price: "1–3 hrs per letter", what: "Wrong notice period = letter thrown out. One mistake = restart eviction.", highlight: false },
  { tool: "M² Landlord Letters", price: "$149/mo unlimited", what: "State-compliant letters in 90 sec — any situation, all properties", highlight: true },
];

export default function LandlordLetters() {
  const [form, setForm] = useState({ email: "", name: "", phone: "", state: "", propertyCount: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) { toast.error("Name and email are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-landlord-letters-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">You're ready to generate letters.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Matt will send you access within 24 hours. Your first letter can be ready in 90 seconds — just describe the situation and the AI handles the rest.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Questions? <a href="tel:+13138064952" className="text-primary font-medium">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Landlord-Tenant Letter Generator — State-Compliant Letters in 90 Seconds | $149/mo"
        description="Describe the situation in plain English. Get a legally-appropriate landlord letter with your state's required notice periods in 90 seconds. Unlimited letters, all properties. $149/mo."
        path="/landlord-letters"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Scale size={11} /> Landlord Letter Generator
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Describe the situation.<br />
              <span className="text-primary">Get a state-compliant letter in 90 seconds.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              One wrong notice period and your eviction starts over from zero. One attorney letter costs $200. This system generates legally-appropriate, state-specific correspondence in the time it takes to read this sentence — for any situation, unlimited.
            </p>
            <div className="mb-10">
              <div className="text-5xl font-black text-primary">$149<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground mt-1">Unlimited letters · All properties · 7-day free trial</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Generating Letters <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Letter types */}
        <section className="py-8 px-4 border-b border-border bg-card">
          <div className="max-w-4xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-center mb-4">Letter Types Covered</p>
            <div className="flex flex-wrap justify-center gap-2">
              {LETTER_TYPES.map((t) => (
                <span key={t} className="px-3 py-1 border border-border text-xs font-medium text-muted-foreground rounded-full">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* The risk section */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="border border-border rounded-lg p-8">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-4">Why This Matters</p>
              <p className="text-lg font-black mb-4 leading-snug">
                A landlord in Ohio sends a 3-day pay-or-quit notice. Ohio requires 5 days. The judge dismisses the case. He starts the eviction process over — six weeks and $800 in court fees lost.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This isn't rare. It happens constantly. Every state has different notice requirements for different situations — and they change. This system stays current and generates letters that hold up, every time.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">What You Get</p>
              <h2 className="text-2xl sm:text-3xl font-black">A legal toolkit that runs itself.</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">The Alternatives</p>
              <h2 className="text-2xl sm:text-3xl font-black">What landlords usually pay.</h2>
            </div>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-5 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div>
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.what}</p>
                  </div>
                  <div className={`text-base font-black whitespace-nowrap ml-4 ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sign up */}
        <section id="signup" className="py-20 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black mb-2">Start Your 7-Day Free Trial</h2>
              <p className="text-muted-foreground text-sm">$149/mo after trial. Unlimited letters, all properties. Cancel anytime.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "name", label: "Your Name *", placeholder: "Mike Tanner", type: "text" },
                { key: "email", label: "Email Address *", placeholder: "mike@tannerproperties.com", type: "email" },
                { key: "phone", label: "Mobile Phone *", placeholder: "(313) 555-0100", type: "tel" },
                { key: "state", label: "Your State *", placeholder: "Michigan", type: "text" },
                { key: "propertyCount", label: "Number of Rental Properties *", placeholder: "12", type: "number" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    min={f.type === "number" ? "1" : undefined}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $149/mo After"}
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">Secure checkout via Stripe. No card charged for 7 days.</p>
          </div>
        </section>

      </div>
    </>
  );
}
