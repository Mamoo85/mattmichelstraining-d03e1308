import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, FileText, AlertTriangle, Clock, CheckCircle, Scale, ArrowRight, Loader2, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Clock,
    title: "90-Second Letter Generation",
    desc: "Describe the violation in plain English — 'tenant parked on grass again' — and get a fully formatted, legally-compliant formal notice with cure period, escalation language, and CC&R citation placeholders in 90 seconds.",
  },
  {
    icon: Scale,
    title: "State-Specific Legal Language Built In",
    desc: "Notice periods, statutory cure timelines, and required disclosures vary by state. Every letter generated uses the correct language for your state so you're not guessing.",
  },
  {
    icon: AlertTriangle,
    title: "Full Escalation Track Included",
    desc: "Every violation starts a complete escalation workflow: First Notice → Written Warning → Fine Notice → Legal Action Referral. Letters are consistent and defensible at every stage.",
  },
  {
    icon: FileText,
    title: "All Letters Logged Automatically",
    desc: "Every letter generated is logged with date, property address, violation type, and current status. Full audit trail if it ever goes to a hearing or court.",
  },
  {
    icon: CheckCircle,
    title: "Works for Every Violation Type",
    desc: "Parking, landscaping, noise complaints, unauthorized architectural changes, rental restrictions, pool rules, trash/recycling violations, unapproved signage — all covered.",
  },
  {
    icon: Shield,
    title: "Defensible, Professional, Consistent",
    desc: "Letters follow a proven legal structure every time. No more inconsistent enforcement that opens your HOA to discrimination claims. Every homeowner gets the same professional notice.",
  },
];

const COMPARISON = [
  { tool: "HOA attorneys", price: "$150–300/letter", what: "Per-letter billing, 1-3 day turnaround, still requires you to explain the situation" },
  { tool: "HOA management companies", price: "$200–500/mo bundle", what: "Bundled services you may not need, limited letter volume, slow response" },
  { tool: "CC&R template sites", price: "$50–100/template", what: "Static templates that still require manual drafting and legal review" },
  { tool: "M² HOA Violation Letters", price: "$149/mo unlimited", what: "AI-generated in 90 seconds, state-specific, full escalation track, all violations logged", highlight: true },
];

export default function HOAViolation() {
  const [form, setForm] = useState({ email: "", name: "", hoaName: "", phone: "", state: "MI" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.hoaName) {
      toast.error("Email and HOA name are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-hoa-violation-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">You're all set.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Matt will reach out within 24 hours to complete setup. Your violation letter portal goes live within 48 hours — then every letter runs on autopilot.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Questions? Call or text{" "}
          <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="HOA Violation Letter Generator — $149/mo | M² Training"
        description="Describe any HOA violation in plain English. Get a legally-compliant formal letter with state-specific notice periods and full escalation language in 90 seconds."
        path="/hoa-violation"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Shield size={11} /> HOA Violation Letters
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Describe the Violation.<br />
              <span className="text-primary">Get the Letter. 90 Seconds.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Stop paying attorneys $200 per letter or spending an hour hunting CC&R clauses.
              Type what happened in plain English and get a legally-compliant violation notice with state-specific cure periods, proper escalation language, and CC&R citation placeholders — ready to send in 90 seconds.
            </p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">
                $149<span className="text-xl text-muted-foreground font-normal">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground">Unlimited letters · 7-day free trial · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Pain Bridge */}
        <section className="py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              The average HOA board member spends{" "}
              <span className="text-foreground font-bold">4-6 hours per month</span>{" "}
              drafting and tracking violation notices. At $150+ per attorney letter, an active community with{" "}
              <span className="text-foreground font-bold">20 violations/month spends $3,000+</span>{" "}
              in legal fees alone — before a single hearing.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
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
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">The Real Cost of Alternatives</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">If you send 10 attorney letters per month, you're spending $1,500–$3,000. We're $149.</p>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    c.highlight ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex-1 pr-4">
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-sm font-black whitespace-nowrap ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>
                    {c.price}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your 7-Day Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              No charge today. Your violation letter portal is live within 48 hours. Cancel anytime.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "hoaName", label: "HOA or Community Name *", placeholder: "Lakewood Estates HOA" },
                { key: "name", label: "Your Name *", placeholder: "Jane Smith" },
                { key: "email", label: "Email Address *", placeholder: "jane@lakewoodestateshoa.com", type: "email" },
                { key: "phone", label: "Phone Number *", placeholder: "(313) 555-0100", type: "tel" },
                { key: "state", label: "Your State *", placeholder: "MI" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type || "text"}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $149/mo After"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">7-day free trial. No card charged today.</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
