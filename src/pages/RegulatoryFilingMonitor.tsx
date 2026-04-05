import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Shield, FileText, Clock, AlertTriangle, Eye } from "lucide-react";

const FEATURES = [
  { icon: Eye, title: "Federal Register Scanning", desc: "We monitor the Federal Register daily for new rules, proposed regulations, and enforcement actions tied to your NAICS codes." },
  { icon: Shield, title: "State EPA Monitoring", desc: "Automated scraping of your state's environmental agency for new compliance requirements affecting your operations." },
  { icon: FileText, title: "Auto-Draft Compliance Filings", desc: "AI drafts filing responses for critical and high-impact regulations. You approve with one click from your inbox." },
  { icon: Clock, title: "Deadline Management", desc: "Every filing deadline is tracked with automatic reminders at 30, 14, 7, 3, and 1 day before due dates." },
  { icon: AlertTriangle, title: "Critical SMS Alerts", desc: "When a critical regulation hits, you get an immediate text — no waiting for your next email check." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Tell Us Your NAICS Codes", desc: "Enter your manufacturing NAICS codes and state(s) of operation. We configure your monitoring immediately." },
  { step: "02", title: "We Scan Daily", desc: "Every morning we check the Federal Register and your state EPA portal for new regulations matching your industry." },
  { step: "03", title: "You Approve & File", desc: "Get a daily digest, auto-drafted filings, and one-click approval from your inbox. Never miss a deadline." },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function RegulatoryFilingMonitor() {
  const [form, setForm] = useState({
    customer_email: "",
    customer_name: "",
    company_name: "",
    naics_codes: "",
    state: "MI",
    additional_states: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_email || !form.company_name) {
      toast.error("Company name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-reg-filing-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
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
          <h1 className="text-2xl font-black text-foreground mb-3">You're all set!</h1>
          <p className="text-muted-foreground leading-relaxed">Your Regulatory Filing Monitor is now active. You'll receive your first scan results within 24 hours.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? Text Matt at <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Regulatory Filing Monitor — Automated Compliance for Manufacturers | $497/mo"
        description="AI-powered Federal Register and state EPA monitoring for manufacturers. Auto-draft filings, deadline tracking, one-click approval. $497/mo."
        path="/regulatory-filing-monitor"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Shield size={11} /> Compliance Automation
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Never Miss a<br /><span className="text-primary">Filing Deadline Again</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              AI monitors the Federal Register and your state EPA daily. Auto-drafts compliance filings. Sends deadline reminders. You just approve from your inbox.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$497<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">For manufacturers · Cancel anytime</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90"
            >
              Start Monitoring <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-card border border-border p-5 rounded-sm">
                  <Icon size={20} className="text-primary mb-3" />
                  <p className="font-bold text-sm mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((s) => (
                <div key={s.step} className="text-center">
                  <div className="text-3xl font-black text-primary/20 mb-2">{s.step}</div>
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sign-Up Form */}
        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Compliance Monitor</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">$497/mo — secure checkout via Stripe.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input type="text" placeholder="Company Name *" required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <input type="text" placeholder="Your Name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <input type="email" placeholder="Email *" required value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <input type="text" placeholder="NAICS Codes (comma-separated, e.g. 332710, 336111)" value={form.naics_codes} onChange={(e) => setForm({ ...form, naics_codes: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none">
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <input type="text" placeholder="Additional States (comma-separated, optional)" value={form.additional_states} onChange={(e) => setForm({ ...form, additional_states: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <input type="tel" placeholder="Phone (for SMS alerts)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>Get Started <ArrowRight size={14} /></>}
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">Powered by Stripe. Cancel anytime. Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 border-t border-border text-center text-xs text-muted-foreground">
          M² Performance Training &middot; Grosse Pointe, MI &middot; <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a>
        </footer>
      </div>
    </>
  );
}
